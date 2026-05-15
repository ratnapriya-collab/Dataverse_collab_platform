'use client'

/**
 * /parts/[id]/concierge — Supplier Concierge guided tour (Screen A.8).
 *
 * Mock tour led by "Datum" — the AI co-pilot. 7 steps walk a first-time
 * supplier through the most important decisions on the part. Each step
 * has a heading, body, and a highlighted "focus point" on the part panel
 * to the left (rendered as a SVG bracket with a glowing focus ring).
 */

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X,
} from 'lucide-react'
import NotificationsBell from '@/components/layout/NotificationsBell'
import WorkspaceSidebar from '@/components/layout/WorkspaceSidebar'
import Toast, { type ToastState } from '@/components/ui/Toast'
import { ApiError, api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import type { UserRead } from '@/types/api'

interface TourStep {
  title: string
  body: string
  /** Focus ring position in % of the viewer canvas. */
  focus?: { xPct: number; yPct: number; label: string }
}

const STEPS: TourStep[] = [
  {
    title: 'Welcome to the part walkthrough',
    body: 'I\'ll guide you through the 3 most important decisions on this part. You can skip at any time or step through with the Next button. Each highlight points to the geometry the decision is anchored to.',
  },
  {
    title: 'The big picture',
    body: 'This part is a Wing Spar Bracket — a structural piece bolted to the spar between the wing root and the avionics enclosure. It carries ~4.2 kN of fatigue load over the airframe lifetime.',
    focus: { xPct: 50, yPct: 50, label: 'Whole part overview' },
  },
  {
    title: 'Wall thickness at the boss',
    body: 'The wall thickness here is 1.6 mm, below the 2.0 mm standard minimum. We accepted this with a documented FEA justification per AS9100 §6.4.3. You can\'t change this without re-running FEA.',
    focus: { xPct: 38, yPct: 36, label: 'face-boss-7 · 1.6 mm wall' },
  },
  {
    title: 'Bolt hole offset',
    body: 'There\'s a 0.3 mm offset on the bolt hole pattern. This was intentional — confirmed against the mating boss tolerance stack. Drill to the nominal coordinates and the part will mate cleanly.',
    focus: { xPct: 56, yPct: 48, label: 'hole-bolt-3 · 0.3 mm offset' },
  },
  {
    title: 'Inlet flange surface finish',
    body: 'Surface roughness here tightened from Ra 3.2 µm to Ra 1.6 µm to seal against the gasket vendor\'s elastomer per their datasheet. Don\'t spec coarser — leakage tests will fail.',
    focus: { xPct: 72, yPct: 33, label: 'face-flange-1 · Ra 1.6 µm' },
  },
  {
    title: 'Load-edge fillet',
    body: 'Fillet radius increased from R1.5 to R2.5 on the load-bearing edge. This was added after CAE identified a stress concentration. Keep the corner generous — don\'t machine flat.',
    focus: { xPct: 30, yPct: 64, label: 'edge-fillet-2 · R2.5' },
  },
  {
    title: 'You\'re all set',
    body: 'You\'ve seen the 4 critical decisions. The rest are auto-applied from the prior revision. If you\'re unsure on any geometry, propose a decision — every change you make becomes a permanent part of the audit trail.',
  },
]

export default function ConciergePage() {
  const params = useParams<{ id: string }>()
  const partId = params?.id ?? 'demo_part'
  const router = useRouter()
  const [user, setUser] = useState<UserRead | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [completed, setCompleted] = useState<Set<number>>(new Set())
  const [toast, setToast] = useState<ToastState | null>(null)

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

  // Keyboard arrows
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'Escape') router.push(`/parts/${partId}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx])

  function handleSignOut(): void {
    clearToken()
    router.replace('/login')
  }

  function goNext(): void {
    setCompleted((prev) => new Set(prev).add(stepIdx))
    setStepIdx((i) => Math.min(i + 1, STEPS.length - 1))
  }
  function goPrev(): void {
    setStepIdx((i) => Math.max(i - 1, 0))
  }
  function finish(): void {
    setToast({ message: 'Tour complete · ready to review', tone: 'success' })
    window.setTimeout(() => router.push(`/parts/${partId}`), 800)
  }

  const step = useMemo(() => STEPS[stepIdx]!, [stepIdx])
  const isLast = stepIdx === STEPS.length - 1

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
      <WorkspaceSidebar user={user} onSignOut={handleSignOut} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Toast toast={toast} onClose={() => setToast(null)} />
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/85 px-6 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="font-semibold uppercase tracking-wider text-slate-400">Workspace</span>
            <span className="text-slate-300">/</span>
            <Link href={`/parts/${partId}`} className="font-medium hover:text-primary">
              Part
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-900">Supplier concierge</span>
          </div>
          <NotificationsBell />
        </header>

        <section className="mx-auto w-full max-w-6xl flex-1 px-6 py-6">
          {/* Two-pane: viewer left, Datum panel right */}
          <div className="grid h-[calc(100vh-9rem)] gap-4 lg:grid-cols-[1.5fr_1fr]">
            {/* ── Viewer (dark surface + bracket SVG + focus ring) ───────── */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-lg">
              {/* CAD grid */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-[0.06]"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
                  backgroundSize: '48px 48px',
                }}
              />
              {/* Vignette */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.5) 100%)',
                }}
              />
              {/* Part info chip */}
              <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs backdrop-blur-sm">
                <span className="font-mono text-white/80">Wing Spar Bracket</span>
                <span className="text-white/30">·</span>
                <span className="text-white/60">Rev B</span>
                <span className="text-white/30">·</span>
                <span className="rounded bg-primary/30 px-1.5 py-0.5 font-mono text-[10px] text-brand-200">
                  STEP
                </span>
              </div>

              {/* SVG bracket */}
              <div className="absolute inset-0 flex items-center justify-center p-10">
                <BracketSvg className="w-full max-w-3xl" />
              </div>

              {/* Focus highlight */}
              {step.focus !== undefined && (
                <div
                  className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${step.focus.xPct}%`, top: `${step.focus.yPct}%` }}
                >
                  {/* Pulsing rings */}
                  <span className="absolute inset-0 -m-2 animate-ping rounded-full bg-brand opacity-50" />
                  <span className="absolute inset-0 -m-1 rounded-full bg-brand-300 opacity-30 blur-md" />
                  <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-brand-300 text-slate-900 ring-4 ring-brand/40 shadow-lg">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  {/* Label */}
                  <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-slate-900/90 px-2 py-1 text-[10px] font-medium text-white shadow-pop backdrop-blur-sm">
                    {step.focus.label}
                  </span>
                </div>
              )}
            </div>

            {/* ── Datum side panel ────────────────────────────────────────── */}
            <aside className="dv-anim-fade-up relative flex flex-col overflow-hidden rounded-2xl border-2 border-purple-200/80 bg-white shadow-lg">
              {/* Header with Datum avatar */}
              <header className="relative overflow-hidden border-b border-purple-100 bg-gradient-to-br from-purple-50 via-white to-purple-50/60 px-5 py-4">
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-purple-200 opacity-30 blur-2xl" />
                <div className="relative flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-md">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">Datum</p>
                      <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-purple-700">
                        AI co-pilot
                      </span>
                    </div>
                    <p className="text-[11px] text-purple-700/70">
                      Step {stepIdx + 1} of {STEPS.length}
                    </p>
                  </div>
                  <Link
                    href={`/parts/${partId}`}
                    aria-label="Skip tour"
                    title="Skip tour"
                    className="ml-auto flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </Link>
                </div>
                {/* Step progress dots */}
                <div className="relative mt-3 flex gap-1">
                  {STEPS.map((_, i) => {
                    const done = completed.has(i) || i < stepIdx
                    const current = i === stepIdx
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setStepIdx(i)}
                        aria-label={`Jump to step ${i + 1}`}
                        className={`h-1.5 flex-1 rounded-full transition-all ${
                          current
                            ? 'bg-purple-600'
                            : done
                            ? 'bg-purple-300'
                            : 'bg-slate-200 hover:bg-slate-300'
                        }`}
                      />
                    )
                  })}
                </div>
              </header>

              {/* Body */}
              <div className="dv-thin-scroll flex-1 overflow-y-auto px-5 py-5">
                <div key={stepIdx} className="dv-anim-fade-up">
                  <h2 className="text-lg font-bold tracking-tight text-slate-900">{step.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{step.body}</p>

                  {step.focus !== undefined && (
                    <div className="mt-4 flex items-center gap-2 rounded-lg border border-purple-100 bg-purple-50/60 px-3 py-2 text-[11px] text-purple-900">
                      <Sparkles className="h-3 w-3 shrink-0 text-purple-600" />
                      <span className="font-medium">Highlighted on the viewer:</span>
                      <span className="font-mono text-purple-700">{step.focus.label}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer / controls */}
              <footer className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={goPrev}
                    disabled={stepIdx === 0}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronLeft className="h-3 w-3" />
                    Back
                  </button>
                  <Link
                    href={`/parts/${partId}`}
                    className="text-[11px] font-medium text-slate-500 hover:text-slate-900 hover:underline"
                  >
                    Skip tour
                  </Link>
                  {isLast ? (
                    <button
                      type="button"
                      onClick={finish}
                      className="inline-flex items-center gap-1 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-purple-700"
                    >
                      <Check className="h-3 w-3" />
                      Finish
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={goNext}
                      className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-700"
                    >
                      Next
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <p className="mt-2 text-center text-[10px] text-slate-400">
                  Use{' '}
                  <kbd className="rounded border border-slate-200 bg-white px-1 font-mono">←</kbd>{' '}
                  <kbd className="rounded border border-slate-200 bg-white px-1 font-mono">→</kbd>{' '}
                  to navigate
                </p>
              </footer>
            </aside>
          </div>

          <Link
            href={`/parts/${partId}`}
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-primary"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to part viewer
          </Link>
        </section>
      </div>
    </div>
  )
}

// ── Inline bracket SVG (clean, isometric — same vibe as the real viewer) ────

function BracketSvg({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 800 500"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Bracket part rendering"
    >
      <defs>
        <linearGradient id="brk-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3d4a5c" />
          <stop offset="1" stopColor="#1f2733" />
        </linearGradient>
        <linearGradient id="brk-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a323f" />
          <stop offset="1" stopColor="#13181f" />
        </linearGradient>
        <linearGradient id="brk-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#222933" />
          <stop offset="1" stopColor="#0e131a" />
        </linearGradient>
        <radialGradient id="brk-boss" cx="0.35" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#4d5b6e" />
          <stop offset="1" stopColor="#1a212c" />
        </radialGradient>
      </defs>
      <ellipse cx="400" cy="430" rx="280" ry="20" fill="#000" opacity="0.5" />

      <polygon points="160,300 640,300 700,260 220,260" fill="url(#brk-top)" stroke="#5b6a80" strokeWidth="1" />
      <polygon points="160,300 640,300 640,360 160,360" fill="url(#brk-front)" stroke="#4a5666" strokeWidth="1" />
      <polygon points="640,300 700,260 700,320 640,360" fill="url(#brk-side)" stroke="#3e4a5a" strokeWidth="1" />

      <polygon points="280,260 560,260 600,220 320,220 280,260 280,140 320,100 600,100 600,180" fill="url(#brk-front)" stroke="#4a5666" strokeWidth="1" />
      <polygon points="280,140 320,100 600,100 560,140" fill="url(#brk-top)" stroke="#5b6a80" strokeWidth="1" />
      <polygon points="560,140 600,100 600,220 560,260" fill="url(#brk-side)" stroke="#3e4a5a" strokeWidth="1" />
      <rect x="320" y="140" width="240" height="80" fill="#10151c" stroke="#3e4a5a" strokeWidth="1" />

      {[220, 320, 480, 580].map((cx) => (
        <g key={cx}>
          <ellipse cx={cx} cy="280" rx="11" ry="5" fill="#1a212c" stroke="#3e4a5a" strokeWidth="1" />
          <ellipse cx={cx} cy="280" rx="6" ry="2.8" fill="#05080b" />
        </g>
      ))}

      <ellipse cx="440" cy="180" rx="44" ry="28" fill="url(#brk-boss)" stroke="#5b6a80" strokeWidth="1" />
      <ellipse cx="440" cy="180" rx="22" ry="14" fill="#1a212c" />
      <ellipse cx="440" cy="178" rx="12" ry="7" fill="#05080b" />

      <ellipse cx="540" cy="180" rx="22" ry="14" fill="url(#brk-boss)" stroke="#5b6a80" strokeWidth="1" />
      <ellipse cx="540" cy="178" rx="11" ry="7" fill="#1a212c" />

      <rect x="345" y="158" width="48" height="40" rx="2" fill="#10151c" stroke="#3e4a5a" strokeWidth="1" />
    </svg>
  )
}
