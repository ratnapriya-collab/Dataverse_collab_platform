'use client'

/**
 * FeedbackPanel — CoLab-style issue tracker for a project.
 *
 * Renders the project's decisions as filterable, exportable issue rows:
 *   • Saved views   (All · Open blockers · My assigned · Resolved)
 *   • Filter chips  by tag, priority, status, assignee
 *   • Search        by title / id / rationale / anchor
 *   • Columns       toggle (creator / tags / priority / status / assignee / created)
 *   • Export CSV    real Blob download (project-scoped)
 *   • Table         priority-bar on the left, click any row → /parts/[id]?focus=DEC-…
 */

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  ChevronDown,
  Columns as ColumnsIcon,
  Download,
  Inbox,
  ListFilter,
  Search,
  Sparkles,
} from 'lucide-react'
import Avatar from '@/components/workspace/Avatar'
import TeamBadge from '@/components/workspace/TeamBadge'
import IssueTagChip, { ALL_TAGS } from './IssueTagChip'
import PriorityIndicator, {
  ALL_PRIORITIES,
  priorityBarClass,
} from './PriorityIndicator'
import {
  formatTimeAgo,
  type FullDecisionState,
  type IssuePriority,
  type IssueTag,
  type MockFullDecision,
} from '@/lib/mockWorkspace'

const STATE_PILL: Record<FullDecisionState, { bg: string; fg: string; label: string; dot: string }> = {
  DRAFT: { bg: 'bg-slate-100', fg: 'text-slate-600', label: 'Draft', dot: 'bg-slate-400' },
  PROPOSED: { bg: 'bg-amber-50', fg: 'text-amber-700', label: 'Proposed', dot: 'bg-amber-500' },
  ACCEPTED: { bg: 'bg-emerald-50', fg: 'text-emerald-700', label: 'Accepted', dot: 'bg-emerald-500' },
  REJECTED: { bg: 'bg-rose-50', fg: 'text-rose-700', label: 'Rejected', dot: 'bg-rose-500' },
  SUPERSEDED: { bg: 'bg-slate-100', fg: 'text-slate-500', label: 'Superseded', dot: 'bg-slate-400' },
}

type SavedView = 'all' | 'open-blockers' | 'my-assigned' | 'resolved'

const SAVED_VIEWS: ReadonlyArray<{ id: SavedView; label: string; hint: string }> = [
  { id: 'all', label: 'All', hint: 'every issue on this project' },
  { id: 'open-blockers', label: 'Open blockers', hint: 'priority blocker · still open' },
  { id: 'my-assigned', label: 'My assigned', hint: 'issues with you as assignee' },
  { id: 'resolved', label: 'Resolved', hint: 'accepted or superseded' },
]

type ColumnKey = 'creator' | 'tags' | 'priority' | 'status' | 'assignee' | 'created'
const ALL_COLUMNS: ReadonlyArray<{ key: ColumnKey; label: string }> = [
  { key: 'creator', label: 'Creator' },
  { key: 'tags', label: 'Tags' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'created', label: 'Created' },
]

interface Props {
  /** All decisions visible on this project, already filtered by project_id by the parent. */
  decisions: MockFullDecision[]
  /** Name of the signed-in user — drives the "My assigned" saved view. */
  currentUserName: string
}

