'use client'

/**
 * captureStore — Zustand store for the Capture-View gallery.
 *
 * In-memory only (capture data is heavy + ephemeral). When you reload the
 * page, the gallery is empty by design. Persisting to localStorage would
 * pin tens of megabytes per part in the browser's quota; if we want true
 * persistence later, the right move is to upload each capture's blob to
 * S3/Postgres-bytea via /api/captures and rehydrate by id.
 *
 * MEMORY HYGIENE: every capture holds an Object URL via URL.createObjectURL.
 * The store is the SINGLE owner of those URLs and MUST revoke them when:
 *   · a capture is removed → revoke its URL
 *   · the store is cleared → revoke every URL
 *   · the part-page unmounts → call cleanup()
 * Forget any of these and we leak the underlying blob in memory forever.
 */

import { create } from 'zustand'
import type { Capture } from '../types/capture.types'

interface CaptureState {
  captures: Capture[]
  add: (capture: Capture) => void
  remove: (id: string) => void
  reorder: (fromIdx: number, toIdx: number) => void
  updateCaption: (id: string, caption: string) => void
  clear: () => void
  /** Called on part-page unmount — releases every Object URL. */
  cleanup: () => void
}

function revokeUrlSafe(url: string): void {
  try {
    URL.revokeObjectURL(url)
  } catch {
    // No-op — older browsers may throw on already-revoked URLs.
  }
}

export const useCaptureStore = create<CaptureState>((set, get) => ({
  captures: [],

  add: (capture) =>
    set((s) => ({ captures: [...s.captures, capture] })),

  remove: (id) =>
    set((s) => {
      const victim = s.captures.find((c) => c.id === id)
      if (victim !== undefined) revokeUrlSafe(victim.previewUrl)
      return { captures: s.captures.filter((c) => c.id !== id) }
    }),

  reorder: (fromIdx, toIdx) =>
    set((s) => {
      if (
        fromIdx === toIdx ||
        fromIdx < 0 ||
        toIdx < 0 ||
        fromIdx >= s.captures.length ||
        toIdx >= s.captures.length
      ) {
        return s
      }
      const next = [...s.captures]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      return { captures: next }
    }),

  updateCaption: (id, caption) =>
    set((s) => ({
      captures: s.captures.map((c) => (c.id === id ? { ...c, caption } : c)),
    })),

  clear: () => {
    const { captures } = get()
    for (const c of captures) revokeUrlSafe(c.previewUrl)
    set({ captures: [] })
  },

  cleanup: () => {
    const { captures } = get()
    for (const c of captures) revokeUrlSafe(c.previewUrl)
    // Don't reset state — leaving the array intact lets the next mount of
    // the same part see its captures. The Object URLs are gone though, so
    // the user would need to re-capture. (Acceptable trade for hygiene.)
  },
}))
