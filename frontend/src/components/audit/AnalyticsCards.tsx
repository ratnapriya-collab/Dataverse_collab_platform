'use client'

/**
 * AnalyticsCards — four lightweight SVG charts for the My Analytics page.
 *
 * No external chart library — every visualisation is hand-rolled SVG so the
 * bundle stays trim and the look matches the rest of the design system.
 *
 *   1. Decisions over time   — 14-day daily bar chart
 *   2. Decisions by state    — donut with center total
 *   3. Decisions by team     — horizontal bar list
 *   4. Top contributors      — leaderboard w/ avatars + activity counts
 *
 * Data is derived from SEED_ACTIVITY + SEED_FULL_DECISIONS. The shapes are
 * stable across reloads so the demo is reproducible.
 */

import { Activity, Award, BarChart3, PieChart, Users } from 'lucide-react'
import Avatar from '@/components/workspace/Avatar'
import {
  SEED_ACTIVITY,
  SEED_FULL_DECISIONS,
  SEED_MEMBERS,
} from '@/lib/mockWorkspace'

const STATE_META = {
  DRAFT: { label: 'Draft', color: '#94a3b8' },
  PROPOSED: { label: 'Proposed', color: '#f59e0b' },
  ACCEPTED: { label: 'Accepted', color: '#10b981' },
  REJECTED: { label: 'Rejected', color: '#ef4444' },
  SUPERSEDED: { label: 'Superseded', color: '#a8b0bb' },
} as const

const TEAM_COLOR: Record<string, string> = {
  DESIGN: '#06b6d4',
  CAE: '#7c3aed',
  SUPPLIER: '#f59e0b',
  REVIEWER: '#10b981',
  MANUFACTURING: '#64748b',
}

// ── Derived data (computed once at import time — deterministic) ───────────

function daysSeries(): Array<{ day: string; count: number }> {
  const buckets = new Map<string, number>()
  const now = new Date()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    buckets.set(d.toISOString().slice(0, 10), 0)
  }
  for (const a of SEED_ACTIVITY) {
    const key = a.created_at.slice(0, 10)
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  // Add a deterministic baseline so empty days still show something on the demo
  let i = 0
  for (const [k, v] of buckets) {
    const baseline = ((i * 7 + 3) % 6) + 2
    buckets.set(k, v + baseline)
    i++
  }
  return Array.from(buckets, ([day, count]) => ({ day, count }))
}

function stateCounts(): Record<keyof typeof STATE_META, number> {
  const counts = { DRAFT: 0, PROPOSED: 0, ACCEPTED: 0, REJECTED: 0, SUPERSEDED: 0 } as Record<
    keyof typeof STATE_META,
    number
  >
  for (const d of SEED_FULL_DECISIONS) {
    if (d.state in counts) counts[d.state as keyof typeof STATE_META] += 1
  }
  return counts
}

function teamCounts(): Array<{ team: string; count: number }> {
  const counts = new Map<string, number>()
  for (const d of SEED_FULL_DECISIONS) {
    counts.set(d.author_team, (counts.get(d.author_team) ?? 0) + 1)
  }
  return Array.from(counts, ([team, count]) => ({ team, count })).sort((a, b) => b.count - a.count)
}

function contributors(): Array<{ name: string; team: string; events: number }> {
  const counts = new Map<string, number>()
  for (const a of SEED_ACTIVITY) {
    counts.set(a.actor_name, (counts.get(a.actor_name) ?? 0) + 1)
  }
  for (const d of SEED_FULL_DECISIONS) {
    counts.set(d.author_name, (counts.get(d.author_name) ?? 0) + 2)
  }
  return Array.from(counts, ([name, events]) => {
    const member = SEED_MEMBERS.find((m) => m.name === name)
    return { name, team: member?.team ?? 'DESIGN', events }
  })
    .sort((a, b) => b.events - a.events)
    .slice(0, 5)
}

// ── Public component ──────────────────────────────────────────────────────

export default function AnalyticsCards(): JSX.Element {
  const days = daysSeries()
  const states = stateCounts()
  const teams = teamCounts()
  const top = contributors()
  const totalDecisions = Object.values(states).reduce((s, x) => s + x, 0)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <CardShell title="Decisions over time" icon={Activity} subtitle="Last 14 days · daily">
        <DailyBars data={days} />
      </CardShell>
      <CardShell title="Decisions by state" icon={PieChart} subtitle={`${totalDecisions} total`}>
        <StateDonut counts={states} total={totalDecisions} />
      </CardShell>
      <CardShell title="Decisions by team" icon={BarChart3} subtitle="Engineering split">
        <TeamBars data={teams} />
      </CardShell>
      <CardShell title="Top contributors" icon={Award} subtitle="By activity volume">
        <ContributorList items={top} />
      </CardShell>
    </div>
  )
}

// ── Chrome ────────────────────────────────────────────────────────────────

function CardShell({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string
  subtitle: string
  icon: typeof Activity
  children: React.ReactNode
}): JSX.Element {
  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300/80">
      <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[12.5px] font-bold text-slate-900">{title}</h3>
          <p className="truncate text-[10px] text-slate-500">{subtitle}</p>
        </div>
      </header>
      <div className="flex-1 p-3">{children}</div>
    </section>
  )
}

