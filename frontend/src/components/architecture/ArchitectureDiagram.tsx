'use client'

/**
 * ArchitectureDiagram — single-file SVG layered architecture map.
 *
 * Four horizontal bands (top → bottom):
 *   Surface   M1 · M6 · M3 · M2
 *   Core      M4 · M5 · M9
 *   Cross     M7 · M8
 *   Planned   Notify Bus · Knowledge Graph (slate, dashed)
 *
 * Module cards are colored by status (live emerald, mocked amber, planned
 * slate). Curved bezier edges show key dependencies with mid-point labels.
 * Click a card → parent opens the details drawer.
 */

import { useMemo } from 'react'
import type { ArchitectureEdge, ArchitectureModule, ModuleLayer, ModuleStatus } from '@/lib/mockWorkspace'

interface Props {
  modules: ArchitectureModule[]
  edges: ArchitectureEdge[]
  selectedId: string | null
  hoveredId?: string | null
  onSelect: (id: string) => void
  onHover?: (id: string | null) => void
}

const STATUS_STYLE: Record<
  ModuleStatus,
  { fill: string; stroke: string; text: string; subtext: string; chipBg: string; chipFg: string; label: string }
> = {
  live: {
    fill: '#ecfdf5',
    stroke: '#059669',
    text: '#064e3b',
    subtext: '#047857',
    chipBg: '#d1fae5',
    chipFg: '#065f46',
    label: 'Live',
  },
  mocked: {
    fill: '#fef3c7',
    stroke: '#d97706',
    text: '#78350f',
    subtext: '#b45309',
    chipBg: '#fde68a',
    chipFg: '#78350f',
    label: 'Mocked',
  },
  planned: {
    fill: '#f1f5f9',
    stroke: '#94a3b8',
    text: '#334155',
    subtext: '#64748b',
    chipBg: '#e2e8f0',
    chipFg: '#475569',
    label: 'Planned',
  },
}

const LAYER_LABEL: Record<ModuleLayer, { name: string; y: number }> = {
  surface: { name: 'USER SURFACE', y: 50 },
  core: { name: 'CORE LOGIC', y: 235 },
  cross: { name: 'CROSS-CUTTING', y: 425 },
  planned: { name: 'PLANNED', y: 585 },
}

export default function ArchitectureDiagram({
  modules,
  edges,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
}: Props): JSX.Element {
  const byId = useMemo(() => new Map(modules.map((m) => [m.id, m])), [modules])

  const neighbourIds = useMemo(() => {
    if (selectedId === null) return null
    const set = new Set<string>([selectedId])
    for (const e of edges) {
      if (e.from === selectedId) set.add(e.to)
      if (e.to === selectedId) set.add(e.from)
    }
    return set
  }, [edges, selectedId])

  function isDim(id: string): boolean {
    return neighbourIds !== null && !neighbourIds.has(id)
  }

  return (
    <svg viewBox="0 0 1100 700" className="h-full w-full" role="img" aria-label="DataVerse Collab architecture">
      <defs>
        {/* Arrow heads — one per status tone for edge ends */}
        <marker id="arch-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <polygon points="0 0, 10 5, 0 10" fill="#64748b" />
        </marker>

        {/* Card shadow */}
        <filter id="arch-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
          <feOffset dx="0" dy="2" result="off" />
          <feComponentTransfer><feFuncA type="linear" slope="0.18" /></feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Layer band backgrounds */}
      {(Object.entries(LAYER_LABEL) as Array<[ModuleLayer, (typeof LAYER_LABEL)[ModuleLayer]]>).map(([layer, info]) => (
        <g key={layer}>
          <rect x="20" y={info.y - 10} width="1060" height="110" rx="12" fill="rgba(15,23,42,0.025)" />
          <text x="36" y={info.y + 6} style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em' }} fill="#64748b">
            {info.name}
          </text>
        </g>
      ))}

      {/* Edges first so cards draw on top */}
      {edges.map((e) => {
        const from = byId.get(e.from)
        const to = byId.get(e.to)
        if (from === undefined || to === undefined) return null
        const dim = neighbourIds !== null && !(neighbourIds.has(e.from) && neighbourIds.has(e.to))

        // Cubic bezier — vertical pull
        const midY = (from.y + to.y) / 2
        const path = `M ${from.x + 90} ${from.y + 45} C ${from.x + 90} ${midY}, ${to.x + 90} ${midY}, ${to.x + 90} ${to.y + 15}`
        const midX = (from.x + 90 + to.x + 90) / 2
        return (
          <g key={e.id} style={{ opacity: dim ? 0.15 : 0.7, transition: 'opacity 200ms ease' }}>
            <path
              d={path}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={selectedId !== null && neighbourIds?.has(e.from) === true && neighbourIds?.has(e.to) === true ? 2 : 1.25}
              strokeDasharray="5 4"
              markerEnd="url(#arch-arrow)"
            />
            <rect x={midX - 32} y={midY - 9} width="64" height="18" rx="9" fill="#ffffff" stroke="#cbd5e1" />
            <text x={midX} y={midY + 3} textAnchor="middle" fontSize="9" fontWeight="600" fill="#475569">
              {e.label}
            </text>
          </g>
        )
      })}

      {/* Module cards */}
      {modules.map((m) => (
        <ModuleCard
          key={m.id}
          mod={m}
          dim={isDim(m.id)}
          selected={selectedId === m.id}
          hovered={hoveredId === m.id}
          onSelect={() => onSelect(m.id)}
          onHover={(state) => onHover?.(state ? m.id : null)}
        />
      ))}

      {/* Bottom legend */}
      <g transform="translate(40, 668)">
        <LegendDot color="#10b981" label="Live" x={0} />
        <LegendDot color="#f59e0b" label="Mocked" x={70} />
        <LegendDot color="#94a3b8" label="Planned" x={155} />
        <text x={245} y={6} fontSize="10" fill="#64748b">·</text>
        <text x={258} y={6} fontSize="10" fill="#64748b">dashed arrow = data flow · click any module for details</text>
      </g>
    </svg>
  )
}

