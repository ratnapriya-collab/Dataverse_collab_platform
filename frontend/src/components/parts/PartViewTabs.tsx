'use client'

/**
 * PartViewTabs — sticky tab strip that lets the user pivot between the three
 * views of the same part: 3D Model · 2D Drawing · BOM.
 *
 * Mounted on every part-scoped page so switching is one click and the
 * conversation panel stays in place. Uses Link (not router.push) so each
 * tab keeps Next.js's per-route prefetching.
 */

import Link from 'next/link'
import { Box, FileEdit, FileText, Layers, ListTree } from 'lucide-react'

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
  return (
    <nav
      aria-label="Part views"
      className="sticky top-0 z-20 flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white/95 px-4 py-2 shadow-sm backdrop-blur-md"
    >
      <span className="mr-2 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        <Layers className="h-3 w-3 text-slate-400" />
        Part view
      </span>
      {TABS.map((t) => {
        const Icon = t.icon
        const isActive = t.id === active
        return (
          <Link
            key={t.id}
            href={t.href(partId)}
            aria-current={isActive ? 'page' : undefined}
            className={[
              'group relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition',
              isActive
                ? 'bg-primary text-white shadow-sm'
                : 'text-slate-600 hover:bg-primary-50 hover:text-primary',
            ].join(' ')}
          >
            <Icon className="h-3.5 w-3.5" />
            {t.label}
            <span
              className={[
                'hidden text-[10px] font-medium opacity-80 sm:inline',
                isActive ? 'text-white' : 'text-slate-400 group-hover:text-primary',
              ].join(' ')}
            >
              · {t.hint}
            </span>
          </Link>
        )
      })}
      {contextChip !== undefined && (
        <span className="ml-auto rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
          {contextChip}
        </span>
      )}
    </nav>
  )
}
