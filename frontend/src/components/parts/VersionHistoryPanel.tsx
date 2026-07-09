'use client'

/**
 * VersionHistoryPanel — dropdown showing the latest 10 auto-saved
 * snapshots of the current (partId, tabId) doc. Click "Restore" to swap
 * the editor content back to that snapshot.
 *
 * Design: a right-aligned dropdown from the toolbar, not a full sidebar,
 * to keep the doc area unchanged. Users can compare a version's char
 * count and timestamp at a glance to decide which to restore.
 */

import { useEffect, useRef } from 'react'
import { Clock, RotateCcw, Trash2, X } from 'lucide-react'
import { clearVersions, type DocVersion } from './docVersions'

interface Props {
  partId: string
  tabId: string
  versions: DocVersion[]
  onRestore: (v: DocVersion) => void
  onClose: () => void
  /** Re-fetch versions after we clear — parent controls the state. */
  onVersionsChanged: () => void
}

function fmtAge(iso: string): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const min = Math.max(0, Math.round((Date.now() - t) / 60_000))
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  if (min < 1440) return `${Math.round(min / 60)}h ago`
  return `${Math.round(min / 1440)}d ago`
}

function fmtWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export default function VersionHistoryPanel({
  partId,
  tabId,
  versions,
  onRestore,
  onClose,
  onVersionsChanged,
}: Props): JSX.Element {
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    const onDown = (e: MouseEvent): void => {
      const t = e.target as Node | null
      if (rootRef.current !== null && t !== null && !rootRef.current.contains(t)) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown, true)
    }
  }, [onClose])

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Version history"
      className="dv-anim-pop absolute right-0 top-9 z-30 w-[320px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-slate-500" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Version history
          </span>
          <span className="ml-1 text-[10px] text-slate-400">
            ({versions.length})
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close version history"
          className="flex h-5 w-5 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="dv-thin-scroll max-h-[300px] overflow-y-auto">
        {versions.length === 0 ? (
          <p className="px-3 py-6 text-center text-[11px] text-slate-500">
            No snapshots yet. Autosave takes one every 30 seconds while
            you're editing.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {versions.map((v, i) => (
              <li
                key={v.createdAt}
                className="flex items-center gap-2 px-3 py-2 transition hover:bg-slate-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-slate-900">
                    {i === 0 ? 'Current — most recent snapshot' : fmtWhen(v.createdAt)}
                  </p>
                  <p className="text-[10.5px] text-slate-500">
                    {fmtAge(v.createdAt)} · {v.charCount.toLocaleString()} chars
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRestore(v)}
                  disabled={i === 0}
                  aria-label={
                    i === 0
                      ? 'This is the current version'
                      : `Restore version from ${fmtWhen(v.createdAt)}`
                  }
                  title={
                    i === 0
                      ? "You're on this version"
                      : `Restore this version — current content is saved as a new snapshot first`
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10.5px] font-semibold text-slate-700 transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                  Restore
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {versions.length > 0 && (
        <div className="flex items-center justify-end border-t border-slate-100 bg-slate-50/40 px-3 py-1.5">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Delete all version snapshots for this doc?')) {
                clearVersions(partId, tabId)
                onVersionsChanged()
              }
            }}
            className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-slate-500 transition hover:text-rose-600"
          >
            <Trash2 className="h-2.5 w-2.5" />
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
