/**
 * ModelCache — IndexedDB persistence for processed STEP/GLB models.
 *
 * Stores the tessellated geometry (Float32Array / Uint32Array buffers) and
 * assembly tree so the expensive OC WASM step can be skipped on re-open.
 *
 * Cache key = filename + fileSize (cheap, no hashing needed for typical use).
 * Each entry also stores the original file bytes so the file can be fully
 * re-processed if needed, but the primary use case is loading from cache.
 */

import type { StepPart, StepTreeNode, ExtractionStats, PMIAnnotation } from './babylon/StepWorker'

const DB_NAME    = 'aes-3d-viewer'
const DB_VERSION = 8               // bumped: PMI annotations
const STORE_META = 'model_meta'    // { id, name, size, processedAt, partCount }
const STORE_DATA = 'model_data'    // { id, parts (serialized), tree }

// ── Serialized forms (ArrayBuffers survive IDB structured clone) ──────────────

interface SerializedPart {
  name:            string
  color:           string | null
  instanceId:      string
  positions:       ArrayBuffer
  normals:         ArrayBuffer
  indices:         ArrayBuffer
  edgePositions:   ArrayBuffer
  edgeIndices:     ArrayBuffer
  edgeGroupStarts: ArrayBuffer
}

export interface CachedModel {
  id:          string           // `${name}::${size}`
  name:        string           // original filename
  size:        number           // file size in bytes
  processedAt: number           // Date.now()
  partCount:   number
  parts:       SerializedPart[]
  tree:        StepTreeNode[]
  stats?:      ExtractionStats
  pmi:         PMIAnnotation[]
}

export interface ModelMeta {
  id:          string
  name:        string
  size:        number
  processedAt: number
  partCount:   number
  stats?:      ExtractionStats
}

// ── DB open ───────────────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      // Delete existing stores on any version upgrade so stale entries are cleared.
      // (The "create if absent" pattern never fires on upgrades — stores already exist.)
      for (const name of [STORE_META, STORE_DATA]) {
        if (db.objectStoreNames.contains(name)) db.deleteObjectStore(name)
        db.createObjectStore(name, { keyPath: 'id' })
      }
    }
    req.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result)
    req.onerror   = () => reject(req.error)
  })
}

// ── Public API ────────────────────────────────────────────────────────────────

export function cacheKey(name: string, size: number): string {
  return `${name}::${size}`
}

/** Store processed model in IndexedDB. Fire-and-forget — errors are swallowed. */
export async function saveToCache(
  fileName: string,
  fileSize: number,
  parts: StepPart[],
  tree: StepTreeNode[],
  stats?: ExtractionStats,
  pmi: PMIAnnotation[] = [],
): Promise<void> {
  try {
    const db = await openDB()
    const id = cacheKey(fileName, fileSize)

    const serializedParts: SerializedPart[] = parts.map(p => ({
      name:          p.name,
      color:         p.color,
      instanceId:    p.instanceId,
      positions:     p.positions.buffer.slice(0),
      normals:       p.normals.buffer.slice(0),
      indices:       p.indices.buffer.slice(0),
      edgePositions:   p.edgePositions.buffer.slice(0),
      edgeIndices:     p.edgeIndices.buffer.slice(0),
      edgeGroupStarts: p.edgeGroupStarts.buffer.slice(0),
    }))

    const meta: ModelMeta = { id, name: fileName, size: fileSize, processedAt: Date.now(), partCount: parts.length, stats }
    const data: CachedModel = { id, name: fileName, size: fileSize, processedAt: Date.now(), partCount: parts.length, parts: serializedParts, tree, stats, pmi }

    await idbPut(db, STORE_META, meta)
    await idbPut(db, STORE_DATA, data)
    db.close()
  } catch (err) {
    console.warn('[ModelCache] save failed:', err)
  }
}

/** Load a cached model by filename + size. Returns null on miss. */
export async function loadFromCache(
  fileName: string,
  fileSize: number,
): Promise<{ parts: StepPart[]; tree: StepTreeNode[]; stats?: ExtractionStats; pmi: PMIAnnotation[] } | null> {
  try {
    const db   = await openDB()
    const id   = cacheKey(fileName, fileSize)
    const data = await idbGet<CachedModel>(db, STORE_DATA, id)
    db.close()
    if (!data) return null

    const parts: StepPart[] = data.parts.map(p => ({
      name:          p.name,
      color:         p.color,
      instanceId:    p.instanceId ?? '',
      positions:     new Float32Array(p.positions),
      normals:       new Float32Array(p.normals),
      indices:       new Uint32Array(p.indices),
      edgePositions:   new Float32Array(p.edgePositions),
      edgeIndices:     new Uint32Array(p.edgeIndices),
      edgeGroupStarts: new Uint32Array(p.edgeGroupStarts ?? new ArrayBuffer(0)),
    }))

    return { parts, tree: data.tree, stats: data.stats, pmi: data.pmi ?? [] }
  } catch (err) {
    console.warn('[ModelCache] load failed:', err)
    return null
  }
}

/** Return all cached model metadata, newest first. */
export async function listCachedModels(): Promise<ModelMeta[]> {
  try {
    const db    = await openDB()
    const items = await idbGetAll<ModelMeta>(db, STORE_META)
    db.close()
    return items.sort((a, b) => b.processedAt - a.processedAt)
  } catch {
    return []
  }
}

/** Delete a single cache entry. */
export async function deleteCachedModel(id: string): Promise<void> {
  try {
    const db = await openDB()
    await Promise.all([idbDelete(db, STORE_META, id), idbDelete(db, STORE_DATA, id)])
    db.close()
  } catch (err) {
    console.warn('[ModelCache] delete failed:', err)
  }
}

/** Delete all cached models. */
export async function clearCache(): Promise<void> {
  try {
    const db = await openDB()
    await Promise.all([idbClear(db, STORE_META), idbClear(db, STORE_DATA)])
    db.close()
  } catch (err) {
    console.warn('[ModelCache] clear failed:', err)
  }
}

// ── IDB promise wrappers ──────────────────────────────────────────────────────

function idbPut(db: IDBDatabase, store: string, value: unknown): Promise<void> {
  return new Promise((res, rej) => {
    const tx  = db.transaction(store, 'readwrite')
    const req = tx.objectStore(store).put(value)
    req.onsuccess = () => res()
    req.onerror   = () => rej(req.error)
  })
}

function idbGet<T>(db: IDBDatabase, store: string, key: string): Promise<T | undefined> {
  return new Promise((res, rej) => {
    const tx  = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).get(key)
    req.onsuccess = () => res(req.result as T | undefined)
    req.onerror   = () => rej(req.error)
  })
}

function idbGetAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((res, rej) => {
    const tx  = db.transaction(store, 'readonly')
    const req = tx.objectStore(store).getAll()
    req.onsuccess = () => res(req.result as T[])
    req.onerror   = () => rej(req.error)
  })
}

function idbDelete(db: IDBDatabase, store: string, key: string): Promise<void> {
  return new Promise((res, rej) => {
    const tx  = db.transaction(store, 'readwrite')
    const req = tx.objectStore(store).delete(key)
    req.onsuccess = () => res()
    req.onerror   = () => rej(req.error)
  })
}

function idbClear(db: IDBDatabase, store: string): Promise<void> {
  return new Promise((res, rej) => {
    const tx  = db.transaction(store, 'readwrite')
    const req = tx.objectStore(store).clear()
    req.onsuccess = () => res()
    req.onerror   = () => rej(req.error)
  })
}
