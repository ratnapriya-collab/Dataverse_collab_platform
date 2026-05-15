'use client'

/**
 * /audit — workspace audit log (immutable event stream).
 *
 * Reuses SEED_ACTIVITY plus a few synthesised system events (resolver
 * completed, PLM pushed) to demonstrate the full taxonomy. Each row has
 * an expandable JSON payload for forensic-style detail.
 */

import { useRouter } from 'next/navigation'
import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  GitBranch,
  History,
  Inbox,
  MailPlus,
  MessageSquare,
  Send,
  Shield,
  Upload,
  UserPlus,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import NotificationsBell from '@/components/layout/NotificationsBell'
import WorkspaceSidebar from '@/components/layout/WorkspaceSidebar'
import StatCard from '@/components/workspace/StatCard'
import Avatar from '@/components/workspace/Avatar'
import { ApiError, api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import {
  SEED_ACTIVITY,
  formatTimeAgo,
} from '@/lib/mockWorkspace'
import type { UserRead } from '@/types/api'

// ── Local event taxonomy (a superset of ActivityKind that adds system + PLM) ─

type AuditEventKind =
  | 'PART_UPLOADED'
  | 'REV_UPLOADED'
  | 'COMMENT_CREATED'
  | 'COMMENT_ACCEPTED'
  | 'COMMENT_REJECTED'
  | 'MEMBER_JOINED'
  | 'INVITE_CREATED'
  | 'RESOLVER_COMPLETED'
  | 'PLM_PUSHED'
  | 'DECISION_SUPERSEDED'

interface AuditRow {
  id: string
  kind: AuditEventKind
  actor_name: string
  target: string
  created_at: string
  payload: Record<string, unknown>
}

const NOW = new Date('2026-05-14T12:00:00Z').getTime()
const D = 86_400_000

const EXTRA_EVENTS: AuditRow[] = [
  {
    id: 'sys-resolver-1',
    kind: 'RESOLVER_COMPLETED',
    actor_name: 'system',
    target: 'Wing Spar Bracket  Rev A → Rev B',
    created_at: new Date(NOW - 2 * D).toISOString(),
    payload: {
      part_id: 'demo_2',
      from_rev: 'Rev A',
      to_rev: 'Rev B',
      auto_carried: 8,
      requires_confirmation: 3,
      resolved: 3,
      regressed: 1,
      orphaned: 0,
    },
  },
  {
    id: 'sys-plm-1',
    kind: 'PLM_PUSHED',
    actor_name: 'Ratnapriya',
    target: 'ECN-2026-0412 → Windchill',
    created_at: new Date(NOW - 10 * D).toISOString(),
    payload: {
      ecn: 'ECN-2026-0412',
      decisions: ['DEC-GEAR-08', 'DEC-GEAR-12'],
      target_system: 'Windchill 12.1',
      status: 'success',
    },
  },
  {
    id: 'sys-super-1',
    kind: 'DECISION_SUPERSEDED',
    actor_name: 'Maria Garcia',
    target: 'DEC-TURBO-V3-04',
    created_at: new Date(NOW - 9 * D).toISOString(),
    payload: { superseded_by: 'DEC-TURBO-V3-08' },
  },
]

const KIND_STYLE: Record<
  AuditEventKind,
  { icon: LucideIcon; bg: string; fg: string; label: string }
> = {
  PART_UPLOADED: {
    icon: Upload,
    bg: 'bg-violet-50',
    fg: 'text-violet-600',
    label: 'Part uploaded',
  },
  REV_UPLOADED: {
    icon: Upload,
    bg: 'bg-violet-50',
    fg: 'text-violet-700',
    label: 'Rev uploaded',
  },
  COMMENT_CREATED: {
    icon: MessageSquare,
    bg: 'bg-amber-50',
    fg: 'text-amber-600',
    label: 'Decision proposed',
  },
  COMMENT_ACCEPTED: {
    icon: CheckCircle2,
    bg: 'bg-emerald-50',
    fg: 'text-emerald-600',
    label: 'Decision accepted',
  },
  COMMENT_REJECTED: {
    icon: XCircle,
    bg: 'bg-rose-50',
    fg: 'text-rose-600',
    label: 'Decision rejected',
  },
  MEMBER_JOINED: {
    icon: UserPlus,
    bg: 'bg-primary-50',
    fg: 'text-primary',
    label: 'Member joined',
  },
  INVITE_CREATED: {
    icon: MailPlus,
    bg: 'bg-brand-50',
    fg: 'text-brand-700',
    label: 'Invite created',
  },
  RESOLVER_COMPLETED: {
    icon: GitBranch,
    bg: 'bg-slate-100',
    fg: 'text-slate-700',
    label: 'Resolver finished',
  },
  PLM_PUSHED: {
    icon: Send,
    bg: 'bg-amber-50',
    fg: 'text-amber-700',
    label: 'Pushed to PLM',
  },
  DECISION_SUPERSEDED: {
    icon: History,
    bg: 'bg-amber-50',
    fg: 'text-amber-600',
    label: 'Decision superseded',
  },
}

const KIND_OPTIONS: ReadonlyArray<{ value: 'ALL' | AuditEventKind; label: string }> = [
  { value: 'ALL', label: 'All event types' },
  ...Object.entries(KIND_STYLE).map(([k, v]) => ({
    value: k as AuditEventKind,
    label: v.label,
  })),
]

export default function AuditPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserRead | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [kindFilter, setKindFilter] = useState<'ALL' | AuditEventKind>('ALL')
  const [actorFilter, setActorFilter] = useState<string>('ALL')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

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

  // Merge SEED_ACTIVITY (typed as ActivityEntry) into AuditRow shape.
  const allEvents = useMemo<AuditRow[]>(() => {
    const fromSeed = SEED_ACTIVITY.map<AuditRow>((a) => ({
      id: a.id,
      kind: a.kind as AuditEventKind,
      actor_name: a.actor_name,
      target: a.target ?? '—',
      created_at: a.created_at,
      payload: {
        part_id: a.part_id,
        snippet: a.snippet,
      },
    }))
    return [...fromSeed, ...EXTRA_EVENTS].sort(
      (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
    )
  }, [])

  const actors = useMemo(() => {
    const set = new Set(allEvents.map((e) => e.actor_name))
    return Array.from(set)
  }, [allEvents])

  const filtered = useMemo(() => {
    return allEvents.filter((e) => {
      if (kindFilter !== 'ALL' && e.kind !== kindFilter) return false
      if (actorFilter !== 'ALL' && e.actor_name !== actorFilter) return false
      return true
    })
  }, [allEvents, kindFilter, actorFilter])

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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

  // Pre-compute stat counts (don't bother memoising — tiny array)
  const acceptedCount = allEvents.filter((e) => e.kind === 'COMMENT_ACCEPTED').length
  const proposedCount = allEvents.filter((e) => e.kind === 'COMMENT_CREATED').length
  const memberCount = allEvents.filter(
    (e) => e.kind === 'MEMBER_JOINED' || e.kind === 'INVITE_CREATED',
  ).length

  return (
    <div className="flex min-h-screen bg-slate-50">
      <WorkspaceSidebar user={user} current="audit" onSignOut={handleSignOut} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/85 px-6 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <History className="h-3 w-3 text-primary" />
            <span className="font-semibold uppercase tracking-wider text-slate-400">
              Workspace
            </span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-900">Audit log</span>
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
                <Shield className="h-7 w-7 text-brand-300" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-200">
                  <History className="h-3 w-3" />
                  Audit trail · immutable
                </div>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">Every change, on the record.</h1>
                <p className="mt-1 text-sm leading-relaxed text-white/75">
                  A permanent log of every action your team takes — decisions made, parts uploaded, signoffs collected, revisions resolved, pushes to PLM. Filter, expand to the raw payload, or export to CSV anytime.
                </p>
              </div>
              <button
                type="button"
                className="hidden shrink-0 items-center gap-1.5 rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 md:inline-flex"
              >
                <Download className="h-3 w-3" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="dv-anim-fade-up mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" style={{ animationDelay: '80ms' }}>
            <StatCard
              icon={History}
              label="Events"
              value={allEvents.length}
              hint="last 30 days"
              accent="text-primary"
              accentBg="bg-primary-50"
            />
            <StatCard
              icon={MessageSquare}
              label="Decisions proposed"
              value={proposedCount}
              hint="raised for review"
              accent="text-amber-600"
              accentBg="bg-amber-50"
            />
            <StatCard
              icon={CheckCircle2}
              label="Decisions accepted"
              value={acceptedCount}
              hint="signed off and locked"
              accent="text-emerald-600"
              accentBg="bg-emerald-50"
            />
            <StatCard
              icon={UserPlus}
              label="Member activity"
              value={memberCount}
              hint="joins, invites & role changes"
              accent="text-brand-700"
              accentBg="bg-brand-50"
            />
          </div>

          {/* Filters */}
          <div className="dv-anim-fade-up mt-8 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm" style={{ animationDelay: '150ms' }}>
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)}
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {KIND_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="ALL">All actors</option>
              {actors.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <span className="ml-auto text-xs text-slate-500">
              <strong className="font-semibold text-slate-900">{filtered.length}</strong> matching
            </span>
          </div>

          {/* Table */}
          <div className="dv-anim-fade-up mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" style={{ animationDelay: '220ms' }}>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <Inbox className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900">Nothing here yet.</p>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
                  Widen your filters — every change your team has ever made is logged in here.
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50/60">
                  <tr className="text-left">
                    <Th>&nbsp;</Th>
                    <Th>When</Th>
                    <Th>What happened</Th>
                    <Th>Who</Th>
                    <Th>On</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ev) => {
                    const s = KIND_STYLE[ev.kind]
                    const Icon = s.icon
                    const open = expanded.has(ev.id)
                    return (
                      <Fragment key={ev.id}>
                        <tr
                          onClick={() => toggle(ev.id)}
                          className="cursor-pointer border-t border-slate-100 transition hover:bg-slate-50/50"
                        >
                          <td className="px-3 py-3">
                            <span className="inline-flex h-5 w-5 items-center justify-center text-slate-400">
                              {open ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
                            <p className="font-mono text-xs text-slate-700">
                              {new Date(ev.created_at).toISOString().slice(0, 16).replace('T', ' ')}
                            </p>
                            <p className="mt-0.5 text-[10px] text-slate-400">
                              {formatTimeAgo(ev.created_at)}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-semibold ${s.bg} ${s.fg}`}>
                              <Icon className="h-3 w-3" />
                              {s.label}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              <Avatar name={ev.actor_name} size="sm" />
                              <span className="text-xs font-medium text-slate-700">{ev.actor_name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className="font-mono text-xs text-slate-900">{ev.target}</span>
                          </td>
                        </tr>
                        {open && (
                          <tr className="border-t border-slate-100 bg-slate-50/60">
                            <td colSpan={5} className="px-12 py-3">
                              <div className="flex items-center justify-between">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                  Raw payload · exactly what was logged
                                </p>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-200/60"
                                >
                                  <FileText className="h-3 w-3" />
                                  Copy as JSON
                                </button>
                              </div>
                              <pre className="mt-1 overflow-x-auto rounded-md border border-slate-200 bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
{JSON.stringify(
  { id: ev.id, kind: ev.kind, actor: ev.actor_name, target: ev.target, at: ev.created_at, ...ev.payload },
  null,
  2,
)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </th>
  )
}
