'use client'

/**
 * SyncStatusCard — right-column sync widget on the PLM-push screen.
 *
 * Shows the live connection to the customer's PLM (Windchill in this demo),
 * last-pulled / last-pushed timestamps, and a "Test connection" button that
 * runs a ~700ms ping animation ending in a green check.
 */

import { useState } from 'react'
import { Check, Loader2, RefreshCw, ServerCog, Send, Wifi, WifiOff } from 'lucide-react'
import { formatTimeAgo, type MockPlmConnection } from '@/lib/mockWorkspace'

interface Props {
  connection: MockPlmConnection
  /** Optional last-pushed override after a successful push. */
  lastPushedAt?: string | null
  /** Optional ECN id assigned on the most recent push. */
  lastEcnId?: string | null
  onPing?: () => void
}

type PingState = 'idle' | 'pinging' | 'ok'

export default function SyncStatusCard({
  connection,
  lastPushedAt,
  lastEcnId,
  onPing,
}: Props): JSX.Element {
  const [ping, setPing] = useState<PingState>('idle')

  function testConnection(): void {
    if (ping === 'pinging') return
    setPing('pinging')
    window.setTimeout(() => {
      setPing('ok')
      onPing?.()
      window.setTimeout(() => setPing('idle'), 1800)
    }, 900)
  }

  const StatusIcon = connection.status === 'connected' ? Wifi : WifiOff
  const statusColor =
    connection.status === 'connected'
      ? 'text-emerald-600'
      : connection.status === 'syncing'
      ? 'text-amber-600'
      : 'text-rose-600'

  const effectiveLastPushed = lastPushedAt ?? connection.last_pushed_at

  return (
    <aside className="space-y-3">
      {/* Connection card */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
          <ServerCog className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            PLM connection
          </span>
        </header>
        <div className="space-y-3 p-4">
          <div className="flex items-center gap-2.5">
            <span
              className={`relative inline-flex h-2 w-2 shrink-0 rounded-full ${
                connection.status === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            >
              {connection.status === 'connected' && (
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-70" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900">{connection.vendor}</p>
              <p className="truncate font-mono text-[10px] text-slate-500">{connection.host}</p>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                connection.status === 'connected'
                  ? 'text-emerald-700 ring-1 ring-emerald-200'
                  : 'text-rose-700 ring-1 ring-rose-200'
              }`}
            >
              <StatusIcon className={`h-2.5 w-2.5 ${statusColor}`} />
              {connection.status}
            </span>
          </div>

          <dl className="space-y-1.5 border-t border-slate-100 pt-3 text-[11px]">
            <Row icon={RefreshCw} label="Last pulled">
              {connection.last_pulled_at !== null ? (
                <>{formatTimeAgo(connection.last_pulled_at)}</>
              ) : (
                <span className="text-slate-400">never</span>
              )}
            </Row>
            <Row icon={Send} label="Last pushed">
              {effectiveLastPushed !== null ? (
                <>
                  {formatTimeAgo(effectiveLastPushed)}
                  {lastEcnId !== undefined && lastEcnId !== null && (
                    <span className="ml-1 font-mono text-emerald-700">· {lastEcnId}</span>
                  )}
                </>
              ) : (
                <span className="text-slate-400">never (this part)</span>
              )}
            </Row>
            <Row icon={ServerCog} label="PLM version">
              <span className="font-mono">{connection.vendor} {connection.version}</span>
            </Row>
          </dl>

          <button
            type="button"
            onClick={testConnection}
            disabled={ping !== 'idle'}
            className={`flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold shadow-sm transition disabled:cursor-not-allowed ${
              ping === 'ok'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : ping === 'pinging'
                ? 'border-slate-200 bg-slate-50 text-slate-500'
                : 'border-slate-200 bg-white text-slate-700 hover:border-primary hover:bg-primary-50 hover:text-primary'
            }`}
          >
            {ping === 'pinging' && <Loader2 className="h-3 w-3 animate-spin" />}
            {ping === 'ok' && <Check className="h-3 w-3" />}
            {ping === 'idle' && <RefreshCw className="h-3 w-3" />}
            {ping === 'pinging' ? 'Pinging…' : ping === 'ok' ? 'Connection healthy' : 'Test connection'}
          </button>
        </div>
      </div>

      {/* "What gets pushed" mini-explainer */}
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-primary-50 via-white to-brand-50/30 p-4 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary-700">
          What lands in {connection.vendor}
        </p>
        <ul className="mt-2 space-y-1.5 text-[11px] text-slate-700">
          <li className="flex items-start gap-1.5">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
            One Engineering Change Notice, classified automatically
          </li>
          <li className="flex items-start gap-1.5">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
            Signed audit bundle (DVEX v1.0) attached as evidence
          </li>
          <li className="flex items-start gap-1.5">
            <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
            ECN PDF generated from rationales + signoffs
          </li>
        </ul>
      </div>
    </aside>
  )
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Wifi
  label: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="inline-flex items-center gap-1.5 text-slate-500">
        <Icon className="h-3 w-3 text-slate-400" />
        {label}
      </dt>
      <dd className="text-right font-medium text-slate-900">{children}</dd>
    </div>
  )
}