export default function FeedbackPanel({ decisions, currentUserName }: Props): JSX.Element {
  const [view, setView] = useState<SavedView>('all')
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState<IssueTag | 'ALL'>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<IssuePriority | 'ALL'>('ALL')
  const [statusFilter, setStatusFilter] = useState<FullDecisionState | 'ALL'>('ALL')
  const [assigneeFilter, setAssigneeFilter] = useState<string | 'ALL'>('ALL')
  const [visibleCols, setVisibleCols] = useState<Set<ColumnKey>>(
    () => new Set(ALL_COLUMNS.map((c) => c.key)),
  )
  const [showColumnsMenu, setShowColumnsMenu] = useState(false)

  // ── Filtering pipeline ────────────────────────────────────────────────────
  const filtered = useMemo<MockFullDecision[]>(() => {
    const q = search.trim().toLowerCase()
    return decisions
      .filter((d) => {
        // Saved view
        if (view === 'open-blockers') {
          if (d.priority !== 'blocker') return false
          if (d.state === 'ACCEPTED' || d.state === 'SUPERSEDED' || d.state === 'REJECTED') {
            return false
          }
        }
        if (view === 'my-assigned' && d.assignee_name !== currentUserName) return false
        if (view === 'resolved' && d.state !== 'ACCEPTED' && d.state !== 'SUPERSEDED') return false

        // Filter chips
        if (tagFilter !== 'ALL' && !(d.tags ?? []).includes(tagFilter)) return false
        if (priorityFilter !== 'ALL' && d.priority !== priorityFilter) return false
        if (statusFilter !== 'ALL' && d.state !== statusFilter) return false
        if (assigneeFilter !== 'ALL' && d.assignee_name !== assigneeFilter) return false

        // Search
        if (q.length > 0) {
          const blob = `${d.title ?? ''} ${d.id} ${d.anchor_id} ${d.rationale}`.toLowerCase()
          if (!blob.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
  }, [decisions, view, search, tagFilter, priorityFilter, statusFilter, assigneeFilter, currentUserName])

  const assigneeOptions = useMemo<string[]>(() => {
    const set = new Set<string>()
    for (const d of decisions) if (d.assignee_name !== undefined) set.add(d.assignee_name)
    return Array.from(set).sort()
  }, [decisions])

  function isColVisible(k: ColumnKey): boolean {
    return visibleCols.has(k)
  }
  function toggleCol(k: ColumnKey): void {
    setVisibleCols((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  function handleExport(): void {
    const cols: ColumnKey[] = ['creator', 'tags', 'priority', 'status', 'assignee', 'created']
    const header = ['id', 'title', ...cols, 'rationale', 'anchor_id', 'part_name']
    const rows = filtered.map((d) => [
      d.id,
      d.title ?? d.rationale.split('.')[0],
      d.author_name,
      (d.tags ?? []).join('|'),
      d.priority ?? '',
      d.state,
      d.assignee_name ?? '',
      d.created_at,
      d.rationale.replace(/"/g, '""'),
      d.anchor_id,
      d.part_name,
    ])
    const csv = [header, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `feedback-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* ── Saved-views row ───────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <ListFilter className="h-3 w-3" />
          Saved views
        </span>
        {SAVED_VIEWS.map((v) => {
          const isActive = view === v.id
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              title={v.hint}
              className={[
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-primary-50 hover:text-primary',
              ].join(' ')}
            >
              {v.label}
            </button>
          )
        })}
        <span className="ml-auto inline-flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-primary hover:bg-primary-50 hover:text-primary"
          >
            <Download className="h-3 w-3" />
            Export CSV
          </button>
        </span>
      </header>

      {/* ── Filter / search / columns row ────────────────────────────────── */}
      <div className="relative flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, anchor or ID…"
            className="h-8 w-full rounded-md border border-slate-200 bg-white pl-7 pr-3 text-[12px] placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <FilterSelect
          label="Tag"
          value={tagFilter}
          onChange={(v) => setTagFilter(v as IssueTag | 'ALL')}
          options={[
            { value: 'ALL', label: 'All tags' },
            ...ALL_TAGS.map((t) => ({ value: t, label: t })),
          ]}
        />
        <FilterSelect
          label="Priority"
          value={priorityFilter}
          onChange={(v) => setPriorityFilter(v as IssuePriority | 'ALL')}
          options={[
            { value: 'ALL', label: 'Any priority' },
            ...ALL_PRIORITIES.map((p) => ({ value: p, label: p })),
          ]}
        />
        <FilterSelect
          label="Status"
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as FullDecisionState | 'ALL')}
          options={[
            { value: 'ALL', label: 'Any status' },
            { value: 'PROPOSED', label: 'Proposed' },
            { value: 'ACCEPTED', label: 'Accepted' },
            { value: 'REJECTED', label: 'Rejected' },
            { value: 'SUPERSEDED', label: 'Superseded' },
          ]}
        />
        {assigneeOptions.length > 0 && (
          <FilterSelect
            label="Assignee"
            value={assigneeFilter}
            onChange={(v) => setAssigneeFilter(v)}
            options={[
              { value: 'ALL', label: 'Anyone' },
              ...assigneeOptions.map((a) => ({ value: a, label: a })),
            ]}
          />
        )}

        {/* Columns dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColumnsMenu((v) => !v)}
            aria-expanded={showColumnsMenu}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-primary hover:bg-primary-50 hover:text-primary"
          >
            <ColumnsIcon className="h-3 w-3" />
            Columns
            <ChevronDown className={`h-3 w-3 transition-transform ${showColumnsMenu ? 'rotate-180' : ''}`} />
          </button>
          {showColumnsMenu && (
            <div
              className="dv-anim-pop absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
              onMouseLeave={() => setShowColumnsMenu(false)}
            >
              <p className="border-b border-slate-100 bg-slate-50/60 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Toggle columns
              </p>
              <ul className="py-1">
                {ALL_COLUMNS.map((c) => (
                  <li key={c.key}>
                    <label className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={isColVisible(c.key)}
                        onChange={() => toggleCol(c.key)}
                        className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      {c.label}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <span className="ml-1 text-[11px] text-slate-500">
          <strong className="font-semibold tabular-nums text-slate-900">{filtered.length}</strong> of{' '}
          {decisions.length}
        </span>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Inbox className="h-5 w-5" />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-900">No feedback matches</p>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
            Try a wider filter, or clear the saved view to see every issue on this project.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/60">
              <tr className="text-left">
                <th className="w-1.5" aria-hidden="true" />
                <Th>Title</Th>
                {isColVisible('creator') && <Th>Creator</Th>}
                {isColVisible('tags') && <Th>Tags</Th>}
                {isColVisible('priority') && <Th>Priority</Th>}
                {isColVisible('status') && <Th>Status</Th>}
                {isColVisible('assignee') && <Th>Assignee</Th>}
                {isColVisible('created') && <Th>Created</Th>}
                <Th align="right">&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const state = STATE_PILL[d.state]
                return (
                  <tr
                    key={d.id}
                    className="group border-t border-slate-100 transition hover:bg-slate-50/50"
                  >
                    {/* Priority bar */}
                    <td className={`${priorityBarClass(d.priority)}`} aria-hidden="true" />

                    {/* Title + id */}
                    <td className="max-w-md px-3 py-3 align-top">
                      <Link
                        href={`/parts/${d.part_id}?focus=${d.id}`}
                        className="text-sm font-semibold text-slate-900 hover:text-primary hover:underline"
                      >
                        {d.title ?? d.rationale.split('.')[0]}
                      </Link>
                      <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                        {d.id} · {d.anchor_id} · {d.part_name}
                      </p>
                    </td>

                    {isColVisible('creator') && (
                      <td className="px-3 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <Avatar name={d.author_name} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-slate-900">{d.author_name}</p>
                            <TeamBadge team={d.author_team} size="xs" variant="dot" />
                          </div>
                        </div>
                      </td>
                    )}

                    {isColVisible('tags') && (
                      <td className="px-3 py-3 align-top">
                        <div className="flex flex-wrap gap-1">
                          {(d.tags ?? []).map((t) => (
                            <IssueTagChip key={t} tag={t} />
                          ))}
                          {(d.tags === undefined || d.tags.length === 0) && (
                            <span className="text-[11px] text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                    )}

                    {isColVisible('priority') && (
                      <td className="whitespace-nowrap px-3 py-3 align-top">
                        <PriorityIndicator priority={d.priority} />
                      </td>
                    )}

                    {isColVisible('status') && (
                      <td className="whitespace-nowrap px-3 py-3 align-top">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${state.bg} ${state.fg}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${state.dot}`} aria-hidden="true" />
                          {state.label}
                        </span>
                      </td>
                    )}

                    {isColVisible('assignee') && (
                      <td className="px-3 py-3 align-top">
                        {d.assignee_name !== undefined ? (
                          <div className="flex items-center gap-2">
                            <Avatar name={d.assignee_name} size="sm" />
                            <span className="truncate text-xs font-medium text-slate-900">
                              {d.assignee_name}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                            <Sparkles className="h-2.5 w-2.5" />
                            Unassigned
                          </span>
                        )}
                      </td>
                    )}

                    {isColVisible('created') && (
                      <td className="whitespace-nowrap px-3 py-3 align-top text-[11px] text-slate-500">
                        {formatTimeAgo(d.created_at)}
                      </td>
                    )}

                    <td className="px-3 py-3 align-top text-right">
                      <Link
                        href={`/parts/${d.part_id}?focus=${d.id}`}
                        className="inline-flex items-center gap-0.5 rounded px-2 py-1 text-[11px] font-semibold text-primary opacity-0 transition group-hover:opacity-100 hover:bg-primary-50"
                      >
                        Open
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ── small inline helpers ────────────────────────────────────────────────────

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}): JSX.Element {
  return (
    <th
      className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${
        align === 'right' ? 'text-right' : ''
      }`}
    >
      {children}
    </th>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}): JSX.Element {
  return (
    <label className="inline-flex items-center gap-1 text-[11px] text-slate-500">
      <span className="hidden sm:inline">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        aria-label={label}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}
