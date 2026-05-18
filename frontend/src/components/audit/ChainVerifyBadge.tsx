'use client'

/**
 * ChainVerifyBadge — large "Chain integrity verified" status banner with a
 * "Verify chain now" button. Clicking the button hands off to the parent's
 * verifier (which runs the per-event re-validation animation); this
 * component just owns the visual state.
 */

import { Loader2, RefreshCw, ShieldCheck } from 'lucide-react'

export type VerifyState = 'idle' | 'verifying' | 'verified'

interface Props {
  state: VerifyState
  eventsCount: number
  genesisAt: string
  /** 0..1 — how far through the chain we are during 'verifying'. */
  progress?: number
  onVerifyNow: () => void
}

export default function ChainVerifyBadge({
  state,
  eventsCount,
  genesisAt,
  progress = 0,
  onVerifyNow,
}: Props): JSX.Element {
  const ribbon =
    state === 'verifying'
      ? 'bg-gradient-to-r from-amber-50 via-amber-50 to-white border-amber-500'
      : 'bg-gradient-to-r from-emerald-50 via-emerald-50 to-white border-emerald-500'

  const Icon = state === 'verifying' ? Loader2 : ShieldCheck
  const iconColor = state === 'verifying' ? 'text-amber-600' : 'text-emerald-600'

  return (
    <div className={`relative overflow-hidden rounded-xl border-l-4 ${ribbon} px-5 py-4 shadow-sm`}>
      <div className="flex items-start gap-4">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${
            state === 'verifying' ? 'bg-amber-100' : 'bg-emerald-100'
          }`}
        >
          <Icon className={`h-6 w-6 ${iconColor} ${state === 'verifying' ? 'animate-spin' : ''}`} />
        </div>
        <div className="min-w-0 flex-1">
          <h2
            className={`text-base font-bold tracking-tight ${
              state === 'verifying' ? 'text-amber-900' : 'text-emerald-900'
            }`}
          >
            {state === 'verifying'
              ? `Verifying chain · re-hashing event by event…`
              : `✓ Chain integrity verified`}
          </h2>
          <p
            className={`mt-0.5 text-xs ${
              state === 'verifying' ? 'text-amber-800/85' : 'text-emerald-800/85'
            }`}
          >
            {eventsCount.toLocaleString()} events · append-only · genesis{' '}
            <span className="font-mono">{new Date(genesisAt).toISOString().slice(0, 10)}</span>
          </p>
          {state === 'verifying' && (
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-amber-100">
              <div
                className="h-full bg-amber-500 transition-all duration-100 ease-linear"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onVerifyNow}
          disabled={state === 'verifying'}
          className={`hidden shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 sm:inline-flex ${
            state === 'verified'
              ? 'border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50'
              : 'border-amber-300 bg-white text-amber-800'
          }`}
        >
          <RefreshCw className={`h-3 w-3 ${state === 'verifying' ? 'animate-spin' : ''}`} />
          {state === 'verifying' ? 'Verifying…' : 'Verify chain now'}
        </button>
      </div>
    </div>
  )
}
