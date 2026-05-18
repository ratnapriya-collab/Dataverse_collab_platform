'use client'

/**
 * DatumRedactionExplainer — purple side card on the partner-view page
 * explaining how Datum decides what to hide.
 */

import { ChevronRight, FileText, MessageSquareWarning, Shield, Sparkles } from 'lucide-react'

interface Props {
  hiddenDecisions: number
  hiddenComments: number
}

export default function DatumRedactionExplainer({
  hiddenDecisions,
  hiddenComments,
}: Props): JSX.Element {
  return (
    <aside className="overflow-hidden rounded-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 via-white to-purple-50/40 shadow-sm">
      <header className="flex items-center gap-2 border-b border-purple-100 bg-purple-50/60 px-3 py-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-sm">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <div>
          <p className="text-[11px] font-bold text-purple-900">Datum</p>
          <p className="text-[10px] text-purple-700/80">AI · redaction co-pilot</p>
        </div>
      </header>
      <div className="px-3 py-3">
        <p className="text-[11px] font-semibold text-purple-900">
          How I decide what to redact
        </p>
        <ul className="mt-2 space-y-2">
          <Rule
            icon={Shield}
            title="Internal-only flag"
            body="Decisions marked internal to the OEM are filtered before partner sync. Never crosses the boundary."
          />
          <Rule
            icon={FileText}
            title="Cost / pricing language"
            body="Mentions of cost, margin, supplier rate, or quote in the rationale or comments are masked."
          />
          <Rule
            icon={MessageSquareWarning}
            title="Admin-only threads"
            body="Comment threads marked admin-only — including any replies under them — stay on your side."
          />
        </ul>

        <div className="mt-3 rounded-md border border-purple-200 bg-white px-2.5 py-1.5 text-[10px] text-purple-900">
          <strong className="font-bold">On this part:</strong>{' '}
          {hiddenDecisions > 0 || hiddenComments > 0 ? (
            <>
              I&rsquo;m hiding{' '}
              <strong className="font-bold tabular-nums">{hiddenDecisions}</strong>{' '}
              {hiddenDecisions === 1 ? 'decision' : 'decisions'} and{' '}
              <strong className="font-bold tabular-nums">{hiddenComments}</strong>{' '}
              {hiddenComments === 1 ? 'comment' : 'comments'}. Technical context is preserved.
            </>
          ) : (
            <>nothing to redact — partner sees the full picture.</>
          )}
        </div>

        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 hover:text-purple-900 hover:underline"
        >
          Edit redaction policy
          <ChevronRight className="h-2.5 w-2.5" />
        </a>
      </div>
    </aside>
  )
}

function Rule({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Shield
  title: string
  body: string
}): JSX.Element {
  return (
    <li className="flex items-start gap-2">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-purple-100 text-purple-700">
        <Icon className="h-3 w-3" />
      </div>
      <div>
        <p className="text-[11px] font-semibold text-purple-900">{title}</p>
        <p className="mt-0.5 text-[10px] leading-snug text-purple-800/85">{body}</p>
      </div>
    </li>
  )
}
