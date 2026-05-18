'use client'

/**
 * /audit/export — DVEX bundle export form.
 *
 * Centered single-card layout. Generates a signed JSON bundle that an
 * external auditor can verify offline with the dvex-replay CLI.
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileCode,
  History,
  Lock,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import NotificationsBell from '@/components/layout/NotificationsBell'
import WorkspaceSidebar from '@/components/layout/WorkspaceSidebar'
import Toast, { type ToastState } from '@/components/ui/Toast'
import DVEXExportModal from '@/components/audit/DVEXExportModal'
import { ApiError, api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import {
  SEED_DVEX_BUNDLE,
  SEED_HASH_CHAIN,
  SEED_WORKSPACE,
  formatTimeAgo,
} from '@/lib/mockWorkspace'
import type { UserRead } from '@/types/api'

export default function DVEXExportPage(): JSX.Element {
  const router = useRouter()
  const [user, setUser] = useState<UserRead | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  const [workspace, setWorkspace] = useState(SEED_WORKSPACE.slug)
  const [fromDate, setFromDate] = useState(
    new Date(new Date('2026-05-18T00:00:00Z').getTime() - 60 * 86_400_000).toISOString().slice(0, 10),
  )
  const [toDate, setToDate] = useState('2026-05-18')
  const [includeAttachments, setIncludeAttachments] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [trigger, setTrigger] = useState(0)

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

  function startExport(): void {
    setModalOpen(true)
    setTrigger((n) => n + 1)
    setToast({ message: 'Generating signed bundle…', tone: 'success' })
  }

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
            <span className="font-semibold text-slate-900">Export bundle</span>
          </div>
          <NotificationsBell />
        </header>

        <section className="mx-auto w-full max-w-3xl px-6 py-8">
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
                <ShieldCheck className="h-7 w-7 text-brand-300" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-200">
                  <Lock className="h-3 w-3" />
                  DVEX v1.0 · signed audit bundle
                </div>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">Export signed audit bundle</h1>
                <p className="mt-1 text-sm leading-relaxed text-white/75">
                  Generate a cryptographically signed JSON bundle an external auditor can verify
                  offline. Bundle includes the full hash chain, a public-key signature, and
                  optionally every attachment referenced inside it.
                </p>
              </div>
            </div>
          </div>

          {/* Form card */}
          <div className="dv-anim-fade-up mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" style={{ animationDelay: '80ms' }}>
            <header className="border-b border-slate-100 bg-slate-50/60 px-5 py-3">
              <h2 className="text-sm font-bold text-slate-900">Bundle settings</h2>
            </header>
            <div className="space-y-4 px-5 py-5">
              <Field label="Workspace">
                <select
                  value={workspace}
                  onChange={(e) => setWorkspace(e.target.value)}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value={SEED_WORKSPACE.slug}>
                    {SEED_WORKSPACE.name} · {SEED_WORKSPACE.slug}
                  </option>
                </select>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="From">
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </Field>
                <Field label="To">
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </Field>
              </div>

              <Field label="Attachments">
                <label className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 bg-slate-50/40 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={includeAttachments}
                    onChange={(e) => setIncludeAttachments(e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-900">
                      Include referenced attachments
                    </p>
                    <p className="text-[11px] text-slate-500">
                      STEP / GLB / PDF files cited in the event payload. Increases bundle size.
                    </p>
                  </div>
                </label>
              </Field>

              {/* Preview chip */}
              <div className="rounded-lg border border-slate-200 bg-gradient-to-br from-emerald-50/40 via-white to-brand-50/30 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Bundle preview
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                  <PreviewRow label="Events">
                    <span className="font-mono tabular-nums">{SEED_HASH_CHAIN.length}</span> events from genesis
                  </PreviewRow>
                  <PreviewRow label="Estimated size">
                    <span className="font-mono">~{Math.round(SEED_DVEX_BUNDLE.size_bytes / 1024)} KB</span>
                  </PreviewRow>
                  <PreviewRow label="Algorithm">
                    <span className="font-mono">{SEED_DVEX_BUNDLE.signature.algo}</span>
                  </PreviewRow>
                  <PreviewRow label="Public key">
                    <span className="font-mono">
                      {SEED_DVEX_BUNDLE.signature.fingerprint.slice(0, 12)}…
                    </span>
                  </PreviewRow>
                </dl>
                {SEED_DVEX_BUNDLE.exported_at !== null && (
                  <p className="mt-2 text-[10px] text-slate-400">
                    Previous export · {formatTimeAgo(SEED_DVEX_BUNDLE.exported_at)} ·{' '}
                    <span className="font-mono">{SEED_DVEX_BUNDLE.filename}</span>
                  </p>
                )}
              </div>
            </div>
            <footer className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
              <Link
                href="/audit"
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={startExport}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
              >
                <Send className="h-3.5 w-3.5" />
                Generate signed bundle
              </button>
            </footer>
          </div>

          {/* Side-info: how auditors verify */}
          <div className="dv-anim-fade-up mt-4 grid gap-3 sm:grid-cols-3" style={{ animationDelay: '160ms' }}>
            <Tile icon={CheckCircle2} title="What's inside" body="The full hash chain, every event's payload, the public-key fingerprint, and the chain tip." />
            <Tile icon={ShieldCheck} title="Why signed" body="Auditors verify offline with dvex-replay. No DataVerse account, no live API." />
            <Tile icon={Download} title="What you share" body="Three small files: bundle JSON, the .pem public key, and a one-line verify command." />
          </div>

          {/* Replay tool deep link */}
          <Link
            href="/audit/replay-tool"
            className="dv-anim-fade-up mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-primary hover:shadow-md"
            style={{ animationDelay: '220ms' }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-50 text-primary">
                <FileCode className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Verify a bundle offline →
                </p>
                <p className="text-[11px] text-slate-500">
                  Stripe-style docs for the <code className="font-mono">dvex-replay</code> CLI
                </p>
              </div>
            </div>
            <Sparkles className="h-4 w-4 text-primary" />
          </Link>

          <Link
            href="/audit"
            className="mt-6 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-primary"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to audit log
          </Link>
        </section>
      </div>

      <DVEXExportModal open={modalOpen} trigger={trigger} onClose={() => setModalOpen(false)} />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      {children}
    </div>
  )
}

function PreviewRow({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-900">{children}</dd>
    </>
  )
}

function Tile({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof CheckCircle2
  title: string
  body: string
}): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-50 text-primary">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <p className="mt-2 text-xs font-bold text-slate-900">{title}</p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{body}</p>
    </div>
  )
}
