'use client'

/**
 * DatumRegressionPanel — Hook 4 surface on /parts/[id]/what-changed.
 *
 * After the cross-rev resolver runs, Datum scans the new revision and
 * surfaces decisions it thinks are likely regressed. Each card shows the
 * likelihood, Datum's reasoning, the suggested action chip, and a fallback
 * note when Datum isn't available.
 *
 * The contract matches the Datum AI spec §6 · Hook 4 — Phase 2 will swap the
 * mocked endpoint for a real Ollama call without any UI changes.
 */

import { AlertTriangle, Eye, Loader2, ShieldAlert, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { ApiError, api } from '@/lib/api'
import type {
  FlagRegressionsResponse,
  FlaggedRegression,
  FlaggedSuggestedAction,
} from '@/types/api'

interface Props {
  partId: string
  revSnapshotId: string
}

const ACTION_META: Record<
  FlaggedSuggestedAction,
  { label: string; bg: string; fg: string; ring: string; icon: typeof AlertTriangle }
> = {
  urgent_review: {
    label: 'Urgent review',
    bg: 'bg-rose-50',
    fg: 'text-rose-700',
    ring: 'ring-rose-200',
    icon: ShieldAlert,
  },
  verify_anchor: {
    label: 'Verify anchor',
    bg: 'bg-amber-50',
    fg: 'text-amber-700',
    ring: 'ring-amber-200',
    icon: Eye,
  },
  no_action: {
    label: 'No action',
    bg: 'bg-slate-100',
    fg: 'text-slate-600',
    ring: 'ring-slate-200',
    icon: AlertTriangle,
  },
}

export default function DatumRegressionPanel({ partId, revSnapshotId }: Props): JSX.Element {
  const [result, setResult] = useState<FlagRegressionsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(): Promise<void> {
    setLoading(true)
    setError(null)
    try {
      const r = await api.datum.flagRegressions({
        rev_snapshot_id: revSnapshotId,
        part_id: partId,
      })
      setResult(r)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'timeout') {
        setError('Datum timed out — please try again.')
      } else if (err instanceof ApiError && err.code === 'network_error') {
        setError('Datum is offline — restart the backend on :4000.')
      } else {
        setError(err instanceof Error ? err.message : 'Datum is unavailable')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <section
      aria-label="Datum-flagged regressions"
      className="overflow-hidden rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/60 via-white to-violet-50/30 shadow-sm"
    >
      <header className="flex items-center gap-2 border-b border-violet-100 px-4 py-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-sm">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-bold text-violet-900">Datum · Flag regressions</h3>
          <p className="text-[10.5px] text-violet-600">
            AI scan after the cross-rev resolver completes
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Scanning…
            </>
          ) : (
            <>
              <Sparkles className="h-3 w-3" />
              {result === null ? 'Run scan' : 'Re-scan'}
            </>
          )}
        </button>
      </header>

      {error !== null && (
        <div
          role="alert"
          className="flex items-start gap-2 border-b border-rose-200 bg-rose-50/80 px-4 py-2 text-[11px] text-rose-700"
        >
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result === null && error === null && !loading && (
        <div className="px-4 py-5 text-center">
          <p className="text-[12px] leading-relaxed text-violet-900">
            Click <strong className="font-semibold">Run scan</strong> and Datum will read every
            re-anchored decision and surface the ones likely to regress on this revision.
          </p>
          <p className="mt-1 text-[10.5px] text-violet-500">
            Confidence on every flag · cite-or-decline rules apply.
          </p>
        </div>
      )}

      {result !== null && (
        <div className="px-4 py-3">
          <div className="flex items-center justify-between text-[10.5px] text-violet-600">
            <span>
              Scanned <strong className="font-bold tabular-nums text-violet-900">{result.scanned_count}</strong>{' '}
              decisions · <strong className="font-bold tabular-nums text-violet-900">{result.flagged.length}</strong>{' '}
              flagged · <span className="font-mono text-violet-500">{result.runtime_ms}ms</span>
            </span>
            <span className="font-mono text-violet-400">{result.source}</span>
          </div>
          {result.flagged.length === 0 ? (
            <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-[11px] font-semibold text-emerald-700">
              No likely regressions in this revision — nice.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {result.flagged.map((f) => (
                <FlaggedCard key={f.decision_id} flagged={f} />
              ))}
            </ul>
          )}
          <p className="mt-3 border-t border-violet-100 pt-2 text-[10px] text-violet-500">
            Datum drafted these flags —{' '}
            <span className="font-semibold text-violet-700">human always has the final word</span>.
            Confirm each via the resolver buckets below.
          </p>
        </div>
      )}
    </section>
  )
}

function FlaggedCard({ flagged }: { flagged: FlaggedRegression }): JSX.Element {
  const action = ACTION_META[flagged.suggested_action]
  const Icon = action.icon
  const pct = Math.round(flagged.likelihood * 100)
  const likelihoodTone =
    flagged.likelihood >= 0.8
      ? 'bg-rose-100 text-rose-700 ring-rose-200'
      : flagged.likelihood >= 0.6
        ? 'bg-amber-100 text-amber-700 ring-amber-200'
        : 'bg-slate-100 text-slate-600 ring-slate-200'

  return (
    <li className="dv-anim-fade-up overflow-hidden rounded-lg border border-violet-200 bg-white shadow-sm">
      <div className="flex items-start gap-2 px-3 py-2">
        <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${action.fg}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10.5px] font-bold text-slate-800">
              {flagged.decision_id}
            </span>
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold tabular-nums ring-1 ${likelihoodTone}`}
              title="Datum's confidence that this decision regressed"
            >
              {pct}% likelihood
            </span>
            <span
              className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ring-1 ${action.bg} ${action.fg} ${action.ring}`}
            >
              {action.label}
            </span>
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-slate-700">
            {flagged.reasoning}
          </p>
        </div>
      </div>
    </li>
  )
}
