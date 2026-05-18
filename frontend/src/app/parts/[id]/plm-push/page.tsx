'use client'

/**
 * /parts/[id]/plm-push — M9 PLM Adapter (push to Windchill).
 *
 * Three-column wizard:
 *   Left   — picker: ACCEPTED decisions to include (pre-checked)
 *   Center — ECN preview generated from selection
 *   Right  — live sync status + "what gets pushed" explainer
 *
 * Bottom action bar fires the PushToPLMModal which animates a 3-phase
 * push then reveals download buttons + a deep-link to the external
 * Windchill view of the assigned ECN.
 */

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Hash,
  Send,
  ServerCog,
} from 'lucide-react'
import NotificationsBell from '@/components/layout/NotificationsBell'
import WorkspaceSidebar from '@/components/layout/WorkspaceSidebar'
import Avatar from '@/components/workspace/Avatar'
import TeamBadge from '@/components/workspace/TeamBadge'
import Toast, { type ToastState } from '@/components/ui/Toast'
import SyncStatusCard from '@/components/plm/SyncStatusCard'
import ECNPreviewCard from '@/components/plm/ECNPreviewCard'
import PushToPLMModal from '@/components/plm/PushToPLMModal'
import { ApiError, api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import {
  SEED_ECN_TEMPLATE,
  SEED_FULL_DECISIONS,
  SEED_PLM_CONNECTION,
  formatTimeAgo,
  type MockFullDecision,
} from '@/lib/mockWorkspace'
import type { UserRead } from '@/types/api'

export default function PlmPushPage(): JSX.Element {
  const params = useParams<{ id: string }>()
  const partId = params?.id ?? 'demo_part'
  const router = useRouter()
  const [user, setUser] = useState<UserRead | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  // ACCEPTED decisions on this part (use first 3 if no exact match).
  const eligible = useMemo<MockFullDecision[]>(() => {
    const onPart = SEED_FULL_DECISIONS.filter((d) => d.state === 'ACCEPTED' && d.part_id === partId)
    return onPart.length > 0 ? onPart.slice(0, 3) : SEED_FULL_DECISIONS.filter((d) => d.state === 'ACCEPTED').slice(0, 3)
  }, [partId])

  // Pre-check all eligible decisions.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(eligible.map((d) => d.id)))
  const [pushTrigger, setPushTrigger] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [pushedEcnId, setPushedEcnId] = useState<string | null>(null)
  const [pushedAt, setPushedAt] = useState<string | null>(null)

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

  const selectedDecisions = useMemo(
    () => eligible.filter((d) => selectedIds.has(d.id)),
    [eligible, selectedIds],
  )

  function toggle(id: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll(): void {
    if (selectedIds.size === eligible.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(eligible.map((d) => d.id)))
  }

  function handlePush(): void {
    if (selectedDecisions.length === 0) {
      setToast({ message: 'Select at least one decision to push', tone: 'error' })
      return
    }
    setModalOpen(true)
    setPushTrigger((n) => n + 1)
  }

  function handlePushComplete(ecnId: string): void {
    setPushedEcnId(ecnId)
    setPushedAt(new Date().toISOString())
    setToast({ message: `${ecnId} created in Windchill`, tone: 'success' })
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

  const allSelected = selectedIds.size === eligible.length && eligible.length > 0

  return (
    <div className="flex min-h-screen bg-slate-50">
      <WorkspaceSidebar user={user} onSignOut={handleSignOut} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Toast toast={toast} onClose={() => setToast(null)} />

        {/* Breadcrumb header */}
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

        <section className="mx-auto w-full max-w-[1280px] px-6 py-8">
          {/* ── Hero ───────────────────────────────────────────────────── */}
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
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-200">
                  <Send className="h-3 w-3" />
                  PLM integration · {SEED_PLM_CONNECTION.vendor} {SEED_PLM_CONNECTION.version}
                </div>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">Push decisions to PLM</h1>
                <p className="mt-1 text-sm leading-relaxed text-white/75">
                  Pick the ACCEPTED decisions to include, review the auto-generated ECN, then push. The
                  signed audit bundle goes along for the ride.
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

          {/* ── 3-column wizard ────────────────────────────────────────── */}
          <div className="dv-anim-fade-up mt-6 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_320px]" style={{ animationDelay: '80ms' }}>
            {/* Left column · Decisions ready to push */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Decisions to push
                  </span>
                </div>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-[10px] font-semibold uppercase tracking-wider text-primary hover:underline"
                >
                  {allSelected ? 'Clear' : 'Select all'}
                </button>
              </header>
              <ul className="divide-y divide-slate-100">
                {eligible.length === 0 ? (
                  <li className="px-4 py-6 text-center text-xs text-slate-500">
                    No ACCEPTED decisions yet on this part.
                  </li>
                ) : (
                  eligible.map((d) => {
                    const checked = selectedIds.has(d.id)
                    return (
                      <li key={d.id}>
                        <label
                          className={`flex w-full cursor-pointer items-start gap-2.5 px-4 py-3 transition ${
                            checked ? 'bg-primary-50/40 hover:bg-primary-50/60' : 'hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(d.id)}
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-slate-300 text-primary focus:ring-primary"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200">
                                <span className="h-1 w-1 rounded-full bg-emerald-500" />
                                Accepted
                              </span>
                              <span className="font-mono text-[10px] text-slate-400">{d.id}</span>
                            </div>
                            <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-slate-700">
                              {d.rationale}
                            </p>
                            <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-500">
                              <Hash className="h-2.5 w-2.5" />
                              <span className="font-mono">{d.anchor_id}</span>
                            </div>
                            <div className="mt-2 flex items-center gap-1.5">
                              <Avatar name={d.author_name} size="sm" />
                              <span className="truncate text-[10px] font-medium text-slate-700">
                                {d.author_name}
                              </span>
                              <TeamBadge team={d.author_team} size="xs" variant="dot" />
                              <span className="ml-auto whitespace-nowrap text-[10px] text-slate-400">
                                {formatTimeAgo(d.created_at)}
                              </span>
                            </div>
                          </div>
                        </label>
                      </li>
                    )
                  })
                )}
              </ul>
              <footer className="border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-[10px] text-slate-500">
                <strong className="font-bold tabular-nums text-slate-900">{selectedIds.size}</strong>{' '}
                of {eligible.length} selected
              </footer>
            </div>

            {/* Center column · ECN preview */}
            <ECNPreviewCard template={SEED_ECN_TEMPLATE} selectedDecisions={selectedDecisions} />

            {/* Right column · Sync + explainer */}
            <SyncStatusCard
              connection={SEED_PLM_CONNECTION}
              lastPushedAt={pushedAt}
              lastEcnId={pushedEcnId}
              onPing={() => setToast({ message: 'Connection healthy · 42 ms', tone: 'success' })}
            />
          </div>

          {/* ── Bottom action bar ──────────────────────────────────────── */}
          <footer className="dv-anim-fade-up sticky bottom-4 z-20 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-5 py-3 shadow-lg backdrop-blur-md" style={{ animationDelay: '160ms' }}>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {pushedEcnId === null
                  ? 'Ready to push to Windchill'
                  : `Pushed · ${pushedEcnId}`}
              </p>
              <p className="text-[11px] text-slate-500">
                {pushedEcnId === null
                  ? `${selectedDecisions.length} decisions · ECN draft auto-classified · audit bundle attached`
                  : 'Open the external view to see how the auditor sees it.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/parts/${partId}`}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </Link>
              {pushedEcnId === null ? (
                <button
                  type="button"
                  onClick={handlePush}
                  disabled={selectedDecisions.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send className="h-3.5 w-3.5" />
                  Push to Windchill
                </button>
              ) : (
                <a
                  href={`/external/windchill/ecn/${pushedEcnId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
                >
                  Open in Windchill
                  <ChevronRight className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </footer>
        </section>
      </div>

      <PushToPLMModal
        open={modalOpen}
        trigger={pushTrigger}
        vendor={SEED_PLM_CONNECTION.vendor}
        vendorHost={SEED_PLM_CONNECTION.host}
        ecnId={pushedEcnId}
        onComplete={handlePushComplete}
        onClose={() => setModalOpen(false)}
      />
    </div>
  )
}
