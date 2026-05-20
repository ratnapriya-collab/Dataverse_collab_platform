'use client'

/**
 * ProjectOverviewTab — Slingshot-style dashboard for /projects/[id].
 *
 * Seven widgets wired to this project's real decisions + members:
 *   · Overdue Decisions     — PROPOSED for > 24h
 *   · Blocked               — priority 'blocker' OR has Blocker tag
 *   · In Progress           — state DRAFT
 *   · Open Decisions list   — grouped by state (DRAFT · PROPOSED · ACCEPTED)
 *   · Member Workload       — assignees + open count
 *   · Decisions By Status   — SVG donut + legend
 *   · Pins                  — empty state (no pinning wired)
 *
 * Each card carries:
 *   1. A 3-dots menu → Edit · Copy Link · Bookmark
 *   2. An expand toggle → swaps the grid for a full-pane detail view of just
 *      that card (BigNumber cards show the count + a decisions table on the
 *      right; the other cards expand to a roomier version of themselves).
 */

import { useEffect, useRef, useState } from 'react'
import {
  Bookmark,
  ChevronDown,
  ClipboardCheck,
  Edit3,
  Link2,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Pin,
  Plus,
  RefreshCw,
} from 'lucide-react'
import Avatar from '@/components/workspace/Avatar'
import { formatTimeAgo, type MockFullDecision, type MockMember } from '@/lib/mockWorkspace'

interface Props {
  decisions: MockFullDecision[]
  members: MockMember[]
  bookmarks: string[]
  onToggleBookmark: (id: string) => void
}

export type CardId = 'overdue' | 'blocked' | 'in-progress' | 'open' | 'members' | 'by-status' | 'pins'

export const CARD_TITLES: Record<CardId, string> = {
  overdue: 'Overdue Decisions',
  blocked: 'Blocked',
  'in-progress': 'In Progress',
  open: 'Open Decisions',
  members: 'Member Tasks Summary',
  'by-status': 'Decisions By Status',
  pins: 'Pins',
}

type CountKey = 'DRAFT' | 'PROPOSED' | 'ACCEPTED' | 'REJECTED'

const STATE_META: Record<CountKey, { label: string; color: string; dot: string; bg: string; fg: string }> = {
  DRAFT: { label: 'Draft', color: '#94a3b8', dot: 'bg-slate-400', bg: 'bg-slate-100', fg: 'text-slate-600' },
  PROPOSED: { label: 'Proposed', color: '#f59e0b', dot: 'bg-amber-500', bg: 'bg-amber-50', fg: 'text-amber-700' },
  ACCEPTED: { label: 'Accepted', color: '#10b981', dot: 'bg-emerald-500', bg: 'bg-emerald-50', fg: 'text-emerald-700' },
  REJECTED: { label: 'Rejected', color: '#ef4444', dot: 'bg-rose-500', bg: 'bg-rose-50', fg: 'text-rose-700' },
}

const ACCENT: Record<'rose' | 'amber' | 'emerald', { ring: string; text: string }> = {
  rose: { ring: 'ring-rose-200/60', text: 'text-rose-600' },
  amber: { ring: 'ring-amber-200/60', text: 'text-amber-600' },
  emerald: { ring: 'ring-emerald-200/60', text: 'text-emerald-600' },
}

const ONE_DAY_MS = 24 * 3_600_000

