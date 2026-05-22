'use client'

/**
 * VerifyAnchorModal — side-by-side Rev A vs Rev B comparison for a Layer-2
 * (fingerprint) match the resolver isn't 100% sure about.
 *
 * Shows two mini "viewer thumbnails" with the anchor centroid marked, the
 * confidence band, decision title + ID, and Accept/Reject actions.
 *
 * Mock-only: rendered SVG anchors with slightly perturbed positions to
 * communicate "the resolver thinks these are the same face" without
 * needing a real 3D library.
 */

import { useEffect } from 'react'
import { ArrowRight, Check, GitCommit, Hash, X } from 'lucide-react'
import ConfidencePill from './ConfidencePill'
import type { MockResolverBucket } from '@/lib/mockWorkspace'

interface Props {
  open: boolean
  bucket: MockResolverBucket | null
  fromRev: string
  toRev: string
  onAccept: (decisionId: string) => void
  onReject: (decisionId: string) => void
  onClose: () => void
}

export default function VerifyAnchorModal({
  open,
  bucket,
  fromRev,
  toRev,
  onAccept,
  onReject,
  onClose,
}: Props): JSX.Element | null {
  // Keyboard shortcuts: ESC close · A accept · R reject (matches the footer hint).
  // Body-scroll lock applied while open.
  useEffect(() => {
    if (!open || bucket === null) return
    const onKey = (e: KeyboardEvent) => {
      // Ignore if any input/textarea is focused so the user can still type freely.
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable === true) return
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        onAccept(bucket.decision_id)
        return
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        onReject(bucket.decision_id)
      }
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, bucket, onAccept, onReject, onClose])

  if (!open || bucket === null) return null

  // Anchor jitter — same hash → same offset, so the demo feels stable.
  const seed = hashStr(bucket.id)
  const drift = {
    x: ((seed >> 1) % 12) - 6,
    y: ((seed >> 3) % 10) - 5,
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Verify anchor across revisions"
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto px-4 py-12"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="dv-anim-fade-in fixed inset-0 bg-slate-900/45 backdrop-blur-sm"
      />
      <div className="dv-anim-pop relative z-10 w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-amber-700">
              <GitCommit className="h-3 w-3" />
              Layer 2 · fingerprint match
            </div>
            <h2 className="mt-1 text-base font-bold tracking-tight text-slate-900">
              Verify anchor — {bucket.title}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              The resolver believes this anchor survived the revision but isn&rsquo;t certain.
              Compare both sides and decide.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Body: side-by-side comparison */}
        <div className="grid grid-cols-2 gap-4 px-6 py-5">
          <RevPanel revLabel={fromRev} tone="slate" decisionId={bucket.decision_id} anchorId={bucket.anchor_id} drift={{ x: 0, y: 0 }} />
          <RevPanel revLabel={toRev} tone="amber" decisionId={bucket.decision_id} anchorId={bucket.anchor_id} drift={drift} confidence={bucket.confidence} />
        </div>

        {/* Drift metric */}
        <div className="mx-6 mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
          <strong className="font-semibold">Detected drift:</strong>{' '}
          centroid moved {Math.hypot(drift.x, drift.y).toFixed(1)} mm · area changed +0.4%.
          Topology-fingerprint match remains within tolerance, but flag it if you&rsquo;re unsure.
        </div>

        {/* Footer actions */}
        <footer className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/60 px-6 py-3">
          <div className="text-[11px] text-slate-500">
            <kbd className="rounded border border-slate-200 bg-white px-1 font-mono">A</kbd> accept ·{' '}
            <kbd className="ml-0.5 rounded border border-slate-200 bg-white px-1 font-mono">R</kbd> reject ·{' '}
            <kbd className="ml-0.5 rounded border border-slate-200 bg-white px-1 font-mono">Esc</kbd> close
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onReject(bucket.decision_id)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
            >
              <X className="h-3.5 w-3.5" />
              Reject — anchor moved
            </button>
            <button
              type="button"
              onClick={() => onAccept(bucket.decision_id)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
            >
              <Check className="h-3.5 w-3.5" />
              Accept — same face
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

// ── Per-rev mini-viewer panel ────────────────────────────────────────────────

function RevPanel({
  revLabel,
  tone,
  decisionId,
  anchorId,
  drift,
  confidence,
}: {
  revLabel: string
  tone: 'slate' | 'amber'
  decisionId: string
  anchorId: string | undefined
  drift: { x: number; y: number }
  confidence?: number
}): JSX.Element {
  const headerBg =
    tone === 'amber'
      ? 'bg-amber-50 border-amber-200 text-amber-700'
      : 'bg-slate-100 border-slate-200 text-slate-600'
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <header className={`flex items-center justify-between border-b px-3 py-1.5 ${headerBg}`}>
        <span className="text-[10px] font-bold uppercase tracking-wider">{revLabel}</span>
        {confidence !== undefined && <ConfidencePill confidence={confidence} layer={2} />}
      </header>
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-950">
        {/* CAD grid */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        {/* Simplified bracket SVG */}
        <svg viewBox="0 0 200 150" className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id={`mini-${revLabel}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3d4a5c" />
              <stop offset="1" stopColor="#1f2733" />
            </linearGradient>
          </defs>
          <polygon points="40,90 160,90 175,75 55,75" fill={`url(#mini-${revLabel})`} stroke="#5b6a80" strokeWidth="0.5" />
          <polygon points="40,90 160,90 160,108 40,108" fill="#2a323f" stroke="#4a5666" strokeWidth="0.5" />
          <rect x="70" y="42" width="60" height="33" fill="#1f2733" stroke="#4a5666" strokeWidth="0.5" />
          <ellipse cx="100" cy="60" rx="11" ry="7" fill="#3d4a5c" stroke="#5b6a80" strokeWidth="0.4" />
          <ellipse cx="100" cy="60" rx="5" ry="3" fill="#0a0d11" />
        </svg>
        {/* Anchor centroid with drift */}
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${50 + drift.x * 1.4}%`,
            top: `${42 + drift.y * 1.4}%`,
          }}
        >
          <span className="relative inline-block">
            <span className={`absolute inset-0 -m-2 animate-ping rounded-full opacity-50 ${tone === 'amber' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            <span
              className={`relative flex h-5 w-5 items-center justify-center rounded-full ring-4 ${
                tone === 'amber'
                  ? 'bg-amber-500 ring-amber-100/30'
                  : 'bg-emerald-500 ring-emerald-100/30'
              }`}
            >
              <Hash className="h-2.5 w-2.5 text-white" />
            </span>
          </span>
        </div>
        {drift.x !== 0 || drift.y !== 0 ? (
          <div className="absolute bottom-2 left-2 rounded-md border border-amber-200 bg-amber-50/95 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-900 backdrop-blur-sm">
            Δ {Math.hypot(drift.x, drift.y).toFixed(1)} mm
          </div>
        ) : null}
      </div>
      <div className="space-y-1 px-3 py-2 text-[11px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-500">Decision</span>
          <span className="font-mono text-slate-900">{decisionId}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-500">Anchor</span>
          <span className="font-mono text-slate-900">{anchorId ?? '—'}</span>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="inline-flex items-center gap-1 text-slate-500">
            <ArrowRight className="h-3 w-3" /> centroid
          </span>
          <span className="font-mono text-slate-900">
            ({(50 + drift.x * 1.4).toFixed(1)}, {(42 + drift.y * 1.4).toFixed(1)})
          </span>
        </div>
      </div>
    </section>
  )
}

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}
