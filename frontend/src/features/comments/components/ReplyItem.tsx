'use client'

/**
 * ReplyItem — one reply inside a ThreadDrawer.
 * Avatar · author · timestamp · (edited) · body w/ mentions · reactions · row actions.
 */

import { useState } from 'react'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import Avatar from '@/components/workspace/Avatar'
import { formatTimeAgo } from '@/lib/mockWorkspace'
import type { Reply } from '../types/thread.types'
import MentionAwareText from './MentionAwareText'
import ReactionStrip from './ReactionStrip'

interface Props {
  reply: Reply
  currentUserId: string
  currentUserName: string
  onEdit?: (id: string, body: string) => void
  onDelete?: (id: string) => void
  onReact: (id: string, emoji: string) => void
}

export default function ReplyItem({
  reply,
  currentUserId,
  currentUserName,
  onEdit,
  onDelete,
  onReact,
}: Props): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(reply.body)
  const [menuOpen, setMenuOpen] = useState(false)
  const isMine = reply.authorName === currentUserName
  const edited = reply.updatedAt !== reply.createdAt

  if (reply.deletedAt !== null) {
    return (
      <div className="flex items-start gap-2 px-3 py-2 text-[11px] italic text-slate-400">
        <Avatar name={reply.authorName} size="sm" />
        <span>This reply was deleted.</span>
      </div>
    )
  }

  return (
    <article
      className="group flex items-start gap-2 px-3 py-2 transition hover:bg-slate-50/60"
      data-reply-id={reply.id}
    >
      <Avatar name={reply.authorName} size="sm" />
      <div className="min-w-0 flex-1">
        <header className="flex items-baseline gap-2 text-[11px]">
          <span className="font-semibold text-slate-900">{reply.authorName}</span>
          <span className="text-[10px] text-slate-400">{formatTimeAgo(reply.createdAt)}</span>
          {edited && (
            <span className="text-[10px] italic text-slate-400" title={`Edited ${formatTimeAgo(reply.updatedAt)}`}>
              (edited)
            </span>
          )}
          {reply.pending === true && (
            <span className="text-[10px] italic text-amber-600">Sending…</span>
          )}
          {isMine && !editing && (
            <div className="relative ml-auto opacity-0 transition group-hover:opacity-100">
              <button
                type="button"
                aria-label="Reply actions"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <MoreHorizontal className="h-3 w-3" />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="dv-anim-pop absolute right-0 top-6 z-20 w-32 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-xl"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      setEditing(true)
                    }}
                    className="flex w-full items-center gap-2 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      onDelete?.(reply.id)
                    }}
                    className="flex w-full items-center gap-2 border-t border-slate-100 px-2 py-1 text-[11px] text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </header>

        {editing ? (
          <div className="mt-1 space-y-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
              className="w-full resize-none rounded-md border border-slate-200 px-2 py-1 text-[12px] focus:border-primary focus:outline-none"
              rows={3}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditing(false)
                  if (draft.trim() !== reply.body) onEdit?.(reply.id, draft.trim())
                }}
                className="rounded bg-primary px-2 py-0.5 text-[10.5px] font-semibold text-white"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false)
                  setDraft(reply.body)
                }}
                className="text-[10.5px] text-slate-500 hover:text-slate-900"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-0.5 break-words text-[12px] leading-relaxed text-slate-700">
            <MentionAwareText body={reply.body} mentions={reply.mentions} />
          </p>
        )}

        <div className="mt-1.5">
          <ReactionStrip
            reactions={reply.reactions}
            currentUserId={currentUserId}
            onToggle={(emoji) => onReact(reply.id, emoji)}
          />
        </div>
      </div>
    </article>
  )
}
