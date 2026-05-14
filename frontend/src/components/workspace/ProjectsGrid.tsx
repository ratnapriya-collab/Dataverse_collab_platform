'use client'

import { useMemo, useState } from 'react'
import { LayoutGrid, Plus } from 'lucide-react'
import ProjectCard from './ProjectCard'
import type { MockProject, ProjectStatus } from '@/lib/mockWorkspace'

const STATUS_FILTERS: { id: ProjectStatus | 'ALL'; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'ACTIVE', label: 'Active' },
  { id: 'IN_REVIEW', label: 'In review' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'ARCHIVED', label: 'Archived' },
]

interface Props {
  projects: MockProject[]
}

export default function ProjectsGrid({ projects }: Props) {
  const [filter, setFilter] = useState<ProjectStatus | 'ALL'>('ALL')

  const filtered = useMemo(
    () => (filter === 'ALL' ? projects : projects.filter((p) => p.status === filter)),
    [projects, filter],
  )

  const countByStatus = useMemo(() => {
    const m: Record<string, number> = { ALL: projects.length }
    for (const p of projects) m[p.status] = (m[p.status] ?? 0) + 1
    return m
  }, [projects])

  return (
    <section>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <LayoutGrid className="h-3 w-3" />
            Projects
          </div>
          <h2 className="mt-1 text-lg font-bold text-slate-900">Active collaborations</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Open a project to review its geometry in 3D and resolve open comments.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-primary to-primary-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
          New project
        </button>
      </header>

      {/* Filter pills */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {STATUS_FILTERS.map((f) => {
          const active = filter === f.id
          const count = countByStatus[f.id] ?? 0
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={[
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition',
                active
                  ? 'border-primary bg-primary text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
              ].join(' ')}
            >
              {f.label}
              <span
                className={[
                  'rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600',
                ].join(' ')}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <LayoutGrid className="mx-auto h-7 w-7 text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-700">
            No projects in this view
          </p>
          <p className="mt-0.5 text-xs text-slate-500">Try another filter.</p>
        </div>
      ) : (
        <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, idx) => (
            <li
              key={p.id}
              className="dv-anim-fade-up"
              style={{ animationDelay: `${idx * 70}ms` }}
            >
              <ProjectCard project={p} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
