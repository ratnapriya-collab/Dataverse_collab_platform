'use client'

/**
 * /my-work — personal inbox of action items, scoped to YOU.
 *
 * Three tabs:
 *   Assigned  — things others want from you (open until you act)
 *   Owned     — comments/decisions you authored that are still open
 *   Following — items on your watchlist; no action required (FYI)
 *
 * Each card surfaces the project, requester (with team badge), title,
 * snippet, time, and an inline action button — the goal is "open the
 * app, see what's on your plate, no clicks to figure that out".
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownNarrowWide,
  ArrowRight,
  ArrowUpNarrowWide,
  AtSign,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Inbox,
  MessageCircle,
  MessageSquare,
  Search,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from 'lucide-react'
import NotificationsBell from '@/components/layout/NotificationsBell'
import WorkspaceSidebar from '@/components/layout/WorkspaceSidebar'
import Avatar from '@/components/workspace/Avatar'
import TeamBadge from '@/components/workspace/TeamBadge'
import { ApiError, api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import {
  formatTimeAgo,
  SEED_WORK_ITEMS,
  TEAM_META,
  TEAM_ORDER,
  type AttachmentType,
  type EngineeringTeam,
  type MockWorkItem,
  type WorkItemKind,
  type WorkItemPriority,
  type WorkItemTab,
} from '@/lib/mockWorkspace'
import type { UserRead } from '@/types/api'

const KIND_META: Record<WorkItemKind, { icon: LucideIcon; label: string; tint: string }> = {
  REVIEW_ASSIGNED: { icon: Eye, label: 'Review', tint: 'text-sky-700 bg-sky-50' },
  COMMENT_REPLY: { icon: MessageSquare, label: 'Reply', tint: 'text-red-700 bg-red-50' },
  DECISION_OWNED: { icon: CheckCircle2, label: 'Decision', tint: 'text-primary-700 bg-primary-50' },
  PART_ASSIGNED: { icon: Inbox, label: 'Assigned', tint: 'text-violet-700 bg-violet-50' },
  MENTION: { icon: AtSign, label: 'Mention', tint: 'text-amber-700 bg-amber-50' },
}

interface TabDef {
  id: WorkItemTab
  label: string
  blurb: string
}

const TABS: TabDef[] = [
  {
    id: 'assigned',
    label: 'Assigned to you',
    blurb: 'Things other people are waiting on you to do.',
  },
  {
    id: 'owned',
    label: 'Owned by you',
    blurb: 'Open decisions and comments you authored, waiting on others.',
  },
  {
    id: 'following',
    label: 'Following',
    blurb: 'Updates on projects you watch. No action required.',
  },
]

type SortMode = 'priority' | 'newest' | 'oldest' | 'due_first'

const SORT_LABEL: Record<SortMode, string> = {
  priority: 'Priority',
  newest: 'Newest first',
  oldest: 'Oldest first',
  due_first: 'Due soonest',
}

const PRIORITY_WEIGHT: Record<WorkItemPriority, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  RESPONDED: 2,
  INFO: 1,
}

export default function MyWorkPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserRead | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<WorkItemTab>('assigned')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortMode>('priority')
  const [sortOpen, setSortOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [teamFilter, setTeamFilter] = useState<Set<EngineeringTeam>>(new Set())

  useEffect(() => {
    let cancelled = false
    api.auth
      .me()
      .then((u) => {
        if (!cancelled) setUser(u)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          clearToken()
          router.replace('/login')
          return
        }
        setError(err instanceof Error ? err.message : 'Failed to load')
      })
    return () => {
      cancelled = true
    }
  }, [router])

  const counts = useMemo(() => {
    const c: Record<WorkItemTab, number> = { assigned: 0, owned: 0, following: 0 }
    for (const item of SEED_WORK_ITEMS) c[item.tab] += 1
    return c
  }, [])

  const visible = useMemo(() => {
    let list = SEED_WORK_ITEMS.filter((i) => i.tab === activeTab)
    const q = query.trim().toLowerCase()
    if (q.length > 0) {
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.project_name.toLowerCase().includes(q) ||
          (i.snippet?.toLowerCase().includes(q) ?? false) ||
          i.requester_name.toLowerCase().includes(q) ||
          (i.attachment?.name.toLowerCase().includes(q) ?? false),
      )
    }
    if (teamFilter.size > 0) {
      list = list.filter((i) => teamFilter.has(i.requester_team))
    }
    const sorted = [...list]
    if (sort === 'priority') {
      sorted.sort(
        (a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority],
      )
    } else if (sort === 'newest') {
      sorted.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
    } else if (sort === 'oldest') {
      sorted.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      )
    } else if (sort === 'due_first') {
      sorted.sort((a, b) => {
        const aDue = a.due_at !== undefined ? new Date(a.due_at).getTime() : Infinity
        const bDue = b.due_at !== undefined ? new Date(b.due_at).getTime() : Infinity
        return aDue - bDue
      })
    }
    return sorted
  }, [activeTab, query, sort, teamFilter])

  function toggleTeam(team: EngineeringTeam): void {
    setTeamFilter((prev) => {
      const next = new Set(prev)
      if (next.has(team)) next.delete(team)
      else next.add(team)
      return next
    })
  }

  function handleSignOut(): void {
    clearToken()
    router.replace('/login')
  }

  if (error !== null) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      </main>
    )
  }

  if (user === null) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-500">
        <span className="text-sm">Loading…</span>
      </main>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <WorkspaceSidebar user={user} current="my_work" onSignOut={handleSignOut} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/85 px-6 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider text-slate-400">
              Workspace
            </span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-900">My Work</span>
          </div>
          <NotificationsBell />
        </header>

        <section className="mx-auto w-full max-w-4xl px-6 py-8">
          {/* Title */}
          <div className="dv-anim-fade-up">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">My Work</h1>
            <p className="mt-1 text-sm text-slate-500">
              Every review, decision, and mention that touches you — across all projects.
              Nothing else.
            </p>
          </div>

          {/* Tab bar */}
          <div className="mt-6 border-b border-slate-200">
            <nav className="-mb-px flex gap-1" aria-label="My Work sections">
              {TABS.map((t) => {
                const active = activeTab === t.id
                const count = counts[t.id]
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    aria-current={active ? 'page' : undefined}
                    className={[
                      'inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition',
                      active
                        ? 'border-primary text-primary'
                        : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800',
                    ].join(' ')}
                  >
                    {t.label}
                    <span
                      className={[
                        'rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                        active ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600',
                      ].join(' ')}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Tab blurb */}
          <p className="mt-3 text-xs text-slate-500">
            {TABS.find((t) => t.id === activeTab)?.blurb}
          </p>

          {/* Search / Sort / Filter control row */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title, project, requester, file…"
                className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Sort dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setSortOpen((o) => !o)
                  setFilterOpen(false)
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-400"
              >
                {sort === 'oldest' ? (
                  <ArrowUpNarrowWide className="h-3.5 w-3.5 text-slate-500" />
                ) : (
                  <ArrowDownNarrowWide className="h-3.5 w-3.5 text-slate-500" />
                )}
                {SORT_LABEL[sort]}
              </button>
              {sortOpen && (
                <div
                  className="dv-anim-pop absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
                  onMouseLeave={() => setSortOpen(false)}
                >
                  {(Object.keys(SORT_LABEL) as SortMode[]).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        setSort(opt)
                        setSortOpen(false)
                      }}
                      className={[
                        'flex w-full items-center justify-between px-3 py-2 text-xs transition hover:bg-slate-50',
                        opt === sort ? 'font-semibold text-primary' : 'text-slate-700',
                      ].join(' ')}
                    >
                      {SORT_LABEL[opt]}
                      {opt === sort && <Check className="h-3 w-3 text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filter button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setFilterOpen((o) => !o)
                  setSortOpen(false)
                }}
                className={[
                  'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium shadow-sm transition',
                  teamFilter.size > 0
                    ? 'border-primary bg-primary-50 text-primary-700'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400',
                ].join(' ')}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filter
                {teamFilter.size > 0 && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-white">
                    {teamFilter.size}
                  </span>
                )}
              </button>
              {filterOpen && (
                <div
                  className="dv-anim-pop absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
                  onMouseLeave={() => setFilterOpen(false)}
                >
                  <p className="border-b border-slate-100 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Filter by team
                  </p>
                  {TEAM_ORDER.map((team) => {
                    const meta = TEAM_META[team]
                    const checked = teamFilter.has(team)
                    return (
                      <button
                        key={team}
                        type="button"
                        onClick={() => toggleTeam(team)}
                        className="flex w-full items-center justify-between px-3 py-2 text-xs transition hover:bg-slate-50"
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: meta.hex }}
                          />
                          <span className={checked ? 'font-semibold text-slate-900' : 'text-slate-700'}>
                            {meta.label}
                          </span>
                        </span>
                        {checked && <Check className="h-3 w-3 text-primary" />}
                      </button>
                    )
                  })}
                  {teamFilter.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setTeamFilter(new Set())}
                      className="block w-full border-t border-slate-100 px-3 py-2 text-left text-[11px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                    >
                      Clear all
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Items */}
          {visible.length === 0 ? (
            <EmptyState tab={activeTab} />
          ) : (
            <ul className="mt-5 space-y-3">
              {visible.map((item, idx) => (
                <li
                  key={item.id}
                  className="dv-anim-fade-up"
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  <WorkItemCard item={item} />
                </li>
              ))}
            </ul>
          )}

          <p className="mt-12 text-center text-[11px] text-slate-400">
            Demo workspace · Mock data — refresh resets state.
          </p>
        </section>
      </div>
    </div>
  )
}

