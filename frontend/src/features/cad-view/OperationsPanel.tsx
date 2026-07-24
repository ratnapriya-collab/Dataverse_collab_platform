'use client'

/**
 * OperationsPanel — middle column. Numbered Operation cards with
 * assigned parts (drag or click a mesh + Assign to Op).
 */

import { useEffect, useState } from 'react'
import {
  ChevronRight, Link2, List, MoreHorizontal, Plus, UserPlus, X,
} from 'lucide-react'
import { useViewerStore } from '@/_viewer/store/viewerStore'
import type { TreeNode } from '@/_viewer/types/viewer'
import { useOperationsStore, type Operation } from './operationsStore'

/** Walk the modelTree and pull every meshed leaf out as a flat list —
 *  we use this to auto-seed empty Operations so the panel doesn't sit
 *  bare on first load. Duplicates the small helper in AssemblyTreePanel
 *  because both callers walk the same shape but for different reasons. */
function flatMeshes(nodes: TreeNode[]): { meshName: string; name: string }[] {
  const out: { meshName: string; name: string }[] = []
  const walk = (list: TreeNode[]): void => {
    for (const n of list) {
      if (n.meshName !== null && n.meshName !== '') {
        out.push({ meshName: n.meshName, name: n.name || n.meshName })
      }
      if (n.children.length > 0) walk(n.children)
    }
  }
  walk(nodes)
  return out
}

interface Props {
  partId: string
}

