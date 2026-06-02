'use client'

/**
 * captureStore — Zustand store for the Capture-View gallery.
 *
 * Source of truth: PostgreSQL via /api/parts/{id}/captures. The store is
 * a client-side mirror that drives the UI. Every mutation goes through
 * the backend; on success the local state is updated to match.
 *
 * Strategy:
 *   · capture()       → POST → on success, add to local state
 *   · remove()        → DELETE → on success, drop from local state + revoke URL
 *   · updateCaption() → optimistic local update + PATCH; rollback on failure
 *   · reorder()       → optimistic local reorder + POST /reorder; rollback on failure
 *   · loadForPart()   → GET list + parallel image fetch → replace local state
 *
 * MEMORY HYGIENE: every capture's previewUrl is a blob URL created here
 * via URL.createObjectURL. The store is the SINGLE owner and MUST revoke
 * every URL when it leaves the array (remove, replace-on-reload, cleanup).
 *
 * Loading state: per-part, exposed so the gallery can show a spinner.
 */

import { create } from 'zustand'
import { api, type CaptureRead } from '@/lib/api'
import type { Capture, CameraState, ViewSettings } from '../types/capture.types'

interface CaptureState {
  /** Captures for the currently-loaded part. */
  captures: Capture[]
  /** The part_id whose captures are currently loaded, or null if nothing loaded. */
  loadedPartId: string | null
  /** True while we're hydrating from the server. */
  loading: boolean
  /** Last error from a load/upload/delete/reorder, surfaced to the user. */
  error: string | null

  /** Load every persisted capture for a part. Replaces local state. */
  loadForPart: (partId: string, partName: string, partVersion?: string) => Promise<void>

  /** Push a freshly-uploaded capture (already round-tripped through the server). */
  addPersisted: (capture: Capture) => void

  /** Delete from server, then local. */
  remove: (id: string) => Promise<void>

  /** Reorder locally first (snappy DnD), then persist. Rolls back on failure. */
  reorder: (fromIdx: number, toIdx: number) => Promise<void>

  /** Edit caption optimistically, persist, rollback on failure. */
  updateCaption: (id: string, caption: string) => Promise<void>

  /** Wipe local + delete every persisted capture for the current part. */
  clear: () => Promise<void>

  /** Called on part-page unmount — releases every blob URL. Does NOT touch the server. */
  cleanup: () => void
}

function revokeUrlSafe(url: string): void {
  try {
    URL.revokeObjectURL(url)
  } catch {
    // No-op — older browsers may throw on already-revoked URLs.
  }
}

function cameraStateFromServer(raw: Record<string, unknown> | null): CameraState | null {
  if (raw === null) return null
  // The server stores whatever shape we sent. Coerce safely.
  const num = (v: unknown): number | null => (typeof v === 'number' ? v : null)
  const tgt = raw.target as { x?: unknown; y?: unknown; z?: unknown } | null | undefined
  const target =
    tgt !== null && tgt !== undefined && typeof tgt === 'object'
      ? {
          x: typeof tgt.x === 'number' ? tgt.x : 0,
          y: typeof tgt.y === 'number' ? tgt.y : 0,
          z: typeof tgt.z === 'number' ? tgt.z : 0,
        }
      : null
  return {
    alpha: num(raw.alpha),
    beta: num(raw.beta),
    radius: num(raw.radius),
    target,
  }
}

/** Unpack the optional view settings sub-object that may be nested under
 * the camera_state JSON. Returns undefined for older captures that
 * predate the Restore View feature — Restore handles that gracefully. */
function viewSettingsFromServer(raw: Record<string, unknown> | null): ViewSettings | undefined {
  if (raw === null) return undefined
  const v = raw.view as Record<string, unknown> | undefined
  if (v === undefined || v === null || typeof v !== 'object') return undefined
  const settings: ViewSettings = {}
  if (v.cameraMode === 'perspective' || v.cameraMode === 'orthographic') {
    settings.cameraMode = v.cameraMode
  }
  if (v.shadingMode === 'shaded' || v.shadingMode === 'wireframe' || v.shadingMode === 'shadedEdges') {
    settings.shadingMode = v.shadingMode
  }
  if (typeof v.gridVisible === 'boolean') settings.gridVisible = v.gridVisible
  if (typeof v.axesVisible === 'boolean') settings.axesVisible = v.axesVisible
  if (typeof v.explodeFactor === 'number') settings.explodeFactor = v.explodeFactor
  if (typeof v.pmiVisible === 'boolean') settings.pmiVisible = v.pmiVisible
  const sp = v.sectionPlane as { axis?: unknown; offset?: unknown } | null | undefined
  if (sp === null) {
    settings.sectionPlane = null
  } else if (sp !== undefined && typeof sp === 'object') {
    if ((sp.axis === 'X' || sp.axis === 'Y' || sp.axis === 'Z') && typeof sp.offset === 'number') {
      settings.sectionPlane = { axis: sp.axis, offset: sp.offset }
    }
  }
  return settings
}

