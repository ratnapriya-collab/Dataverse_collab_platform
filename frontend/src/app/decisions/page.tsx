'use client'

/**
 * /decisions — workspace-wide decision feed (Screen A.6).
 *
 * Mock data only — reads from SEED_FULL_DECISIONS. Filter by state, author,
 * project; search across rationale/anchor/ID.
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FileCheck2,
  ListFilter,
  Search,
  XCircle,
} from 'lucide-react'
import NotificationsBell from '@/components/layout/NotificationsBell'
import WorkspaceSidebar from '@/components/layout/WorkspaceSidebar'
import StatCard from '@/components/workspace/StatCard'
import Avatar from '@/components/workspace/Avatar'
import TeamBadge from '@/components/workspace/TeamBadge'
import { ApiError, api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import {
  SEED_FULL_DECISIONS,
  SEED_MEMBERS,
  SEED_PROJECTS,
  formatTimeAgo,
  type FullDecisionState,
} from '@/lib/mockWorkspace'
import type { UserRead } from '@/types/api'

type StateFilter = 'ALL' | FullDecisionState

const STATE_FILTERS: ReadonlyArray<{ id: StateFilter; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'PROPOSED', label: 'Proposed' },
  { id: 'ACCEPTED', label: 'Accepted' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'SUPERSEDED', label: 'Superseded' },
]

const STATE_PILL: Record<FullDecisionState, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  PROPOSED: 'bg-amber-50 text-amber-700 border-amber-200',
  ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
  SUPERSEDED: 'bg-slate-100 text-slate-500 border-slate-200',
}

const STATE_DOT: Record<FullDecisionState, string> = {
  DRAFT: 'bg-slate-400',
  PROPOSED: 'bg-amber-500',
  ACCEPTED: 'bg-emerald-500',
  REJECTED: 'bg-rose-500',
  SUPERSEDED: 'bg-slate-400',
}

export default function DecisionsPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserRead | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [stateFilter, setStateFilter] = useState<StateFilter>('ALL')
  const [projectFilter, setProjectFilter] = useState<string>('ALL')
  const [authorFilter, setAuthorFilter] = useState<string>('ALL')
  const [search, setSearch] = useState('')

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

  function handleSignOut(): void {
    clearToken()
    router.replace('/login')
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return SEED_FULL_DECISIONS.filter((d) => {
      if (stateFilter !== 'ALL' && d.state !== stateFilter) return false
      if (projectFilter !== 'ALL' && d.project_id !== projectFilter) return false
      if (authorFilter !== 'ALL' && d.author_name !== authorFilter) return false
      if (q.length > 0) {
        const blob = `${d.id} ${d.rationale} ${d.anchor_id} ${d.part_name} ${d.project_name}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    }).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
  }, [stateFilter, projectFilter, authorFilter, search])

  const counts = useMemo(() => {
    return {
      total: SEED_FULL_DECISIONS.length,
      proposed: SEED_FULL_DECISIONS.filter((d) => d.state === 'PROPOSED').length,
      accepted: SEED_FULL_DECISIONS.filter((d) => d.state === 'ACCEPTED').length,
      rejected: SEED_FULL_DECISIONS.filter((d) => d.state === 'REJECTED').length,
    }
  }, [])

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
      <WorkspaceSidebar user={user} current="decisions" onSignOut={handleSignOut} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/85 px-6 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <FileCheck2 className="h-3 w-3 text-primary" />
            <span className="font-semibold uppercase tracking-wider text-slate-400">
              Workspace
            </span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-900">Decisions</span>
          </div>
          <NotificationsBell />
        </header>

        <section className="mx-auto w-full max-w-6xl px-6 py-8">
          {/* Hero */}
          <div className="dv-anim-fade-up relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-primary-900 p-6 text-white shadow-lg">
            <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-brand opacity-25 blur-3xl" />
            <div className="pointer-events-none absolute -left-10 -bottom-10 h-60 w-60 rounded-full bg-primary opacity-30 blur-3xl" />
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.12]"
              style={{
                backgroundImage:
                  'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            />
            <div className="relative z-10 flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm ring-1 ring-white/20">
                <FileCheck2 className="h-7 w-7 text-brand-300" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-200">
                  <Clock className="h-3 w-3" />
                  Workspace · decision feed
                </div>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">All decisions</h1>
                <p className="mt-1 text-sm leading-relaxed text-white/70">
                  Every anchored decision across {SEED_PROJECTS.length} projects · filterable by state, author, and project.
                </p>
                <p className="mt-2 text-[11px] text-white/40">
                  Decisions are first-class records — anchored to geometry, immutable rationale, full audit trail.
                </p>
              </div>
            </div>
          </div>

          {/* Stat tiles */}
          <div className="dv-anim-fade-up mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" style={{ animationDelay: '80ms' }}>
            <StatCard
              icon={FileCheck2}
              label="Total decisions"
              value={counts.total}
              hint={`across ${SEED_PROJECTS.length} projects`}
              accent="text-primary"
              accentBg="bg-primary-50"
            />
            <StatCard
              icon={Clock}
              label="Proposed"
              value={counts.proposed}
              hint="awaiting signoff"
              accent="text-amber-600"
              accentBg="bg-amber-50"
            />
            <StatCard
              icon={CheckCircle2}
              label="Accepted"
              value={counts.accepted}
              hint="signed off & locked"
              accent="text-emerald-600"
              accentBg="bg-emerald-50"
            />
            <StatCard
              icon={XCircle}
              label="Rejected"
              value={counts.rejected}
              hint="resolved or deferred"
              accent="text-rose-600"
              accentBg="bg-rose-50"
            />
          </div>

          {/* Filters */}
          <div className="dv-anim-fade-up mt-8 rounded-xl border border-slate-200 bg-white p-3 shadow-sm" style={{ animationDelay: '150ms' }}>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search rationale, anchor, ID…"
                  className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-sm placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  aria-label="Filter by project"
                >
                  <option value="ALL">All projects</option>
                  {SEED_PROJECTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select
                  value={authorFilter}
                  onChange={(e) => setAuthorFilter(e.target.value)}
                  className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  aria-label="Filter by author"
                >
                  <option value="ALL">All authors</option>
                  {SEED_MEMBERS.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* State chips */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
              <ListFilter className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">State</span>
              {STATE_FILTERS.map((s) => {
                const active = stateFilter === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStateFilter(s.id)}
                    aria-pressed={active}
                    className={[
                      'rounded-full px-2.5 py-1 text-xs font-medium transition',
                      active
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    ].join(' ')}
                  >
                    {s.label}
                  </button>
                )
              })}
              <span className="ml-auto text-xs text-slate-500">
                <strong className="font-semibold text-slate-900">{filtered.length}</strong> matching
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="dv-anim-fade-up mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" style={{ animationDelay: '220ms' }}>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <Search className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900">No decisions match</p>
                <p className="mt-1 text-xs text-slate-500">
                  Try clearing a filter or widening the date range.
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50/60">
                  <tr className="text-left">
                    <Th>State</Th>
                    <Th>Rationale</Th>
                    <Th>Project · Part</Th>
                    <Th>Author</Th>
                    <Th>Created</Th>
                    <Th align="right">Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => (
                    <tr key={d.id} className="group border-t border-slate-100 transition hover:bg-slate-50/50">
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATE_PILL[d.state]}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${STATE_DOT[d.state]}`} />
                          {d.state.toLowerCase()}
                        </span>
                      </td>
                      <td className="max-w-md px-4 py-3 align-top">
                        <p className="line-clamp-2 text-sm text-slate-700">{d.rationale}</p>
                        <p className="mt-1 font-mono text-[10px] text-slate-400">
                          {d.id} · {d.anchor_id}
                          {d.citations.length > 0 && (
                            <span className="ml-2 text-slate-500">{d.citations.join(' · ')}</span>
                          )}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <Link
                          href={`/parts/${d.part_id}`}
                          className="text-sm font-medium text-slate-900 hover:text-primary hover:underline"
                        >
                          {d.part_name}
                        </Link>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">
                          {d.project_name}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <Avatar name={d.author_name} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-slate-900">{d.author_name}</p>
                            <TeamBadge team={d.author_team} size="xs" variant="dot" />
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-slate-500">
                        {formatTimeAgo(d.created_at)}
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <Link
                          href={`/parts/${d.part_id}`}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100 hover:bg-primary-50"
                        >
                          View
                          <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={`px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${
        align === 'right' ? 'text-right' : ''
      }`}
    >
      {children}
    </th>
  )
}
