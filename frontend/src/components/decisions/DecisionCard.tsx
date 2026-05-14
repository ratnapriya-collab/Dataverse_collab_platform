'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { ApiError, api } from '@/lib/api'
import type { DecisionRead, DecisionState } from '@/types/api'

interface Props {
  decision: DecisionRead
  onChanged: (updated: DecisionRead) => void
  highlighted?: boolean
  onHover?: (faceUuid: string | null) => void
}

const STATE_STYLES: Record<DecisionState, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: 'bg-slate-200', text: 'text-slate-700', label: 'Draft' },
  PROPOSED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Proposed' },
  ACCEPTED: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Accepted' },
  REJECTED: { bg: 'bg-slate-200', text: 'text-slate-600', label: 'Rejected' },
  SUPERSEDED: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Superseded' },
}

export default function DecisionCard({
  decision,
  onChanged,
  highlighted = false,
  onHover,
}: Props) {
  const [busy, setBusy] = useState<DecisionState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const style = STATE_STYLES[decision.state]

  async function go(to: DecisionState): Promise<void> {
    setError(null)
    setBusy(to)
    try {
      const updated = await api.decisions.transition(decision.id, to)
      onChanged(updated)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Transition failed')
    } finally {
      setBusy(null)
    }
  }

  const allowAccept = decision.state === 'PROPOSED'
  const allowReject = decision.state === 'PROPOSED'

  const authorName = decision.author?.name ?? 'Unknown'
  const anchorShort = decision.anchor !== null
    ? `${decision.anchor.face_uuid.slice(0, 8)}…${decision.anchor.face_uuid.slice(-4)}`
    : '—'

  return (
    <article
      onMouseEnter={() => onHover?.(decision.anchor?.face_uuid ?? null)}
      onMouseLeave={() => onHover?.(null)}
      className={[
        'rounded-lg border bg-white px-3 py-2.5 transition',
        highlighted ? 'border-primary shadow-md ring-1 ring-primary/30' : 'border-slate-200',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.bg} ${style.text}`}
        >
          {style.label}
        </span>
        <span className="font-mono text-[10px] text-slate-400">{anchorShort}</span>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-800">{decision.rationale}</p>

      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
        <span>by {authorName}</span>
        <time>{new Date(decision.created_at).toLocaleString()}</time>
      </div>

      {(allowAccept || allowReject) && (
        <div className="mt-3 flex gap-2">
          {allowAccept && (
            <button
              type="button"
              onClick={() => void go('ACCEPTED')}
              disabled={busy !== null}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Check className="h-3.5 w-3.5" />
              {busy === 'ACCEPTED' ? 'Accepting…' : 'Accept'}
            </button>
          )}
          {allowReject && (
            <button
              type="button"
              onClick={() => void go('REJECTED')}
              disabled={busy !== null}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X className="h-3.5 w-3.5" />
              {busy === 'REJECTED' ? '…' : 'Reject'}
            </button>
          )}
        </div>
      )}

      {error !== null && (
        <p role="alert" className="mt-2 text-[11px] text-red-600">
          {error}
        </p>
      )}
    </article>
  )
}
