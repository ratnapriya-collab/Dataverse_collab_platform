'use client'

/**
 * ProjectOverviewTab — Slingshot-style dashboard for /projects/[id].
 *
 * Six widget cards wired to this project's real decisions + members:
 *   1. Overdue Decisions       — PROPOSED for > 24h
 *   2. Blocked                 — priority 'blocker' OR has Blocker tag
 *   3. In Progress             — state DRAFT
 *   4. Open Decisions list     — grouped by state (DRAFT · PROPOSED · ACCEPTED)
 *   5. Member Workload         — assignees + open count
 *   6. Decisions By Status     — SVG donut + legend
 *
 * A 7th Pins card shows an empty state — pinning isn't wired yet.
 */

import { Edit3, MoreHorizontal, Maximize2, Pin, Plus, RefreshCw, ChevronDown } from 'lucide-react'
import Avatar from '@/components/workspace/Avatar'
import type { MockFullDecision, MockMember } from '@/lib/mockWorkspace'

interface Props {
  decisions: MockFullDecision[]
  members: MockMember[]
}

type CountKey = 'DRAFT' | 'PROPOSED' | 'ACCEPTED' | 'REJECTED'

const STATE_META: Record<CountKey, { label: string; color: string; dot: string; bg: string; fg: string }> = {
  DRAFT: { label: 'Draft', color: '#94a3b8', dot: 'bg-slate-400', bg: 'bg-slate-100', fg: 'text-slate-600' },
  PROPOSED: { label: 'Proposed', color: '#f59e0b', dot: 'bg-amber-500', bg: 'bg-amber-50', fg: 'text-amber-700' },
  ACCEPTED: { label: 'Accepted', color: '#10b981', dot: 'bg-emerald-500', bg: 'bg-emerald-50', fg: 'text-emerald-700' },
  REJECTED: { label: 'Rejected', color: '#ef4444', dot: 'bg-rose-500', bg: 'bg-rose-50', fg: 'text-rose-700' },
}

const ONE_DAY_MS = 24 * 3_600_000

