'use client'

/**
 * PushToPLMModal — overlays the page while the push runs, then flips to a
 * success card. "Live" mock — runs a 3-phase animation then assigns an ECN
 * id and reveals the View/Download buttons.
 */

import { useEffect, useState } from 'react'
import {
  Check,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  ShieldCheck,
  X,
} from 'lucide-react'

type Phase = 'idle' | 'p1' | 'p2' | 'p3' | 'success'

const PHASES: Array<{ id: Phase; label: string; durationMs: number }> = [
  { id: 'p1', label: 'Locking decisions in DataVerse…', durationMs: 700 },
  { id: 'p2', label: 'Generating PDF · attaching signed audit bundle…', durationMs: 900 },
  { id: 'p3', label: 'Posting to Windchill 12.1 → workflow #4711…', durationMs: 1100 },
]

interface Props {
  open: boolean
  /** Triggers the push sequence; null while idle. */
  trigger: number
  vendor: string
  vendorHost: string
  onComplete: (ecnId: string) => void
  onClose: () => void
  /** Optional pre-assigned ECN id (otherwise we synthesise one). */
  ecnId: string | null
}

export default function PushToPLMModal({
  open,
  trigger,
  vendor,
  vendorHost,
  onComplete,
  onClose,
  ecnId,
}: Props): JSX.Element | null {
  const [phase, setPhase] = useState<Phase>('idle')

  // Each time the trigger value changes, kick off the animation.
  useEffect(() => {
    if (trigger === 0) return
    setPhase('p1')
    let elapsed = 0
    const timers: number[] = []
    for (const p of PHASES) {
      const t = window.setTimeout(() => setPhase(p.id), elapsed)
      timers.push(t)
      elapsed += p.durationMs
    }
    const final = window.setTimeout(() => {
      const newId = ecnId ?? `ECN-2026-${String(Math.floor(Math.random() * 900 + 100))}`
      setPhase('success')
      onComplete(newId)
    }, elapsed)
    timers.push(final)
    return () => timers.forEach((t) => window.clearTimeout(t))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])

  // ESC closes the success modal (not the in-flight one).
  useEffect(() => {
    if (!open || phase !== 'success') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, phase, onClose])

  if (!open) return null
  const isPushing = phase !== 'idle' && phase !== 'success'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Push to PLM"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm dv-anim-fade-in"
    >
      <div className="dv-anim-pop w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        {phase === 'success' && ecnId !== null ? (
          <SuccessBody ecnId={ecnId} vendor={vendor} onClose={onClose} />
        ) : (
          <PushingBody phase={phase} vendor={vendor} vendorHost={vendorHost} />
        )}
        {!isPushing && (
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

function PushingBody({ phase, vendor, vendorHost }: { phase: Phase; vendor: string; vendorHost: string }): JSX.Element {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <div>
          <h2 className="text-sm font-bold tracking-tight text-slate-900">Pushing to {vendor}</h2>
          <p className="font-mono text-[10px] text-slate-500">{vendorHost}</p>
        </div>
      </div>
      <ul className="mt-5 space-y-2">
        {PHASES.map((p) => {
          const phaseOrder: Phase[] = ['idle', 'p1', 'p2', 'p3', 'success']
          const reached = phaseOrder.indexOf(phase) >= phaseOrder.indexOf(p.id)
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
        Do not close — the ECN id is assigned server-side.
      </p>
    </div>
  )
}

function SuccessBody({ ecnId, vendor, onClose }: { ecnId: string; vendor: string; onClose: () => void }): JSX.Element {
  function fakeDownload(filename: string, kind: 'pdf' | 'json'): void {
    const content =
      kind === 'pdf'
        ? `(mock) ${ecnId} — Engineering Change Notice\nGenerated by DataVerse.Collab\n`
        : JSON.stringify(
            {
              schema: 'dvex-v1.0',
              ecn_id: ecnId,
              generated_at: new Date().toISOString(),
              signature: 'Ed25519 · 7f3a:b2e1:c8d5:…',
            },
            null,
            2,
          )
    const blob = new Blob([content], { type: kind === 'pdf' ? 'application/pdf' : 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <CheckCircle2 className="h-7 w-7" />
      </div>
      <h2 className="mt-4 text-base font-bold tracking-tight text-slate-900">Pushed successfully</h2>
      <p className="mt-1 text-sm text-slate-600">
        Your ECN is now in {vendor} and queued for approval workflow #4711.
      </p>

      <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-left">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800/80">
            ECN id
          </p>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800">
            <ShieldCheck className="h-3 w-3" />
            Bundle signature applied
          </span>
        </div>
        <code className="mt-1.5 block font-mono text-base font-bold text-emerald-900">{ecnId}</code>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => fakeDownload(`${ecnId}.pdf`, 'pdf')}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <FileText className="h-3 w-3" />
          Download ECN PDF
        </button>
        <button
          type="button"
          onClick={() => fakeDownload(`${ecnId}-audit-bundle.dvex.json`, 'json')}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <ShieldCheck className="h-3 w-3" />
          Audit bundle (signed)
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Close
        </button>
        <a
          href={`/external/windchill/ecn/${ecnId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-700"
        >
          View in {vendor}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  )
}
