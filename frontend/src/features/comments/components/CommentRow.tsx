'use client'

/**
 * CommentRow — one threaded comment as it appears in CommentsPanel's list.
 * Click anywhere → opens ThreadDrawer · hover → highlights matching pin.
 */

import { CheckCircle2, MessageSquare, Sparkles } from 'lucide-react'
import Avatar from '@/components/workspace/Avatar'
import { formatTimeAgo } from '@/lib/mockWorkspace'
import { eventBus } from '../eventBus'
import { useCommentsStore } from '../store/commentsStore'
import type { Reply, Thread } from '../types/thread.types'
import MentionAwareText from './MentionAwareText'

const PRIORITY_DOT: Record<NonNullable<Thread['priority']>, string> = {
  blocker: 'bg-rose-500',
  high: 'bg-amber-500',
  medium: 'bg-sky-500',
  low: 'bg-slate-400',
}

interface Props {
  thread: Thread
  rootReply: Reply | undefined
}

export default function CommentRow({ thread, rootReply }: Props): JSX.Element {
  const selected = useCommentsStore((s) => s.selectedThreadId === thread.id)
  const hovered = useCommentsStore((s) => s.hoveredThreadId === thread.id)
  const selectThread = useCommentsStore((s) => s.selectThread)
  const setHovered = useCommentsStore((s) => s.setHovered)
  const exportSelected = useCommentsStore((s) => s.selectedForExport.has(thread.id))
  const toggleExport = useCommentsStore((s) => s.toggleExportSelection)
  const exportDialogOpen = useCommentsStore((s) => s.exportDialogOpen)

  const resolved = thread.status === 'resolved'
  const bodyPreview = rootReply?.body ?? '…'

  return (
    <button
      role="row"
      aria-selected={selected}
      onClick={() => {
        selectThread(thread.id, 'sidebar')
        eventBus.emit('panel:thread-clicked', { threadId: thread.id })
      }}
      onMouseEnter={() => setHovered(thread.id)}
      onMouseLeave={() => setHovered(null)}
      className={[
        'group w-full border-l-2 px-3 py-2 text-left transition',
        selected
          ? 'border-l-primary bg-primary-50/60'
          : hovered
            ? 'border-l-slate-300 bg-slate-50/60'
            : 'border-l-transparent hover:bg-slate-50/60',
      ].join(' ')}
    >
      <div className="flex items-start gap-2">
        {/* Export-mode checkbox, only shows when dialog is open */}
        {exportDialogOpen && (
          <input
            type="checkbox"
            checked={exportSelected}
            onChange={() => toggleExport(thread.id)}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 h-3 w-3 shrink-0 cursor-pointer accent-primary"
          />
        )}
        <Avatar name={thread.authorName} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[10.5px]">
            <span className="truncate font-semibold text-slate-900">
              {thread.authorName}
            </span>
            {thread.priority !== null && (
              <span
                className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[thread.priority]}`}
                aria-label={`Priority: ${thread.priority}`}
                title={`Priority: ${thread.priority}`}
              />
            )}
            {resolved && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
            <span className="ml-auto text-[9.5px] text-slate-400">
              {formatTimeAgo(thread.lastReplyAt)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[12px] font-semibold leading-tight text-slate-800">
            {thread.title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-600">
            <MentionAwareText body={bodyPreview} mentions={rootReply?.mentions ?? []} />
          </p>
          {thread.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {thread.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-slate-100 px-1 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-slate-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-0.5">
              <MessageSquare className="h-2.5 w-2.5" />
              {thread.replyCount}
            </span>
            {thread.assigneeName !== null && (
              <span className="inline-flex items-center gap-0.5">
                <Sparkles className="h-2.5 w-2.5 text-primary" />
                {thread.assigneeName.split(' ')[0]}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}