const PRIORITY_BAR: Record<WorkItemPriority, string> = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-amber-400',
  INFO: 'bg-slate-300',
  RESPONDED: 'bg-emerald-500',
}

const ATTACHMENT_META: Record<AttachmentType, { label: string; tint: string }> = {
  step: { label: 'STEP', tint: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  stp: { label: 'STP', tint: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  glb: { label: 'GLB', tint: 'bg-violet-50 text-violet-700 border-violet-200' },
  gltf: { label: 'GLTF', tint: 'bg-violet-50 text-violet-700 border-violet-200' },
  pdf: { label: 'PDF', tint: 'bg-rose-50 text-rose-700 border-rose-200' },
  stl: { label: 'STL', tint: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  iges: { label: 'IGES', tint: 'bg-amber-50 text-amber-700 border-amber-200' },
}

function formatDateChip(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function WorkItemCard({ item }: { item: MockWorkItem }) {
  const meta = KIND_META[item.kind]
  const Icon = meta.icon
  const dueMs =
    item.due_at !== undefined ? new Date(item.due_at).getTime() - Date.now() : null
  const dueSoon = dueMs !== null && dueMs < 24 * 3_600_000
  const attach = item.attachment

  return (
    <Link
      href={`/projects/${item.project_id}`}
      className="group flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      {/* Left priority bar — instant scan colour for the item's urgency */}
      <div
        className={`w-1 shrink-0 ${PRIORITY_BAR[item.priority]}`}
        aria-hidden="true"
      />

      <div className="flex flex-1 gap-4 p-4">
        <Avatar name={item.requester_name} size="md" />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${meta.tint}`}
                >
                  <Icon className="h-2.5 w-2.5" />
                  {meta.label}
                </span>
                <Link
                  href={`/projects/${item.project_id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="truncate text-[11px] font-semibold text-slate-500 hover:text-primary hover:underline"
                >
                  {item.project_name}
                </Link>
                {item.status === 'RESPONDED' && (
                  <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-700">
                    Awaiting them
                  </span>
                )}
              </div>
              <h3 className="mt-1 text-sm font-semibold text-slate-900 group-hover:text-primary">
                {item.title}
              </h3>
              {item.snippet !== undefined && (
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">
                  {item.snippet}
                </p>
              )}

              {/* File attachment chip */}
              {attach !== undefined && (
                <div className="mt-2.5 inline-flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${ATTACHMENT_META[attach.type].tint}`}
                  >
                    <FileText className="h-3 w-3" />
                    {ATTACHMENT_META[attach.type].label}
                  </span>
                  <span className="truncate font-mono text-[10px] text-slate-600">
                    {attach.name}
                  </span>
                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-slate-700">
                    {attach.version}
                  </span>
                </div>
              )}
            </div>

            {/* Right column — date + relative time + reviewer progress */}
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                <Calendar className="h-2.5 w-2.5" />
                {formatDateChip(item.created_at)}
              </span>
              {item.due_at !== undefined && (
                <span
                  className={[
                    'inline-flex items-center gap-1 text-[10px]',
                    dueSoon ? 'font-bold text-red-600' : 'text-slate-500',
                  ].join(' ')}
                >
                  <Clock className="h-2.5 w-2.5" />
                  {dueSoon
                    ? 'Due soon'
                    : `Due ${formatTimeAgo(item.due_at).replace('ago', 'from now')}`}
                </span>
              )}
            </div>
          </div>

          {/* Bottom row — requester + reviewer progress + comments + arrow */}
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">{item.requester_name}</span>
              <TeamBadge team={item.requester_team} size="xs" />
            </div>
            <div className="flex items-center gap-3">
              {item.reviewer_progress !== undefined && (
                <span
                  title={`${item.reviewer_progress.responded} of ${item.reviewer_progress.total} reviewers responded`}
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600"
                >
                  <Users className="h-3 w-3 text-slate-400" />
                  {item.reviewer_progress.responded}/{item.reviewer_progress.total}
                </span>
              )}
              {item.comment_count !== undefined && item.comment_count > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600">
                  <MessageCircle className="h-3 w-3 text-slate-400" />
                  {item.comment_count}
                </span>
              )}
              <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

function EmptyState({ tab }: { tab: WorkItemTab }) {
  const messages: Record<WorkItemTab, { title: string; sub: string }> = {
    assigned: {
      title: 'You’re all caught up',
      sub: 'No one is waiting on you right now.',
    },
    owned: {
      title: 'No open items',
      sub: 'Every decision you authored has been resolved.',
    },
    following: {
      title: 'Nothing new to read',
      sub: 'No fresh activity on projects you follow.',
    },
  }
  const m = messages[tab]
  return (
    <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
        <Bell className="h-5 w-5 text-emerald-600" />
      </div>
      <p className="mt-3 text-base font-semibold text-slate-900">{m.title}</p>
      <p className="mt-1 text-xs text-slate-500">{m.sub}</p>
    </div>
  )
}
