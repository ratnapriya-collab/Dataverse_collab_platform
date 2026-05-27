'use client'

/**
 * ProjectHubHero — the rich header card on /projects/[id].
 *
 * Pairs a project thumbnail (left) with project metadata + actions (right):
 *   • title · description · status pill
 *   • parts / open-comments / members stat strip
 *   • avatar stack + Invite button
 *   • Upload-part + share / settings buttons
 *
 * No data fetching here — purely presentational. The parent page owns the
 * project + members + handlers and passes them in.
 */

import { Plus, Settings, Share2, UserPlus } from 'lucide-react'
import { AvatarStack } from '@/components/workspace/Avatar'
import ProjectThumbnail from '@/components/workspace/ProjectThumbnail'
import type { MockProject, ProjectStatus } from '@/lib/mockWorkspace'

const STATUS_STYLES: Record<
  ProjectStatus,
  { dot: string; bg: string; fg: string; ring: string; label: string }
> = {
  ACTIVE: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', fg: 'text-emerald-700', ring: 'ring-emerald-200', label: 'Active' },
  IN_REVIEW: { dot: 'bg-amber-500', bg: 'bg-amber-50', fg: 'text-amber-700', ring: 'ring-amber-200', label: 'In review' },
  APPROVED: { dot: 'bg-primary-500', bg: 'bg-primary-50', fg: 'text-primary-700', ring: 'ring-primary-200', label: 'Approved' },
  ARCHIVED: { dot: 'bg-slate-400', bg: 'bg-slate-100', fg: 'text-slate-700', ring: 'ring-slate-200', label: 'Archived' },
}

interface Props {
  project: MockProject
  memberCount: number
  /** Called when the user clicks the primary CTA (e.g. "Upload part"). */
  onUploadPart?: () => void
  onInvite?: () => void
  onShare?: () => void
  onSettings?: () => void
}

export default function ProjectHubHero({
  project,
  memberCount,
  onUploadPart,
  onInvite,
  onShare,
  onSettings,
}: Props): JSX.Element {
  const status = STATUS_STYLES[project.status]
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)]">
        {/* Left — thumbnail */}
        <div className="relative">
          <ProjectThumbnail
            shape={project.shape}
            tone={project.tone}
            aspectClass="aspect-[4/3] md:aspect-auto md:h-full"
          />
          <div className="absolute left-3 top-3">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${status.bg} ${status.fg} ${status.ring}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden="true" />
              {status.label}
            </span>
          </div>
        </div>

        {/* Right — content */}
        <div className="flex flex-col gap-4 p-5">
          {/* Title + actions row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Project
              </p>
              <h1 className="mt-0.5 truncate text-xl font-bold tracking-tight text-slate-900">
                {project.name}
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
                {project.description}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <IconBtn label="Share" onClick={onShare}>
                <Share2 className="h-3.5 w-3.5" />
              </IconBtn>
              <IconBtn label="Settings" onClick={onSettings}>
                <Settings className="h-3.5 w-3.5" />
              </IconBtn>
            </div>
          </div>

          {/* Stat strip */}
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Parts" value={project.parts_count} />
            <Stat
              label="Open comments"
              value={project.open_comments}
              accent={project.open_comments > 0 ? 'text-rose-600' : undefined}
            />
            <Stat label="Members" value={memberCount} />
          </div>

          {/* Members + CTAs */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <div className="flex items-center gap-3">
              <AvatarStack names={project.member_names} size="sm" max={5} />
              <span className="text-[11px] text-slate-500">
                {project.member_names.length}{' '}
                {project.member_names.length === 1 ? 'collaborator' : 'collaborators'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onInvite}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-primary hover:bg-primary-50 hover:text-primary"
              >
                <UserPlus className="h-3 w-3" />
                Invite
              </button>
              <button
                type="button"
                onClick={onUploadPart}
                className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-primary to-primary-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:shadow-md"
              >
                <Plus className="h-3 w-3" />
                Upload part
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── helpers ─────────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent?: string
}): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p
        className={`mt-0.5 text-xl font-bold tabular-nums leading-none ${
          accent ?? 'text-slate-900'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string
  onClick?: () => void
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-primary hover:bg-primary-50 hover:text-primary"
    >
      {children}
    </button>
  )
}
