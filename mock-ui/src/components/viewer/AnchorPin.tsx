'use client'

import type { DecisionState } from '@/lib/mock-data'

interface Props {
  /** 1-based number displayed in the pin. */
  number: number
  state: DecisionState
  /** Tooltip text on hover (decision title). */
  label: string
  active: boolean
  onClick: () => void
  /** Position in % relative to its container (use absolute positioning). */
  xPct: number
  yPct: number
}

const PIN_STYLE: Record<DecisionState, { ring: string; bg: string; text: string }> = {
  PROPOSED: { ring: 'ring-state-proposed/30', bg: 'bg-state-proposed', text: 'text-white' },
  ACCEPTED: { ring: 'ring-state-accepted/30', bg: 'bg-state-accepted', text: 'text-white' },
  REJECTED: { ring: 'ring-state-rejected/30', bg: 'bg-state-rejected', text: 'text-white' },
  SUPERSEDED: { ring: 'ring-state-superseded/30', bg: 'bg-state-superseded', text: 'text-white' },
}

export default function AnchorPin({ number, state, label, active, onClick, xPct, yPct }: Props) {
  const s = PIN_STYLE[state]
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Pin ${number} — ${label}`}
      style={{ left: `${xPct}%`, top: `${yPct}%` }}
      className="group absolute -translate-x-1/2 -translate-y-1/2 focus-ring rounded-full"
    >
      {/* Leader line up to label badge */}
      <span
        aria-hidden="true"
        className={`absolute left-1/2 top-1/2 h-px w-12 -translate-y-1/2 origin-left bg-gradient-to-r ${
          active ? 'opacity-100' : 'opacity-40 group-hover:opacity-80'
        }`}
        style={{
          background: `linear-gradient(to right, ${stateHex(state)}, transparent)`,
          transform: `translateY(-50%) rotate(-30deg)`,
        }}
      />
      {/* Pin dot */}
      <span
        className={`relative flex h-7 w-7 items-center justify-center rounded-full ring-4 transition-all ${
          s.bg
        } ${s.ring} ${
          active ? 'scale-110 shadow-lg ring-8' : 'shadow-md group-hover:scale-110'
        }`}
        style={
          state === 'PROPOSED' && !active
            ? { animation: 'pin-bounce 2s ease-in-out infinite' }
            : undefined
        }
      >
        <span className={`text-[11px] font-bold tabular-nums ${s.text}`}>{number}</span>
        {state === 'PROPOSED' && (
          <span className={`absolute -inset-1 rounded-full ${s.bg} opacity-20 animate-ping`} aria-hidden="true" />
        )}
      </span>
      {/* Tooltip */}
      <span
        className={`pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded border border-p-rule bg-p-surface px-2 py-1 text-[10px] font-medium text-p-text shadow-pop transition-opacity ${
          active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        {label}
      </span>
    </button>
  )
}

function stateHex(s: DecisionState): string {
  return s === 'PROPOSED'
    ? '#d99543'
    : s === 'ACCEPTED'
    ? '#5ec087'
    : s === 'REJECTED'
    ? '#d56363'
    : '#a8b0bb'
}
