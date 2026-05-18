'use client'

/**
 * HashChainEventRow — one row in the hash-chain detail page.
 *
 * Compact: seq, type pill, actor, time, prev_hash (grey) → curr_hash (accent).
 * Expanded: full payload JSON in a dark code block, both hashes in full
 * with copy buttons, and the verification-formula tooltip on the spine.
 */

import { useState } from 'react'
import { ArrowRight, Check, ChevronDown, ChevronRight, Copy } from 'lucide-react'
import Avatar from '@/components/workspace/Avatar'
import type { HashChainEvent, HashChainEventKind } from '@/lib/mockWorkspace'

interface Props {
  event: HashChainEvent
  /** If true, the green check on the spine pulses (means: just verified). */
  recentlyVerified?: boolean
}

const KIND_TONE: Record<HashChainEventKind, { bg: string; fg: string }> = {
  WORKSPACE_GENESIS: { bg: 'bg-violet-50', fg: 'text-violet-700' },
  MEMBER_JOINED: { bg: 'bg-primary-50', fg: 'text-primary-700' },
  INVITE_CREATED: { bg: 'bg-brand-50', fg: 'text-brand-700' },
  PART_UPLOADED: { bg: 'bg-violet-50', fg: 'text-violet-700' },
  REV_UPLOADED: { bg: 'bg-violet-50', fg: 'text-violet-700' },
  DECISION_PROPOSED: { bg: 'bg-amber-50', fg: 'text-amber-700' },
  DECISION_ACCEPTED: { bg: 'bg-emerald-50', fg: 'text-emerald-700' },
  DECISION_REJECTED: { bg: 'bg-rose-50', fg: 'text-rose-700' },
  DECISION_SUPERSEDED: { bg: 'bg-amber-50', fg: 'text-amber-700' },
  RESOLVER_COMPLETED: { bg: 'bg-slate-100', fg: 'text-slate-700' },
  BUNDLE_SIGNED: { bg: 'bg-emerald-50', fg: 'text-emerald-700' },
  PLM_PUSHED: { bg: 'bg-amber-50', fg: 'text-amber-700' },
}

const HASH_TOOLTIP =
  'SHA-256 of (prev_hash + seq + type + actor + payload + timestamp)'

export default function HashChainEventRow({ event, recentlyVerified }: Props): JSX.Element {
  const [open, setOpen] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const tone = KIND_TONE[event.kind] ?? { bg: 'bg-slate-100', fg: 'text-slate-700' }
  const isGenesis = event.kind === 'WORKSPACE_GENESIS'

  function copy(key: string, text: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text)
    }
    setCopiedKey(key)
    window.setTimeout(() => setCopiedKey(null), 1100)
  }

  return (
    <li className="relative pl-12">
      {/* Spine dot */}
      <span
        className={`absolute left-[12px] top-3 z-10 flex h-3 w-3 items-center justify-center rounded-full ring-4 ring-white ${
          recentlyVerified === true ? 'bg-emerald-500' : 'bg-slate-300'
        }`}
        aria-hidden="true"
      >
        {recentlyVerified === true && (
          <span className="absolute inset-0 -m-1 animate-ping rounded-full bg-emerald-400 opacity-70" />
        )}
        {recentlyVerified === true && <Check className="relative h-2 w-2 text-white" strokeWidth={4} />}
      </span>

      <article
        className={`overflow-hidden rounded-lg border bg-white shadow-sm transition ${
          open ? 'border-primary/40 ring-2 ring-primary/15' : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        {/* Compact row */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50/40"
        >
          <span className="w-12 shrink-0 font-mono text-[11px] font-bold tabular-nums text-slate-400">
            #{event.seq}
          </span>
          <span className={`shrink-0 rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${tone.bg} ${tone.fg}`}>
            {event.kind}
          </span>
          <div className="flex min-w-0 items-center gap-2">
            <Avatar name={event.actor} size="sm" />
            <span className="truncate text-xs font-medium text-slate-700">{event.actor}</span>
          </div>
          <span className="ml-auto whitespace-nowrap font-mono text-[10px] text-slate-400">
            {new Date(event.created_at).toISOString().slice(0, 16).replace('T', ' ')}
          </span>
          {/* prev → curr visual */}
          <span
            className="hidden items-center gap-1.5 font-mono text-[10px] text-slate-500 md:inline-flex"
            title={HASH_TOOLTIP}
          >
            <span className="text-slate-400">
              {isGenesis ? '∅' : `${event.prev_hash.slice(0, 6)}…${event.prev_hash.slice(-4)}`}
            </span>
            <ArrowRight className="h-3 w-3 text-slate-300" />
            <span className="font-semibold text-primary">
              {event.curr_hash.slice(0, 6)}…{event.curr_hash.slice(-4)}
            </span>
          </span>
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          )}
        </button>

        {/* Expanded payload */}
        {open && (
          <div
            className="dv-anim-fade-in border-t border-slate-100 bg-slate-50/60 px-4 py-3"
            onClick={(e) => e.stopPropagation()}
          >
            <HashBlock
              label="prev_hash"
              value={isGenesis ? '0…0 (genesis)' : event.prev_hash}
              displayValue={isGenesis ? '0000…0000 (workspace genesis)' : event.prev_hash}
              tone="slate"
              copied={copiedKey === 'prev'}
              onCopy={() => copy('prev', event.prev_hash)}
              tooltip={HASH_TOOLTIP}
            />
            <HashBlock
              label="curr_hash"
              value={event.curr_hash}
              displayValue={event.curr_hash}
              tone="primary"
              copied={copiedKey === 'curr'}
              onCopy={() => copy('curr', event.curr_hash)}
              tooltip={HASH_TOOLTIP}
            />

            <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              payload
            </p>
            <pre className="mt-1 overflow-x-auto rounded-lg border border-slate-800 bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
{JSON.stringify(
  {
    seq: event.seq,
    kind: event.kind,
    actor: event.actor,
    created_at: event.created_at,
    payload: event.payload,
  },
  null,
  2,
)}
            </pre>

            <p className="mt-2 text-[10px] text-slate-400">
              <strong className="font-semibold text-slate-600">Formula:</strong> {HASH_TOOLTIP.toLowerCase()}.
              Immutable · cannot be edited or deleted.
            </p>
          </div>
        )}
      </article>
    </li>
  )
}

function HashBlock({
  label,
  value,
  displayValue,
  tone,
  copied,
  onCopy,
  tooltip,
}: {
  label: string
  value: string
  displayValue: string
  tone: 'slate' | 'primary'
  copied: boolean
  onCopy: () => void
  tooltip: string
}): JSX.Element {
  return (
    <div className="mt-2 first:mt-0">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-200/60"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div
        title={tooltip}
        className={`mt-1 break-all rounded-md border bg-white px-2.5 py-1.5 font-mono text-[11px] leading-snug ${
          tone === 'primary'
            ? 'border-primary/30 text-primary-700'
            : 'border-slate-200 text-slate-500'
        }`}
      >
        {displayValue}
      </div>
    </div>
  )
}