/** Server CaptureRead → local Capture (after fetching the bytes). */
async function hydrate(
  server: CaptureRead,
  partName: string,
  partVersion: string | undefined,
): Promise<Capture> {
  const blob = await api.captures.fetchImageBlob(server.id)
  const previewUrl = URL.createObjectURL(blob)
  return {
    id: server.id,
    previewUrl,
    blob,
    caption: server.caption,
    width: server.width,
    height: server.height,
    capturedAt: server.created_at,
    camera: cameraStateFromServer(server.camera_state),
    view: viewSettingsFromServer(server.camera_state),
    partId: server.part_id,
    partName,
    partVersion,
  }
}

export const useCaptureStore = create<CaptureState>((set, get) => ({
  captures: [],
  loadedPartId: null,
  loading: false,
  error: null,

  loadForPart: async (partId, partName, partVersion) => {
    // If we're already loaded for this part, no-op. Reloads happen via
    // explicit clear() or part-id change.
    const state = get()
    if (state.loadedPartId === partId && !state.loading) return

    // Revoke any prior URLs before replacing state.
    for (const c of state.captures) revokeUrlSafe(c.previewUrl)
    set({ captures: [], loadedPartId: partId, loading: true, error: null })

    try {
      const list = await api.captures.list(partId)
      // Hydrate (fetch bytes) in parallel. For 20+ captures, sequential
      // would noticeably stall the panel.
      const hydrated = await Promise.all(
        list.map((c) => hydrate(c, partName, partVersion)),
      )
      // Guard against a part-id change mid-load: only commit if we're
      // still loading for this part.
      if (get().loadedPartId !== partId) {
        // Stale load — revoke what we just minted and bail.
        for (const c of hydrated) revokeUrlSafe(c.previewUrl)
        return
      }
      set({ captures: hydrated, loading: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load captures'
      set({ loading: false, error: message })
    }
  },

  addPersisted: (capture) =>
    set((s) => ({ captures: [...s.captures, capture], error: null })),

  remove: async (id) => {
    const { captures } = get()
    const victim = captures.find((c) => c.id === id)
    if (victim === undefined) return
    // Optimistic — drop locally first so the UI feels instant.
    set({ captures: captures.filter((c) => c.id !== id) })
    try {
      await api.captures.delete(id)
      revokeUrlSafe(victim.previewUrl)
    } catch (err) {
      // Rollback: put it back at its original index (closest approximation).
      set((s) => {
        if (s.captures.some((c) => c.id === id)) return s
        return { captures: [...s.captures, victim] }
      })
      const message = err instanceof Error ? err.message : 'Failed to delete capture'
      set({ error: message })
    }
  },

  reorder: async (fromIdx, toIdx) => {
    const { captures, loadedPartId } = get()
    if (
      loadedPartId === null ||
      fromIdx === toIdx ||
      fromIdx < 0 ||
      toIdx < 0 ||
      fromIdx >= captures.length ||
      toIdx >= captures.length
    ) {
      return
    }
    // Optimistic local reorder.
    const next = [...captures]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved!)
    set({ captures: next })

    const orderedIds = next.map((c) => c.id)
    try {
      await api.captures.reorder(loadedPartId, orderedIds)
    } catch (err) {
      // Rollback to the prior order.
      set({ captures, error: err instanceof Error ? err.message : 'Failed to reorder' })
    }
  },

  updateCaption: async (id, caption) => {
    const { captures } = get()
    const prev = captures.find((c) => c.id === id)
    if (prev === undefined || prev.caption === caption) return
    // Optimistic.
    set({
      captures: captures.map((c) => (c.id === id ? { ...c, caption } : c)),
    })
    try {
      await api.captures.update(id, { caption })
    } catch (err) {
      // Rollback to the prior caption.
      set((s) => ({
        captures: s.captures.map((c) => (c.id === id ? { ...c, caption: prev.caption } : c)),
        error: err instanceof Error ? err.message : 'Failed to save caption',
      }))
    }
  },

  clear: async () => {
    const { captures } = get()
    if (captures.length === 0) return
    // Delete each on the server. If any fail, we still wipe the rest;
    // the user can refresh and the survivors will reappear.
    const ids = captures.map((c) => c.id)
    const results = await Promise.allSettled(ids.map((id) => api.captures.delete(id)))
    for (const c of captures) revokeUrlSafe(c.previewUrl)
    set({ captures: [] })
    const failures = results.filter((r) => r.status === 'rejected').length
    if (failures > 0) {
      set({ error: `${failures} capture${failures === 1 ? '' : 's'} could not be deleted` })
    }
  },

  cleanup: () => {
    const { captures } = get()
    for (const c of captures) revokeUrlSafe(c.previewUrl)
    // Don't reset state — the next mount of the same part can re-hydrate.
    // The blob URLs are dead, so on remount loadForPart will rebuild them.
    set({ captures: [], loadedPartId: null })
  },
}))
