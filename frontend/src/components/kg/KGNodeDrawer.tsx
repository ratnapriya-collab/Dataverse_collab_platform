'use client'

/**
 * KGNodeDrawer — slide-in right panel showing the selected KG node
 * with its immediate neighbours grouped by relation kind.
 */

import Link from 'next/link'
import { ArrowRight, ArrowUpRight, ExternalLink, Hash, X } from 'lucide-react'
import type { KGEdge, KGNode } from '@/lib/mockWorkspace'

interface Props {
  open: boolean
  node: KGNode | null
  allNodes: KGNode[]
  allEdges: KGEdge[]
  onClose: () => void
  onSelect: (nodeId: string) => void
}

const KIND_BADGE: Record<KGNode['kind'], { bg: string; fg: string; ring: string; label: string }> = {
  standard: { bg: 'bg-violet-50', fg: 'text-violet-700', ring: 'ring-violet-200', label: 'Standard' },
  decision: { bg: 'bg-amber-50', fg: 'text-amber-700', ring: 'ring-amber-200', label: 'Decision' },
  part: { bg: 'bg-primary-50', fg: 'text-primary-700', ring: 'ring-primary-200', label: 'Part' },
}

export default function KGNodeDrawer({
  open,
  node,
  allNodes,
  allEdges,
  onClose,
  onSelect,
}: Props): JSX.Element | null {
  if (!open || node === null) return null

  const byId = new Map(allNodes.map((n) => [n.id, n]))
  const cites = allEdges.filter((e) => e.from === node.id && e.kind === 'cites').map((e) => byId.get(e.to)!).filter(Boolean)
  const citedBy = allEdges.filter((e) => e.to === node.id && e.kind === 'cites').map((e) => byId.get(e.from)!).filter(Boolean)
  const supersedes = allEdges.filter((e) => e.from === node.id && e.kind === 'supersedes').map((e) => byId.get(e.to)!).filter(Boolean)
  const supersededBy = allEdges.filter((e) => e.to === node.id && e.kind === 'supersedes').map((e) => byId.get(e.from)!).filter(Boolean)
  const appliesTo = allEdges.filter((e) => e.from === node.id && e.kind === 'applies-to').map((e) => byId.get(e.to)!).filter(Boolean)
  const appliedBy = allEdges.filter((e) => e.to === node.id && e.kind === 'applies-to').map((e) => byId.get(e.from)!).filter(Boolean)

  const badge = KIND_BADGE[node.kind]

  return (
    <aside
      className="dv-anim-fade-up fixed right-0 top-0 z-40 flex h-screen w-[360px] flex-col border-l border-slate-200 bg-white shadow-2xl"
      role="dialog"
      aria-label={`Knowledge graph node — ${node.label}`}
    >
      {/* Header */}
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0 flex-1">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${badge.bg} ${badge.fg} ${badge.ring}`}
          >
            <Hash className="h-2.5 w-2.5" />
            {badge.label}
            {node.state !== undefined && (
              <>
                <span className="opacity-50">·</span>
                <span>{node.state.toLowerCase()}</span>
              </>
            )}
          </span>
          <h2 className="mt-1.5 truncate font-mono text-sm font-bold text-slate-900">{node.label}</h2>
          {node.meta !== undefined && (
            <p className="mt-0.5 text-[11px] text-slate-500">{node.meta}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* Body */}
      <div className="dv-thin-scroll flex-1 overflow-y-auto px-4 py-4">
        {cites.length > 0 && (
          <RelationGroup label="Cites" tone="violet" nodes={cites} onSelect={onSelect} />
        )}
        {citedBy.length > 0 && (
          <RelationGroup label="Cited by" tone="violet" nodes={citedBy} onSelect={onSelect} />
        )}
        {supersedes.length > 0 && (
          <RelationGroup label="Supersedes" tone="rose" nodes={supersedes} onSelect={onSelect} />
        )}
        {supersededBy.length > 0 && (
          <RelationGroup label="Superseded by" tone="rose" nodes={supersededBy} onSelect={onSelect} />
        )}
        {appliesTo.length > 0 && (
          <RelationGroup label="Applies to" tone="teal" nodes={appliesTo} onSelect={onSelect} />
        )}
        {appliedBy.length > 0 && (
          <RelationGroup label="Decisions on this part" tone="amber" nodes={appliedBy} onSelect={onSelect} />
        )}

        {cites.length === 0 && citedBy.length === 0 && supersedes.length === 0 && supersededBy.length === 0 && appliesTo.length === 0 && appliedBy.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
            This node has no recorded relations yet.
          </p>
        )}
      </div>

      {/* Footer — deep link to the actual page */}
      <footer className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
        {node.kind === 'part' && node.part_id !== undefined && (
          <Link
            href={`/parts/${node.part_id}`}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-700"
          >
            Open part viewer
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
        {node.kind === 'decision' && node.part_id !== undefined && (
          <Link
            href={`/parts/${node.part_id}`}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-700"
          >
            Open in part viewer
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
        {node.kind === 'standard' && (
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            View on standards portal
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </footer>
    </aside>
  )
}

// ── Relation group ──────────────────────────────────────────────────────────

const TONE: Record<'violet' | 'rose' | 'teal' | 'amber', { dot: string; label: string }> = {
  violet: { dot: 'bg-violet-500', label: 'text-violet-700' },
  rose: { dot: 'bg-rose-500', label: 'text-rose-700' },
  teal: { dot: 'bg-primary', label: 'text-primary-700' },
  amber: { dot: 'bg-amber-500', label: 'text-amber-700' },
}

function RelationGroup({
  label,
  tone,
  nodes,
  onSelect,
}: {
  label: string
  tone: keyof typeof TONE
  nodes: KGNode[]
  onSelect: (id: string) => void
}): JSX.Element {
  const t = TONE[tone]
  return (
    <section className="mb-4">
      <header className="mb-1.5 flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} aria-hidden="true" />
        <p className={`text-[10px] font-semibold uppercase tracking-wider ${t.label}`}>
          {label}
        </p>
        <span className="ml-auto rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-slate-600">
          {nodes.length}
        </span>
      </header>
      <ul className="space-y-1">
        {nodes.map((n) => {
          const b = KIND_BADGE[n.kind]
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onSelect(n.id)}
                className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition hover:shadow-sm ${b.ring} ${b.bg} hover:border-current`}
              >
                <span className={`text-[9px] font-bold uppercase tracking-wider ${b.fg}`}>
                  {b.label.slice(0, 3)}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-semibold text-slate-900">
                  {n.label}
                </span>
                <ArrowRight className="h-3 w-3 text-slate-400" />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
