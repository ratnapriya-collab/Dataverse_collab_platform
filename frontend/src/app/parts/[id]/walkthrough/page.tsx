'use client'

/**
 * /parts/[id]/walkthrough — fullscreen Decision Walkthrough (Screen A.9).
 *
 * Sequentially steps through every decision on the part with rationale,
 * citations, author and signoff progress. Arrow keys + on-screen Prev/Next.
 * Dimmed background hints at the viewer behind.
 */

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Hash,
  PlayCircle,
  X,
  XCircle,
} from 'lucide-react'
import Avatar from '@/components/workspace/Avatar'
import TeamBadge from '@/components/workspace/TeamBadge'
import { ApiError, api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import {
  SEED_FULL_DECISIONS,
  formatTimeAgo,
  type FullDecisionState,
  type MockFullDecision,
} from '@/lib/mockWorkspace'
import type { UserRead } from '@/types/api'

const STATE_PILL: Record<FullDecisionState, { bg: string; fg: string; label: string }> = {
  DRAFT: { bg: 'bg-slate-100', fg: 'text-slate-700', label: 'Draft' },
  PROPOSED: { bg: 'bg-amber-50', fg: 'text-amber-700', label: 'Proposed' },
  ACCEPTED: { bg: 'bg-emerald-50', fg: 'text-emerald-700', label: 'Accepted' },
  REJECTED: { bg: 'bg-rose-50', fg: 'text-rose-700', label: 'Rejected' },
  SUPERSEDED: { bg: 'bg-slate-100', fg: 'text-slate-500', label: 'Superseded' },
}

export default function WalkthroughPage() {
  const params = useParams<{ id: string }>()
  const partId = params?.id ?? 'demo_part'
  const router = useRouter()
  const [user, setUser] = useState<UserRead | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [idx, setIdx] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')

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

  // Use the full feed for now — in real product these would be the decisions
  // scoped to this part. For the demo, just take the first 6.
  const decisions = useMemo<MockFullDecision[]>(() => SEED_FULL_DECISIONS.slice(0, 6), [])

  const next = () => {
    setDirection('forward')
    setIdx((i) => Math.min(i + 1, decisions.length - 1))
  }
  const prev = () => {
    setDirection('back')
    setIdx((i) => Math.max(i - 1, 0))
  }

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'Escape') router.push(`/parts/${partId}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decisions.length, partId])

  if (error !== null) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-sm text-red-600">
        {error}
      </main>
    )
  }
  if (user === null || decisions.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-400">
        <span className="text-sm">Loading walkthrough…</span>
      </main>
    )
  }

  const d = decisions[idx] as MockFullDecision
  const state = STATE_PILL[d.state]
  const progress = ((idx + 1) / decisions.length) * 100

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-slate-900">
      {/* Dimmed viewer-ish background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 1000px 600px at 30% 25%, rgba(31,122,109,0.18), transparent 60%), radial-gradient(ellipse 900px 700px at 80% 90%, rgba(6,182,212,0.14), transparent 60%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Header bar */}
      <header className="relative z-10 flex items-center justify-between border-b border-white/10 bg-black/30 px-6 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 ring-1 ring-white/20">
            <PlayCircle className="h-3.5 w-3.5 text-brand-300" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-200">
              Decision walkthrough · demo
            </span>
            <span className="text-xs font-medium text-white/80">
              Part <span className="font-mono">{partId}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden text-[11px] text-white/50 sm:inline">
            Use{' '}
            <kbd className="rounded border border-white/20 bg-white/10 px-1 font-mono text-[10px]">
              ←
            </kbd>{' '}
            <kbd className="rounded border border-white/20 bg-white/10 px-1 font-mono text-[10px]">
              →
            </kbd>{' '}
            to navigate ·{' '}
            <kbd className="rounded border border-white/20 bg-white/10 px-1 font-mono text-[10px]">
              ESC
            </kbd>{' '}
            to exit
          </span>
          <Link
            href={`/parts/${partId}`}
            aria-label="Exit walkthrough"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Progress bar */}
      <div className="relative z-10 h-1 bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-primary via-primary-400 to-brand-400 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Card */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <article
          key={d.id}
          className={`w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-slate-950/85 shadow-2xl ring-1 ring-white/5 backdrop-blur-md ${
            direction === 'forward' ? 'dv-anim-fade-up' : 'dv-anim-fade-up'
          }`}
        >
          <header className="flex items-start gap-4 border-b border-white/10 px-6 py-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
              <Hash className="h-5 w-5 text-brand-300" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${state.bg} ${state.fg}`}
                >
                  {state.label}
                </span>
                <span className="font-mono text-[11px] text-white/40">{d.id}</span>
              </div>
              <h1 className="mt-1.5 text-lg font-bold tracking-tight text-white">
                {d.part_name}
                <span className="text-white/40"> · </span>
                <span className="font-mono text-base font-medium text-brand-300">{d.anchor_id}</span>
              </h1>
              <p className="mt-0.5 text-xs text-white/50">{d.project_name}</p>
            </div>
            <span className="hidden shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-white/70 sm:inline">
              {idx + 1} of {decisions.length}
            </span>
          </header>

          <div className="space-y-4 px-6 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Rationale
            </p>
            <p className="text-base leading-relaxed text-white/85">{d.rationale}</p>

            {d.citations.length > 0 && (
              <div className="border-t border-white/10 pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  Citations
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {d.citations.map((c) => (
                    <li
                      key={c}
                      className="rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-white/80"
                    >
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 border-t border-white/10 pt-4 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  Author
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Avatar name={d.author_name} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{d.author_name}</p>
                    <TeamBadge team={d.author_team} size="xs" variant="dot" />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  Signoff
                </p>
                <div className="mt-2">
                  {d.signoff_progress !== undefined ? (
                    <div>
                      <div className="flex items-baseline justify-between text-xs text-white/80">
                        <span>
                          {d.signoff_progress.responded} / {d.signoff_progress.total} signed
                        </span>
                        <span className="font-mono text-white/40">
                          {Math.round(
                            (d.signoff_progress.responded / d.signoff_progress.total) * 100,
                          )}
                          %
                        </span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full bg-emerald-400 transition-all"
                          style={{
                            width: `${(d.signoff_progress.responded / d.signoff_progress.total) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-white/50">No signoff required — terminal state.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/10 pt-3 text-[11px] text-white/40">
              <span>Created {formatTimeAgo(d.created_at)}</span>
              <span className="flex items-center gap-1">
                {d.state === 'ACCEPTED' && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
                {d.state === 'REJECTED' && <XCircle className="h-3 w-3 text-rose-400" />}
                <span>Permanent · part of audit log</span>
              </span>
            </div>
          </div>
        </article>
      </div>

      {/* Bottom navigation bar */}
      <footer className="relative z-10 flex items-center justify-between gap-4 border-t border-white/10 bg-black/40 px-6 py-3 backdrop-blur-md">
        <button
          type="button"
          onClick={prev}
          disabled={idx === 0}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>

        <div className="flex items-center gap-1.5">
          {decisions.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setDirection(i > idx ? 'forward' : 'back')
                setIdx(i)
              }}
              aria-label={`Go to decision ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                i === idx ? 'w-8 bg-brand-300' : 'w-1.5 bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={next}
          disabled={idx === decisions.length - 1}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ArrowRight className="h-4 w-4" />
        </button>
      </footer>

      {/* Floating exit-hint */}
      <Link
        href={`/parts/${partId}`}
        className="absolute bottom-20 left-6 z-20 hidden items-center gap-1 text-[11px] text-white/40 transition hover:text-white/70 md:flex"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to part viewer
      </Link>
    </main>
  )
}
