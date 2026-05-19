'use client'

/**
 * ModuleStatusDrawer — slides in from the right when a module is selected.
 *
 * Shows the module's title, status pill, description, feature list, and a
 * deep link to the mocked UI page (omitted for Planned modules).
 */

import Link from 'next/link'
import { ArrowUpRight, Check, CircleDashed, Hash, X } from 'lucide-react'
import type { ArchitectureModule, ModuleStatus } from '@/lib/mockWorkspace'

const STATUS_PILL: Record<ModuleStatus, { bg: string; fg: string; ring: string; icon: typeof Check; label: string }> = {
  live: { bg: 'bg-emerald-50', fg: 'text-emerald-700', ring: 'ring-emerald-200', icon: Check, label: 'Live' },
  mocked: { bg: 'bg-amber-50', fg: 'text-amber-700', ring: 'ring-amber-200', icon: CircleDashed, label: 'Mocked' },
  planned: { bg: 'bg-slate-100', fg: 'text-slate-700', ring: 'ring-slate-200', icon: CircleDashed, label: 'Planned' },
}

interface Props {
  open: boolean
  module: ArchitectureModule | null
  onClose: () => void
}

export default function ModuleStatusDrawer({ open, module, onClose }: Props): JSX.Element | null {
  if (!open || module === null) return null
  const s = STATUS_PILL[module.status]
  const Icon = s.icon

  return (
    <aside
      role="dialog"
      aria-label={`Module · ${module.title}`}
      className="dv-anim-fade-up fixed right-0 top-0 z-40 flex h-screen w-[400px] flex-col border-l border-slate-200 bg-white shadow-2xl"
    >
      {/* Header */}
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <Hash className="-mt-0.5 mr-1 inline h-2.5 w-2.5" />
            Module · {module.id}
          </p>
          <h2 className="mt-1 text-sm font-bold tracking-tight text-slate-900">{module.title}</h2>
          <span
            className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${s.bg} ${s.fg} ${s.ring}`}
          >
            <Icon className="h-3 w-3" />
            {s.label}
          </span>
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
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Description</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-700">{module.description}</p>
        </section>

        <section className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            What it does
          </p>
          <ul className="mt-2 space-y-1.5">
            {module.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-[12px] leading-snug text-slate-700">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </section>

        {module.status === 'planned' && (
          <div className="mt-5 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            This module is part of the long-term plan. It has no UI yet — designs and acceptance
            criteria are in the product spec.
          </div>
        )}
      </div>

      {/* Footer CTA */}
      {module.href !== undefined && (
        <footer className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
          <Link
            href={module.href}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-700"
          >
            Open mocked screen
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </footer>
      )}
    </aside>
  )
}
