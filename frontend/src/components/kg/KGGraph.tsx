'use client'

/**
 * KGGraph — single-file SVG knowledge graph.
 *
 * Renders three vertical bands:
 *   Standards (left, violet) → Decisions (centre, state-tinted) → Parts (right, teal)
 *
 * Curved bezier edges connect them with a small label on the midpoint.
 * Selecting a node dims everything else and highlights its direct edges + neighbours.
 */

import { useMemo } from 'react'
import type { KGEdge, KGNode } from '@/lib/mockWorkspace'

interface Props {
  nodes: KGNode[]
  edges: KGEdge[]
  selectedId: string | null
  hoveredId?: string | null
  onSelect: (id: string) => void
  onHover?: (id: string | null) => void
}

const NODE_STYLE: Record<
  KGNode['kind'],
  { fill: string; stroke: string; text: string; shape: 'circle' | 'rect' | 'pill' }
> = {
  standard: { fill: '#f5f3ff', stroke: '#7c3aed', text: '#5b21b6', shape: 'circle' },
  decision: { fill: '#fef3c7', stroke: '#d97706', text: '#92400e', shape: 'pill' },
  part: { fill: '#e9f1ef', stroke: '#15524a', text: '#0f3a35', shape: 'rect' },
}

const DECISION_STATE_TINT: Record<NonNullable<KGNode['state']>, { fill: string; stroke: string; text: string }> = {
  PROPOSED: { fill: '#fef3c7', stroke: '#d97706', text: '#92400e' },
  ACCEPTED: { fill: '#d1fae5', stroke: '#059669', text: '#065f46' },
  REJECTED: { fill: '#fee2e2', stroke: '#dc2626', text: '#7f1d1d' },
  SUPERSEDED: { fill: '#f1f5f9', stroke: '#94a3b8', text: '#475569' },
}

const EDGE_STYLE: Record<KGEdge['kind'], { stroke: string; dash: string; label: string }> = {
  cites: { stroke: '#a78bfa', dash: '4 3', label: 'cites' },
  supersedes: { stroke: '#f87171', dash: '6 4', label: 'supersedes' },
  'applies-to': { stroke: '#5eead4', dash: '0', label: 'applies to' },
}

export default function KGGraph({
  nodes,
  edges,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
}: Props): JSX.Element {
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])

  // Neighbours of the selected node — used to dim/highlight.
  const neighbourIds = useMemo(() => {
    if (selectedId === null) return null
    const set = new Set<string>([selectedId])
    for (const e of edges) {
      if (e.from === selectedId) set.add(e.to)
      if (e.to === selectedId) set.add(e.from)
    }
    return set
  }, [edges, selectedId])

  function isDimmed(id: string): boolean {
    if (neighbourIds === null) return false
    return !neighbourIds.has(id)
  }

  return (
    <svg
      viewBox="0 0 1000 620"
      className="h-full w-full"
      role="img"
      aria-label="Knowledge graph of decisions, standards and parts"
    >
      <defs>
        {/* Arrow heads — one per edge tone */}
        {(Object.entries(EDGE_STYLE) as Array<[KGEdge['kind'], (typeof EDGE_STYLE)[KGEdge['kind']]]>).map(([kind, s]) => (
          <marker
            key={`arr-${kind}`}
            id={`kg-arrow-${kind}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <polygon points="0 0, 10 5, 0 10" fill={s.stroke} />
          </marker>
        ))}

        {/* Drop-shadow filter for nodes */}
        <filter id="kg-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" />
          <feOffset dx="0" dy="1.5" result="off" />
          <feComponentTransfer><feFuncA type="linear" slope="0.35" /></feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Faint band background gradients */}
        <linearGradient id="band-stds" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="rgba(124,58,237,0.07)" />
          <stop offset="1" stopColor="rgba(124,58,237,0)" />
        </linearGradient>
        <linearGradient id="band-parts" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="rgba(21,82,74,0.07)" />
          <stop offset="1" stopColor="rgba(21,82,74,0)" />
        </linearGradient>
      </defs>

      {/* Band backgrounds */}
      <rect x="0" y="0" width="280" height="620" fill="url(#band-stds)" />
      <rect x="720" y="0" width="280" height="620" fill="url(#band-parts)" />

      {/* Column headers */}
      <text x="130" y="36" textAnchor="middle" className="fill-violet-700" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.15em' }}>
        STANDARDS
      </text>
      <text x="500" y="36" textAnchor="middle" className="fill-amber-700" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.15em' }}>
        DECISIONS
      </text>
      <text x="870" y="36" textAnchor="middle" className="fill-primary" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.15em' }}>
        PARTS
      </text>

      {/* Edges first (so nodes draw on top) */}
      {edges.map((e) => {
        const from = byId.get(e.from)
        const to = byId.get(e.to)
        if (from === undefined || to === undefined) return null
        const s = EDGE_STYLE[e.kind]

        const dim = neighbourIds !== null && !(neighbourIds.has(e.from) && neighbourIds.has(e.to))

        // Cubic bezier — pull control points horizontally between the bands
        const dx = (to.x - from.x) * 0.5
        const c1x = from.x + dx
        const c2x = to.x - dx
        const path = `M ${from.x} ${from.y} C ${c1x} ${from.y}, ${c2x} ${to.y}, ${to.x} ${to.y}`
        const midX = (from.x + to.x) / 2
        const midY = (from.y + to.y) / 2 - 2

        return (
          <g key={e.id} style={{ opacity: dim ? 0.18 : 1, transition: 'opacity 220ms ease' }}>
            <path
              d={path}
              fill="none"
              stroke={s.stroke}
              strokeWidth={selectedId !== null && neighbourIds?.has(e.from) === true && neighbourIds?.has(e.to) === true ? 2 : 1.25}
              strokeDasharray={s.dash}
              markerEnd={`url(#kg-arrow-${e.kind})`}
            />
            {/* Edge label chip */}
            <g style={{ pointerEvents: 'none' }}>
              <rect
                x={midX - 30}
                y={midY - 8}
                width={60}
                height={14}
                rx={7}
                fill="#ffffff"
                stroke={s.stroke}
                strokeOpacity={0.5}
              />
              <text x={midX} y={midY + 2} textAnchor="middle" style={{ fontSize: 9, fontWeight: 600 }} fill={s.stroke}>
                {s.label}
              </text>
            </g>
          </g>
        )
      })}

      {/* Nodes */}
      {nodes.map((n) => (
        <KGNodeView
          key={n.id}
          node={n}
          dimmed={isDimmed(n.id)}
          selected={selectedId === n.id}
          hovered={hoveredId === n.id}
          onSelect={() => onSelect(n.id)}
          onHover={(state) => onHover?.(state ? n.id : null)}
        />
      ))}
    </svg>
  )
}

