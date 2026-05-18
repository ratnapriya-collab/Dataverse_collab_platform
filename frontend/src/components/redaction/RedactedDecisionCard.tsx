'use client'

/**
 * RedactedDecisionCard — placeholder card shown in the partner view in
 * place of each internal-only decision. Grey, locked, with a Datum
 * tooltip explaining why it's hidden.
 *
 * When `showWhatsHidden` is true (admin debug toggle), it reveals the
 * underlying rationale with a red strike-through overlay so the admin
 * can see exactly what the partner is missing.
 */

import { Eye, Lock, Sparkles } from 'lucide-react'

interface Props {
  /** Decision id for reference; partner sees only the id format, not the rationale. */
  decisionId: string
  /** Reason the resolver flagged this as internal-only — shown on hover. */
  reason: 'internal-flag' | 'cost-keyword' | 'admin-only-thread'
  /** When true, render the underlying rationale with a red strike-through overlay (admin debug). */
  showWhatsHidden: boolean
  /** Rationale text — only displayed when showWhatsHidden=true. */
  hiddenRationale?: string
  /** Optional author name — only displayed when showWhatsHidden=true. */
  hiddenAuthorName?: string
}

const REASON_COPY: Record<Props['reason'], string> = {
  'internal-flag': 'Marked internal-only on the OEM workspace.',
  'cost-keyword': 'Contains cost / pricing language. Datum screened it before partner view.',
  'admin-only-thread': 'Discussion thread is admin-only.',
}

export default function RedactedDecisionCard({
  decisionId,
  reason,
  showWhatsHidden,
  hiddenRationale,
  hiddenAuthorName,
}: Props): JSX.Element {
  if (showWhatsHidden && hiddenRationale !== undefined) {
    return (
      <article className="relative overflow-hidden rounded-lg border-2 border-dashed border-rose-300 bg-rose-50/60 p-4 shadow-sm">
        {/* Banner showing it would be redacted */}
        <div className="-mx-4 -mt-4 mb-3 flex items-center gap-2 border-b border-rose-300 bg-rose-100/70 px-4 py-1.5">
          <Eye className="h-3 w-3 text-rose-700" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800">
            Admin debug · partner would NOT see this
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] text-rose-600">{decisionId}</span>
          <span className="rounded-full bg-rose-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-800">
            internal-only
          </span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-rose-900 line-through decoration-rose-500 decoration-2">
          {hiddenRationale}
        </p>
        {hiddenAuthorName !== undefined && (
          <p className="mt-1.5 text-[10px] text-rose-700">
            by {hiddenAuthorName} · would be filtered by Datum
          </p>
        )}
        <p className="mt-2 text-[10px] italic text-rose-700/85">
          Reason: {REASON_COPY[reason]}
        </p>
      </article>
    )
  }

  return (
    <article
      className="group relative overflow-hidden rounded-lg border border-slate-200 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 p-4 shadow-sm"
      title={REASON_COPY[reason]}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-200/70 text-slate-500">
          <Lock className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="text-sm font-bold text-slate-700">Internal-only decision</p>
            <span className="font-mono text-[10px] text-slate-400">{decisionId}</span>
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
            [REDACTED]
          </p>
          <div className="mt-2 flex items-center gap-1.5 rounded-md border border-purple-100 bg-purple-50/70 px-2 py-1 text-[10px] text-purple-800">
            <Sparkles className="h-2.5 w-2.5 shrink-0 text-purple-600" />
            <span>Datum screened this from your view</span>
          </div>
        </div>
      </div>
    </article>
  )
}
