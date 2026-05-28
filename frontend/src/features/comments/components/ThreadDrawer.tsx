'use client'

/**
 * ThreadDrawer — slide-in panel for replies.
 *
 * Mounted from a portal so it floats over the part viewer + panel without
 * fighting the existing layout. Width is fixed-but-resizable; on small
 * screens it stretches full-width.
 *
 * Listens to keyboard:reply / keyboard:resolve events so j/k/r/e from
 * anywhere on the page can drive it.
 */

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, MessageSquare, X } from 'lucide-react'
import Avatar from '@/components/workspace/Avatar'
import { formatTimeAgo } from '@/lib/mockWorkspace'
import { eventBus } from '../eventBus'
import { useCommentsStore } from '../store/commentsStore'
import { useReplies } from '../hooks/useThreadsStorage'
import type { Thread } from '../types/thread.types'
import CommentComposer from './CommentComposer'
import ReplyItem from './ReplyItem'

const PRIORITY_PILL: Record<NonNullable<Thread['priority']>, string> = {
  blocker: 'bg-rose-100 text-rose-700 ring-rose-200',
  high: 'bg-amber-100 text-amber-700 ring-amber-200',
  medium: 'bg-sky-100 text-sky-700 ring-sky-200',
  low: 'bg-slate-100 text-slate-600 ring-slate-200',
}

interface Props {
  thread: Thread | null
  currentUser: { id: string; name: string }
  onResolve: (id: string, resolved: boolean) => void
}

export default function ThreadDrawer({ thread, currentUser, onResolve }: Props): JSX.Element | null {
  const drawerOpen = useCommentsStore((s) => s.drawerOpen)
  const closeDrawer = useCommentsStore((s) => s.closeDrawer)
  const composerRef = useRef<HTMLDivElement | null>(null)

  const { replies, addReply, patchReply, deleteReply, toggleReaction } = useReplies(
    thread?.id ?? null,
  )

  // Wire keyboard:reply → focus composer; keyboard:resolve → toggle.
  useEffect(() => {
    const off1 = eventBus.on('keyboard:reply', () => {
      const ta = composerRef.current?.querySelector('textarea')
      ta?.focus()
    })
    const off2 = eventBus.on('keyboard:resolve', () => {
      if (thread !== null) onResolve(thread.id, thread.status !== 'resolved')
    })
    return () => {
      off1()
      off2()
    }
  }, [thread, onResolve])

  if (typeof document === 'undefined' || !drawerOpen || thread === null) return null

  const resolved = thread.status === 'resolved'

  return createPortal(
    <>
      {/* Backdrop — click to close. */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[2px]"
        onClick={closeDrawer}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-label={`Thread: ${thread.title}`}
        data-thread-drawer
        className="dv-anim-fade-up fixed right-0 top-0 z-50 flex h-screen w-full max-w-[480px] flex-col border-l border-slate-200 bg-white shadow-2xl"
      >
        {/* Header */}
        <header className="flex items-start gap-3 border-b border-slate-200 px-4 py-3">
          <Avatar name={thread.authorName} size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              <span
                className={[
                  'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-bold uppercase tracking-wider ring-1',
                  resolved
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                    : 'bg-amber-50 text-amber-700 ring-amber-200',
                ].join(' ')}
              >
                {resolved ? <CheckCircle2 className="h-2.5 w-2.5" /> : null}
                {thread.status.toUpperCase()}
              </span>
              {thread.priority !== null && (
                <span
                  className={`rounded-full px-1.5 py-0.5 font-bold uppercase tracking-wider ring-1 ${PRIORITY_PILL[thread.priority]}`}
                >
                  {thread.priority}
                </span>
              )}
              {thread.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-slate-600"
                >
                  {tag}
                </span>
              ))}
            </div>
            <h2 className="mt-1 text-sm font-bold leading-tight text-slate-900">
              {thread.title}
            </h2>
            <p className="mt-0.5 text-[10.5px] text-slate-500">
              Started by {thread.authorName} · {formatTimeAgo(thread.createdAt)} ·{' '}
              {thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onResolve(thread.id, !resolved)}
              title={resolved ? 'Reopen (e)' : 'Resolve (e)'}
              className={[
                'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10.5px] font-semibold transition',
                resolved
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:text-emerald-700',
              ].join(' ')}
            >
              <CheckCircle2 className="h-3 w-3" />
              {resolved ? 'Reopen' : 'Resolve'}
            </button>
            <button
              type="button"
              aria-label="Close"
              onClick={closeDrawer}
              className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="dv-thin-scroll flex-1 overflow-y-auto">
          {replies.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-slate-400">
              <MessageSquare className="h-6 w-6 opacity-50" />
              <p className="text-[11px]">No replies yet.</p>
              <p className="text-[10px] text-slate-400">Start the discussion below.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {replies.map((reply) => (
                <li key={reply.id}>
                  <ReplyItem
                    reply={reply}
                    currentUserId={currentUser.id}
                    currentUserName={currentUser.name}
                    onEdit={(id, body) => patchReply(id, { body })}
                    onDelete={(id) => deleteReply(id)}
                    onReact={(id, emoji) => toggleReaction(id, emoji, currentUser.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Composer */}
        <div ref={composerRef}>
          {resolved ? (
            <div className="border-t border-slate-100 bg-slate-50 px-3 py-3 text-center text-[11px] text-slate-500">
              Thread resolved — reopen to reply.
            </div>
          ) : (
            <CommentComposer
              threadId={thread.id}
              mode="reply"
              onSubmit={(body) => {
                addReply({ body, authorId: currentUser.id, authorName: currentUser.name })
              }}
            />
          )}
        </div>

        {/* Keyboard hints footer */}
        <footer className="flex items-center justify-center gap-3 border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-[9.5px] text-slate-500">
          <span>
            <kbd className="rounded border border-slate-300 bg-white px-1 font-mono">⌘+Enter</kbd> send
          </span>
          <span>
            <kbd className="rounded border border-slate-300 bg-white px-1 font-mono">r</kbd> reply
          </span>
          <span>
            <kbd className="rounded border border-slate-300 bg-white px-1 font-mono">e</kbd>{' '}
            {resolved ? 'reopen' : 'resolve'}
          </span>
          <span>
            <kbd className="rounded border border-slate-300 bg-white px-1 font-mono">Esc</kbd> close
          </span>
        </footer>
      </aside>
    </>,
    document.body,
  )
}
