'use client'

/**
 * /parts/[id]/what-changed — M5 Cross-Rev Resolver "What changed" page.
 *
 * The unfair-advantage feature. Shows how every Rev A decision was mapped
 * onto Rev B by the 3-layer resolver:
 *
 *   Layer 1  exact match by face_uuid       → Auto-carried
 *   Layer 2  topology-fingerprint match     → Requires confirmation
 *   Layer 3  proximity / partial match      → Resolved, Regressed, Orphaned
 *
 * 100% mocked — reads SEED_RESOLVER_RESULT, no backend call.
 */

import Link from 'next/link'
import { useMemo, useState, useCallback, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  GitBranch,
  Layers,
  Sparkles,
  Unlink,
  Wand2,
} from 'lucide-react'
import NotificationsBell from '@/components/layout/NotificationsBell'
import WorkspaceSidebar from '@/components/layout/WorkspaceSidebar'
import StatCard from '@/components/workspace/StatCard'
import Toast, { type ToastState } from '@/components/ui/Toast'
import ConfidencePill from '@/components/resolver/ConfidencePill'
import VerifyAnchorModal from '@/components/resolver/VerifyAnchorModal'
import DatumRegressionPanel from '@/components/datum/DatumRegressionPanel'
import { ApiError, api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import { SEED_RESOLVER_RESULT, type MockResolverBucket } from '@/lib/mockWorkspace'
import type { UserRead } from '@/types/api'

type BucketTone = 'emerald' | 'amber' | 'primary' | 'rose' | 'slate'
type Layer = 1 | 2 | 3

const TONE_STRIP: Record<BucketTone, string> = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  primary: 'bg-primary',
  rose: 'bg-rose-500',
  slate: 'bg-slate-400',
}

const TONE_ICON_BG: Record<BucketTone, string> = {
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  primary: 'bg-primary-50 text-primary',
  rose: 'bg-rose-50 text-rose-600',
  slate: 'bg-slate-100 text-slate-600',
}

