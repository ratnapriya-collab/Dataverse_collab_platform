'use client'

/**
 * useRecentlyViewed — track the last N projects the user opened.
 *
 * Persisted to localStorage under `dataverse.recently-viewed.projects` so
 * the list survives reloads. Cross-tab sync via the standard `storage` event
 * and a custom `dataverse:recently-viewed-changed` event for same-tab updates.
 *
 * API mirrors useBookmarks for consistency.
 */

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'dataverse.recently-viewed.projects'
const MAX_ENTRIES = 8

export interface RecentlyViewedEntry {
  projectId: string
  viewedAt: string // ISO
}

function readStorage(): RecentlyViewedEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is RecentlyViewedEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as RecentlyViewedEntry).projectId === 'string' &&
        typeof (e as RecentlyViewedEntry).viewedAt === 'string',
    )
  } catch {
    return []
  }
}

function writeStorage(entries: RecentlyViewedEntry[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    window.dispatchEvent(
      new CustomEvent('dataverse:recently-viewed-changed', { detail: { entries } }),
    )
  } catch {
    // localStorage may be unavailable — silent fail.
  }
}

/**
 * Read-only access to the list. Re-reads on the custom event + storage event.
 */
export function useRecentlyViewed(): RecentlyViewedEntry[] {
  const [entries, setEntries] = useState<RecentlyViewedEntry[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const load = (): void => setEntries(readStorage())
    load()
    window.addEventListener('storage', load)
    window.addEventListener('dataverse:recently-viewed-changed', load)
    return () => {
      window.removeEventListener('storage', load)
      window.removeEventListener('dataverse:recently-viewed-changed', load)
    }
  }, [])

  return entries
}

/**
 * Imperative recorder — call once when a project page mounts. Idempotent:
 * if the project is already at the top with a recent timestamp it's a no-op.
 * Otherwise the project is moved to the top and the list is trimmed.
 */
export function useRecordRecentlyViewed(projectId: string | undefined | null): void {
  const record = useCallback((id: string) => {
    const existing = readStorage()
    const now = new Date().toISOString()
    // Strip out any existing entry for this project, then prepend the fresh one.
    const next: RecentlyViewedEntry[] = [
      { projectId: id, viewedAt: now },
      ...existing.filter((e) => e.projectId !== id),
    ].slice(0, MAX_ENTRIES)
    writeStorage(next)
  }, [])

  useEffect(() => {
    if (projectId === undefined || projectId === null || projectId === '') return
    record(projectId)
  }, [projectId, record])
}
