'use client'

/**
 * /my-overview — personal dashboard.
 *
 * Different from /workspace:
 *   · /workspace  → workspace-level (projects, switcher, recently viewed)
 *   · /my-overview → personal lens (your activity feed, your awaiting-review
 *     queue, your team). The cards live here so /workspace stays focused on
 *     the project switcher and project grid.
 */

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  CheckCircle2,
  ClipboardCheck,
  MessageSquare,
} from 'lucide-react'
import NotificationsBell from '@/components/layout/NotificationsBell'
import WorkspaceSidebar from '@/components/layout/WorkspaceSidebar'
import ActivityFeed from '@/components/workspace/ActivityFeed'
import { AvatarStack } from '@/components/workspace/Avatar'
import PendingDecisionsCard from '@/components/workspace/PendingDecisionsCard'
import StatCard from '@/components/workspace/StatCard'
import TeamCard from '@/components/workspace/TeamCard'
import { ApiError, api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import {
  SEED_ACTIVITY,
  SEED_MEMBERS,
  SEED_PENDING_DECISIONS,
  SEED_PROJECTS,
  withCurrentUser,
} from '@/lib/mockWorkspace'
import type { UserRead } from '@/types/api'

export default function MyOverviewPage() {
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
        setError(err instanceof Error ? err.message : 'Failed to load')
      })
    return () => {
      cancelled = true
    }
  }, [router])

  const members = useMemo(
    () => (user !== null ? withCurrentUser(SEED_MEMBERS, user.name, user.email) : SEED_MEMBERS),
    [user],
  )
  // Personal-lens stats — pulled from the seed corpus + pending list.
  const myReviewQueue = SEED_PENDING_DECISIONS.length
  const myMentions = useMemo(
    () =>
      SEED_ACTIVITY.filter((a) => a.snippet?.toLowerCase().includes('@you') ?? false).length,
    [],
  )
  const myActiveProjects = useMemo(
    () => SEED_PROJECTS.filter((p) => p.member_names.includes('You')).length,
    [],
  )
  // Pretend Sarah and David are online — the green dot is purely aesthetic.
  const onlineNames = useMemo(() => new Set(['Sarah Chen', 'David Kim']), [])

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

  const firstName = user.name.split(' ')[0] ?? user.name

  return (
    <div className="flex min-h-screen bg-slate-50">
      <WorkspaceSidebar user={user} current="dashboard" onSignOut={handleSignOut} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/85 px-6 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider text-slate-400">
              Workspace
            </span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-900">My Overview</span>
          </div>
          <NotificationsBell />
        </header>

        <section className="mx-auto w-full max-w-6xl px-6 py-8">
          {/* ── Personal hero ────────────────────────────────────────────── */}
          <div className="dv-anim-fade-up relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-primary-900 px-7 py-6 text-white shadow-lg">
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand opacity-20 blur-3xl" />
            <div className="pointer-events-none absolute -left-12 -bottom-16 h-56 w-56 rounded-full bg-primary opacity-30 blur-3xl" />
            <div className="relative z-10">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-200">
                Personal · Dashboard
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
                Welcome back, {firstName}
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-white/65">
                Your decisions, your reviews, your team — everything that needs your eye lives
                here. Switch to the Workspace view to see the project portfolio.
              </p>
              <div className="mt-3 flex items-center gap-3 text-xs text-white/70">
                <AvatarStack names={members.map((m) => m.name)} size="sm" max={5} />
                <span className="text-white/50">·</span>
                <span>
                  <span className="font-semibold text-white">{members.length}</span> teammates
                </span>
              </div>
            </div>
          </div>

          {/* ── Personal stat tiles ──────────────────────────────────────── */}
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="dv-anim-fade-up" style={{ animationDelay: '80ms' }}>
              <StatCard
                icon={ClipboardCheck}
                label="Awaiting your review"
                value={myReviewQueue}
                hint={`${myReviewQueue === 0 ? 'all clear' : 'needs your eye'}`}
                accent="text-red-600"
                accentBg="bg-red-50"
                trend={[1, 2, 3, 2, 3, 2, 3]}
              />
            </div>
            <div className="dv-anim-fade-up" style={{ animationDelay: '150ms' }}>
              <StatCard
                icon={MessageSquare}
                label="Mentions today"
                value={myMentions}
                hint="@you in comments"
                accent="text-amber-600"
                accentBg="bg-amber-50"
                trend={[0, 1, 0, 2, 1, 3, 1]}
              />
            </div>
            <div className="dv-anim-fade-up" style={{ animationDelay: '220ms' }}>
              <StatCard
                icon={CheckCircle2}
                label="Active projects"
                value={myActiveProjects}
                hint="you're collaborating on"
                accent="text-emerald-600"
                accentBg="bg-emerald-50"
                trend={[2, 2, 3, 3, 3, 3, 4]}
              />
            </div>
          </div>

          {/* ── Supporting cards: activity / pending / team ──────────────── */}
          <div
            className="dv-anim-fade-up mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]"
            style={{ animationDelay: '320ms' }}
          >
            <ActivityFeed entries={SEED_ACTIVITY} limit={6} />
            <div className="space-y-4">
              <PendingDecisionsCard decisions={SEED_PENDING_DECISIONS} />
              <TeamCard members={members} onlineNames={onlineNames} />
            </div>
          </div>

          <p className="mt-12 text-center text-[11px] text-slate-400">
            <Activity className="-mt-0.5 mr-1 inline h-3 w-3" />
            Your personal lens · All data is mock and resets on refresh.
          </p>
        </section>
      </div>
    </div>
  )
}
