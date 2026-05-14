'use client'

import Link from 'next/link'
import { notFound, useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Box,
  ChevronRight,
  Download,
  History,
  MessageSquare,
  Plus,
  Share2,
  Users,
} from 'lucide-react'
import Logo from '@/components/ui/Logo'
import UserBadge from '@/components/ui/UserBadge'
import Avatar, { AvatarStack } from '@/components/workspace/Avatar'
import ProjectThumbnail from '@/components/workspace/ProjectThumbnail'
import { ApiError, api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import {
  formatTimeAgo,
  getProject,
  SEED_MEMBERS,
  type MockProject,
  type ProjectStatus,
  withCurrentUser,
} from '@/lib/mockWorkspace'
import type { UserRead } from '@/types/api'

const ViewerCanvas = dynamic(() => import('@/components/viewer/ViewerCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
      Loading 3D viewer…
    </div>
  ),
})

const STATUS_STYLES: Record<ProjectStatus, { dot: string; text: string; label: string }> = {
  ACTIVE: { dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Active' },
  IN_REVIEW: { dot: 'bg-amber-500', text: 'text-amber-700', label: 'In review' },
  APPROVED: { dot: 'bg-primary-500', text: 'text-primary-700', label: 'Approved' },
  ARCHIVED: { dot: 'bg-slate-400', text: 'text-slate-600', label: 'Archived' },
}

interface MockComment {
  id: string
  author_name: string
  rationale: string
  created_at: string
  state: 'PROPOSED' | 'ACCEPTED' | 'REJECTED'
}

function mockCommentsFor(project: MockProject): MockComment[] {
  const NOW = Date.now()
  const all: MockComment[] = [
    {
      id: 'c1',
      author_name: 'Sarah Chen',
      rationale:
        'Wall thickness at the inlet flange is 1.6 mm — needs ≥ 2.0 mm per the supplier spec.',
      created_at: new Date(NOW - 35 * 60_000).toISOString(),
      state: 'PROPOSED',
    },
    {
      id: 'c2',
      author_name: 'David Kim',
      rationale: 'Surface finish on the seal face should be Ra 0.8 µm or better.',
      created_at: new Date(NOW - 3 * 3_600_000).toISOString(),
      state: 'ACCEPTED',
    },
    {
      id: 'c3',
      author_name: 'John Williams',
      rationale: 'Confirm hole pattern aligns with the ECU module mounting bosses.',
      created_at: new Date(NOW - 18 * 3_600_000).toISOString(),
      state: 'PROPOSED',
    },
  ]
  return all.slice(0, Math.max(1, project.open_comments + 1))
}

export default function ProjectPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id ?? ''
  const project = getProject(id)

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

  const members = useMemo(() => {
    if (project === undefined) return []
    return withCurrentUser(SEED_MEMBERS, user?.name ?? 'You', user?.email ?? '').filter(
      (m) => project.member_names.includes(m.name) || m.is_you,
    )
  }, [project, user])

  const comments = useMemo(
    () => (project !== undefined ? mockCommentsFor(project) : []),
    [project],
  )

  function handleSignOut(): void {
    clearToken()
    router.replace('/login')
  }

  if (project === undefined) {
    notFound()
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

  const status = STATUS_STYLES[project.status]

  return (
    <main className="flex h-screen flex-col bg-slate-50">
      {/* ── Navbar with breadcrumb ──────────────────────────────────────── */}
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-6 py-3">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href="/workspace"
              aria-label="Back to workspace"
              title="Back to workspace"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-primary hover:text-primary hover:shadow-sm"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Logo compact markClassName="h-8 w-8" />
            <div className="flex min-w-0 items-center gap-2 border-l border-slate-200 pl-4 text-sm">
              <Link href="/workspace" className="text-slate-500 hover:text-primary">
                Workspace
              </Link>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
              <span className="truncate font-semibold text-slate-900">{project.name}</span>
              <span
                className={`ml-2 inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold ${status.text}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <UserBadge name={user.name} email={user.email} />
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ── Main 2-column ───────────────────────────────────────────────── */}
      <section className="grid flex-1 grid-cols-[1fr_380px] overflow-hidden">
        <div className="relative bg-slate-100">
          <ViewerCanvas />
        </div>

        <aside className="overflow-y-auto border-l border-slate-200 bg-white">
          {/* Hero card with thumbnail */}
          <div className="relative">
            <ProjectThumbnail shape={project.shape} tone={project.tone} aspectClass="aspect-[16/9]" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3">
              <h1 className="text-lg font-bold text-white">{project.name}</h1>
            </div>
          </div>

          <div className="px-5 py-4">
            <p className="text-xs leading-relaxed text-slate-600">{project.description}</p>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Stat label="Parts" value={project.parts_count} />
              <Stat label="Open" value={project.open_comments} tone="red" />
              <Stat label="Members" value={members.length} />
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-primary to-primary-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:shadow-md"
              >
                <Plus className="h-3.5 w-3.5" />
                New comment
              </button>
              <button
                type="button"
                aria-label="Share project"
                title="Share project"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition hover:border-primary hover:text-primary"
              >
                <Share2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Download"
                title="Download"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition hover:border-primary hover:text-primary"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <hr className="border-slate-200" />

          {/* Members */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between">
              <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Users className="h-3 w-3" />
                Members
              </h3>
              <AvatarStack names={project.member_names} size="sm" max={3} />
            </div>
            <ul className="mt-3 space-y-2">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-2.5">
                  <Avatar name={m.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-900">
                      {m.name}
                      {m.is_you && (
                        <span className="ml-1.5 rounded-full bg-brand-50 px-1.5 py-0.5 text-[9px] font-bold text-brand-700">
                          YOU
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">{m.email}</p>
                  </div>
                  <span className="text-[10px] font-semibold uppercase text-slate-500">
                    {m.role}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <hr className="border-slate-200" />

          {/* Comments thread */}
          <div className="px-5 py-4">
            <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <MessageSquare className="h-3 w-3" />
              Comments
              <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                {comments.length}
              </span>
            </h3>
            <ul className="mt-3 space-y-3">
              {comments.map((c) => (
                <li
                  key={c.id}
                  className={`rounded-lg border-l-4 bg-slate-50 px-3 py-2.5 ${
                    c.state === 'ACCEPTED'
                      ? 'border-l-emerald-500'
                      : c.state === 'REJECTED'
                        ? 'border-l-slate-400'
                        : 'border-l-red-500'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Avatar name={c.author_name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-900">
                        {c.author_name}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {formatTimeAgo(c.created_at)} ·{' '}
                        <span
                          className={
                            c.state === 'ACCEPTED'
                              ? 'text-emerald-700'
                              : c.state === 'REJECTED'
                                ? 'text-slate-500'
                                : 'text-red-700'
                          }
                        >
                          {c.state}
                        </span>
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-700">
                    {c.rationale}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <hr className="border-slate-200" />

          {/* Activity teaser */}
          <div className="px-5 py-4 pb-6">
            <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <History className="h-3 w-3" />
              Activity
            </h3>
            <ul className="mt-3 space-y-2 text-[11px] text-slate-600">
              <li className="flex items-center gap-2">
                <Box className="h-3 w-3 text-slate-400" />
                <span>
                  <span className="font-semibold text-slate-900">Sarah Chen</span> uploaded
                  a new part · 25m ago
                </span>
              </li>
              <li className="flex items-center gap-2">
                <MessageSquare className="h-3 w-3 text-slate-400" />
                <span>
                  <span className="font-semibold text-slate-900">David Kim</span> accepted
                  a comment · 3h ago
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Users className="h-3 w-3 text-slate-400" />
                <span>
                  <span className="font-semibold text-slate-900">Maria Garcia</span> joined
                  this project · 2d ago
                </span>
              </li>
            </ul>
            <p className="mt-4 text-center text-[10px] text-slate-400">
              Mock project · Geometry shown is sample
            </p>
          </div>
        </aside>
      </section>
    </main>
  )
}

function Stat({
  label,
  value,
  tone = 'slate',
}: {
  label: string
  value: number
  tone?: 'slate' | 'red'
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2">
      <p
        className={`text-lg font-bold tabular-nums ${tone === 'red' && value > 0 ? 'text-red-600' : 'text-slate-900'}`}
      >
        {value}
      </p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
    </div>
  )
}
