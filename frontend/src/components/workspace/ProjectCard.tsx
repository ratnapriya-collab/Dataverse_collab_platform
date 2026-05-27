'use client'

import Link from 'next/link'
import { ArrowUpRight, Box, MessageCircle } from 'lucide-react'
import { AvatarStack } from './Avatar'
import ProjectThumbnail from './ProjectThumbnail'
import { formatTimeAgo, type MockProject, type ProjectStatus } from '@/lib/mockWorkspace'

interface Props {
  project: MockProject
}

const STATUS_STYLES: Record<ProjectStatus, { dot: string; pill: string; label: string }> = {
  ACTIVE: {
    dot: 'bg-emerald-500',
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    label: 'Active',
  },
  IN_REVIEW: {
    dot: 'bg-amber-500',
    pill: 'bg-amber-50 text-amber-700 border-amber-200',
    label: 'In review',
  },
  APPROVED: {
    dot: 'bg-primary-500',
    pill: 'bg-primary-50 text-primary-700 border-primary-200',
    label: 'Approved',
  },
  ARCHIVED: {
    dot: 'bg-slate-400',
    pill: 'bg-slate-100 text-slate-600 border-slate-200',
    label: 'Archived',
  },
}

export default function ProjectCard({ project }: Props) {
  const s = STATUS_STYLES[project.status]
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl"
    >
      <div className="relative">
        <ProjectThumbnail shape={project.shape} tone={project.tone} />

        {/* Status pill — top-left */}
        <div
          className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border bg-white/95 px-2 py-0.5 text-[10px] font-semibold shadow-sm backdrop-blur ${s.pill}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
          {s.label}
        </div>

        {/* Open comments badge — top-right */}
        {project.open_comments > 0 && (
          <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
            <MessageCircle className="h-2.5 w-2.5" />
            {project.open_comments}
          </div>
        )}

        {/* Hover affordance — bottom-right floating button */}
        <div className="pointer-events-none absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-slate-900 opacity-0 shadow-md transition group-hover:opacity-100">
          <ArrowUpRight className="h-4 w-4" />
        </div>
      </div>

      <div className="px-4 py-3.5">
        <h3 className="truncate text-sm font-semibold text-slate-900 group-hover:text-primary">
          {project.name}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
          {project.description}
        </p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 text-[11px] text-slate-600">
            <span className="inline-flex items-center gap-1">
              <Box className="h-3 w-3 text-slate-400" />
              {project.parts_count}{' '}
              <span className="text-slate-400">
                {project.parts_count === 1 ? 'part' : 'parts'}
              </span>
            </span>
            <span className="text-slate-200">·</span>
            <AvatarStack names={project.member_names} size="sm" max={3} />
          </div>
          <span className="shrink-0 text-[11px] text-slate-400">
            {formatTimeAgo(project.last_activity_at)}
          </span>
        </div>
      </div>

    </Link>
  )
}
