'use client'

/**
 * /parts/[id]/plm-push — Push to PLM (Screen A.10).
 *
 * Mock Windchill push flow. Picks ready-to-push ACCEPTED decisions,
 * shows an ECN assignment preview, fakes a progress modal, then a
 * success toast with a faux Windchill link.
 */

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Send,
  ServerCog,
  Sparkles,
} from 'lucide-react'
import NotificationsBell from '@/components/layout/NotificationsBell'
import WorkspaceSidebar from '@/components/layout/WorkspaceSidebar'
import StatCard from '@/components/workspace/StatCard'
import TeamBadge from '@/components/workspace/TeamBadge'
import Avatar from '@/components/workspace/Avatar'
import Toast, { type ToastState } from '@/components/ui/Toast'
import { ApiError, api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import {
  SEED_FULL_DECISIONS,
  formatTimeAgo,
} from '@/lib/mockWorkspace'
import type { UserRead } from '@/types/api'

const NOW = new Date('2026-05-14T12:00:00Z').getTime()

const SYNC_STATE = {
  last_pulled: new Date(NOW - 2 * 3_600_000).toISOString(),
  last_pushed: null as string | null,
  pending: 3,
  target: 'Windchill 12.1',
}

type Phase = 'idle' | 'pushing-1' | 'pushing-2' | 'pushing-3' | 'success'

const PHASES: Array<{ id: Phase; label: string; durationMs: number }> = [
  { id: 'pushing-1', label: 'Locking decisions in DataVerse…', durationMs: 700 },
  { id: 'pushing-2', label: 'Generating ECN payload (PLM-compatible)…', durationMs: 800 },
  { id: 'pushing-3', label: 'Posting to Windchill 12.1 → workflow #4711…', durationMs: 1100 },
]

export default function PlmPushPage() {
  const params = useParams<{ id: string }>()
  const partId = params?.id ?? 'demo_part'
  const router = useRouter()
  const [user, setUser] = useState<UserRead | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  const [phase, setPhase] = useState<Phase>('idle')
  const [ecnId, setEcnId] = useState<string | null>(null)
  const [lastPushed, setLastPushed] = useState<string | null>(SYNC_STATE.last_pushed)

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

  // Pick the 3 most-recent ACCEPTED decisions as "ready to push".
  const readyToPush = useMemo(
    () =>
      SEED_FULL_DECISIONS.filter((d) => d.state === 'ACCEPTED')
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
        .slice(0, 3),
    [],
  )

  function handlePush(): void {
    if (phase !== 'idle') return
    let elapsed = 0
    for (const p of PHASES) {
      const at = elapsed
      window.setTimeout(() => setPhase(p.id), at)
      elapsed += p.durationMs
    }
    window.setTimeout(() => {
      const newEcn = `ECN-2026-${String(Math.floor(Math.random() * 900 + 100))}`
      setEcnId(newEcn)
      setPhase('success')
      setLastPushed(new Date().toISOString())
      setToast({ message: `${newEcn} created in Windchill`, tone: 'success' })
    }, elapsed)
  }

  function reset(): void {
    setPhase('idle')
    setEcnId(null)
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

  const isPushing = phase !== 'idle' && phase !== 'success'

  return (
    <div className="flex min-h-screen bg-slate-50">
      <WorkspaceSidebar user={user} onSignOut={handleSignOut} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Toast toast={toast} onClose={() => setToast(null)} />

        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/85 px-6 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ServerCog className="h-3 w-3 text-primary" />
            <span className="font-semibold uppercase tracking-wider text-slate-400">Workspace</span>
            <span className="text-slate-300">/</span>
            <Link href={`/parts/${partId}`} className="font-medium hover:text-primary">
              Part
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-900">Push to PLM</span>
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
                backgroundImage: 'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            />
            <div className="relative z-10 flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm ring-1 ring-white/20">
                <ServerCog className="h-7 w-7 text-brand-300" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-200">
                  <Send className="h-3 w-3" />
                  PLM integration · {SYNC_STATE.target}
                </div>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">Push decisions to PLM</h1>
                <p className="mt-1 text-sm leading-relaxed text-white/70">
                  Generate an ECN containing all locked decisions on this part. The payload is PLM-compatible JSON and lands in your Windchill workflow queue.
                </p>
              </div>
              <Link
                href={`/parts/${partId}`}
                className="hidden shrink-0 items-center gap-1.5 rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/15 md:inline-flex"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to viewer
              </Link>
            </div>
          </div>

          {/* Sync state stats */}
          <div className="dv-anim-fade-up mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" style={{ animationDelay: '80ms' }}>
            <StatCard
              icon={Download}
              label="Last pulled"
              value={formatTimeAgo(SYNC_STATE.last_pulled)}
              hint={SYNC_STATE.target}
              accent="text-primary"
              accentBg="bg-primary-50"
            />
            <StatCard
              icon={Send}
              label="Last pushed"
              value={lastPushed !== null ? formatTimeAgo(lastPushed) : 'Never'}
              hint={lastPushed !== null ? ecnId ?? '—' : 'no prior pushes for this part'}
              accent="text-emerald-600"
              accentBg="bg-emerald-50"
            />
            <StatCard
              icon={Clock}
              label="Ready to push"
              value={readyToPush.length}
              hint="accepted decisions"
              accent="text-amber-600"
              accentBg="bg-amber-50"
            />
            <StatCard
              icon={ServerCog}
              label="Target system"
              value="Windchill 12.1"
              hint="prod · us-east-1"
              accent="text-brand-700"
              accentBg="bg-brand-50"
            />
          </div>

          {/* Preview table */}
          <div className="dv-anim-fade-up mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" style={{ animationDelay: '150ms' }}>
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div>
                <h2 className="text-sm font-bold tracking-tight text-slate-900">Will be included in the ECN</h2>
                <p className="text-xs text-slate-500">
                  {readyToPush.length} decisions · grouped under a single Engineering Change Notice
                </p>
              </div>
              <button
                type="button"
                onClick={handlePush}
                disabled={isPushing}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPushing ? (
                  <>
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-r-transparent" />
                    Pushing…
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Push to Windchill
                  </>
                )}
              </button>
            </header>
            <table className="w-full">
              <thead className="bg-slate-50/60">
                <tr className="text-left">
                  <Th>Decision</Th>
                  <Th>Rationale</Th>
                  <Th>Anchor</Th>
                  <Th>Author</Th>
                  <Th>Created</Th>
                </tr>
              </thead>
              <tbody>
                {readyToPush.map((d) => (
                  <tr key={d.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 align-top">
                      <p className="font-mono text-xs font-semibold text-slate-900">{d.id}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">{d.project_name}</p>
                    </td>
                    <td className="max-w-md px-4 py-3 align-top">
                      <p className="line-clamp-2 text-sm text-slate-700">{d.rationale}</p>
                      {d.citations.length > 0 && (
                        <p className="mt-1 truncate font-mono text-[10px] text-slate-500">
                          {d.citations.join(' · ')}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700">
                        {d.anchor_id}
                      </span>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* JSON payload preview (collapsed by default) */}
          <details className="dv-anim-fade-up mt-4 rounded-xl border border-slate-200 bg-white shadow-sm" style={{ animationDelay: '220ms' }}>
            <summary className="flex cursor-pointer items-center justify-between px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Preview ECN payload (PLM-compatible JSON)
              </span>
              <span className="text-[10px] uppercase tracking-wider text-slate-400">
                {readyToPush.length} decisions · ~{readyToPush.length * 1.2} KB
              </span>
            </summary>
            <pre className="overflow-x-auto border-t border-slate-100 bg-slate-900 p-4 font-mono text-[11px] leading-relaxed text-slate-100">
{JSON.stringify(
  {
    ecn_id: ecnId ?? 'ECN-<assigned-on-push>',
    target_system: 'Windchill 12.1',
    workflow: '#4711 — Engineering Change',
    part_id: partId,
    decisions: readyToPush.map((d) => ({
      id: d.id,
      anchor_id: d.anchor_id,
      state: d.state,
      rationale: d.rationale,
      citations: d.citations,
      author: d.author_name,
      created_at: d.created_at,
    })),
  },
  null,
  2,
)}
            </pre>
          </details>
        </section>
      </div>

      {/* Progress / success modal */}
      {phase !== 'idle' && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm dv-anim-fade-in">
          <div className="dv-anim-pop w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            {phase === 'success' ? (
              <div className="p-6 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
                <h2 className="mt-4 text-base font-bold tracking-tight text-slate-900">
                  Pushed successfully
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  All {readyToPush.length} decisions are now in Windchill.
                </p>

                <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-left">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800/80">
                    ECN ID
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <code className="font-mono text-base font-bold text-emerald-900">{ecnId}</code>
                    <a
                      href="#"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline"
                    >
                      Open in Windchill
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                <div className="mt-5 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Close
                  </button>
                  <Link
                    href={`/parts/${partId}`}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
                  >
                    Back to viewer
                  </Link>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-[2.5px] border-primary border-r-transparent" />
                  <h2 className="text-sm font-bold tracking-tight text-slate-900">
                    Pushing to {SYNC_STATE.target}
                  </h2>
                </div>
                <ul className="mt-5 space-y-2">
                  {PHASES.map((p) => {
                    const reached = PHASES.findIndex((x) => x.id === phase) >= PHASES.findIndex((x) => x.id === p.id)
                    const isCurrent = p.id === phase
                    return (
                      <li
                        key={p.id}
                        className={`flex items-center gap-3 rounded-md px-3 py-2 text-xs transition ${
                          isCurrent
                            ? 'bg-primary-50 text-primary-700'
                            : reached
                            ? 'text-slate-700'
                            : 'text-slate-400'
                        }`}
                      >
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                            reached
                              ? isCurrent
                                ? 'bg-primary text-white'
                                : 'bg-emerald-500 text-white'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {reached && !isCurrent ? <Check className="h-3 w-3" /> : null}
                        </span>
                        <span className="flex-1">{p.label}</span>
                      </li>
                    )
                  })}
                </ul>
                <p className="mt-4 text-[10px] text-slate-400">
                  Do not close this window — the ECN ID assigns server-side.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </th>
  )
}
