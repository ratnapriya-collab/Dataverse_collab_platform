'use client'

import { Check, Hash, MessageSquare, X } from 'lucide-react'
import StatePill from './StatePill'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import type { Decision } from '@/lib/mock-data'
import { formatRelative } from '@/lib/mock-data'

interface Props {
  decision: Decision
  /** Highlights the card (e.g. when its pin is clicked in the viewer). */
  active?: boolean
  onClick?: () => void
  onAccept?: () => void
  onReject?: () => void
}

export default function DecisionCard({ decision, active, onClick, onAccept, onReject }: Props) {
  const d = decision
  const showActions = d.state === 'PROPOSED'
  return (
    <article
      onClick={onClick}
      data-decision-id={d.id}
      className={`group relative cursor-pointer rounded-lg border bg-white p-4 transition-all ${
        active
          ? 'border-accent shadow-card-hover ring-2 ring-accent/15'
          : 'border-rule shadow-card hover:border-ink-mute/30 hover:shadow-card-hover'
      }`}
    >
      <header className="flex items-center justify-between gap-3">
        <StatePill state={d.state} />
        <span className="font-mono text-[10px] text-ink-mute">{d.id}</span>
      </header>

      <p className="mt-3 text-sm leading-relaxed text-ink">
        {d.rationale}
      </p>

      <div className="mt-3 flex items-center gap-2 text-[11px] text-ink-mute">
        <Hash className="h-3 w-3" />
        <span className="font-mono">{d.anchorId}</span>
      </div>

      {d.citations.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {d.citations.map((c) => (
            <span
              key={c}
              className="rounded border border-rule bg-rule-soft px-1.5 py-0.5 font-mono text-[10px] text-ink-soft"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      <footer className="mt-3 flex items-center justify-between gap-3 border-t border-rule pt-3">
        <div className="flex items-center gap-2 text-[11px]">
          <Avatar name={d.author.name} initials={d.author.initials} size="xs" />
          <span className="font-medium text-ink">{d.author.name}</span>
          <span className="text-ink-mute">· {formatRelative(d.createdAt)}</span>
        </div>
        {showActions && (
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation()
                onReject?.()
              }}
            >
              <X className="h-3 w-3" />
              Reject
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={(e) => {
                e.stopPropagation()
                onAccept?.()
              }}
            >
              <Check className="h-3 w-3" />
              Accept
            </Button>
          </div>
        )}
        {!showActions && d.signoffs !== undefined && (
          <div className="flex items-center gap-1.5">
            <MessageSquare className="h-3 w-3 text-ink-mute" />
            <span className="text-[10px] text-ink-mute">
              {d.signoffs.filter((s) => s.state === 'SIGNED').length}/{d.signoffs.length} signed
            </span>
          </div>
        )}
      </footer>
    </article>
  )
}