export default function OperationsPanel({ partId }: Props): JSX.Element {
  const opsByPart = useOperationsStore((s) => s.byPartId[partId] ?? [])
  const selectedOpId = useOperationsStore((s) => s.selectedOpId)
  const addOperation = useOperationsStore((s) => s.addOperation)
  const selectOperation = useOperationsStore((s) => s.selectOperation)
  const addPartToOperation = useOperationsStore((s) => s.addPartToOperation)
  const modelTree = useViewerStore((s) => s.modelTree)

  // Auto-seed operations once the model tree finishes loading. Distributes
  // the parts round-robin across whatever operations exist. Only runs when
  // (a) every operation is currently empty, and (b) the tree has parts —
  // so if the user has manually assigned anything, we never overwrite.
  useEffect(() => {
    if (opsByPart.length === 0) return
    const allEmpty = opsByPart.every((op) => op.parts.length === 0)
    if (!allEmpty) return
    const parts = flatMeshes(modelTree)
    if (parts.length === 0) return

    // Round-robin distribute — Operation 1 gets parts [0, N, 2N…],
    // Operation 2 gets [1, N+1, 2N+1…], etc. Feels natural in the panel.
    parts.forEach((p, i) => {
      const op = opsByPart[i % opsByPart.length]
      if (op === undefined) return
      addPartToOperation(partId, op.id, p.meshName, p.name, 'x1')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partId, modelTree.length, opsByPart.length])

  return (
    <aside className="flex w-[280px] shrink-0 flex-col border-r border-slate-200 bg-slate-50/40">
      <header className="border-b border-slate-100 bg-white px-3 py-2">
        <p className="text-[11.5px] font-bold text-slate-900">Operations</p>
        <p className="text-[9.5px] text-slate-500">
          {opsByPart.length} operation{opsByPart.length === 1 ? '' : 's'}
        </p>
      </header>

      <div className="dv-thin-scroll flex-1 overflow-y-auto p-2">
        {opsByPart.length === 0 ? (
          <p className="px-4 py-6 text-center text-[10.5px] text-slate-400">
            No operations yet. Click <em>+ Add Operation</em> below.
          </p>
        ) : (
          <ul className="space-y-2">
            {opsByPart.map((op) => (
              <OperationCard
                key={op.id}
                partId={partId}
                op={op}
                selected={op.id === selectedOpId}
                onSelect={() =>
                  selectOperation(op.id === selectedOpId ? null : op.id)
                }
              />
            ))}
          </ul>
        )}
      </div>

      <footer className="border-t border-slate-200 bg-white p-2">
        <button
          type="button"
          onClick={() => addOperation(partId)}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-purple-500 to-indigo-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition hover:shadow-md"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Operation
        </button>
      </footer>
    </aside>
  )
}

function OperationCard({
  partId, op, selected, onSelect,
}: {
  partId: string
  op: Operation
  selected: boolean
  onSelect: () => void
}): JSX.Element {
  const renameOperation = useOperationsStore((s) => s.renameOperation)
  const removeOperation = useOperationsStore((s) => s.removeOperation)
  const removePartFromOp = useOperationsStore((s) => s.removePartFromOperation)
  const addPartToOperation = useOperationsStore((s) => s.addPartToOperation)
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(op.title)

  // Read hoveredMesh so "Assign hovered" button can wire it up.
  const hoveredMesh = useViewerStore((s) => s.hoveredMesh)

  return (
    <li
      className={[
        'rounded-md border bg-white transition',
        selected
          ? 'border-primary/50 ring-1 ring-primary/30'
          : 'border-slate-200 hover:border-slate-300',
      ].join(' ')}
    >
      <div className="flex items-center gap-1.5 border-b border-slate-100 px-2 py-1.5">
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded bg-primary/10 px-1 text-[9.5px] font-bold text-primary">
            {op.number}
          </span>
          {renaming ? (
            <input
              type="text"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                renameOperation(partId, op.id, draft.trim() || op.title)
                setRenaming(false)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  renameOperation(partId, op.id, draft.trim() || op.title)
                  setRenaming(false)
                } else if (e.key === 'Escape') {
                  setDraft(op.title)
                  setRenaming(false)
                }
              }}
              className="min-w-0 flex-1 rounded border border-primary/40 px-1 py-0.5 text-[11px] focus:outline-none"
            />
          ) : (
            <span className="truncate text-[11.5px] font-semibold text-slate-800">
              {op.title}
            </span>
          )}
        </button>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title={hoveredMesh !== null ? `Assign ${hoveredMesh} to this operation` : 'Hover a part to assign'}
            aria-label="Assign hovered part"
            disabled={hoveredMesh === null}
            onClick={() => {
              if (hoveredMesh !== null) {
                addPartToOperation(partId, op.id, hoveredMesh, hoveredMesh)
              }
            }}
            className="flex h-5 w-5 items-center justify-center rounded text-slate-400 transition enabled:hover:bg-emerald-50 enabled:hover:text-emerald-600 disabled:opacity-40"
          >
            <UserPlus className="h-3 w-3" />
          </button>
          <IconAction label="Link related step" icon={Link2} />
          <IconAction label="Show parts list" icon={List} />
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="More"
              className="flex h-5 w-5 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <MoreHorizontal className="h-3 w-3" />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-10 mt-1 w-28 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    setDraft(op.title)
                    setRenaming(true)
                  }}
                  className="block w-full px-2 py-1 text-left text-[10.5px] hover:bg-slate-50"
                >
                  Rename
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    if (window.confirm(`Delete "${op.title}"?`)) {
                      removeOperation(partId, op.id)
                    }
                  }}
                  className="block w-full px-2 py-1 text-left text-[10.5px] text-rose-600 hover:bg-rose-50"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ul className="divide-y divide-slate-100 px-1 py-0.5">
        {op.parts.length === 0 ? (
          <li className="px-2 py-1 text-[10.5px] italic text-slate-400">
            No parts yet. Hover a part in the tree/viewer and click the
            <span className="mx-1 inline-block align-middle">
              <UserPlus className="inline h-2.5 w-2.5" />
            </span>
            icon above.
          </li>
        ) : (
          op.parts.map((p) => (
            <li
              key={p.meshName}
              className="group flex items-center gap-1.5 px-1.5 py-1"
            >
              <span className="min-w-0 flex-1 truncate text-[11px] text-slate-700">
                {p.label}
              </span>
              <span className="rounded bg-slate-100 px-1 py-0 font-mono text-[9.5px] font-semibold text-slate-600">
                {p.qty}
              </span>
              <button
                type="button"
                onClick={() => removePartFromOp(partId, op.id, p.meshName)}
                aria-label="Remove part"
                className="opacity-0 transition group-hover:opacity-100"
              >
                <X className="h-3 w-3 text-slate-400 hover:text-rose-600" />
              </button>
            </li>
          ))
        )}
      </ul>

      <button
        type="button"
        className="flex w-full items-center justify-end gap-0.5 border-t border-slate-100 bg-slate-50/50 px-2 py-1 text-[10px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
      >
        Suboperation
        <ChevronRight className="h-3 w-3" />
      </button>
    </li>
  )
}

function IconAction({
  label, icon: Icon,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
}): JSX.Element {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="flex h-5 w-5 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-primary"
    >
      <Icon className="h-3 w-3" />
    </button>
  )
}
