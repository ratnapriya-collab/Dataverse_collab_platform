'use client'

/**
 * ReactionStrip — emoji-reactions row on a Reply.
 * Click an existing reaction to toggle your vote · click + to add a new one.
 */

import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { Reaction } from '../types/thread.types'

const PRESET_EMOJIS = ['👍', '✅', '🎯', '🤔', '👀', '🚀', '🔥', '❤️']

interface Props {
  reactions: Reaction[]
  currentUserId: string
  onToggle: (emoji: string) => void
}

export default function ReactionStrip({ reactions, currentUserId, onToggle }: Props): JSX.Element {
  const [pickerOpen, setPickerOpen] = useState(false)
  return (
    <div className="flex flex-wrap items-center gap-1">
      {reactions.map((r) => {
        const mine = r.userIds.includes(currentUserId)
        return (
          <button
            key={r.emoji}
            type="button"
            onClick={() => onToggle(r.emoji)}
            className={[
              'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10.5px] transition',
              mine
                ? 'border-primary/40 bg-primary-50 text-primary-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
            ].join(' ')}
          >
            <span>{r.emoji}</span>
            <span className="font-bold tabular-nums">{r.userIds.length}</span>
          </button>
        )
      })}
      <div className="relative">
        <button
          type="button"
          aria-label="Add reaction"
          onClick={() => setPickerOpen((o) => !o)}
          className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400 transition hover:border-slate-400 hover:text-slate-700"
        >
          <Plus className="h-3 w-3" />
        </button>
        {pickerOpen && (
          <div
            role="menu"
            className="dv-anim-pop absolute bottom-full left-0 z-30 mb-1 inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white px-1 py-1 shadow-xl"
          >
            {PRESET_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  onToggle(e)
                  setPickerOpen(false)
                }}
                className="inline-flex h-7 w-7 items-center justify-center rounded text-base transition hover:bg-slate-100"
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
