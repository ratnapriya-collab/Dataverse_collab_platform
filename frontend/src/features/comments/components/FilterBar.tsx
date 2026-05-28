'use client'

/**
 * FilterBar — the toolbar above the threads list inside CommentsPanel.
 * Status · priority · @me · search · pin-density toggle · keyboard '/' focus.
 */

import { Eye, EyeOff, Search, SlidersHorizontal, UserCircle } from 'lucide-react'
import { useState } from 'react'
import { useCommentsStore } from '../store/commentsStore'
import type { PinDensityMode, ThreadPriority, ThreadStatus } from '../types/thread.types'

const STATUS_OPTIONS: ThreadStatus[] = ['open', 'resolved']
const PRIORITY_OPTIONS: NonNullable<ThreadPriority>[] = ['blocker', 'high', 'medium', 'low']
const DENSITY_OPTIONS: Array<{ id: PinDensityMode; label: string; icon: typeof Eye }> = [
  { id: 'open-only', label: 'Open only', icon: Eye },
  { id: 'all', label: 'All', icon: Eye },
  { id: 'hidden', label: 'Hide pins', icon: EyeOff },
]

export default function FilterBar(): JSX.Element {
  const filters = useCommentsStore((s) => s.filters)
  const setFilter = useCommentsStore((s) => s.setFilter)
  const resetFilters = useCommentsStore((s) => s.resetFilters)
  const pinDensityMode = useCommentsStore((s) => s.pinDensityMode)
  const setPinDensityMode = useCommentsStore((s) => s.setPinDensityMode)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const toggleStatus = (s: ThreadStatus): void => {
    const next = filters.status.includes(s)
      ? filters.status.filter((x) => x !== s)
      : [...filters.status, s]
    setFilter('status', next)
  }

  const togglePriority = (p: NonNullable<ThreadPriority>): void => {
    const next = filters.priority.includes(p)
      ? filters.priority.filter((x) => x !== p)
      : [...filters.priority, p]
    setFilter('priority', next)
  }

  const anyFilterActive =
    filters.status.length !== 1 ||
    filters.status[0] !== 'open' ||
    filters.priority.length > 0 ||
    filters.assignedToMe ||
    filters.mentionsMe ||
    filters.searchQuery.trim() !== ''

  return (
    <div className="space-y-1.5 border-b border-slate-100 bg-slate-50/60 px-3 py-2">
      {/* Search + density picker */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            data-comments-search
            value={filters.searchQuery}
            onChange={(e) => setFilter('searchQuery', e.target.value)}
            placeholder="Search comments…  /"
            className="w-full rounded-md border border-slate-200 bg-white py-1 pl-7 pr-2 text-[11px] placeholder:text-slate-400 focus:border-primary focus:outline-none"
          />
        </div>
        <button
          type="button"
          aria-label="Advanced filters"
          onClick={() => setShowAdvanced((o) => !o)}
          className={[
            'inline-flex h-6 w-6 items-center justify-center rounded transition',
            showAdvanced || anyFilterActive
              ? 'bg-primary-50 text-primary'
              : 'text-slate-500 hover:bg-slate-100',
          ].join(' ')}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Status + assignment chips (always visible) */}
      <div className="flex flex-wrap items-center gap-1">
        {STATUS_OPTIONS.map((s) => {
          const on = filters.status.includes(s)
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatus(s)}
              className={[
                'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition',
                on
                  ? s === 'open'
                    ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-200'
                    : 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200'
                  : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:text-slate-900',
              ].join(' ')}
            >
              {s}
            </button>
          )
        })}
        <span className="text-slate-300">·</span>
        <button
          type="button"
          onClick={() => setFilter('assignedToMe', !filters.assignedToMe)}
          className={[
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition',
            filters.assignedToMe
              ? 'bg-primary text-white'
              : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:text-slate-900',
          ].join(' ')}
        >
          <UserCircle className="h-2.5 w-2.5" />
          @me
        </button>
      </div>

      {/* Advanced — priority + density */}
      {showAdvanced && (
        <div className="dv-anim-fade-in space-y-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5">
          <div>
            <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">
              Priority
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {PRIORITY_OPTIONS.map((p) => {
                const on = filters.priority.includes(p)
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePriority(p)}
                    className={[
                      'rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider transition',
                      on
                        ? 'bg-primary text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    ].join(' ')}
                  >
                    {p}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">
              Pins in viewer
            </p>
            <div className="mt-1 inline-flex overflow-hidden rounded-md border border-slate-200">
              {DENSITY_OPTIONS.map((opt) => {
                const Icon = opt.icon
                const on = pinDensityMode === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPinDensityMode(opt.id)}
                    className={[
                      'inline-flex items-center gap-1 border-r border-slate-200 px-2 py-0.5 text-[10px] font-medium last:border-r-0 transition',
                      on ? 'bg-primary-50 text-primary' : 'bg-white text-slate-600 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <Icon className="h-2.5 w-2.5" />
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
          {anyFilterActive && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-[10px] font-semibold text-slate-500 hover:text-primary"
            >
              Reset filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}
