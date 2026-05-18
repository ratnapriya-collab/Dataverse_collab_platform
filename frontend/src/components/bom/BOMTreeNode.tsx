'use client'

/**
 * BOMTreeNode — single row in the BOM tree. Recurses on `children` so a
 * subassembly looks identical to a leaf part, just with an expander
 * chevron and indented kids.
 */

import Link from 'next/link'
import { ArrowUpRight, ChevronRight, MessageSquare, Package } from 'lucide-react'
import type { MockBomNode } from '@/lib/mockWorkspace'

interface Props {
  node: MockBomNode
  /** 0 = root, 1 = first nested, etc. — drives the indent rail. */
  depth: number
  expanded: Set<string>
  selectedId: string | null
  onToggle: (id: string) => void
  onSelect: (id: string) => void
}

export default function BOMTreeNode({
  node,
  depth,
  expanded,
  selectedId,
  onToggle,
  onSelect,
}: Props): JSX.Element {
  const hasChildren = node.children !== undefined && node.children.length > 0
  const isOpen = expanded.has(node.id)
  const isSelected = selectedId === node.id

  return (
    <li>
      <div
        className={`group relative flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition ${
          isSelected ? 'bg-primary-50' : 'hover:bg-slate-50'
        }`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {/* Indent rail */}
        {depth > 0 && (
          <span
            aria-hidden="true"
            className="absolute left-0 top-0 bottom-0 w-px bg-slate-200"
            style={{ left: `${(depth - 1) * 20 + 18}px` }}
          />
        )}

        {/* Expander */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (hasChildren) onToggle(node.id)
          }}
          aria-label={hasChildren ? (isOpen ? 'Collapse' : 'Expand') : undefined}
          aria-expanded={hasChildren ? isOpen : undefined}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition ${
            hasChildren ? 'hover:bg-slate-200 hover:text-slate-700' : 'invisible'
          }`}
        >
          <ChevronRight
            className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-90' : ''}`}
          />
        </button>

        {/* Row body — clickable for selection */}
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          {/* Icon: subassembly vs leaf */}
          <div
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
              hasChildren
                ? 'bg-primary-50 text-primary-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Package className="h-3 w-3" />
          </div>

          {/* Name + meta */}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <p className={`truncate text-[13px] font-semibold ${isSelected ? 'text-primary-900' : 'text-slate-900'}`}>
                {node.name}
              </p>
              <span className="font-mono text-[10px] text-slate-500">{node.part_number}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-slate-500">
              <span className="font-mono">× {node.quantity}</span>
              {node.material !== undefined && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>{node.material}</span>
                </>
              )}
              {node.supplier_ref !== undefined && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono">{node.supplier_ref}</span>
                </>
              )}
            </div>
          </div>

          {/* Decisions count badge */}
          {node.decisions_count > 0 && (
            <span className="hidden shrink-0 items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200 md:inline-flex">
              <MessageSquare className="h-2.5 w-2.5" />
              {node.decisions_count}
            </span>
          )}
        </button>

        {/* Open button — appears on hover for leaves with a part_id */}
        {node.part_id !== undefined && (
          <Link
            href={`/parts/${node.part_id}`}
            onClick={(e) => e.stopPropagation()}
            className="hidden shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 opacity-0 transition group-hover:opacity-100 hover:border-primary hover:text-primary md:inline-flex"
          >
            Open
            <ArrowUpRight className="h-2.5 w-2.5" />
          </Link>
        )}
      </div>

      {/* Children */}
      {hasChildren && isOpen && (
        <ul>
          {node.children!.map((child) => (
            <BOMTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              selectedId={selectedId}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
