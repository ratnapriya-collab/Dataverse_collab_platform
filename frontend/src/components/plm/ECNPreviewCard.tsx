'use client'

/**
 * ECNPreviewCard — center column of the PLM-push wizard.
 *
 * Renders an Engineering Change Notice form whose fields are derived from
 * the decisions the user has checked on the left. Everything is read-only
 * (mock); the only "input" is the textarea so the user can tweak the
 * combined description before pushing.
 */

import { useState } from 'react'
import { FileText, Paperclip, ShieldCheck, Users } from 'lucide-react'
import TeamBadge from '@/components/workspace/TeamBadge'
import Avatar from '@/components/workspace/Avatar'
import type { MockEcnTemplate, MockFullDecision } from '@/lib/mockWorkspace'

interface Props {
  template: MockEcnTemplate
  selectedDecisions: MockFullDecision[]
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1_000_000) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1_048_576).toFixed(1)} MB`
}

export default function ECNPreviewCard({ template, selectedDecisions }: Props): JSX.Element {
  const auto = selectedDecisions
    .map((d) => `• [${d.id}] ${d.rationale.split('. ')[0]}.`)
    .join('\n')

  const [description, setDescription] = useState<string>(auto)

  // Re-derive when selection changes (cheap, no useEffect dance needed since
  // the user can still edit; we just don't fight them).
  const placeholder = auto

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-5 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            ECN preview
          </span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-600">
          Draft · awaits assignment
        </span>
      </header>

      <div className="space-y-4 px-5 py-4">
        <Field label="ECN Number">
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-700">
            {template.draft_id}
          </code>
          <span className="ml-2 text-[10px] text-slate-500">
            (real ID assigned by {`Windchill`} on submit)
          </span>
        </Field>

        <Field label="Title">
          <p className="text-sm font-semibold text-slate-900">{template.title}</p>
        </Field>

        <Field label="Description">
          <textarea
            value={description.length === 0 ? placeholder : description}
            onChange={(e) => setDescription(e.target.value)}
            rows={Math.min(8, Math.max(3, selectedDecisions.length + 1))}
            className="w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="mt-1 text-[10px] text-slate-400">
            Auto-generated from {selectedDecisions.length} selected decision
            {selectedDecisions.length === 1 ? '' : 's'} · editable
          </p>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Change classification">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200">
              <ShieldCheck className="h-2.5 w-2.5" />
              {template.classification}
            </span>
            <span className="ml-2 text-[10px] text-slate-500">auto-detected</span>
          </Field>

          <Field label="Affected parts">
            <p className="text-xs font-medium text-slate-900">{template.affected_part}</p>
          </Field>
        </div>

        <Field label={`Required approvals (${approvers(selectedDecisions).length})`} icon={Users}>
          <ul className="space-y-1">
            {approvers(selectedDecisions).map((a) => (
              <li key={a.name} className="flex items-center gap-2">
                <Avatar name={a.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-900">{a.name}</p>
                </div>
                <TeamBadge team={a.team} size="xs" variant="dot" />
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-600">
                  Pending
                </span>
              </li>
            ))}
          </ul>
        </Field>

        <Field label="Attachments" icon={Paperclip}>
          <ul className="space-y-1">
            {template.attachments.map((a) => (
              <li
                key={a.name}
                className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50/40 px-2.5 py-1.5"
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-medium text-slate-700">
                  {a.name}
                </span>
                <span className="shrink-0 text-[10px] tabular-nums text-slate-500">
                  {formatSize(a.size_bytes)}
                </span>
                {a.signed === true && (
                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200">
                    <ShieldCheck className="h-2.5 w-2.5" />
                    Signed
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Field>
      </div>
    </section>
  )
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string
  icon?: typeof Users
  children: React.ReactNode
}): JSX.Element {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        {Icon !== undefined && <Icon className="h-3 w-3 text-slate-400" />}
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      </div>
      <div>{children}</div>
    </div>
  )
}

function approvers(decisions: MockFullDecision[]): Array<{ name: string; team: MockFullDecision['author_team'] }> {
  const seen = new Map<string, MockFullDecision['author_team']>()
  for (const d of decisions) {
    if (!seen.has(d.author_name)) seen.set(d.author_name, d.author_team)
  }
  return Array.from(seen.entries()).map(([name, team]) => ({ name, team }))
}