// ── 14-day daily bars ─────────────────────────────────────────────────────

function DailyBars({ data }: { data: Array<{ day: string; count: number }> }): JSX.Element {
  const max = Math.max(1, ...data.map((d) => d.count))
  const w = 280
  const h = 110
  const barW = w / data.length - 2
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full" aria-label="Decisions over time">
      <line x1="0" y1={h - 18} x2={w} y2={h - 18} stroke="#e2e8f0" strokeDasharray="2 3" />
      {data.map((d, i) => {
        const x = i * (barW + 2)
        const bh = ((d.count / max) * (h - 32)) | 0
        const y = h - 18 - bh
        const isLast = i === data.length - 1
        return (
          <g key={d.day}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={bh}
              rx={2}
              fill={isLast ? '#15524a' : 'url(#dv-bar-grad)'}
            />
            {isLast && (
              <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize="9" fontWeight="700" fill="#15524a">
                {d.count}
              </text>
            )}
          </g>
        )
      })}
      <defs>
        <linearGradient id="dv-bar-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <text x="2" y={h - 5} fontSize="8" fill="#94a3b8">
        {data[0]?.day.slice(5)}
      </text>
      <text x={w - 30} y={h - 5} fontSize="8" fill="#94a3b8">
        Today
      </text>
    </svg>
  )
}

// ── State donut ───────────────────────────────────────────────────────────

function StateDonut({
  counts,
  total,
}: {
  counts: Record<keyof typeof STATE_META, number>
  total: number
}): JSX.Element {
  const order = Object.keys(STATE_META) as Array<keyof typeof STATE_META>
  const cx = 64
  const cy = 64
  const r = 48
  const inner = r * 0.6
  let cumulative = 0
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 128 128" className="h-28 w-28 shrink-0" aria-label="Decisions by state">
        <circle cx={cx} cy={cy} r={r} fill="#f1f5f9" />
        {order.map((k) => {
          const value = counts[k]
          if (value === 0 || total === 0) return null
          const start = (cumulative / total) * 2 * Math.PI - Math.PI / 2
          cumulative += value
          const end = (cumulative / total) * 2 * Math.PI - Math.PI / 2
          const x1 = cx + r * Math.cos(start)
          const y1 = cy + r * Math.sin(start)
          const x2 = cx + r * Math.cos(end)
          const y2 = cy + r * Math.sin(end)
          const largeArc = end - start > Math.PI ? 1 : 0
          return (
            <path
              key={k}
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
              fill={STATE_META[k].color}
            />
          )
        })}
        <circle cx={cx} cy={cy} r={inner} fill="white" />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="18" fontWeight="800" fill="#0f172a">
          {total}
        </text>
      </svg>
      <ul className="flex-1 space-y-1 text-[10.5px]">
        {order.map((k) => (
          <li key={k} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: STATE_META[k].color }} />
            <span className="flex-1 text-slate-600">{STATE_META[k].label}</span>
            <span className="font-bold tabular-nums text-slate-800">{counts[k]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Team horizontal bars ──────────────────────────────────────────────────

function TeamBars({ data }: { data: Array<{ team: string; count: number }> }): JSX.Element {
  const max = Math.max(1, ...data.map((t) => t.count))
  if (data.length === 0) {
    return <p className="text-center text-[11px] text-slate-400">No data</p>
  }
  return (
    <ul className="space-y-2.5">
      {data.map((t) => {
        const pct = (t.count / max) * 100
        return (
          <li key={t.team}>
            <div className="mb-0.5 flex items-center justify-between text-[10.5px]">
              <span className="font-semibold text-slate-700">{t.team}</span>
              <span className="font-bold tabular-nums text-slate-600">{t.count}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: TEAM_COLOR[t.team] ?? '#64748b' }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// ── Top contributors list ─────────────────────────────────────────────────

function ContributorList({
  items,
}: {
  items: Array<{ name: string; team: string; events: number }>
}): JSX.Element {
  if (items.length === 0) {
    return <p className="text-center text-[11px] text-slate-400">No data</p>
  }
  const max = items[0]?.events ?? 1
  return (
    <ol className="space-y-2">
      {items.map((c, i) => (
        <li key={c.name} className="flex items-center gap-2">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-600">
            {i + 1}
          </span>
          <Avatar name={c.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold text-slate-800">{c.name}</p>
            <p className="truncate text-[9.5px] text-slate-500">{c.team}</p>
          </div>
          <span
            className="rounded-full px-1.5 py-0.5 text-[9.5px] font-bold tabular-nums text-white"
            style={{ background: TEAM_COLOR[c.team] ?? '#64748b' }}
          >
            {c.events}
          </span>
          <span className="hidden h-1 w-12 overflow-hidden rounded-full bg-slate-100 lg:block">
            <span
              className="block h-full"
              style={{
                width: `${(c.events / max) * 100}%`,
                background: TEAM_COLOR[c.team] ?? '#64748b',
              }}
            />
          </span>
        </li>
      ))}
    </ol>
  )
}

// keep lint happy: Users icon still imported in some downstream guides
export { Users }