export default function WhatChangedPage(): JSX.Element {
  const params = useParams<{ id: string }>()
  const partId = params?.id ?? 'demo_part'
  const router = useRouter()
  const [user, setUser] = useState<UserRead | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  // Bucket open/close + per-decision verification state
  const [openBuckets, setOpenBuckets] = useState<Record<string, boolean>>({
    auto_carried: false,
    requires: true,
    resolved: false,
    regressed: true,
    orphaned: false,
  })
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set())
  const [rejected, setRejected] = useState<Set<string>>(new Set())
  const [activeVerify, setActiveVerify] = useState<MockResolverBucket | null>(null)

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

  function toggleBucket(key: string): void {
    setOpenBuckets((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const result = SEED_RESOLVER_RESULT
  const flaggedCount = result.requires_confirmation.length + result.regressed.length

  const handleAccept = useCallback((decisionId: string) => {
    setConfirmed((prev) => new Set(prev).add(decisionId))
    setRejected((prev) => {
      const n = new Set(prev)
      n.delete(decisionId)
      return n
    })
    setActiveVerify(null)
    setToast({ message: `Accepted · ${decisionId} carried forward`, tone: 'success' })
  }, [])

  const handleReject = useCallback((decisionId: string) => {
    setRejected((prev) => new Set(prev).add(decisionId))
    setConfirmed((prev) => {
      const n = new Set(prev)
      n.delete(decisionId)
      return n
    })
    setActiveVerify(null)
    setToast({ message: `Rejected · ${decisionId} re-opened in Rev B`, tone: 'success' })
  }, [])

  function handleResolveAll(): void {
    if (flaggedCount === 0) {
      setToast({ message: 'Nothing flagged — every decision is already placed', tone: 'success' })
      return
    }
    const next = new Set(confirmed)
    for (const b of result.requires_confirmation) next.add(b.decision_id)
    setConfirmed(next)
    setToast({
      message: `Resolved ${flaggedCount} flagged decision${flaggedCount === 1 ? '' : 's'}`,
      tone: 'success',
    })
  }

  function handleExport(): void {
    const blob = new Blob([JSON.stringify(buildReport(result), null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `resolver-report-${partId}-${result.from_rev.replace(' ', '')}-to-${result.to_rev.replace(' ', '')}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    setToast({ message: 'Resolver report exported · JSON ready', tone: 'success' })
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

        {/* Breadcrumb header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/85 px-6 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Layers className="h-3 w-3 text-primary" />
            <span className="font-semibold uppercase tracking-wider text-slate-400">Workspace</span>
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
          {/* ── Hero ───────────────────────────────────────────────────── */}
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
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-200">
                  <Sparkles className="h-3 w-3" />
                  Cross-rev resolver
                  <span
                    className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-emerald-300/40 bg-emerald-400/15 px-2 py-0.5 text-emerald-200"
                    aria-live="polite"
                  >
                    <span className="relative inline-flex h-1.5 w-1.5">
                      <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400" />
                      <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    </span>
                    {result.layers_run}-layer resolver complete
                  </span>
                </div>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">
                  What changed · {result.from_rev}{' '}
                  <ArrowRight className="inline h-4 w-4 align-baseline text-brand-300" />{' '}
                  {result.to_rev}
                </h1>
                <p className="mt-1 text-sm leading-relaxed text-white/75">
                  Bracket-AERO-014 · resolver complete ·{' '}
                  <strong className="font-semibold text-white">
                    {Math.round(result.average_confidence * 100)}%
                  </strong>{' '}
                  average confidence (high band ≥ 0.95).
                </p>
                <p className="mt-2 text-[11px] text-white/45">
                  {result.requires_confirmation.length} decisions need your eye ·{' '}
                  {result.regressed.length} regressed and impossible to miss below.
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

          {/* ── 5 stat cards ───────────────────────────────────────────── */}
          <div className="dv-anim-fade-up mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5" style={{ animationDelay: '80ms' }}>
            <StatCard
              icon={CheckCircle2}
              label="Auto-carried"
              value={result.auto_carried.length}
              hint="Layer 1 · face_uuid"
              accent="text-emerald-600"
              accentBg="bg-emerald-50"
            />
            <StatCard
              icon={AlertTriangle}
              label="Needs confirmation"
              value={result.requires_confirmation.length}
              hint="Layer 2 · fingerprint"
              accent="text-amber-600"
              accentBg="bg-amber-50"
            />
            <StatCard
              icon={Sparkles}
              label="Resolved by change"
              value={result.resolved.length}
              hint="rev introduced the fix"
              accent="text-primary"
              accentBg="bg-primary-50"
            />
            <StatCard
              icon={AlertTriangle}
              label="Regressed"
              value={result.regressed.length}
              hint="urgent — review now"
              accent="text-rose-600"
              accentBg="bg-rose-50"
            />
            <StatCard
              icon={Unlink}
              label="Orphaned"
              value={result.orphaned.length}
              hint="no match at any layer"
              accent="text-slate-500"
              accentBg="bg-slate-100"
            />
          </div>

          {/* ── Urgent regression banner ───────────────────────────────── */}
          {result.regressed.length > 0 && (
            <div className="dv-anim-fade-up mt-6 flex items-start gap-3 rounded-xl border-l-4 border-rose-500 bg-gradient-to-r from-rose-50 via-rose-50 to-white px-5 py-4 shadow-sm" style={{ animationDelay: '150ms' }}>
              <span className="relative mt-0.5 inline-flex h-5 w-5 shrink-0">
                <span className="absolute inset-0 animate-ping rounded-full bg-rose-300 opacity-60" />
                <AlertTriangle className="relative h-5 w-5 text-rose-600" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-rose-900">
                  {result.regressed.length} decision{result.regressed.length === 1 ? '' : 's'} regressed in this revision
                </p>
                {result.regressed.map((r) => (
                  <p key={r.id} className="mt-0.5 text-xs text-rose-800/85">
                    <span className="font-mono font-semibold">{r.decision_id}</span> — &ldquo;{r.title}&rdquo;
                    {r.anchor_id !== undefined && (
                      <>
                        {' '}
                        · anchor moved <strong className="font-semibold">4.2 mm</strong> in {result.to_rev}
                      </>
                    )}
                  </p>
                ))}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-rose-700/80">
                  <span className="inline-flex items-center gap-0.5">
                    <span className="font-semibold text-rose-900">Impact:</span> 2 mating parts ·
                    CAE re-approval required
                  </span>
                  <span className="text-rose-300">·</span>
                  <span>Estimated rework cost: ~$1.4k</span>
                  <span className="text-rose-300">·</span>
                  <span className="inline-flex items-center gap-0.5">
                    <Sparkles className="h-2.5 w-2.5 text-violet-500" />
                    Datum scan below cross-references this
                  </span>
                </div>
                <p className="mt-1 text-[11px] font-semibold text-rose-700/70">
                  Review immediately before this rev ships.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpenBuckets((p) => ({ ...p, regressed: true }))
                  document.getElementById('bucket-regressed')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700"
              >
                Review now
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* ── Datum · Hook 4 · Flag Regressions ────────────────────────── */}
          <div className="dv-anim-fade-up mt-6" style={{ animationDelay: '200ms' }}>
            <DatumRegressionPanel
              partId={partId}
              revSnapshotId={`${partId}:${result.to_rev}`}
            />
          </div>

          {/* ── Buckets ────────────────────────────────────────────────── */}
          <div className="mt-8 space-y-4">
            <Bucket
              id="auto_carried"
              tone="emerald"
              icon={CheckCircle2}
              title="Auto-carried"
              description="Layer 1 — exact match by face_uuid. The geometry under the anchor was bit-identical across revisions."
              items={result.auto_carried}
              defaultLayer={1}
              open={openBuckets.auto_carried ?? false}
              onToggle={() => toggleBucket('auto_carried')}
              partId={partId}
              animationDelay="220ms"
            />

            <Bucket
              id="requires"
              tone="amber"
              icon={AlertTriangle}
              title="Requires confirmation"
              description="Layer 2 — topology-fingerprint match below the 0.95 confidence threshold. Verify each before promoting."
              items={result.requires_confirmation}
              defaultLayer={2}
              open={openBuckets.requires ?? false}
              onToggle={() => toggleBucket('requires')}
              actionLabel="Verify anchor"
              onAction={(b) => setActiveVerify(b)}
              confirmedSet={confirmed}
              rejectedSet={rejected}
              partId={partId}
              animationDelay="290ms"
            />

            <Bucket
              id="resolved"
              tone="primary"
              icon={Sparkles}
              title="Resolved by change"
              description={`Layer 3 — concerns from ${result.from_rev} that the new revision addresses. No action required.`}
              items={result.resolved}
              defaultLayer={3}
              open={openBuckets.resolved ?? false}
              onToggle={() => toggleBucket('resolved')}
              partId={partId}
              animationDelay="360ms"
            />

            <div id="bucket-regressed">
              <Bucket
                id="regressed"
                tone="rose"
                icon={AlertTriangle}
                title="Regressed"
                description="Layer 3 — decisions previously rejected now apply again. The geometry that triggered them is back."
                items={result.regressed}
                defaultLayer={3}
                open={openBuckets.regressed ?? true}
                onToggle={() => toggleBucket('regressed')}
                actionLabel="Re-open decision"
                onAction={(b) =>
                  setToast({
                    message: `${b.decision_id} re-opened · back in your queue`,
                    tone: 'success',
                  })
                }
                showThumbnails
                partId={partId}
                animationDelay="430ms"
              />
            </div>

            <Bucket
              id="orphaned"
              tone="slate"
              icon={Unlink}
              title="Orphaned"
              description="Anchors lost completely — no match at Layer 1, 2 or 3. Archived for the audit trail."
              items={result.orphaned}
              defaultLayer={3}
              open={openBuckets.orphaned ?? false}
              onToggle={() => toggleBucket('orphaned')}
              partId={partId}
              animationDelay="500ms"
              dimmed
            />
          </div>

          {/* ── Footer actions ─────────────────────────────────────────── */}
          <footer className="dv-anim-fade-up mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm" style={{ animationDelay: '600ms' }}>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">Bulk actions</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Apply your verdict to every flagged decision, or hand the report to QA for offline review.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleResolveAll}
                disabled={flaggedCount === 0}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-primary hover:bg-primary-50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Wand2 className="h-3.5 w-3.5" />
                Resolve all flagged
                {flaggedCount > 0 && (
                  <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-amber-700">
                    {flaggedCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
              >
                <Download className="h-3.5 w-3.5" />
                Export resolver report
              </button>
            </div>
          </footer>
        </section>
      </div>

      <VerifyAnchorModal
        open={activeVerify !== null}
        bucket={activeVerify}
        fromRev={result.from_rev}
        toRev={result.to_rev}
        onAccept={handleAccept}
        onReject={handleReject}
        onClose={() => setActiveVerify(null)}
      />
    </div>
  )
}

// ─── Bucket section (collapsible) ────────────────────────────────────────────

interface BucketProps {
  id: string
  tone: BucketTone
  icon: typeof CheckCircle2
  title: string
  description: string
  items: MockResolverBucket[]
  defaultLayer: Layer
  open: boolean
  onToggle: () => void
  actionLabel?: string
  onAction?: (bucket: MockResolverBucket) => void
  confirmedSet?: Set<string>
  rejectedSet?: Set<string>
  showThumbnails?: boolean
  partId: string
  animationDelay?: string
  dimmed?: boolean
}

function Bucket({
  id,
  tone,
  icon: Icon,
  title,
  description,
  items,
  defaultLayer,
  open,
  onToggle,
  actionLabel,
  onAction,
  confirmedSet,
  rejectedSet,
  showThumbnails,
  partId,
  animationDelay,
  dimmed,
}: BucketProps): JSX.Element {
  // Empty bucket — small chip-style row
  if (items.length === 0) {
    return (
      <div
        className={`dv-anim-fade-up flex items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-white px-5 py-3.5 text-sm ${
          dimmed === true ? 'opacity-60' : ''
        }`}
        style={animationDelay !== undefined ? { animationDelay } : undefined}
      >
        <div className={`flex h-8 w-8 items-center justify-center rounded-md ${TONE_ICON_BG[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-700">{title}</p>
          <p className="text-xs text-slate-500">None — nothing to review here.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-500">
          0
        </span>
      </div>
    )
  }

  return (
    <div
      className="dv-anim-fade-up overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      style={animationDelay !== undefined ? { animationDelay } : undefined}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`bucket-content-${id}`}
        className="flex w-full items-start gap-3 border-b border-slate-100 px-5 py-4 text-left transition hover:bg-slate-50/50"
      >
        <span className={`mt-1 h-8 w-1.5 shrink-0 rounded-full ${TONE_STRIP[tone]}`} aria-hidden="true" />
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${TONE_ICON_BG[tone]}`}>
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
        <ChevronDown
          className={`mt-1.5 h-4 w-4 shrink-0 text-slate-400 transition-transform ${
            open ? 'rotate-0' : '-rotate-90'
          }`}
        />
      </button>

      {open && (
        <ul id={`bucket-content-${id}`} className="dv-anim-fade-in divide-y divide-slate-100">
          {items.map((b) => {
            const isConfirmed = confirmedSet?.has(b.decision_id) ?? false
            const isRejected = rejectedSet?.has(b.decision_id) ?? false
            return (
              <li key={b.id} className="flex flex-col gap-3 px-5 py-3 transition hover:bg-slate-50/60 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <p className="truncate text-sm font-medium text-slate-900">{b.title}</p>
                    <span className="font-mono text-[10px] text-slate-400">{b.decision_id}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    {b.anchor_id !== undefined && <span className="font-mono">anchor · {b.anchor_id}</span>}
                    <ConfidencePill confidence={b.confidence} layer={defaultLayer} />
                    <Link
                      href={`/parts/${partId}?focus=${b.decision_id}`}
                      className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
                    >
                      <Eye className="h-3 w-3" />
                      View in viewer
                    </Link>
                  </div>
                  {showThumbnails === true && (
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:max-w-sm">
                      <MiniRevThumb label="Rev A" tone="slate" />
                      <MiniRevThumb label="Rev B" tone="rose" />
                    </div>
                  )}
                </div>

                {actionLabel !== undefined && onAction !== undefined && (
                  <div className="flex shrink-0 items-center gap-2">
                    {isConfirmed && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" />
                        Verified
                      </span>
                    )}
                    {isRejected && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">
                        Rejected
                      </span>
                    )}
                    {!isConfirmed && !isRejected && (
                      <button
                        type="button"
                        onClick={() => onAction(b)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-primary hover:bg-primary-50 hover:text-primary"
                      >
                        <Eye className="h-3 w-3" />
                        {actionLabel}
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ─── Tiny Rev A/B thumbnail used inside the Regressed bucket ────────────────

function MiniRevThumb({ label, tone }: { label: string; tone: 'slate' | 'rose' }): JSX.Element {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-950">
      <div
        className={`flex items-center justify-between px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${
          tone === 'rose' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'
        }`}
      >
        <span>{label}</span>
        {tone === 'rose' && <span className="font-mono text-rose-700">Δ 4.2 mm</span>}
      </div>
      <div className="relative aspect-[16/10] w-full">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '14px 14px',
          }}
        />
        <svg viewBox="0 0 160 100" className="absolute inset-0 h-full w-full">
          <polygon points="30,68 130,68 140,58 40,58" fill="#2a323f" stroke="#4a5666" strokeWidth="0.5" />
          <polygon points="30,68 130,68 130,82 30,82" fill="#1f2733" stroke="#4a5666" strokeWidth="0.5" />
          <rect x="60" y="30" width="40" height="28" fill="#1f2733" stroke="#4a5666" strokeWidth="0.5" />
        </svg>
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: tone === 'rose' ? '54%' : '50%', top: tone === 'rose' ? '48%' : '42%' }}
        >
          <span className={`block h-3 w-3 rounded-full ring-2 ${tone === 'rose' ? 'bg-rose-500 ring-rose-100/30' : 'bg-emerald-500 ring-emerald-100/30'}`} />
        </div>
      </div>
    </div>
  )
}

// ─── Exportable report (downloaded by "Export resolver report" button) ──────

function buildReport(r: typeof SEED_RESOLVER_RESULT): Record<string, unknown> {
  return {
    schema: 'dataverse.resolver-report/v1',
    generated_at: new Date().toISOString(),
    part_id: r.part_id,
    from_rev: r.from_rev,
    to_rev: r.to_rev,
    layers_run: r.layers_run,
    average_confidence: r.average_confidence,
    summary: {
      auto_carried: r.auto_carried.length,
      requires_confirmation: r.requires_confirmation.length,
      resolved_by_change: r.resolved.length,
      regressed: r.regressed.length,
      orphaned: r.orphaned.length,
    },
    buckets: {
      auto_carried: r.auto_carried,
      requires_confirmation: r.requires_confirmation,
      resolved_by_change: r.resolved,
      regressed: r.regressed,
      orphaned: r.orphaned,
    },
  }
}
