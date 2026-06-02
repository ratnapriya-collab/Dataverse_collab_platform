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

import { useMemo } from 'react'
import { Inbox } from 'lucide-react'
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
}

export default function CommentsPanel({
  partId,
  partName,
  currentUser,
  composeAnchor,
}: Props): JSX.Element {
  useSeedThreads(partId)
  const { threads, upsertThread, patchThread } = useThreads(partId)
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