export default function ProjectOverviewTab({
  decisions,
  members,
  bookmarks,
  onToggleBookmark,
}: Props): JSX.Element {
  const [expandedId, setExpandedId] = useState<CardId | null>(null)
  const [menuId, setMenuId] = useState<CardId | null>(null)

  // ESC closes whatever's open; outside-click closes the menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (menuId !== null) setMenuId(null)
      else if (expandedId !== null) setExpandedId(null)
    }
    const onMouseDown = (e: MouseEvent) => {
      if (menuId === null) return
      const t = e.target as Element | null
      if (!t?.closest?.('[data-card-menu]')) setMenuId(null)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onMouseDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onMouseDown)
    }
  }, [menuId, expandedId])

  const now = Date.now()
  const overdueDecs = decisions.filter(
    (d) => d.state === 'PROPOSED' && now - +new Date(d.created_at) > ONE_DAY_MS,
  )
  const blockedDecs = decisions.filter(
    (d) => d.priority === 'blocker' || (d.tags?.includes('Blocker') ?? false),
  )
  const inProgressDecs = decisions.filter((d) => d.state === 'DRAFT')
  const openDecs = decisions.filter(
    (d) => d.state === 'DRAFT' || d.state === 'PROPOSED' || d.state === 'ACCEPTED',
  )

  const counts: Record<CountKey, number> = {
    DRAFT: decisions.filter((d) => d.state === 'DRAFT').length,
    PROPOSED: decisions.filter((d) => d.state === 'PROPOSED').length,
    ACCEPTED: decisions.filter((d) => d.state === 'ACCEPTED').length,
    REJECTED: decisions.filter((d) => d.state === 'REJECTED').length,
  }

  function cardProps(id: CardId): CardChromeProps {
    return {
      id,
      expanded: expandedId === id,
      onToggleExpand: () => setExpandedId((p) => (p === id ? null : id)),
      menuOpen: menuId === id,
      onToggleMenu: () => setMenuId((p) => (p === id ? null : id)),
      bookmarked: bookmarks.includes(id),
      onBookmark: () => {
        onToggleBookmark(id)
        setMenuId(null)
      },
    }
  }

  return (
    <div className="space-y-5">
      <SubHeader />

      {expandedId !== null ? (
        <ExpandedView
          expandedId={expandedId}
          cardProps={cardProps}
          decisions={decisions}
          openDecs={openDecs}
          overdueDecs={overdueDecs}
          blockedDecs={blockedDecs}
          inProgressDecs={inProgressDecs}
          members={members}
          counts={counts}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <BigNumberCard {...cardProps('overdue')} title="Overdue Decisions" accent="rose" value={overdueDecs.length} items={overdueDecs} />
            <BigNumberCard {...cardProps('blocked')} title="Blocked" accent="amber" value={blockedDecs.length} items={blockedDecs} />
            <BigNumberCard {...cardProps('in-progress')} title="In Progress" accent="emerald" value={inProgressDecs.length} items={inProgressDecs} />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <OpenDecisionsCard {...cardProps('open')} decisions={openDecs} />
            <MemberSummaryCard {...cardProps('members')} members={members} decisions={decisions} />
            <ByStatusCard {...cardProps('by-status')} counts={counts} total={decisions.length} />
          </div>
          <PinsCard {...cardProps('pins')} />
        </>
      )}
    </div>
  )
}

// ── Sub-header (above the cards) ──────────────────────────────────────────

function SubHeader(): JSX.Element {
  return (
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
  )
}

// ── Card chrome (title bar + menu + expand) ───────────────────────────────

interface CardChromeProps {
  id: CardId
  expanded: boolean
  onToggleExpand: () => void
  menuOpen: boolean
  onToggleMenu: () => void
  bookmarked: boolean
  onBookmark: () => void
}

