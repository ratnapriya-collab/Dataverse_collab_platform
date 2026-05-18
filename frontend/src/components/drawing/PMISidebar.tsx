'use client'

/**
 * PMISidebar — right-rail list of PMI symbols visible on the drawing.
 *
 * Each row pairs a GD&T glyph + numeric value with a plain-English note.
 * Clicking a row selects the matching callout pin on the canvas; rows
 * that link to a real decision get a "↗ Decision" badge.
 */

import Link from 'next/link'
import { ArrowUpRight, Sparkles } from 'lucide-react'
import type { MockPMICallout, PMISymbol } from '@/lib/mockWorkspace'

interface Props {
  callouts: MockPMICallout[]
  selectedId: string | null
  hoveredId: string | null
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
  partId: string
}

const SYMBOL_GLYPH: Record<PMISymbol, string> = {
  diameter: '⌀',
  flatness: '▱',
  concentricity: '◎',
  position: '⊕',
  parallelism: '∥',
  perpendicularity: '⊥',
  surface: '◇',
}

const SYMBOL_LABEL: Record<PMISymbol, string> = {
  diameter: 'Diameter',
  flatness: 'Flatness',
  concentricity: 'Concentricity',
  position: 'True position',
  parallelism: 'Parallelism',
  perpendicularity: 'Perpendicularity',
  surface: 'Surface finish',
}

export default function PMISidebar({
  callouts,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  partId,
}: Props): JSX.Element {
  return (
    <aside className="flex h-full flex-col overflow-hidden border-l border-slate-200 bg-white">
      <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            PMI annotations
          </p>
          <p className="text-sm font-bold text-slate-900">
            {callouts.length} callout{callouts.length === 1 ? '' : 's'} on this sheet
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200">
          {callouts.filter((c) => c.linked_decision_id !== undefined).length} linked
        </span>
      </header>

      <ul className="dv-thin-scroll flex-1 divide-y divide-slate-100 overflow-y-auto">
        {callouts.map((c, i) => {
          const isActive = selectedId === c.id
          const isHovered = hoveredId === c.id
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                onMouseEnter={() => onHover(c.id)}
                onMouseLeave={() => onHover(null)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${
                  isActive ? 'bg-primary-50' : isHovered ? 'bg-slate-50' : 'hover:bg-slate-50/60'
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-base font-bold ${
                    c.linked_decision_id !== undefined
                      ? 'bg-primary text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-base font-bold text-slate-900">
                      {SYMBOL_GLYPH[c.symbol]}
                    </span>
                    <span className="font-mono text-[12px] font-semibold text-slate-900">
                      {c.label.replace(/^[⌀▱◎⊕∥⊥◇]\s*/u, '')}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {SYMBOL_LABEL[c.symbol]}
                    {c.datum !== undefined && (
                      <span className="ml-1 text-slate-400">· datum {c.datum}</span>
                    )}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{c.note}</p>
                  {c.linked_decision_id !== undefined && (
                    <Link
                      href={`/parts/${partId}?focus=${c.linked_decision_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 inline-flex items-center gap-1 rounded-md border border-primary-100 bg-primary-50 px-1.5 py-0.5 text-[10px] font-semibold text-primary-700 transition hover:bg-primary-100"
                    >
                      <Sparkles className="h-2.5 w-2.5" />
                      {c.linked_decision_id}
                      <ArrowUpRight className="h-2.5 w-2.5" />
                    </Link>
                  )}
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      <footer className="border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 text-[10px] text-slate-500">
        Click a row to highlight on the drawing · click the pin to open it
      </footer>
    </aside>
  )
}
