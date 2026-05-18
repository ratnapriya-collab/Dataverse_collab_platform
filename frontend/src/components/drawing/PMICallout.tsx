'use client'

/**
 * PMICallout — single pin on the 2D drawing surface marking a PMI symbol.
 *
 * Hovering raises a small popover with the GD&T glyph + value; clicking
 * selects it (drives the right-panel detail view).
 */

import type { MockPMICallout } from '@/lib/mockWorkspace'

interface Props {
  callout: MockPMICallout
  index: number
  selected: boolean
  hovered: boolean
  onSelect: () => void
  onHover: (state: boolean) => void
}

export default function PMICallout({ callout, index, selected, hovered, onSelect, onHover }: Props): JSX.Element {
  const tone = callout.linked_decision_id !== undefined ? 'primary' : 'neutral'
  const ring = tone === 'primary' ? 'ring-primary/30' : 'ring-slate-300/40'
  const dot = tone === 'primary' ? 'bg-primary' : 'bg-slate-700'

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      aria-label={`PMI ${index + 1} — ${callout.note}`}
      style={{ left: `${callout.xPct}%`, top: `${callout.yPct}%` }}
      className="group absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none"
    >
      <span
        className={`relative flex h-7 w-7 items-center justify-center rounded-full text-white shadow-md transition-all ring-4 ${dot} ${ring} ${
          selected ? 'scale-110' : hovered ? 'scale-105' : ''
        }`}
      >
        <span className="text-[10px] font-bold tabular-nums">{index + 1}</span>
        {callout.linked_decision_id !== undefined && !selected && (
          <span className="absolute -inset-1 animate-ping rounded-full bg-primary opacity-25" aria-hidden="true" />
        )}
      </span>
      {/* Hover popover */}
      <span
        className={`pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[10px] font-semibold text-slate-700 shadow-pop transition-opacity ${
          hovered || selected ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {callout.label}
        {callout.datum !== undefined && (
          <span className="ml-1 text-slate-400">· datum {callout.datum}</span>
        )}
      </span>
    </button>
  )
}
