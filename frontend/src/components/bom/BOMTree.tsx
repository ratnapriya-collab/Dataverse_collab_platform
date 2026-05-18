'use client'

/**
 * BOMTree — owns the expanded-state Set and renders the recursive tree.
 * The root is always expanded; everything else starts collapsed.
 */

import { useEffect, useMemo, useState } from 'react'
import BOMTreeNode from './BOMTreeNode'
import type { MockBomNode } from '@/lib/mockWorkspace'

interface Props {
  root: MockBomNode
  selectedId: string | null
  onSelect: (id: string) => void
}

/** Walk every node id so "Expand all" can fill the Set in one go. */
function collectAllIds(node: MockBomNode): string[] {
  const ids = [node.id]
  for (const child of node.children ?? []) ids.push(...collectAllIds(child))
  return ids
}

export default function BOMTree({ root, selectedId, onSelect }: Props): JSX.Element {
  const allIds = useMemo(() => collectAllIds(root), [root])

  // Auto-open root + first level so the tree doesn't look empty on load.
  const initial = useMemo(() => {
    const set = new Set<string>([root.id])
    for (const c of root.children ?? []) set.add(c.id)
    return set
  }, [root])
  const [expanded, setExpanded] = useState<Set<string>>(initial)

  // Reset selection if the user collapses the selected node's ancestor.
  useEffect(() => {
    if (selectedId === null) return
    // (we don't bother tracking ancestor relationships; visual feedback only)
  }, [expanded, selectedId])

  function toggle(id: string): void {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Bill of materials
        </p>
        <div className="flex items-center gap-1 text-[10px]">
          <button
            type="button"
            onClick={() => setExpanded(new Set(allIds))}
            className="rounded px-1.5 py-0.5 font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={() => setExpanded(new Set([root.id]))}
            className="rounded px-1.5 py-0.5 font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            Collapse all
          </button>
        </div>
      </header>
      <ul className="py-2">
        <BOMTreeNode
          node={root}
          depth={0}
          expanded={expanded}
          selectedId={selectedId}
          onToggle={toggle}
          onSelect={onSelect}
        />
      </ul>
    </div>
  )
}
