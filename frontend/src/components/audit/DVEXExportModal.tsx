'use client'

/**
 * DVEXExportModal — overlay shown while a signed audit bundle is being
 * generated. Mirrors the PushToPLMModal shape (3 phases → result card).
 *
 * Result card has three actions: download bundle (real Blob), download
 * the public key (.pem), copy the offline verification command.
 */

import { useEffect, useState } from 'react'
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  Key,
  Loader2,
  ShieldCheck,
  X,
} from 'lucide-react'
import { SEED_DVEX_BUNDLE, SEED_HASH_CHAIN, type MockDvexBundle } from '@/lib/mockWorkspace'

type Phase = 'idle' | 'p1' | 'p2' | 'p3' | 'success'

const PHASES: Array<{ id: Phase; label: string; durationMs: number }> = [
  { id: 'p1', label: 'Computing hash chain…', durationMs: 700 },
  { id: 'p2', label: 'Signing with Ed25519…', durationMs: 800 },
  { id: 'p3', label: 'Generating bundle JSON…', durationMs: 900 },
]

interface Props {
  open: boolean
  /** Increments to kick off a fresh generation. */
  trigger: number
  onClose: () => void
}

export default function DVEXExportModal({ open, trigger, onClose }: Props): JSX.Element | null {
  const [phase, setPhase] = useState<Phase>('idle')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (trigger === 0) return
    setPhase('p1')
    let elapsed = 0
    const timers: number[] = []
    for (const p of PHASES) {
      timers.push(window.setTimeout(() => setPhase(p.id), elapsed))
      elapsed += p.durationMs
    }
    timers.push(window.setTimeout(() => setPhase('success'), elapsed))
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [trigger])

  useEffect(() => {
    if (!open || phase !== 'success') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, phase, onClose])

  if (!open) return null

  const bundle = SEED_DVEX_BUNDLE
  const isWorking = phase !== 'idle' && phase !== 'success'

  function downloadBundle(): void {
    const content = buildBundle(bundle)
    const blob = new Blob([JSON.stringify(content, null, 2)], {
      type: 'application/json',
    })
    triggerDownload(blob, bundle.filename)
  }

  function downloadPubKey(): void {
    const pem =
      `-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA${bundle.signature.fingerprint.replace(/:/g, '')}\n-----END PUBLIC KEY-----\n`
    const blob = new Blob([pem], { type: 'application/x-pem-file' })
    triggerDownload(blob, bundle.signature.pubkey_pem_filename)
  }

  function copyVerifyCommand(): void {
    const cmd = `dvex-replay verify ${bundle.filename} ${bundle.signature.pubkey_pem_filename}`
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(cmd)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Export DVEX bundle"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm dv-anim-fade-in"
    >
      <div className="dv-anim-pop relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        {phase === 'success' ? (
          <ResultCard
            bundle={bundle}
            onDownloadBundle={downloadBundle}
            onDownloadPubKey={downloadPubKey}
            onCopyVerify={copyVerifyCommand}
            copied={copied}
          />
        ) : (
          <WorkingCard phase={phase} />
        )}
        {!isWorking && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

function WorkingCard({ phase }: { phase: Phase }): JSX.Element {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <div>
          <h2 className="text-sm font-bold tracking-tight text-slate-900">Exporting signed bundle</h2>
          <p className="text-[11px] text-slate-500">DVEX v1.0 · Ed25519 signature</p>
        </div>
      </div>
      <ul className="mt-5 space-y-2">
        {PHASES.map((p) => {
          const order: Phase[] = ['idle', 'p1', 'p2', 'p3', 'success']
          const reached = order.indexOf(phase) >= order.indexOf(p.id)
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
    </div>
  )
}

function ResultCard({
  bundle,
  onDownloadBundle,
  onDownloadPubKey,
  onCopyVerify,
  copied,
}: {
  bundle: MockDvexBundle
  onDownloadBundle: () => void
  onDownloadPubKey: () => void
  onCopyVerify: () => void
  copied: boolean
}): JSX.Element {
  return (
    <div className="p-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <CheckCircle2 className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-base font-bold tracking-tight text-slate-900">Bundle ready</h2>
      <p className="mt-1 text-sm text-slate-600">
        {bundle.events_count.toLocaleString()} events · genesis → tip · signed offline-verifiable.
      </p>

      <div className="mt-5 space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800/80">
            Bundle
          </span>
          <code className="font-mono text-[11px] font-bold text-emerald-900">{bundle.filename}</code>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800/80">
            Size
          </span>
          <span className="font-mono text-[11px] text-emerald-900">{formatSize(bundle.size_bytes)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-800/80">
            <ShieldCheck className="h-3 w-3" />
            Signature
          </span>
          <span className="font-mono text-[10px] text-emerald-900">
            {bundle.signature.algo} · {bundle.signature.fingerprint.slice(0, 14)}…
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={onDownloadBundle}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-700"
        >
          <Download className="h-3 w-3" />
          Download bundle ({formatSize(bundle.size_bytes)})
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onDownloadPubKey}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Key className="h-3 w-3" />
            Download .pem
          </button>
          <button
            type="button"
            onClick={onCopyVerify}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied!' : 'Copy verify cmd'}
          </button>
        </div>
      </div>

      <p className="mt-4 text-[10px] text-slate-400">
        Auditors verify offline via{' '}
        <code className="rounded bg-slate-100 px-1 font-mono text-slate-700">dvex-replay</code> — no
        DataVerse account needed.
      </p>
    </div>
  )
}

// ── helpers ─────────────────────────────────────────────────────────────────

function buildBundle(bundle: MockDvexBundle): Record<string, unknown> {
  return {
    schema: bundle.schema,
    workspace: {
      slug: bundle.workspace_slug,
      name: bundle.workspace_name,
    },
    exported_at: bundle.exported_at,
    events_count: bundle.events_count,
    genesis_hash: bundle.genesis_hash,
    tip_hash: bundle.tip_hash,
    signature: bundle.signature,
    events: SEED_HASH_CHAIN.map((e) => ({
      seq: e.seq,
      kind: e.kind,
      actor: e.actor,
      created_at: e.created_at,
      prev_hash: e.prev_hash,
      curr_hash: e.curr_hash,
      payload: e.payload,
    })),
  }
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1_000_000) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1_048_576).toFixed(2)} MB`
}

