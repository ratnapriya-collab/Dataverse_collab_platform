'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  Building2,
  FolderKanban,
  MailPlus,
  MessageSquare,
  Plus,
  Search,
  Users,
} from 'lucide-react'
import NotificationsBell from '@/components/layout/NotificationsBell'
import QuickActionsFAB from '@/components/layout/QuickActionsFAB'
import WorkspaceSidebar from '@/components/layout/WorkspaceSidebar'
import ActivityFeed from '@/components/workspace/ActivityFeed'
import { AvatarStack } from '@/components/workspace/Avatar'
import PendingDecisionsCard from '@/components/workspace/PendingDecisionsCard'
import ProjectsGrid from '@/components/workspace/ProjectsGrid'
import StatCard from '@/components/workspace/StatCard'
import TeamCard from '@/components/workspace/TeamCard'
import { ApiError, api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import {
  SEED_ACTIVITY,
  SEED_INVITES,
  SEED_MEMBERS,
  SEED_PENDING_DECISIONS,
  SEED_PROJECTS,
  SEED_WORKSPACE,
  withCurrentUser,
} from '@/lib/mockWorkspace'
import type { UserRead } from '@/types/api'

export default function WorkspacePage() {
  const router = useRouter()
  const [user, setUser] = useState<UserRead | null>(null)
  const [error, setError] = useState<string | null>(null)

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
        setError(err instanceof Error ? err.message : 'Failed to load workspace')
      })
    return () => {
      cancelled = true
    }
  }, [router])

  const members = useMemo(
    () => (user !== null ? withCurrentUser(SEED_MEMBERS, user.name, user.email) : SEED_MEMBERS),
    [user],
  )
  const memberNames = useMemo(() => members.map((m) => m.name), [members])
  // Pretend Sarah and David are online — the green dot is purely aesthetic.
  const onlineNames = useMemo(() => new Set(['Sarah Chen', 'David Kim']), [])
  const adminCount = useMemo(() => members.filter((m) => m.role === 'ADMIN').length, [members])
  const pendingInvites = useMemo(() => SEED_INVITES.filter((i) => !i.used).length, [])
  const openComments = useMemo(
    () => SEED_PROJECTS.reduce((sum, p) => sum + p.open_comments, 0),
    [],
  )
  const totalParts = useMemo(
    () => SEED_PROJECTS.reduce((sum, p) => sum + p.parts_count, 0),
    [],
  )
  const activeProjects = useMemo(
    () => SEED_PROJECTS.filter((p) => p.status === 'ACTIVE' || p.status === 'IN_REVIEW').length,
    [],
  )

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
      <WorkspaceSidebar user={user} current="dashboard" onSignOut={handleSignOut} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Slim top bar with just notifications + breadcrumb hint. */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/85 px-6 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider text-slate-400">
              Workspace
            </span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-900">Dashboard</span>
          </div>
          <NotificationsBell />
        </header>

      <section className="mx-auto w-full max-w-6xl px-6 py-8">
        {/* ── Compact hero ───────────────────────────────────────────────── */}
        <div className="dv-anim-fade-up relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-primary-900 px-7 py-6 text-white shadow-lg">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand opacity-20 blur-3xl" />
          <div className="pointer-events-none absolute -left-12 -bottom-16 h-56 w-56 rounded-full bg-primary opacity-30 blur-3xl" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.14]"
            style={{
              backgroundImage:
                'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          />

          <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-200">
                <Building2 className="h-3 w-3" />
                Workspace
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
                {SEED_WORKSPACE.name}
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-white/65">
                {SEED_WORKSPACE.description}
              </p>
              <div className="mt-3 flex items-center gap-3 text-xs text-white/70">
                <AvatarStack names={memberNames} size="sm" max={5} />
                <span className="text-white/50">·</span>
                <span>
                  <span className="font-semibold text-white">{members.length}</span> members
                </span>
                <span className="text-white/20">·</span>
                <span>
                  <span className="font-semibold text-white">{SEED_PROJECTS.length}</span>{' '}
                  projects
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="relative hidden lg:block">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
                <input
                  type="search"
                  placeholder="Search projects…"
                  className="w-56 rounded-md border border-white/20 bg-white/10 py-1.5 pl-7 pr-3 text-xs text-white placeholder:text-white/40 backdrop-blur focus:border-white/40 focus:outline-none"
                />
              </div>
              <Link
                href="/admin"
                className="inline-flex items-center gap-1 rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-white/20"
              >
                Manage
              </Link>
              <Link
                href="/home"
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-900 shadow-sm transition hover:shadow-md"
              >
                <Plus className="h-3.5 w-3.5" />
                Upload
              </Link>
            </div>
          </div>
        </div>

        {/* ── Stat tiles ─────────────────────────────────────────────────── */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="dv-anim-fade-up" style={{ animationDelay: '80ms' }}>
            <StatCard
              icon={FolderKanban}
              label="Projects in workspace"
              value={SEED_PROJECTS.length}
              hint={`${activeProjects} active · ${SEED_PROJECTS.length - activeProjects} done`}
              accent="text-violet-600"
              accentBg="bg-violet-50"
              trend={[2, 3, 3, 2, 4, 3, 4]}
            />
          </div>
          <div className="dv-anim-fade-up" style={{ animationDelay: '150ms' }}>
            <StatCard
              icon={MessageSquare}
              label="Open comments"
              value={openComments}
              hint="awaiting decision"
              accent="text-red-600"
              accentBg="bg-red-50"
              trend={[5, 4, 6, 8, 7, 9, 10]}
            />
          </div>
          <div className="dv-anim-fade-up" style={{ animationDelay: '220ms' }}>
            <StatCard
              icon={Users}
              label="Members"
              value={members.length}
              hint={`${adminCount} admin${adminCount === 1 ? '' : 's'}`}
              accent="text-primary"
              accentBg="bg-primary-50"
              trend={[3, 3, 4, 4, 4, 5, 5]}
            />
          </div>
          <div className="dv-anim-fade-up" style={{ animationDelay: '290ms' }}>
            <StatCard
              icon={MailPlus}
              label="Pending invites"
              value={pendingInvites}
              hint={`${totalParts} total parts indexed`}
              accent="text-brand-700"
              accentBg="bg-brand-50"
              trend={[0, 1, 2, 1, 2, 1, 1]}
            />
          </div>
        </div>

        {/* ── Projects grid (centerpiece) ────────────────────────────────── */}
        <div
          className="dv-anim-fade-up mt-8"
          style={{ animationDelay: '380ms' }}
        >
          <ProjectsGrid projects={SEED_PROJECTS} />
        </div>

        {/* ── Supporting cards: activity / pending / team ────────────────── */}
        <div
          className="dv-anim-fade-up mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]"
          style={{ animationDelay: '480ms' }}
        >
          <ActivityFeed entries={SEED_ACTIVITY} limit={6} />
          <div className="space-y-4">
            <PendingDecisionsCard decisions={SEED_PENDING_DECISIONS} />
            <TeamCard members={members} onlineNames={onlineNames} />
          </div>
        </div>

        <p className="mt-12 text-center text-[11px] text-slate-400">
          Demo workspace · All data here is mock and resets on refresh.
        </p>
      </section>
      </div>

      <QuickActionsFAB />
    </div>
  )
}
