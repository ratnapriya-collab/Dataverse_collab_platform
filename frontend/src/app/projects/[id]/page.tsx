'use client'

/**
 * /projects/[id] — Project collaboration hub (CoLab pattern).
 *
 * Flow:  Workspace → click project card → land here.
 *
 * Layout: WorkspaceSidebar + sticky breadcrumb + ProjectHubHero,
 * followed by a 4-tab strip (Parts · Decisions · Activity · Members)
 * with inline tab content. Each tab is project-scoped:
 *
 *   PARTS      grid of parts in this project → click → /parts/[id]
 *              (3D + 2D + BOM viewer)
 *   DECISIONS  the decisions raised against parts in this project
 *   ACTIVITY   recent events
 *   MEMBERS    who's collaborating + role + team badge
 *
 * Mock-only: parts derive from SEED_FULL_DECISIONS keyed by project_id.
 */

import Link from 'next/link'
import { notFound, useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, BarChart3, ChevronRight, FileBox, FolderKanban, Inbox } from 'lucide-react'
import NotificationsBell from '@/components/layout/NotificationsBell'
import WorkspaceSidebar from '@/components/layout/WorkspaceSidebar'
import ProjectHubHero from '@/components/projects/ProjectHubHero'
import ProjectHubTabs, { type ProjectHubTab } from '@/components/projects/ProjectHubTabs'
import ProjectOverviewTab from '@/components/projects/ProjectOverviewTab'
import ProjectPinsTab from '@/components/projects/ProjectPinsTab'
import FeedbackPanel from '@/components/feedback/FeedbackPanel'
import { useBookmarks } from '@/hooks/useBookmarks'
import Avatar from '@/components/workspace/Avatar'
import TeamBadge from '@/components/workspace/TeamBadge'
import Toast, { type ToastState } from '@/components/ui/Toast'
import { ApiError, api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import {
  SEED_ACTIVITY,
  SEED_FULL_DECISIONS,
  SEED_MEMBERS,
  formatTimeAgo,
  getProject,
  withCurrentUser,
  type MockFullDecision,
  type ActivityEntry,
  type MockMember,
} from '@/lib/mockWorkspace'
import type { UserRead } from '@/types/api'

const STATE_PILL: Record<MockFullDecision['state'], { bg: string; fg: string; dot: string }> = {
  DRAFT: { bg: 'bg-slate-100', fg: 'text-slate-600', dot: 'bg-slate-400' },
  PROPOSED: { bg: 'bg-amber-50', fg: 'text-amber-700', dot: 'bg-amber-500' },
  ACCEPTED: { bg: 'bg-emerald-50', fg: 'text-emerald-700', dot: 'bg-emerald-500' },
  REJECTED: { bg: 'bg-rose-50', fg: 'text-rose-700', dot: 'bg-rose-500' },
  SUPERSEDED: { bg: 'bg-slate-100', fg: 'text-slate-500', dot: 'bg-slate-400' },
}

export default function ProjectHubPage(): JSX.Element {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id ?? ''
  const project = getProject(id)

  const [user, setUser] = useState<UserRead | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [tab, setTab] = useState<ProjectHubTab>('overview')
  const { bookmarks, toggle: toggleBookmark } = useBookmarks(id)

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

  // Members on THIS project
  const projectMembers = useMemo<MockMember[]>(() => {
    if (project === undefined) return []
    return withCurrentUser(SEED_MEMBERS, user?.name ?? 'You', user?.email ?? '').filter(
      (m) => project.member_names.includes(m.name) || m.is_you,
    )
  }, [project, user])

  // Decisions scoped to this project
  const decisions = useMemo<MockFullDecision[]>(() => {
    if (project === undefined) return []
    return SEED_FULL_DECISIONS.filter((d) => d.project_id === project.id)
  }, [project])

  // Parts derived from this project's decisions (one card per part_id)
  type ProjectPart = { id: string; name: string; decisions_count: number; open_count: number }
  const parts = useMemo<ProjectPart[]>(() => {
    const m = new Map<string, ProjectPart>()
    for (const d of decisions) {
      const existing = m.get(d.part_id) ?? {
        id: d.part_id,
        name: d.part_name,
        decisions_count: 0,
        open_count: 0,
      }
      existing.decisions_count += 1
      if (d.state === 'PROPOSED' || d.state === 'DRAFT') existing.open_count += 1
      m.set(d.part_id, existing)
    }
    return Array.from(m.values())
  }, [decisions])

  // Activity — workspace-wide for now, since SEED_ACTIVITY isn't project-keyed.
  // We surface the slice most likely to belong to this project by matching
  // actor or part-name fragments — a heuristic that keeps the demo realistic.
  const activity = useMemo<ActivityEntry[]>(() => {
    if (project === undefined) return []
    const partNames = parts.map((p) => p.name.toLowerCase())
    return SEED_ACTIVITY.filter((a) => {
      if (a.target === undefined) return false
      const t = a.target.toLowerCase()
      if (partNames.some((n) => t.includes(n.split(' ')[0]?.toLowerCase() ?? ''))) return true
      return project.member_names.includes(a.actor_name)
    }).slice(0, 8)
  }, [project, parts])

  function handleSignOut(): void {
    clearToken()
    router.replace('/login')
  }

  if (project === undefined) notFound()

  if (error !== null) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p role="alert" className="text-sm text-red-600">{error}</p>
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

  const counts: Record<ProjectHubTab, number> = {
    overview: 0,
    parts: parts.length,
    decisions: decisions.length,
    feedback: decisions.length, // every decision is a feedback row
    pins: bookmarks.length,
    dashboards: 0,
    activity: activity.length,
    members: projectMembers.length,
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <WorkspaceSidebar user={user} current="projects" onSignOut={handleSignOut} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Toast toast={toast} onClose={() => setToast(null)} />

        {/* Breadcrumb header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/85 px-6 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-1.5 text-xs">
            <FolderKanban className="h-3 w-3 text-primary" />
            <Link href="/workspace" className="font-semibold uppercase tracking-wider text-slate-400 hover:text-primary">
              Workspace
            </Link>
            <ChevronRight className="h-3 w-3 text-slate-300" />
            <Link href="/workspace" className="text-slate-500 hover:text-primary">Projects</Link>
            <ChevronRight className="h-3 w-3 text-slate-300" />
            <span className="font-semibold text-slate-900">{project.name}</span>
          </div>
          <NotificationsBell />
        </header>

        <section className="mx-auto w-full max-w-6xl px-6 py-8">
          {/* Hero */}
          <div className="dv-anim-fade-up">
            <ProjectHubHero
              project={project}
              memberCount={projectMembers.length}
              onUploadPart={() => setToast({ message: 'Open the Parts tab below to upload a part', tone: 'success' })}
              onInvite={() => setToast({ message: 'Invite a teammate via Admin → Invites', tone: 'success' })}
              onShare={() => setToast({ message: 'Share link copied', tone: 'success' })}
              onSettings={() => setToast({ message: 'Project settings coming soon', tone: 'success' })}
            />
          </div>

          {/* Tabs */}
          <div className="dv-anim-fade-up mt-6" style={{ animationDelay: '80ms' }}>
            <ProjectHubTabs active={tab} onChange={setTab} counts={counts} />
          </div>

          {/* Tab content */}
          <div className="dv-anim-fade-up mt-6" style={{ animationDelay: '160ms' }} key={tab}>
            {tab === 'overview' && (
              <ProjectOverviewTab
                decisions={decisions}
                members={projectMembers}
                bookmarks={bookmarks}
                onToggleBookmark={(id) => {
                  toggleBookmark(id)
                  setToast({
                    message: bookmarks.includes(id) ? 'Removed from Pins' : 'Pinned to this project',
                    tone: 'success',
                  })
                }}
              />
            )}
            {tab === 'parts' && <PartsTab parts={parts} />}
            {tab === 'decisions' && <DecisionsTab decisions={decisions} />}
            {tab === 'feedback' && (
              <FeedbackPanel decisions={decisions} currentUserName={user.name} />
            )}
            {tab === 'pins' && (
              <ProjectPinsTab
                bookmarks={bookmarks}
                decisions={decisions}
                members={projectMembers}
                onUnpin={(id) => {
                  toggleBookmark(id)
                  setToast({ message: 'Removed from Pins', tone: 'success' })
                }}
                onGoToOverview={() => setTab('overview')}
              />
            )}
            {tab === 'dashboards' && <DashboardsTab onGoToOverview={() => setTab('overview')} />}
            {tab === 'activity' && <ActivityTab activity={activity} />}
            {tab === 'members' && <MembersTab members={projectMembers} projectName={project.name} />}
          </div>
        </section>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// TAB CONTENT — kept inline since each tab is scoped tightly to this page.
// ───────────────────────────────────────────────────────────────────────────

function PartsTab({ parts }: { parts: Array<{ id: string; name: string; decisions_count: number; open_count: number }> }): JSX.Element {
  if (parts.length === 0) {
    return (
      <EmptyTab
        icon={FileBox}
        title="No parts yet on this project"
        body="Upload a STEP / GLB to start anchoring decisions to its geometry."
      />
    )
  }
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {parts.map((p, idx) => (
        <li
          key={p.id}
          className="dv-anim-fade-up"
          style={{ animationDelay: `${Math.min(idx * 50, 240)}ms`, animationFillMode: 'backwards' }}
        >
          <Link
            href={`/parts/${p.id}`}
            className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-px hover:border-primary/30 hover:shadow-md"
          >
            <div
              className="relative h-32 w-full overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-primary-900"
              aria-hidden="true"
            >
              <div
                className="absolute inset-0 opacity-[0.18]"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
                  backgroundSize: '18px 18px',
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <FileBox className="h-12 w-12 text-white/40 transition group-hover:scale-110 group-hover:text-white/60" />
              </div>
              {p.open_count > 0 && (
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 ring-1 ring-amber-300">
                  {p.open_count} open
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <div>
                <p className="truncate text-sm font-bold text-slate-900">{p.name}</p>
                <p className="font-mono text-[10px] text-slate-500">{p.id}</p>
              </div>
              <div className="mt-auto flex items-center justify-between">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                  {p.decisions_count} {p.decisions_count === 1 ? 'decision' : 'decisions'}
                </span>
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-primary opacity-0 transition group-hover:opacity-100">
                  Open
                  <ArrowUpRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function DecisionsTab({ decisions }: { decisions: MockFullDecision[] }): JSX.Element {
  if (decisions.length === 0) {
    return (
      <EmptyTab
        icon={Inbox}
        title="No decisions raised yet"
        body="Open a part and click any face on the 3D viewer to propose your first decision."
      />
    )
  }
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <ul className="divide-y divide-slate-100">
        {decisions
          .slice()
          .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
          .map((d) => {
            const s = STATE_PILL[d.state]
            return (
              <li key={d.id} className="group flex items-start gap-3 px-4 py-3 transition hover:bg-slate-50/60">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${s.bg} ${s.fg}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
                  {d.state.toLowerCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <Link
                      href={`/parts/${d.part_id}?focus=${d.id}`}
                      className="text-sm font-semibold text-slate-900 hover:text-primary hover:underline"
                    >
                      {d.part_name}
                    </Link>
                    <span className="font-mono text-[10px] text-slate-400">{d.id}</span>
                    <span className="font-mono text-[10px] text-slate-400">· {d.anchor_id}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-slate-700">
                    {d.rationale}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                    <Avatar name={d.author_name} size="sm" />
                    <span className="font-medium text-slate-700">{d.author_name}</span>
                    <TeamBadge team={d.author_team} size="xs" variant="dot" />
                    <span className="ml-auto text-slate-400">{formatTimeAgo(d.created_at)}</span>
                  </div>
                </div>
                <Link
                  href={`/parts/${d.part_id}?focus=${d.id}`}
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-md px-2 py-1 text-[11px] font-semibold text-primary opacity-0 transition group-hover:opacity-100 hover:bg-primary-50"
                >
                  Open
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </li>
            )
          })}
      </ul>
    </div>
  )
}

function ActivityTab({ activity }: { activity: ActivityEntry[] }): JSX.Element {
  if (activity.length === 0) {
    return (
      <EmptyTab icon={Inbox} title="No activity yet" body="Decisions, uploads and signoffs will appear here as they happen." />
    )
  }
  return (
    <ol className="relative space-y-3 pl-10">
      <span aria-hidden="true" className="absolute left-4 bottom-3 top-3 w-px bg-slate-200" />
      {activity.map((a) => (
        <li key={a.id} className="relative">
          <span
            aria-hidden="true"
            className="absolute -left-[24px] top-3 z-10 flex h-3 w-3 items-center justify-center rounded-full bg-primary ring-4 ring-slate-50"
          />
          <article className="overflow-hidden rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2">
              <Avatar name={a.actor_name} size="sm" />
              <p className="text-[12px]">
                <span className="font-semibold text-slate-900">{a.actor_name}</span>
                <span className="text-slate-600"> {a.kind.replace(/_/g, ' ').toLowerCase()}</span>
                {a.target !== undefined && (
                  <span className="ml-1 font-mono text-[11px] text-slate-700">{a.target}</span>
                )}
              </p>
              <span className="ml-auto whitespace-nowrap text-[10px] text-slate-400">
                {formatTimeAgo(a.created_at)}
              </span>
            </div>
            {a.snippet !== undefined && (
              <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-slate-600">
                {a.snippet}
              </p>
            )}
          </article>
        </li>
      ))}
    </ol>
  )
}

function MembersTab({ members, projectName }: { members: MockMember[]; projectName: string }): JSX.Element {
  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between">
        <p className="text-[11px] text-slate-500">
          {members.length} {members.length === 1 ? 'person is' : 'people are'} collaborating on{' '}
          <strong className="font-semibold text-slate-900">{projectName}</strong>
        </p>
      </header>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {members.map((m) => (
          <li
            key={m.id}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <Avatar name={m.name} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900">
                {m.name}
                {m.is_you === true && (
                  <span className="ml-1.5 rounded-full bg-brand-50 px-1.5 py-0.5 text-[9px] font-bold text-brand-700">
                    YOU
                  </span>
                )}
              </p>
              <p className="truncate text-[11px] text-slate-500">{m.email}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-600">
                  {m.role}
                </span>
                {m.team !== undefined && <TeamBadge team={m.team} size="xs" variant="dot" />}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function DashboardsTab({ onGoToOverview }: { onGoToOverview: () => void }): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-50 text-primary">
        <BarChart3 className="h-6 w-6" />
      </div>
      <p className="mt-3 text-sm font-bold text-slate-900">One dashboard for now</p>
      <p className="mt-1 max-w-md text-[12px] leading-relaxed text-slate-500">
        The Overview tab is the project&apos;s default dashboard. Saved views and
        custom dashboards will live here — until then, head back to Overviews.
      </p>
      <button
        type="button"
        onClick={onGoToOverview}
        className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-primary-700"
      >
        Open Overviews
      </button>
    </div>
  )
}

function EmptyTab({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof FileBox
  title: string
  body: string
}): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">{body}</p>
    </div>
  )
}