// ── Node renderer (shape varies by kind) ────────────────────────────────────

interface NodeProps {
  node: KGNode
  dimmed: boolean
  selected: boolean
  hovered: boolean
  onSelect: () => void
  onHover: (state: boolean) => void
}

function KGNodeView({ node: n, dimmed, selected, hovered, onSelect, onHover }: NodeProps): JSX.Element {
  const baseStyle = NODE_STYLE[n.kind]
  const style =
    n.kind === 'decision' && n.state !== undefined
      ? { ...baseStyle, ...DECISION_STATE_TINT[n.state] }
      : baseStyle
  const scale = selected ? 1.08 : hovered ? 1.04 : 1
  const ringSize = selected ? 7 : hovered ? 4 : 0

  // Shape dimensions
  const isCircle = baseStyle.shape === 'circle'
  const isPill = baseStyle.shape === 'pill'
  const w = isCircle ? 76 : isPill ? 150 : 156
  const h = isCircle ? 76 : 36
  const rx = isCircle ? 38 : isPill ? 18 : 6

  return (
    <g
      style={{
        opacity: dimmed ? 0.25 : 1,
        cursor: 'pointer',
        transition: 'opacity 220ms ease, transform 180ms ease',
        transform: `translate(${n.x}px, ${n.y}px) scale(${scale})`,
        transformBox: 'fill-box',
        transformOrigin: 'center',
      }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      filter="url(#kg-shadow)"
    >
      {/* Highlight ring */}
      {ringSize > 0 && (
        <rect
          x={-w / 2 - ringSize}
          y={-h / 2 - ringSize}
          width={w + ringSize * 2}
          height={h + ringSize * 2}
          rx={rx + ringSize}
          fill="none"
          stroke={style.stroke}
          strokeOpacity={0.25}
          strokeWidth={ringSize * 1.5}
        />
      )}
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={rx}
        fill={style.fill}
        stroke={style.stroke}
        strokeWidth={selected ? 2 : 1.4}
      />
      {n.kind === 'decision' && n.state !== undefined && (
        // Tiny state dot inside the pill
        <circle cx={-w / 2 + 10} cy={0} r={3} fill={style.stroke} />
      )}
      <text
        textAnchor="middle"
        y={isCircle ? -3 : 4}
        style={{ fontSize: isCircle ? 10 : 11, fontWeight: 700 }}
        fill={style.text}
      >
        {n.label}
      </text>
      {isCircle && n.meta !== undefined && (
        <text
          textAnchor="middle"
          y={12}
          style={{ fontSize: 8, fontWeight: 500 }}
          fill={style.text}
          opacity={0.7}
        >
          standard
        </text>
      )}
    </g>
  )
}