// ── Module card ────────────────────────────────────────────────────────────

function ModuleCard({
  mod,
  dim,
  selected,
  hovered,
  onSelect,
  onHover,
}: {
  mod: ArchitectureModule
  dim: boolean
  selected: boolean
  hovered: boolean
  onSelect: () => void
  onHover: (state: boolean) => void
}): JSX.Element {
  const s = STATUS_STYLE[mod.status]
  const scale = selected ? 1.04 : hovered ? 1.02 : 1
  const cardW = 180
  const cardH = 90
  return (
    <g
      style={{
        opacity: dim ? 0.3 : 1,
        cursor: 'pointer',
        transition: 'opacity 200ms ease, transform 160ms ease',
        transform: `translate(${mod.x}px, ${mod.y}px) scale(${scale})`,
        transformBox: 'fill-box',
        transformOrigin: 'center',
      }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      filter="url(#arch-shadow)"
    >
      {/* Selection ring */}
      {selected && (
        <rect
          x={-6}
          y={-6}
          width={cardW + 12}
          height={cardH + 12}
          rx={14}
          fill="none"
          stroke={s.stroke}
          strokeOpacity={0.35}
          strokeWidth={6}
        />
      )}

      <rect
        x={0}
        y={0}
        width={cardW}
        height={cardH}
        rx={8}
        fill={s.fill}
        stroke={s.stroke}
        strokeWidth={mod.status === 'planned' ? 1.5 : 1.8}
        strokeDasharray={mod.status === 'planned' ? '5 4' : '0'}
      />

      {/* Status chip top-right */}
      <g>
        <rect x={cardW - 70} y={8} width="62" height="16" rx="8" fill={s.chipBg} />
        <text x={cardW - 39} y={20} textAnchor="middle" fontSize="9" fontWeight="700" fill={s.chipFg}>
          {mod.status === 'live' ? '✓ Live' : mod.status === 'mocked' ? '◐ Mocked' : '◯ Planned'}
        </text>
      </g>

      <text x={14} y={28} fontSize="11" fontWeight="800" fill={s.text} fontFamily="ui-monospace, monospace">
        {mod.label}
      </text>
      <text x={14} y={50} fontSize="10" fontWeight="600" fill={s.subtext}>
        {mod.title.split('·').slice(1).join('·').trim() || mod.title}
      </text>

      {/* Quick descriptor */}
      <text x={14} y={72} fontSize="9" fill={s.text} opacity={0.7}>
        {oneLiner(mod)}
      </text>
    </g>
  )
}

function oneLiner(m: ArchitectureModule): string {
  // Pull first ~38 chars of the first description sentence.
  const first = m.description.split('.')[0] ?? ''
  return first.length <= 56 ? first + '.' : first.slice(0, 55) + '…'
}

function LegendDot({ color, label, x }: { color: string; label: string; x: number }): JSX.Element {
  return (
    <g transform={`translate(${x}, 0)`}>
      <circle cx={5} cy={3} r={4} fill={color} />
      <text x={14} y={6} fontSize="10" fontWeight="600" fill="#475569">
        {label}
      </text>
    </g>
  )
}
