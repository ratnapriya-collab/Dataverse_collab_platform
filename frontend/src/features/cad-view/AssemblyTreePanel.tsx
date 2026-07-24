'use client'

/**
 * AssemblyTreePanel — left column of the CAD View.
 * Searchable flat parts list from the loaded GLB. Hover a row → mesh
 * tints in viewer. Click a row → mesh turns green (persistent).
 */

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useViewerStore } from '@/_viewer/store/viewerStore'
import type { TreeNode } from '@/_viewer/types/viewer'

interface Props {
  collapsed: boolean
  onToggleCollapsed: () => void
}

function flattenTree(nodes: TreeNode[]): {
  meshName: string
  name: string
  color: string
}[] {
  const out: { meshName: string; name: string; color: string }[] = []
  const walk = (list: TreeNode[]): void => {
    for (const n of list) {
      if (n.meshName !== null && n.meshName !== '') {
        out.push({ meshName: n.meshName, name: n.name || n.meshName, color: n.color })
      }
      if (n.children.length > 0) walk(n.children)
    }
  }
  walk(nodes)
  return out
}

export default function AssemblyTreePanel({
  collapsed,
  onToggleCollapsed,
}: Props): JSX.Element {
  const modelTree = useViewerStore((s) => s.modelTree)
  const hoveredMesh = useViewerStore((s) => s.hoveredMesh)
  const setHoveredMesh = useViewerStore((s) => s.setHoveredMesh)
  const selectedMesh = useViewerStore((s) => s.selectedMesh)
  const setSelectedMesh = useViewerStore((s) => s.setSelectedMesh)
  const [q, setQ] = useState('')
  const [hideAll, setHideAll] = useState(false)

  const parts = useMemo(() => flattenTree(modelTree), [modelTree])
  const filtered = useMemo(() => {
    if (q.trim() === '') return parts
    const needle = q.trim().toLowerCase()
    return parts.filter((p) => p.name.toLowerCase().includes(needle))
  }, [parts, q])

  if (collapsed) {
    return (
      <aside className="flex w-8 shrink-0 flex-col items-center gap-2 border-r border-slate-200 bg-slate-50 py-2">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="Expand assembly tree"
          className="flex h-6 w-6 items-center justify-center rounded text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <span
          className="mt-2 text-[9px] font-bold uppercase tracking-widest text-slate-400"
          style={{ writingMode: 'vertical-rl' }}
        >
          Assembly Tree
        </span>
      </aside>
    )
  }

  return (
    <aside className="flex w-[240px] shrink-0 flex-col border-r border-slate-200 bg-white">
      <header className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <div className="min-w-0">
          <p className="text-[11.5px] font-bold text-slate-900">Assembly Tree</p>
          <p className="text-[9.5px] text-slate-500">{parts.length} parts</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setHideAll((v) => !v)}
            className={[
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-semibold transition',
              hideAll
                ? 'border-amber-400/60 bg-amber-50 text-amber-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
            ].join(' ')}
          >
            {hideAll ? 'Show all' : 'Hide all'}
          </button>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label="Collapse assembly tree"
            className="flex h-5 w-5 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div className="relative border-b border-slate-100 px-3 py-1.5">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search parts…"
          aria-label="Search parts"
          className="w-full rounded border border-slate-200 bg-white py-1 pl-6 pr-2 text-[11px] transition placeholder:text-slate-400 focus:border-primary/40 focus:outline-none"
        />
      </div>

      <ul
        className="dv-thin-scroll flex-1 overflow-y-auto py-0.5"
        role="listbox"
        aria-label="Assembly parts"
      >
        {hideAll ? (
          <li className="px-3 py-4 text-center text-[10.5px] text-slate-400">
            List hidden — click <em>Show all</em> to expand
          </li>
        ) : filtered.length === 0 ? (
          <li className="px-3 py-4 text-center text-[10.5px] text-slate-400">
            {parts.length === 0 ? 'Waiting for model to load…' : 'No matches.'}
          </li>
        ) : (
          filtered.map((p) => {
            const isHover = hoveredMesh === p.meshName
            const isSelected = selectedMesh === p.meshName
            return (
              <li key={p.meshName}>
                <button
                  type="button"
                  onMouseEnter={() => setHoveredMesh(p.meshName)}
                  onMouseLeave={() => setHoveredMesh(null)}
                  onClick={() =>
                    setSelectedMesh(isSelected ? null : p.meshName)
                  }
                  aria-pressed={isSelected}
                  className={[
                    'flex w-full items-center gap-2 px-3 py-1 text-left text-[11px] transition',
                    isSelected
                      ? 'bg-primary/12 text-primary'
                      : isHover
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-2 shrink-0 rounded-full border border-slate-300"
                    style={{ backgroundColor: p.color || '#cbd5e1' }}
                  />
                  <span className="truncate">{p.name}</span>
                  {isSelected && (
                    <span className="ml-auto inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  )}
                </button>
              </li>
            )
          })
        )}
      </ul>

      <footer className="border-t border-slate-200 bg-slate-50 px-3 py-2">
        <select
          aria-label="Variant"
          className="mb-1.5 w-full rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700 focus:border-primary/40 focus:outline-none"
          defaultValue="current"
        >
          <option value="current">Current</option>
          <option value="v8">V8</option>
          <option value="v6">V6</option>
        </select>
        <button
          type="button"
          className="w-full rounded-md bg-gradient-to-r from-purple-500 to-indigo-500 px-2 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:shadow-md"
        >
          Update CAD
        </button>
      </footer>
    </aside>
  )
}