function CardShell({
  title,
  accent,
  expanded,
  onToggleExpand,
  menuOpen,
  onToggleMenu,
  bookmarked,
  onBookmark,
  children,
  className,
}: CardChromeProps & {
  title: string
  accent?: keyof typeof ACCENT
  children: React.ReactNode
  className?: string
}): JSX.Element {
  const a = accent !== undefined ? ACCENT[accent] : null
  return (
    <section
      className={[
        'flex flex-col overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300/80',
        a !== null ? `ring-1 ${a.ring}` : '',
        className ?? '',
      ].join(' ')}
    >
      <header className="relative flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <h3 className="text-[12.5px] font-bold text-slate-900">{title}</h3>
        <div className="flex items-center gap-1 text-slate-400">
          <div className="relative" data-card-menu>
            <button
              type="button"
              aria-label={`${title} options`}
              aria-expanded={menuOpen}
              onClick={(e) => {
                e.stopPropagation()
                onToggleMenu()
              }}
              className={[
                'flex h-6 w-6 items-center justify-center rounded transition',
                menuOpen
                  ? 'bg-primary-50 text-primary'
                  : 'hover:bg-slate-100 hover:text-slate-700',
              ].join(' ')}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
            {menuOpen && <CardMenu bookmarked={bookmarked} onBookmark={onBookmark} />}
          </div>
          <button
            type="button"
            aria-label={expanded ? `Collapse ${title}` : `Expand ${title}`}
            onClick={onToggleExpand}
            className="flex h-6 w-6 items-center justify-center rounded transition hover:bg-slate-100 hover:text-slate-700"
          >
            {expanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>
        </div>
      </header>
      {children}
    </section>
  )
}

function CardMenu({
  bookmarked,
  onBookmark,
}: {
  bookmarked: boolean
  onBookmark: () => void
}): JSX.Element {
  const items: Array<{ icon: typeof Edit3; label: string; onClick?: () => void; active?: boolean }> = [
    { icon: Edit3, label: 'Edit' },
    { icon: Link2, label: 'Copy Link' },
    {
      icon: Bookmark,
      label: bookmarked ? 'Remove bookmark' : 'Bookmark',
      onClick: onBookmark,
      active: bookmarked,
    },
  ]
  return (
    <div
      role="menu"
      className="dv-anim-pop absolute right-0 top-7 z-30 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
    >
      {items.map((it, idx) => {
        const Icon = it.icon
        return (
          <button
            key={it.label}
            type="button"
            role="menuitem"
            onClick={it.onClick}
            className={[
              'flex w-full items-center gap-2.5 px-3 py-2 text-[12px] transition hover:bg-slate-50',
              idx > 0 ? 'border-t border-slate-100' : '',
              it.active === true ? 'text-primary font-semibold' : 'text-slate-700',
            ].join(' ')}
          >
            <Icon
              className={[
                'h-3.5 w-3.5',
                it.active === true ? 'fill-primary text-primary' : 'text-slate-500',
              ].join(' ')}
            />
            {it.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Big number card ───────────────────────────────────────────────────────

function BigNumberCard({
  title,
  value,
  accent,
  items,
  ...chrome
}: CardChromeProps & {
  title: string
  value: number
  accent: keyof typeof ACCENT
  items: MockFullDecision[]
}): JSX.Element {
  const a = ACCENT[accent]
  if (chrome.expanded) {
    return (
      <CardShell title={title} accent={accent} {...chrome} className="min-h-[68vh]">
        <div className="flex flex-1 flex-col md:flex-row">
          <div className="flex w-full items-center justify-center border-b border-slate-100 py-12 md:w-[26%] md:border-b-0 md:border-r md:py-0">
            <span className={`text-[120px] font-black leading-none tabular-nums ${a.text}`}>
              {value}
            </span>
          </div>
          <div className="flex-1">
            <DecisionTable items={items} />
          </div>
        </div>
      </CardShell>
    )
  }
  return (
    <CardShell title={title} accent={accent} {...chrome}>
      <div className="flex flex-1 items-center justify-center py-10">
        <span className={`text-6xl font-black tabular-nums ${a.text}`}>{value}</span>
      </div>
    </CardShell>
  )
}

// ── Decisions table (used in BigNumber expanded view) ─────────────────────

function DecisionTable({ items }: { items: MockFullDecision[] }): JSX.Element {
  if (items.length === 0) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center px-6 text-[12px] text-slate-400">
        No matching decisions
      </div>
    )
  }
  return (
    <div className="dv-thin-scroll h-full overflow-auto">
      <table className="w-full text-left text-[12px]">
        <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm">
          <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <th className="px-4 py-2.5">Title</th>
            <th className="px-3 py-2.5">Status</th>
            <th className="px-3 py-2.5">Assignee</th>
            <th className="px-3 py-2.5 text-right">↑ Due Date</th>
            <th className="w-10 px-2 py-2.5 text-right">
              <Plus className="ml-auto h-3 w-3 text-slate-400" />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((d) => {
            const meta = STATE_META[d.state as CountKey] ?? STATE_META.DRAFT
            return (
              <tr key={d.id} className="transition hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-slate-300" />
                    <ClipboardCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    <span className="truncate text-slate-800">
                      {d.title ?? d.rationale.split('.')[0]}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.bg} ${meta.fg}`}
                  >
                    {meta.label}
                  </span>
                </td>
                <td className="px-3 py-3">
                  {d.assignee_name !== undefined ? (
                    <div className="flex items-center gap-1.5">
                      <Avatar name={d.assignee_name} size="sm" />
                      <span className="truncate text-slate-700">{d.assignee_name}</span>
                    </div>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-right text-rose-600">
                  {formatTimeAgo(d.created_at)}
                </td>
                <td className="px-2 py-3 text-right">
                  <button
                    type="button"
                    aria-label="Row actions"
                    className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Open decisions list ───────────────────────────────────────────────────

function OpenDecisionsCard({
  decisions,
  ...chrome
}: CardChromeProps & { decisions: MockFullDecision[] }): JSX.Element {
  const groups: Array<{ key: CountKey; items: MockFullDecision[] }> = (
    ['DRAFT', 'PROPOSED', 'ACCEPTED'] as CountKey[]
  ).map((k) => ({ key: k, items: decisions.filter((d) => d.state === k) }))

  const expanded = chrome.expanded
  return (
    <CardShell title="Open Decisions" {...chrome} className={expanded ? 'min-h-[68vh]' : ''}>
      <div className="flex flex-1 flex-col">
        <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Title
        </div>
        <div className={`dv-thin-scroll flex-1 overflow-y-auto ${expanded ? '' : 'max-h-[280px]'}`}>
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
                  {g.items.slice(0, expanded ? g.items.length : 4).map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center gap-2 px-4 py-1.5 transition hover:bg-slate-50/70"
                    >
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
  ...chrome
}: CardChromeProps & { members: MockMember[]; decisions: MockFullDecision[] }): JSX.Element {
  const list = chrome.expanded ? members : members.slice(0, 3)
  return (
    <CardShell title="Member Tasks Summary" {...chrome} className={chrome.expanded ? 'min-h-[68vh]' : ''}>
      <div className="flex flex-1 flex-col">
        {list.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-12 text-[11px] text-slate-400">
            There&apos;s no data to display
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.map((m) => {
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

function ByStatusCard({
  counts,
  total,
  ...chrome
}: CardChromeProps & { counts: Record<CountKey, number>; total: number }): JSX.Element {
  const order: CountKey[] = ['DRAFT', 'PROPOSED', 'ACCEPTED', 'REJECTED']
  const expanded = chrome.expanded
  return (
    <CardShell title="Decisions By Status" {...chrome} className={expanded ? 'min-h-[68vh]' : ''}>
      <div className="flex flex-1 flex-col">
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-4 py-2.5">
          {order.map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5 text-[10.5px] text-slate-600">
              <span className={`h-2 w-2 rounded-full ${STATE_META[k].dot}`} aria-hidden="true" />
              {STATE_META[k].label}
              <span className="font-bold tabular-nums text-slate-700">{counts[k]}</span>
            </span>
          ))}
        </div>
        <div className="flex flex-1 items-center justify-center pb-5">
          {total === 0 ? (
            <p className="text-[11px] text-slate-400">There&apos;s no data to display</p>
          ) : (
            <Donut
              size={expanded ? 280 : 144}
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
  size,
}: {
  segments: Array<{ value: number; color: string }>
  total: number
  size: number
}): JSX.Element {
  const cx = 80
  const cy = 80
  const r = 58
  const inner = r * 0.58
  let cumulative = 0
  return (
    <svg viewBox="0 0 160 160" style={{ width: size, height: size }} aria-label="Decisions by status">
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

function PinsCard(props: CardChromeProps): JSX.Element {
  return (
    <CardShell title="Pins" {...props} className={props.expanded ? 'min-h-[68vh]' : ''}>
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

// ── Expanded full-pane dispatcher ─────────────────────────────────────────

function ExpandedView({
  expandedId,
  cardProps,
  decisions,
  openDecs,
  overdueDecs,
  blockedDecs,
  inProgressDecs,
  members,
  counts,
}: {
  expandedId: CardId
  cardProps: (id: CardId) => CardChromeProps
  decisions: MockFullDecision[]
  openDecs: MockFullDecision[]
  overdueDecs: MockFullDecision[]
  blockedDecs: MockFullDecision[]
  inProgressDecs: MockFullDecision[]
  members: MockMember[]
  counts: Record<CountKey, number>
}): JSX.Element {
  switch (expandedId) {
    case 'overdue':
      return (
        <BigNumberCard
          {...cardProps('overdue')}
          title="Overdue Decisions"
          accent="rose"
          value={overdueDecs.length}
          items={overdueDecs}
        />
      )
    case 'blocked':
      return (
        <BigNumberCard
          {...cardProps('blocked')}
          title="Blocked"
          accent="amber"
          value={blockedDecs.length}
          items={blockedDecs}
        />
      )
    case 'in-progress':
      return (
        <BigNumberCard
          {...cardProps('in-progress')}
          title="In Progress"
          accent="emerald"
          value={inProgressDecs.length}
          items={inProgressDecs}
        />
      )
    case 'open':
      return <OpenDecisionsCard {...cardProps('open')} decisions={openDecs} />
    case 'members':
      return <MemberSummaryCard {...cardProps('members')} members={members} decisions={decisions} />
    case 'by-status':
      return <ByStatusCard {...cardProps('by-status')} counts={counts} total={decisions.length} />
    case 'pins':
      return <PinsCard {...cardProps('pins')} />
  }
}
