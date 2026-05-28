'use client'

/**
 * PartViewTabs — compact dropdown for switching between the 4 part views:
 *   3D Model · 2D Drawing · BOM · Doc.
 *
 * Previously rendered as a full-width sticky strip; that ate vertical real
 * estate on the viewer. Now a single chevron button → menu, designed to be
 * embedded in the part-page header. Uses Link (not router.push) so each
 * option keeps Next.js's per-route prefetching.
 */

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Box, ChevronDown, FileEdit, FileText, ListTree } from 'lucide-react'

export type PartView = '3d' | '2d' | 'bom' | 'doc'

interface Props {
  partId: string
  active: PartView
  /** Optional pill chip on the active view, e.g. "5 PMI · 12 decisions". */
  contextChip?: string
}

interface TabSpec {
  id: PartView
  label: string
  href: (id: string) => string
  icon: typeof Box
  hint: string
}

const TABS: TabSpec[] = [
  {
    id: '3d',
    label: '3D Model',
    href: (id) => `/parts/${id}`,
    icon: Box,
    hint: 'Anchored decisions',
  },
  {
    id: '2d',
    label: '2D Drawing',
    href: (id) => `/parts/${id}/drawing`,
    icon: FileText,
    hint: 'PMI callouts & GD&T',
  },
  {
    id: 'bom',
    label: 'BOM',
    href: (id) => `/parts/${id}/bom`,
    icon: ListTree,
    hint: 'Assembly tree',
  },
  {
    id: 'doc',
    label: 'Doc',
    href: (id) => `/parts/${id}/doc`,
    icon: FileEdit,
    hint: 'Design notes & spec',
  },
]

export default function PartViewTabs({ partId, active, contextChip }: Props): JSX.Element {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const activeSpec = TABS.find((t) => t.id === active) ?? TABS[0]
  const ActiveIcon = activeSpec.icon

  // Close on outside click + ESC
  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (wrapRef.current !== null && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Switch part view"
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-primary/40 hover:text-primary"
      >
        <ActiveIcon className="h-3.5 w-3.5 text-primary" />
        {activeSpec.label}
        <span className="hidden text-[10px] font-medium text-slate-400 sm:inline">
          · {activeSpec.hint}
        </span>
        <ChevronDown
          className={`h-3 w-3 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {contextChip !== undefined && (
        <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 sm:inline">
          {contextChip}
        </span>
      )}

      {open && (
        <div
          role="menu"
          aria-label="Part views"
          className="dv-anim-pop absolute left-0 top-full z-40 mt-1 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
        >
          {TABS.map((t) => {
            const Icon = t.icon
            const isActive = t.id === active
            return (
              <Link
                key={t.id}
                href={t.href(partId)}
                role="menuitem"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setOpen(false)}
                className={[
                  'flex items-start gap-2.5 px-3 py-2 text-xs transition',
                  isActive
                    ? 'bg-primary-50 text-primary'
                    : 'text-slate-700 hover:bg-slate-50',
                ].join(' ')}
              >
                <Icon
                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${isActive ? 'text-primary' : 'text-slate-400'}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight">{t.label}</p>
                  <p className="mt-0.5 text-[10.5px] text-slate-500">{t.hint}</p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
