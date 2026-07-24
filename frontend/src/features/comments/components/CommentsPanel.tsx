'use client'

/**
 * CommentsPanel — the v2 replacement for the inline-replies Comments tab.
 *
 * Structure:
 *   ┌─────────────────────┐
 *   │  Header + Export    │
 *   ├─────────────────────┤
 *   │  FilterBar          │   status · priority · @me · search · density
 *   ├─────────────────────┤
 *   │  Thread list        │   one CommentRow per thread (filtered + sorted)
 *   ├─────────────────────┤
 *   │  New-thread composer│   creates a thread anchored to current face
 *   └─────────────────────┘
 *   + portal: ThreadDrawer when a thread is selected
 */

import { useEffect, useMemo, useState } from 'react'
import { Inbox, Loader2, Sparkles, X } from 'lucide-react'
import { ApiError, api } from '@/lib/api'
import { matchesFilters, useCommentsStore } from '../store/commentsStore'
import { useReplies, useThreads, buildThread } from '../hooks/useThreadsStorage'
import { useSeedThreads } from '../hooks/useSeedThreads'
import { useCommentKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import type { Reply, Thread } from '../types/thread.types'
import CommentRow from './CommentRow'
import FilterBar from './FilterBar'
import CommentComposer from './CommentComposer'
import ThreadDrawer from './ThreadDrawer'
import ExportButton from './ExportButton'
import ExportDialog from './ExportDialog'
import ToggleOverlayButton from './ToggleOverlayButton'

interface Props {
  partId: string
  partName: string
  currentUser: { id: string; name: string }
  /** Face anchor used for newly-composed top-level threads. */
  composeAnchor: { faceUuid: string; centroid: { x: number; y: number; z: number } } | null
  /** Persistent decisions from the API — used to auto-hydrate the
   *  localStorage thread list on first mount when it's empty. Solves
   *  the "Comments 11 · 0 of 0" mismatch where the tab count came from
   *  decisions but content came from an empty localStorage list. */
  seedFromDecisions?: readonly {
    id: string
    rationale: string
    state: string
    created_at: string
    author_id: string
    author?: { name?: string | null } | null
    anchor?: {
      face_uuid: string
      centroid: { x: number; y: number; z: number }
    } | null
  }[]
}

export default function CommentsPanel({
  partId,
  partName,
  currentUser,
  composeAnchor,
  seedFromDecisions,
}: Props): JSX.Element {
  useSeedThreads(partId)
  const { threads, upsertThread, patchThread } = useThreads(partId)

  // Auto-seed: if we have persistent decisions from the API but the
  // localStorage thread list is empty, mirror each decision into a
  // thread so the Comments tab actually shows content. Runs once per
  // (partId, decisions-length) — never overwrites existing threads.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (seedFromDecisions === undefined || seedFromDecisions.length === 0) return
    if (threads.length > 0) return
    const now = new Date().toISOString()
    const mid = (p: string): string =>
      `${p}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
    // Track keys we wrote in this pass so we can roll back if the
    // storage quota gets exhausted mid-way through.
    const writtenReplyKeys: string[] = []
    const safeSet = (key: string, value: string): boolean => {
      try {
        window.localStorage.setItem(key, value)
        return true
      } catch (err) {
        if (err instanceof DOMException && /quota/i.test(err.name + err.message)) {
          // eslint-disable-next-line no-console
          console.warn(
            '[CommentsPanel] localStorage quota exceeded — auto-seed aborted. ' +
              'Clear old docs/screenshots or wipe with: ' +
              "Object.keys(localStorage).filter(k=>k.startsWith('dataverse.')).forEach(k=>localStorage.removeItem(k))",
          )
          // Roll back what we wrote so we don't leave orphan replies.
          for (const k of writtenReplyKeys) {
            try { window.localStorage.removeItem(k) } catch { /* noop */ }
          }
          return false
        }
        throw err  // some other unexpected error — surface it
      }
    }

    const seeded: Thread[] = []
    for (let i = 0; i < seedFromDecisions.length; i++) {
      const d = seedFromDecisions[i]!
      const threadId = mid('thr')
      const replyId = mid('rep')
      const anchor = d.anchor ?? {
        face_uuid: `nda_${i}`,
        centroid: { x: 0, y: 0, z: 0 },
      }
      const authorName = d.author?.name ?? currentUser.name
      const assigned = i < Math.ceil(seedFromDecisions.length / 2)
      const replyKey = `dataverse.replies.${threadId}`
      const ok = safeSet(
        replyKey,
        JSON.stringify([
          {
            id: replyId,
            threadId,
            authorId: d.author_id,
            authorName,
            body: d.rationale,
            mentions: [],
            reactions: [],
            createdAt: d.created_at,
            updatedAt: d.created_at,
          },
        ]),
      )
      if (!ok) return  // quota hit — bail out entirely, roll back done above
      writtenReplyKeys.push(replyKey)
      seeded.push({
        id: threadId,
        partId,
        anchor: {
          partId,
          faceUuid: anchor.face_uuid,
          centroid: anchor.centroid,
        },
        rootReplyId: replyId,
        authorId: d.author_id,
        authorName,
        title: d.rationale.split(/[.!?]/)[0]?.slice(0, 80) ?? 'Untitled',
        status: d.state === 'ACCEPTED' ? ('resolved' as const) : ('open' as const),
        priority: null,
        assigneeId: assigned ? currentUser.id : null,
        assigneeName: assigned ? currentUser.name : null,
        tags: [] as string[],
        replyCount: 1,
        lastReplyAt: d.created_at,
        participantIds: [authorName],
        createdAt: d.created_at,
        updatedAt: d.created_at,
        resolvedAt: null,
        resolvedById: null,
      })
    }
    // Final write for the thread INDEX. If this fails, roll back the
    // per-thread reply keys so we don't leave orphans on disk.
    const threadsKey = `dataverse.threads.${partId}`
    if (!safeSet(threadsKey, JSON.stringify(seeded))) return

    window.dispatchEvent(
      new CustomEvent('dataverse:threads-changed', {
        detail: { key: threadsKey },
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partId, seedFromDecisions?.length])
  const filters = useCommentsStore((s) => s.filters)
  const sort = useCommentsStore((s) => s.sort)
  const selectedThreadId = useCommentsStore((s) => s.selectedThreadId)
  const exportDialogOpen = useCommentsStore((s) => s.exportDialogOpen)
  const selectThread = useCommentsStore((s) => s.selectThread)

  // Visible threads after filter + sort
  const visibleThreads = useMemo(() => {
    const matching = threads.filter((t) =>
      matchesFilters(t, filters, currentUser.name),
    )
    const sorted = [...matching]
    switch (sort) {
      case 'newest':
        sorted.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        break
      case 'oldest':
        sorted.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
        break
      case 'most-active':
        sorted.sort((a, b) => b.replyCount - a.replyCount)
        break
      case 'priority': {
        const rank: Record<string, number> = { blocker: 0, high: 1, medium: 2, low: 3 }
        sorted.sort(
          (a, b) =>
            (rank[a.priority ?? ''] ?? 9) - (rank[b.priority ?? ''] ?? 9),
        )
        break
      }
    }
    return sorted
  }, [threads, filters, sort, currentUser.name])

  // Wire j/k/Esc keyboard nav across the visible list order
  useCommentKeyboardShortcuts({
    threadIdsInOrder: visibleThreads.map((t) => t.id),
  })

  // Root reply for each thread, batch-fetched from localStorage
  const rootRepliesByThread = useRootReplies(visibleThreads)

  const selectedThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) ?? null,
    [threads, selectedThreadId],
  )

  function handleNewThread(body: string): void {
    if (composeAnchor === null) return
    const built = buildThread({
      partId,
      faceUuid: composeAnchor.faceUuid,
      centroid: composeAnchor.centroid,
      authorId: currentUser.id,
      authorName: currentUser.name,
      title: body.split('.')[0].slice(0, 80),
      rootBody: body,
    })
    upsertThread(built.thread)
    // Save root reply via direct localStorage write so it shows immediately
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        `dataverse.replies.${built.thread.id}`,
        JSON.stringify([built.rootReply]),
      )
      window.dispatchEvent(
        new CustomEvent('dataverse:threads-changed', {
          detail: { key: `dataverse.replies.${built.thread.id}` },
        }),
      )
    }
    selectThread(built.thread.id, 'sidebar')
  }

  function handleResolve(id: string, resolved: boolean): void {
    patchThread(id, {
      status: resolved ? 'resolved' : 'open',
      resolvedAt: resolved ? new Date().toISOString() : null,
      resolvedById: resolved ? currentUser.id : null,
    })
  }

  return (
    <section
      data-comments-panel
      className="flex h-full flex-col bg-white"
      aria-label="Comments"
    >
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Comments
          </p>
          <p className="text-[11.5px] font-bold text-slate-900">
            {visibleThreads.length} of {threads.length}{' '}
            <span className="font-normal text-slate-500">
              · {threads.filter((t) => t.status === 'open').length} open
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <ToggleOverlayButton totalCount={threads.length} />
          <ExportButton totalCount={threads.length} visibleCount={visibleThreads.length} />
        </div>
      </header>

      <FilterBar />

      {/* Datum AI summarise bar — visible whenever there's at least one
          thread. Uses the same summarize-thread backend the Threads tab
          uses, so the user can get a rollup of the whole comment stream
          without switching tabs. */}
      {threads.length > 0 && (
        <DatumSummariseBar
          partId={partId}
          partName={partName}
          decisionIds={
            seedFromDecisions?.slice(0, 8).map((d) => d.id) ?? []
          }
        />
      )}

      {/* Thread list */}
      <div className="dv-thin-scroll flex-1 overflow-y-auto">
        {visibleThreads.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 px-6 text-center text-slate-400">
            <Inbox className="h-5 w-5 opacity-50" />
            <p className="text-[11px] font-semibold">
              {threads.length === 0 ? 'No comments yet' : 'No matches'}
            </p>
            <p className="text-[10px]">
              {threads.length === 0
                ? 'Click a face on the 3D viewer to start a thread.'
                : 'Adjust the filters to see more.'}
            </p>
            {/* Recovery action — when the panel is empty but decisions
                exist in the DB (typical when the auto-seed hit the
                localStorage quota), let the user clear old data + retry
                without pasting a console script. */}
            {threads.length === 0 &&
              seedFromDecisions !== undefined &&
              seedFromDecisions.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window === 'undefined') return
                    // Clear every dataverse.* key — old docs, versions,
                    // captures, threads. Aggressive but safe: DB-backed
                    // decisions/anchors survive; only the localStorage
                    // mock layer is wiped.
                    const keys = Object.keys(window.localStorage).filter((k) =>
                      k.startsWith('dataverse.'),
                    )
                    keys.forEach((k) => window.localStorage.removeItem(k))
                    // eslint-disable-next-line no-console
                    console.log(`[CommentsPanel] cleared ${keys.length} dataverse.* keys — reloading`)
                    window.location.reload()
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:shadow-md"
                >
                  Populate from {seedFromDecisions.length} decisions in DB →
                </button>
              )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visibleThreads.map((t) => (
              <li key={t.id}>
                <CommentRow thread={t} rootReply={rootRepliesByThread.get(t.id)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* New-thread composer */}
      {composeAnchor !== null && (
        <CommentComposer
          mode="new-thread"
          placeholder={`Comment on face ${composeAnchor.faceUuid}…  (⌘+Enter)`}
          onSubmit={handleNewThread}
        />
      )}

      {/* Drawer (portal) */}
      <ThreadDrawer
        thread={selectedThread}
        currentUser={currentUser}
        onResolve={handleResolve}
      />

      {/* Export dialog (portal) */}
      {exportDialogOpen && (
        <ExportDialog
          partId={partId}
          partName={partName}
          threads={threads}
          rootRepliesByThread={rootRepliesByThread}
          currentUserName={currentUser.name}
        />
      )}
    </section>
  )
}

/**
 * Batch-fetch root replies from localStorage for the visible threads.
 * Keeps reads cheap — each thread has at most one root reply.
 */
function useRootReplies(threads: Thread[]): Map<string, Reply> {
  return useMemo(() => {
    const map = new Map<string, Reply>()
    if (typeof window === 'undefined') return map
    for (const t of threads) {
      try {
        const raw = window.localStorage.getItem(`dataverse.replies.${t.id}`)
        if (raw === null) continue
        const replies = JSON.parse(raw) as Reply[]
        const root = replies.find((r) => r.id === t.rootReplyId) ?? replies[0]
        if (root !== undefined) map.set(t.id, root)
      } catch {
        // skip
      }
    }
    return map
  }, [threads])
}

/**
 * DatumSummariseBar — one-click AI summary of the doc's comments.
 *
 * Sits below the FilterBar in the Comments tab. Clicking "Summarise
 * with Datum" calls /api/datum/summarize-thread with the current part
 * context and shows the returned rollup in a collapsible card so the
 * user can scan the whole conversation without reading every thread.
 *
 * State machine:
 *   idle → loading → (summary | error) → dismiss returns to idle
 */
function DatumSummariseBar({
  partId,
  partName,
  decisionIds,
}: {
  partId: string
  partName: string
  decisionIds: string[]
}): JSX.Element {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick(): Promise<void> {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.datum.summarizeThread({
        thread_id: `part:${partId}`,
        part_name: partName,
        decision_ids: decisionIds,
      })
      const text =
        (result as { summary?: string; text?: string }).summary ??
        (result as { text?: string }).text ??
        JSON.stringify(result).slice(0, 400)
      setSummary(text)
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Datum is unavailable right now.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="border-b border-slate-100 bg-gradient-to-r from-purple-50/60 to-indigo-50/60 px-3 py-2">
      {summary === null && error === null && (
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-purple-500 to-indigo-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:shadow-md disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Datum is summarising…
            </>
          ) : (
            <>
              <Sparkles className="h-3 w-3" />
              Summarise with Datum AI
            </>
          )}
        </button>
      )}
      {summary !== null && (
        <div className="relative rounded-md border border-purple-200 bg-white/70 p-2 pr-6">
          <div className="mb-1 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-purple-600" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
              Datum AI · Summary
            </p>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-700">{summary}</p>
          <button
            type="button"
            onClick={() => setSummary(null)}
            aria-label="Dismiss summary"
            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      {error !== null && (
        <div className="relative rounded-md border border-rose-200 bg-rose-50 p-2 pr-6 text-[11px] text-rose-700">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss error"
            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded text-rose-500 hover:bg-rose-100"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
}
