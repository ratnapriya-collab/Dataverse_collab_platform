'use client'

/**
 * useBookmarks — per-project widget bookmark store backed by localStorage.
 *
 * The Project Overview cards each carry a Bookmark menu item; the Pins tab
 * surfaces whatever the user has pinned. Storage lives under
 * `dataverse.bookmarks.{projectId}` and survives reloads.
 */

import { useCallback, useEffect, useState } from 'react'

const STORAGE_PREFIX = 'dataverse.bookmarks.'

function keyFor(projectId: string): string {
  return STORAGE_PREFIX + projectId
}

export interface BookmarksApi {
  bookmarks: string[]
  isBookmarked: (id: string) => boolean
  toggle: (id: string) => void
}

export function useBookmarks(projectId: string): BookmarksApi {
  const [bookmarks, setBookmarks] = useState<string[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(keyFor(projectId))
      if (raw !== null) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setBookmarks(parsed.filter((x): x is string => typeof x === 'string'))
      } else {
        setBookmarks([])
      }
    } catch {
      setBookmarks([])
    }
  }, [projectId])

  const persist = useCallback(
    (next: string[]) => {
      if (typeof window === 'undefined') return
      try {
        window.localStorage.setItem(keyFor(projectId), JSON.stringify(next))
      } catch {
        // localStorage may be unavailable (private mode, quota); silent fail is fine.
      }
    },
    [projectId],
  )

  const toggle = useCallback(
    (id: string) => {
      setBookmarks((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        persist(next)
        return next
      })
    },
    [persist],
  )

  const isBookmarked = useCallback((id: string) => bookmarks.includes(id), [bookmarks])

  return { bookmarks, isBookmarked, toggle }
}