export default function ProjectOverviewTab({ decisions, members }: Props): JSX.Element {
  const now = Date.now()
  const overdue = decisions.filter(
    (d) => d.state === 'PROPOSED' && now - +new Date(d.created_at) > ONE_DAY_MS,
  ).length
  const blocked = decisions.filter(
    (d) => d.priority === 'blocker' || (d.tags?.includes('Blocker') ?? false),
  ).length
  const inProgress = decisions.filter((d) => d.state === 'DRAFT').length

  const counts: Record<CountKey, number> = {
    DRAFT: decisions.filter((d) => d.state === 'DRAFT').length,
    PROPOSED: decisions.filter((d) => d.state === 'PROPOSED').length,
    ACCEPTED: decisions.filter((d) => d.state === 'ACCEPTED').length,
    REJECTED: decisions.filter((d) => d.state === 'REJECTED').length,
  }

  const openDecisions = decisions.filter((d) => d.state === 'DRAFT' || d.state === 'PROPOSED' || d.state === 'ACCEPTED')

  return (
    <div className="space-y-5">
      {/* Sub-header row */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-900 transition hover:text-primary"
        >
          Project Overview
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </button>
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <RefreshCw className="h-3 w-3" />
            <span className="font-semibold uppercase tracking-wider">Last Refreshed:</span>
            <span className="text-slate-700">Now</span>
          </span>
          <button
            type="button"
            aria-label="Edit overview"
            className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-white shadow-sm transition hover:bg-primary-700"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="More options"
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Row 1: 3 big-number cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <BigNumberCard title="Overdue Decisions" value={overdue} accent="rose" />
        <BigNumberCard title="Blocked" value={blocked} accent="amber" />
        <BigNumberCard title="In Progress" value={inProgress} accent="emerald" />
      </div>

      {/* Row 2: Open · Member summary · Donut */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <OpenDecisionsCard decisions={openDecisions} />
        <MemberSummaryCard members={members} decisions={decisions} />
        <ByStatusCard counts={counts} total={decisions.length} />
      </div>

      {/* Pins */}
      <PinsCard />
    </div>
  )
}

// ── Card chrome ────────────────────────────────────────────────────────────

function CardShell({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}): JSX.Element {
  return (
    <section
      className={[
        'flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300/80',
        className ?? '',
      ].join(' ')}
    >
      <header className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <h3 className="text-[12.5px] font-bold text-slate-900">{title}</h3>
        <div className="flex items-center gap-1 text-slate-400">
          <button
            type="button"
            aria-label={`${title} options`}
            className="flex h-6 w-6 items-center justify-center rounded transition hover:bg-slate-100 hover:text-slate-700"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label={`Expand ${title}`}
            className="flex h-6 w-6 items-center justify-center rounded transition hover:bg-slate-100 hover:text-slate-700"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
        </div>
      </header>
      {children}
    </section>
  )
}

// ── Big number card ───────────────────────────────────────────────────────

const ACCENT: Record<'rose' | 'amber' | 'emerald', { ring: string; text: string }> = {
  rose: { ring: 'ring-rose-200/60', text: 'text-rose-600' },
  amber: { ring: 'ring-amber-200/60', text: 'text-amber-600' },
  emerald: { ring: 'ring-emerald-200/60', text: 'text-emerald-600' },
}

function BigNumberCard({
  title,
  value,
  accent,
}: {
  title: string
  value: number
  accent: keyof typeof ACCENT
}): JSX.Element {
  const a = ACCENT[accent]
  return (
    <CardShell title={title} className={`ring-1 ${a.ring}`}>
      <div className="flex flex-1 items-center justify-center py-10">
        <span className={`text-6xl font-black tabular-nums ${a.text}`}>{value}</span>
      </div>
    </CardShell>
  )
}

// ── Open decisions list ───────────────────────────────────────────────────

function OpenDecisionsCard({ decisions }: { decisions: MockFullDecision[] }): JSX.Element {
  const groups: Array<{ key: CountKey; items: MockFullDecision[] }> = (
    ['DRAFT', 'PROPOSED', 'ACCEPTED'] as CountKey[]
  ).map((k) => ({ key: k, items: decisions.filter((d) => d.state === k) }))

  return (
    <CardShell title="Open Decisions">
      <div className="flex flex-1 flex-col">
        <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Title
        </div>
        <div className="dv-thin-scroll max-h-[280px] flex-1 overflow-y-auto">
          {groups.map((g) => {
            if (g.items.length === 0) return null
            const meta = STATE_META[g.key]
            return (
              <div key={g.key} className="border-t border-slate-100">
                <div className="flex items-center gap-2 px-4 py-1.5">
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ${meta.bg} ${meta.fg}`}
                  >
                    {meta.label}
                  </span>
                  <span className="text-[10px] font-semibold tabular-nums text-slate-500">
                    {g.items.length}
                  </span>
                </div>
                <ul className="pb-1">
                  {g.items.slice(0, 4).map((d) => (
                    <li key={d.id} className="flex items-center gap-2 px-4 py-1.5 transition hover:bg-slate-50/70">
                      <span className={`h-3 w-3 shrink-0 rounded-sm ${meta.dot}`} aria-hidden="true" />
                      <span className="truncate text-[12px] text-slate-700">
                        {d.title ?? d.rationale.split('.')[0]}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
          {decisions.length === 0 && (
            <div className="flex flex-1 items-center justify-center py-12 text-[11px] text-slate-400">
              No open decisions yet
            </div>
          )}
        </div>
      </div>
    </CardShell>
  )
}

// ── Member summary ────────────────────────────────────────────────────────

function MemberSummaryCard({
  members,
  decisions,
}: {
  members: MockMember[]
  decisions: MockFullDecision[]
}): JSX.Element {
  const top = members.slice(0, 3)
  return (
    <CardShell title="Member Tasks Summary">
      <div className="flex flex-1 flex-col">
        {top.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-12 text-[11px] text-slate-400">
            There&apos;s no data to display
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {top.map((m) => {
              const openCount = decisions.filter(
                (d) =>
                  d.assignee_name === m.name &&
                  (d.state === 'DRAFT' || d.state === 'PROPOSED'),
              ).length
              return (
                <li key={m.id} className="flex items-center gap-2.5 px-4 py-2.5">
                  <Avatar name={m.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-slate-900">{m.name}</p>
                    <p className="truncate text-[10.5px] text-slate-500">{m.role}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tabular-nums text-slate-600">
                    {openCount}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </CardShell>
  )
}

// ── Donut: decisions by status ────────────────────────────────────────────

function ByStatusCard({ counts, total }: { counts: Record<CountKey, number>; total: number }): JSX.Element {
  const order: CountKey[] = ['DRAFT', 'PROPOSED', 'ACCEPTED', 'REJECTED']
  return (
    <CardShell title="Decisions By Status">
      <div className="flex flex-1 flex-col">
        {/* Legend */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-4 py-2.5">
          {order.map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5 text-[10.5px] text-slate-600">
              <span
                className={`h-2 w-2 rounded-full ${STATE_META[k].dot}`}
                aria-hidden="true"
              />
              {STATE_META[k].label}
            </span>
          ))}
        </div>
        <div className="flex flex-1 items-center justify-center pb-5">
          {total === 0 ? (
            <p className="text-[11px] text-slate-400">There&apos;s no data to display</p>
          ) : (
            <Donut
              segments={order.map((k) => ({ value: counts[k], color: STATE_META[k].color }))}
              total={total}
            />
          )}
        </div>
      </div>
    </CardShell>
  )
}

function Donut({
  segments,
  total,
}: {
  segments: Array<{ value: number; color: string }>
  total: number
}): JSX.Element {
  const cx = 80
  const cy = 80
  const r = 58
  const inner = r * 0.58
  let cumulative = 0

  return (
    <svg viewBox="0 0 160 160" className="h-36 w-36" aria-label="Decisions by status">
      <circle cx={cx} cy={cy} r={r} fill="#f1f5f9" />
      {segments.map((seg, i) => {
        if (seg.value === 0) return null
        const start = (cumulative / total) * 2 * Math.PI - Math.PI / 2
        cumulative += seg.value
        const end = (cumulative / total) * 2 * Math.PI - Math.PI / 2
        const x1 = cx + r * Math.cos(start)
        const y1 = cy + r * Math.sin(start)
        const x2 = cx + r * Math.cos(end)
        const y2 = cy + r * Math.sin(end)
        const largeArc = end - start > Math.PI ? 1 : 0
        const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
        return <path key={i} d={path} fill={seg.color} />
      })}
      <circle cx={cx} cy={cy} r={inner} fill="white" />
      <text
        x={cx}
        y={cy + 4}
        textAnchor="middle"
        fontSize="22"
        fontWeight="800"
        fill="#0f172a"
        fontFamily="ui-monospace, monospace"
      >
        {total}
      </text>
    </svg>
  )
}

// ── Pins (empty state) ────────────────────────────────────────────────────

function PinsCard(): JSX.Element {
  return (
    <CardShell title="Pins">
      <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-500">
          <Pin className="h-7 w-7 -rotate-12" />
        </div>
        <p className="mt-3 text-sm font-bold text-slate-900">No Pins Added</p>
        <p className="mt-1 max-w-md text-[11.5px] leading-relaxed text-slate-500">
          Pin important files, links, or dashboards to see them here.
        </p>
        <button
          type="button"
          className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-primary/40 hover:text-primary"
        >
          <Plus className="h-3 w-3" />
          Pin
        </button>
      </div>
    </CardShell>
  )
}
