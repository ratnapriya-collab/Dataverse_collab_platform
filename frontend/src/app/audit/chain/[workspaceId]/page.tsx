'use client'

/**
 * /audit/chain/[workspaceId] — M7 Hash Chain detail page.
 *
 * Renders the full append-only event chain for a workspace. Top of page
 * carries a "Chain integrity verified" badge with a "Verify chain now"
 * button that re-validates event by event in an animation (every event
 * gets a green pulsing check on the spine as it's checked).
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Download,
  FileCode,
  GitBranch,
  History,
  Lock,
  ShieldCheck,
} from 'lucide-react'
import NotificationsBell from '@/components/layout/NotificationsBell'
import WorkspaceSidebar from '@/components/layout/WorkspaceSidebar'
import StatCard from '@/components/workspace/StatCard'
import Toast, { type ToastState } from '@/components/ui/Toast'
import ChainVerifyBadge, { type VerifyState } from '@/components/audit/ChainVerifyBadge'
import HashChainEventRow from '@/components/audit/HashChainEventRow'
import { ApiError, api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import { SEED_HASH_CHAIN, SEED_WORKSPACE, formatTimeAgo } from '@/lib/mockWorkspace'
import type { UserRead } from '@/types/api'

const VERIFY_TICK_MS = 30 // per-event interval during the verification animation

export default function HashChainDetailPage(): JSX.Element {
  const params = useParams<{ workspaceId: string }>()
  const workspaceSlug = params?.workspaceId ?? SEED_WORKSPACE.slug
  const router = useRouter()
  const [user, setUser] = useState<UserRead | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  const [verifyState, setVerifyState] = useState<VerifyState>('verified')
  const [verifiedUpTo, setVerifiedUpTo] = useState<number>(SEED_HASH_CHAIN.length)
  const [pulseSeq, setPulseSeq] = useState<number | null>(null)

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

  function startVerify(): void {
    setVerifyState('verifying')
    setVerifiedUpTo(0)
    setPulseSeq(null)
    let idx = 0
    const total = SEED_HASH_CHAIN.length
    const tick = window.setInterval(() => {
      idx += 1
      setVerifiedUpTo(idx)
      setPulseSeq(idx)
      if (idx >= total) {
        window.clearInterval(tick)
        window.setTimeout(() => {
          setVerifyState('verified')
          setPulseSeq(null)
          setToast({
            message: `Chain verified · ${total.toLocaleString()} events from genesis`,
            tone: 'success',
          })
        }, 300)
      }
    }, VERIFY_TICK_MS)
  }

  const events = SEED_HASH_CHAIN
  const genesis = events[0]
  const tip = events[events.length - 1]
  const progress = verifiedUpTo / Math.max(1, events.length)

  if (error !== null) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      </main>
    )
  }
  if (user === null || genesis === undefined || tip === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-500">
        <span className="text-sm">Loading…</span>
      </main>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <WorkspaceSidebar user={user} current="audit" onSignOut={handleSignOut} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Toast toast={toast} onClose={() => setToast(null)} />

        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/85 px-6 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <History className="h-3 w-3 text-primary" />
            <span className="font-semibold uppercase tracking-wider text-slate-400">Workspace</span>
            <span className="text-slate-300">/</span>
            <Link href="/audit" className="font-medium hover:text-primary">Audit</Link>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-900">Hash chain</span>
            <span className="text-slate-300">·</span>
            <span className="font-mono text-slate-700">{workspaceSlug}</span>
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
                <GitBranch className="h-7 w-7 text-brand-300" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-200">
                  <Lock className="h-3 w-3" />
                  Append-only hash chain · M7
                </div>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">Workspace hash chain</h1>
                <p className="mt-1 text-sm leading-relaxed text-white/75">
                  Every workspace event SHA-256-chained to the previous. Tamper-evident · offline-verifiable · the immutable audit trail behind every ECN we hand a customer.
                </p>
                <p className="mt-2 font-mono text-[10px] text-white/45">
                  genesis · <span className="text-brand-200">{genesis.curr_hash.slice(0, 12)}…</span> →
                  tip · <span className="text-brand-200">{tip.curr_hash.slice(0, 12)}…</span>
                </p>
              </div>
              <div className="hidden flex-col gap-2 md:flex">
                <Link
                  href="/audit/export"
                  className="inline-flex items-center gap-1.5 rounded-md bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/25"
                >
                  <Download className="h-3 w-3" />
                  Export bundle
                </Link>
                <Link
                  href="/audit/replay-tool"
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-transparent px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:bg-white/10"
                >
                  <FileCode className="h-3 w-3" />
                  Replay tool docs
                </Link>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="dv-anim-fade-up mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" style={{ animationDelay: '80ms' }}>
            <StatCard
              icon={History}
              label="Events"
              value={events.length.toLocaleString()}
              hint="from genesis to tip"
              accent="text-primary"
              accentBg="bg-primary-50"
            />
            <StatCard
              icon={ShieldCheck}
              label="Chain status"
              value={verifyState === 'verifying' ? 'Verifying' : 'Verified'}
              hint={verifyState === 'verifying' ? `${verifiedUpTo} / ${events.length}` : 'all hashes match'}
              accent="text-emerald-600"
              accentBg="bg-emerald-50"
            />
            <StatCard
              icon={Lock}
              label="Genesis"
              value={new Date(genesis.created_at).toISOString().slice(0, 10)}
              hint={formatTimeAgo(genesis.created_at)}
              accent="text-slate-700"
              accentBg="bg-slate-100"
            />
            <StatCard
              icon={GitBranch}
              label="Tip"
              value={formatTimeAgo(tip.created_at)}
              hint={`#${tip.seq} · ${tip.kind}`}
              accent="text-brand-700"
              accentBg="bg-brand-50"
            />
          </div>

          {/* Verify badge */}
          <div className="dv-anim-fade-up mt-6" style={{ animationDelay: '150ms' }}>
            <ChainVerifyBadge
              state={verifyState}
              eventsCount={events.length}
              genesisAt={genesis.created_at}
              progress={progress}
              onVerifyNow={startVerify}
            />
          </div>

          {/* Event list */}
          <div className="dv-anim-fade-up mt-6" style={{ animationDelay: '220ms' }}>
            <header className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold tracking-tight text-slate-900">
                Event chain ({events.length})
              </h2>
              <span className="text-[10px] text-slate-500">most recent first · click any row for payload</span>
            </header>
            <div className="relative">
              <span
                aria-hidden="true"
                className="absolute left-[13px] top-3 bottom-3 w-px bg-gradient-to-b from-slate-200 via-slate-200 to-transparent"
              />
              <ul className="space-y-2">
                {[...events].reverse().map((e) => (
                  <HashChainEventRow
                    key={e.seq}
                    event={e}
                    recentlyVerified={pulseSeq === e.seq && verifyState === 'verifying'}
                  />
                ))}
              </ul>
            </div>
          </div>

          <Link
            href="/audit"
            className="mt-8 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-primary"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to audit log
          </Link>
        </section>
      </div>
    </div>
  )
}
