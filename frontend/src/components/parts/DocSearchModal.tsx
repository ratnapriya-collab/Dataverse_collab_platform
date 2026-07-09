'use client'

/**
 * DocSearchModal — Ctrl+K / Cmd+K global search across every doc saved
 * to localStorage.
 *
 * Scans keys under `dataverse.doc.*` (skipping the `*.type` and
 * `*.versions.*` metadata siblings), strips HTML to plain text, matches
 * the query case-insensitively, and lists hits with a snippet + click-to-
 * navigate. The router push lands the user on that part's Doc tab.
 *
 * Not full-text-indexed — a linear scan through localStorage is plenty
 * for hundreds of docs and keeps zero dependencies.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Search, X } from 'lucide-react'

interface DocHit {
  partId: string
  tabId: string
  storageKey: string
  snippet: string
  matchCount: number
}

interface Props {
  onClose: () => void
}

const STORAGE_PREFIX = 'dataverse.doc.'

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildSnippet(text: string, query: string): string {
  if (query === '') return text.slice(0, 140) + (text.length > 140 ? '…' : '')
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx < 0) return text.slice(0, 140) + (text.length > 140 ? '…' : '')
  const start = Math.max(0, idx - 40)
  const end = Math.min(text.length, idx + query.length + 100)
  return (
    (start > 0 ? '…' : '') +
    text.slice(start, end) +
    (end < text.length ? '…' : '')
  )
}

function countMatches(text: string, query: string): number {
  if (query === '') return 0
  const q = query.toLowerCase()
  let count = 0
  let from = 0
  const lower = text.toLowerCase()
  while (true) {
    const i = lower.indexOf(q, from)
    if (i < 0) break
    count++
    from = i + q.length
  }
  return count
}

export default function DocSearchModal({ onClose }: Props): JSX.Element {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const hits = useMemo<DocHit[]>(() => {
    if (typeof window === 'undefined') return []
    const results: DocHit[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k === null) continue
      if (!k.startsWith(STORAGE_PREFIX)) continue
      // Skip metadata siblings — `*.type` and `*.versions.*`.
      if (k.endsWith('.type')) continue
      if (k.includes('.versions.')) continue
      const raw = window.localStorage.getItem(k)
      if (raw === null || raw.trim() === '') continue
      // Parse the key back into (partId, tabId).
      const rest = k.slice(STORAGE_PREFIX.length)
      const lastDot = rest.lastIndexOf('.')
      if (lastDot < 0) continue
      const partId = rest.slice(0, lastDot)
      const tabId = rest.slice(lastDot + 1)
      const text = stripHtml(raw)
      if (q.trim() !== '' && !text.toLowerCase().includes(q.toLowerCase())) continue
      results.push({
        partId,
        tabId,
        storageKey: k,
        snippet: buildSnippet(text, q.trim()),
        matchCount: countMatches(text, q.trim()),
      })
    }
    // Sort: exact-match count desc, then partId for stability.
    results.sort((a, b) => b.matchCount - a.matchCount || a.partId.localeCompare(b.partId))
    return results
  }, [q])

  // Clamp active idx as list changes.
  useEffect(() => {
    setActiveIdx((i) => (hits.length === 0 ? 0 : Math.min(i, hits.length - 1)))
  }, [hits.length])
  useEffect(() => setActiveIdx(0), [q])

  const openHit = (h: DocHit): void => {
    onClose()
    // Navigate to the doc + hint the active tab via ?tab=<id>.
    router.push(`/parts/${h.partId}/doc?tab=${h.tabId}`)
  }

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => (hits.length === 0 ? 0 : (i + 1) % hits.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => (hits.length === 0 ? 0 : (i - 1 + hits.length) % hits.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (hits[activeIdx] !== undefined) openHit(hits[activeIdx]!)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search across all docs"
      onKeyDown={handleKey}
      className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/50 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="dv-anim-pop mt-[10vh] w-[620px] max-w-[95vw] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="relative border-b border-slate-100">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search every document in your workspace…"
            className="w-full border-0 py-3 pl-11 pr-11 text-[14px] focus:outline-none focus:ring-0"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="dv-thin-scroll max-h-[60vh] overflow-y-auto">
          {hits.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12px] text-slate-500">
              {q.trim() === ''
                ? 'Start typing to search every doc across the workspace.'
                : `No matches for "${q.trim()}"`}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {hits.map((h, i) => (
                <li key={h.storageKey}>
                  <button
                    type="button"
                    onClick={() => openHit(h)}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={[
                      'flex w-full items-start gap-3 px-4 py-3 text-left transition',
                      i === activeIdx ? 'bg-primary-50' : 'hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-900">
                        <span className="truncate">{h.partId}</span>
                        <span className="text-slate-300">·</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0 font-mono text-[10px] text-slate-600">
                          {h.tabId}
                        </span>
                        {h.matchCount > 0 && (
                          <span className="ml-auto rounded-full bg-primary/10 px-2 py-0 text-[10px] font-bold text-primary">
                            {h.matchCount}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-slate-500">
                        {h.snippet}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-3 py-1.5 text-[10px] text-slate-500">
          <span>
            <kbd className="rounded border border-slate-300 bg-white px-1 py-0.5 font-mono">↑</kbd>
            <kbd className="ml-1 rounded border border-slate-300 bg-white px-1 py-0.5 font-mono">↓</kbd>
            <span className="ml-1.5">navigate</span>
            <kbd className="ml-3 rounded border border-slate-300 bg-white px-1 py-0.5 font-mono">Enter</kbd>
            <span className="ml-1.5">open</span>
            <kbd className="ml-3 rounded border border-slate-300 bg-white px-1 py-0.5 font-mono">Esc</kbd>
            <span className="ml-1.5">close</span>
          </span>
          <span>{hits.length} result{hits.length === 1 ? '' : 's'}</span>
        </div>
      </div>
    </div>
  )
}
