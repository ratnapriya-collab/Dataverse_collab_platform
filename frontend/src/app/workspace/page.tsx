'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { AvatarStack } from '@/components/workspace/Avatar'
import ProjectsGrid from '@/components/workspace/ProjectsGrid'
import StatCard from '@/components/workspace/StatCard'
import { ApiError, api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import {
  SEED_INVITES,
  SEED_MEMBERS,
  SEED_PROJECTS,
  SEED_WORKSPACE,
  SEED_WORKSPACES,
  getProjectsByWorkspace,
  getWorkspace,
  withCurrentUser,
} from '@/lib/mockWorkspace'
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed'
import type { UserRead } from '@/types/api'

export default function WorkspacePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<UserRead | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Active workspace — driven by ?ws=<id>. Falls back to the default workspace.
  const wsParam = searchParams?.get('ws') ?? null
  const activeWorkspace = useMemo(() => {
    return (wsParam !== null ? getWorkspace(wsParam) : undefined) ?? SEED_WORKSPACE
  }, [wsParam])
  // Projects scoped to the active workspace. The dashboard's grid + stat cards
  // all derive from this so the page truly "switches" when you change ws.
  const workspaceProjects = useMemo(
    () => getProjectsByWorkspace(activeWorkspace.id),
    [activeWorkspace],
  )
  // Recently-viewed list, hydrated from localStorage on mount + storage events.
  const recentEntries = useRecentlyViewed()
  const recentProjects = useMemo(() => {
    const ordered = recentEntries
      .map((e) => SEED_PROJECTS.find((p) => p.id === e.projectId))
      .filter((p): p is (typeof SEED_PROJECTS)[number] => p !== undefined)
    // Top 6 keeps the grid compact + readable.
    return ordered.slice(0, 6)
  }, [recentEntries])

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
  const adminCount = useMemo(() => members.filter((m) => m.role === 'ADMIN').length, [members])
  const pendingInvites = useMemo(() => SEED_INVITES.filter((i) => !i.used).length, [])
  const openComments = useMemo(
    () => workspaceProjects.reduce((sum, p) => sum + p.open_comments, 0),
    [workspaceProjects],
  )
  const totalParts = useMemo(
    () => workspaceProjects.reduce((sum, p) => sum + p.parts_count, 0),
    [workspaceProjects],
  )
  const activeProjects = useMemo(
    () => workspaceProjects.filter((p) => p.status === 'ACTIVE' || p.status === 'IN_REVIEW').length,
    [workspaceProjects],
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
                {activeWorkspace.name}
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-white/65">
                {activeWorkspace.description}
              </p>
              <div className="mt-3 flex items-center gap-3 text-xs text-white/70">
                <AvatarStack names={memberNames} size="sm" max={5} />
                <span className="text-white/50">·</span>
                <span>
                  <span className="font-semibold text-white">{members.length}</span> members
                </span>
                <span className="text-white/20">·</span>
                <span>
                  <span className="font-semibold text-white">{workspaceProjects.length}</span>{' '}
                  projects
                </span>
              </div>
              {/* Workspace switcher chips */}
              <nav
                aria-label="Switch workspace"
                className="mt-4 flex flex-wrap gap-1.5"
              >
                {SEED_WORKSPACES.map((ws) => {
                  const isActive = ws.id === activeWorkspace.id
                  return (
                    <Link
                      key={ws.id}
                      href={`/workspace?ws=${ws.id}`}
                      className={[
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition',
                        isActive
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'border border-white/20 bg-white/10 text-white/80 backdrop-blur hover:bg-white/15 hover:text-white',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black',
                          isActive ? 'bg-primary text-white' : 'bg-white/15 text-white',
                        ].join(' ')}
                      >
                        {ws.name.charAt(0).toUpperCase()}
                      </span>
                      {ws.name}
                    </Link>
                  )
                })}
              </nav>
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
              value={workspaceProjects.length}
              hint={`${activeProjects} active · ${workspaceProjects.length - activeProjects} done`}
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

        {/* ── Recently viewed ────────────────────────────────────────────── */}
        {recentProjects.length > 0 && (
          <div
            className="dv-anim-fade-up mt-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            style={{ animationDelay: '340ms' }}
          >
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-[13px] font-bold tracking-tight text-slate-900">
                Recently viewed
              </h2>
              <p className="text-[10.5px] text-slate-500">
                {recentProjects.length} project{recentProjects.length === 1 ? '' : 's'} you opened
                lately
              </p>
            </div>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {recentProjects.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/projects/${p.id}`}
                    className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/40 px-3 py-2 transition hover:-translate-y-px hover:border-primary/40 hover:bg-white hover:shadow-sm"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gradient-to-br from-primary/80 to-brand text-[10px] font-black text-white shadow-sm">
                      {p.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold text-slate-900">
                        {p.name}
                      </p>
                      <p className="truncate text-[10px] text-slate-500">
                        {getWorkspace(p.workspace_id)?.name ?? 'Workspace'} ·{' '}
                        {p.parts_count} parts · {p.open_comments} open
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Projects grid (centerpiece) ────────────────────────────────── */}
        <div
          className="dv-anim-fade-up mt-8"
          style={{ animationDelay: '380ms' }}
        >
          <ProjectsGrid projects={workspaceProjects} />
        </div>

      </section>
      </div>

      <QuickActionsFAB />
    </div>
  )
}
