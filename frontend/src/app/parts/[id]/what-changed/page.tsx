'use client'

/**
 * /parts/[id]/what-changed — Cross-rev resolver report (Screen A.7).
 *
 * Shows how decisions on the previous revision map to the new revision:
 * auto-carried · requires-confirmation · resolved · regressed · orphaned.
 * Mock data only (SEED_RESOLVER_RESULT).
 */

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Eye,
  GitBranch,
  Layers,
  Sparkles,
  Unlink,
} from 'lucide-react'
import NotificationsBell from '@/components/layout/NotificationsBell'
import WorkspaceSidebar from '@/components/layout/WorkspaceSidebar'
import StatCard from '@/components/workspace/StatCard'
import Toast, { type ToastState } from '@/components/ui/Toast'
import { ApiError, api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import { SEED_RESOLVER_RESULT, type MockResolverBucket } from '@/lib/mockWorkspace'
import type { UserRead } from '@/types/api'

export default function WhatChangedPage() {
  const params = useParams<{ id: string }>()
  const partId = params?.id ?? 'demo_part'
  const router = useRouter()
  const [user, setUser] = useState<UserRead | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set())

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

  const result = SEED_RESOLVER_RESULT
  const totalDecisions =
    result.auto_carried.length +
    result.requires_confirmation.length +
    result.resolved.length +
    result.regressed.length +
    result.orphaned.length

  function handleVerify(decisionId: string): void {
    setConfirmed((prev) => new Set(prev).add(decisionId))
    setToast({ message: 'Anchor verified · decision carried forward', tone: 'success' })
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
      <WorkspaceSidebar user={user} onSignOut={handleSignOut} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Toast toast={toast} onClose={() => setToast(null)} />

        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/85 px-6 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Layers className="h-3 w-3 text-primary" />
            <span className="font-semibold uppercase tracking-wider text-slate-400">Workspace</span>
            <span className="text-slate-300">/</span>
            <Link href="/workspace" className="font-medium hover:text-primary">
              Projects
            </Link>
            <span className="text-slate-300">/</span>
            <Link href={`/parts/${partId}`} className="font-medium hover:text-primary">
              Part
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-900">What changed</span>
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
                <GitBranch className="h-7 w-7 text-brand-300" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-200">
                  <Sparkles className="h-3 w-3" />
                  Cross-rev resolver
                </div>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">
                  What changed · {result.from_rev}{' '}
                  <ArrowRight className="inline h-4 w-4 align-baseline text-brand-300" />{' '}
                  {result.to_rev}
                </h1>
                <p className="mt-1 text-sm leading-relaxed text-white/70">
                  {totalDecisions} decisions were evaluated against the new revision. {result.requires_confirmation.length} need your confirmation; {result.regressed.length} regressed.
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

          {/* Stat strip */}
          <div className="dv-anim-fade-up mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" style={{ animationDelay: '80ms' }}>
            <StatCard
              icon={CheckCircle2}
              label="Auto-carried"
              value={result.auto_carried.length}
              hint="high-confidence match"
              accent="text-emerald-600"
              accentBg="bg-emerald-50"
            />
            <StatCard
              icon={AlertTriangle}
              label="Requires confirmation"
              value={result.requires_confirmation.length}
              hint="anchor likely the same"
              accent="text-amber-600"
              accentBg="bg-amber-50"
            />
            <StatCard
              icon={Sparkles}
              label="Resolved"
              value={result.resolved.length}
              hint="rev introduced the fix"
              accent="text-primary"
              accentBg="bg-primary-50"
            />
            <StatCard
              icon={Unlink}
              label="Regressed / Orphaned"
              value={result.regressed.length + result.orphaned.length}
              hint={`${result.regressed.length} regressed · ${result.orphaned.length} orphaned`}
              accent="text-rose-600"
              accentBg="bg-rose-50"
            />
          </div>

          {/* Urgent banner if regressed > 0 */}
          {result.regressed.length > 0 && (
            <div className="dv-anim-fade-up mt-6 flex items-start gap-3 rounded-xl border-l-4 border-rose-500 bg-rose-50 px-5 py-4 shadow-sm" style={{ animationDelay: '150ms' }}>
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-rose-900">
                  {result.regressed.length} decision{result.regressed.length === 1 ? '' : 's'} regressed
                </p>
                <p className="mt-0.5 text-xs text-rose-800/80">
                  A previously rejected decision now applies again in {result.to_rev}. Review before merging.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('bucket-regressed')
                  if (el !== null) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700"
              >
                Review now
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Buckets */}
          <div className="mt-8 space-y-6">
            <Bucket
              tone="emerald"
              icon={CheckCircle2}
              title="Auto-carried"
              description="High confidence — anchor and geometry matched cleanly across the revision."
              items={result.auto_carried}
              animationDelay="220ms"
            />

            <Bucket
              tone="amber"
              icon={AlertTriangle}
              title="Requires confirmation"
              description="Anchor likely persisted but confidence < 0.75. Verify before carrying forward."
              items={result.requires_confirmation}
              actionLabel="Verify anchor"
              onAction={handleVerify}
              confirmedSet={confirmed}
              animationDelay="290ms"
            />

            <Bucket
              tone="primary"
              icon={Sparkles}
              title="Resolved by change"
              description={`Concerns from ${result.from_rev} that the new revision addresses — no action required.`}
              items={result.resolved}
              animationDelay="360ms"
            />

            <div id="bucket-regressed">
              <Bucket
                tone="rose"
                icon={AlertTriangle}
                title="Regressed"
                description="Decisions previously rejected now apply again — the geometry that triggered them is back."
                items={result.regressed}
                actionLabel="Open in viewer"
                onAction={(id) =>
                  setToast({
                    message: `Opening ${id} in viewer…`,
                    tone: 'success',
                  })
                }
                animationDelay="430ms"
              />
            </div>

            {result.orphaned.length > 0 && (
              <Bucket
                tone="slate"
                icon={Unlink}
                title="Orphaned"
                description="Anchors that no longer exist in the new revision — decisions stay archived for the audit trail."
                items={result.orphaned}
                animationDelay="500ms"
              />
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

// ── Bucket section ──────────────────────────────────────────────────────────

const TONE: Record<
  'emerald' | 'amber' | 'primary' | 'rose' | 'slate',
  { strip: string; iconBg: string; iconFg: string; badge: string }
> = {
  emerald: {
    strip: 'bg-emerald-500',
    iconBg: 'bg-emerald-50',
    iconFg: 'text-emerald-600',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  amber: {
    strip: 'bg-amber-500',
    iconBg: 'bg-amber-50',
    iconFg: 'text-amber-600',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  primary: {
    strip: 'bg-primary',
    iconBg: 'bg-primary-50',
    iconFg: 'text-primary',
    badge: 'bg-primary-50 text-primary-700 border-primary-100',
  },
  rose: {
    strip: 'bg-rose-500',
    iconBg: 'bg-rose-50',
    iconFg: 'text-rose-600',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  slate: {
    strip: 'bg-slate-400',
    iconBg: 'bg-slate-100',
    iconFg: 'text-slate-600',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
  },
}

interface BucketProps {
  tone: keyof typeof TONE
  icon: typeof CheckCircle2
  title: string
  description: string
  items: MockResolverBucket[]
  actionLabel?: string
  onAction?: (decisionId: string) => void
  confirmedSet?: Set<string>
  animationDelay?: string
}

function Bucket({
  tone,
  icon: Icon,
  title,
  description,
  items,
  actionLabel,
  onAction,
  confirmedSet,
  animationDelay,
}: BucketProps) {
  const t = TONE[tone]
  if (items.length === 0) {
    return (
      <div className="dv-anim-fade-up flex items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white px-5 py-4 text-sm text-slate-500" style={animationDelay !== undefined ? { animationDelay } : undefined}>
        <div className={`flex h-8 w-8 items-center justify-center rounded-md ${t.iconBg} ${t.iconFg}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-700">{title}</p>
          <p className="text-xs text-slate-500">None — nothing to review.</p>
        </div>
      </div>
    )
  }
  return (
    <div
      className="dv-anim-fade-up overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      style={animationDelay !== undefined ? { animationDelay } : undefined}
    >
      <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
        <span className={`mt-1 h-8 w-1.5 rounded-full ${t.strip}`} aria-hidden="true" />
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${t.iconBg} ${t.iconFg}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-bold tracking-tight text-slate-900">{title}</h2>
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-600">
              {items.length}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
      </header>
      <ul className="divide-y divide-slate-100">
        {items.map((b) => {
          const isConfirmed = confirmedSet?.has(b.decision_id) ?? false
          return (
            <li key={b.id} className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50/60">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className="truncate text-sm font-medium text-slate-900">{b.title}</p>
                  <span className="font-mono text-[10px] text-slate-400">{b.decision_id}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-[11px] text-slate-500">
                  {b.anchor_id !== undefined && (
                    <span className="font-mono">anchor · {b.anchor_id}</span>
                  )}
                  <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 font-semibold ${t.badge}`}>
                    {Math.round(b.confidence * 100)}% confidence
                  </span>
                </div>
              </div>
              {actionLabel !== undefined && onAction !== undefined && (
                isConfirmed ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" />
                    Verified
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onAction(b.decision_id)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-primary hover:bg-primary-50 hover:text-primary"
                  >
                    <Eye className="h-3 w-3" />
                    {actionLabel}
                  </button>
                )
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
