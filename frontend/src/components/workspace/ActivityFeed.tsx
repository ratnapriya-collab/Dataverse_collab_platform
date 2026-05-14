'use client'

import Link from 'next/link'
import {
  CheckCircle2,
  MailPlus,
  MessageSquare,
  Upload,
  UserPlus,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import Avatar from './Avatar'
import { formatTimeAgo, type ActivityEntry, type ActivityKind } from '@/lib/mockWorkspace'

interface Props {
  entries: ActivityEntry[]
  /** Max items to show. Defaults to all. */
  limit?: number
}

interface Style {
  icon: LucideIcon
  iconColor: string
  iconBg: string
  verb: string
}

const STYLES: Record<ActivityKind, Style> = {
  PART_UPLOADED: {
    icon: Upload,
    iconColor: 'text-violet-600',
    iconBg: 'bg-violet-50',
    verb: 'uploaded',
  },
  COMMENT_CREATED: {
    icon: MessageSquare,
    iconColor: 'text-red-600',
    iconBg: 'bg-red-50',
    verb: 'commented on',
  },
  COMMENT_ACCEPTED: {
    icon: CheckCircle2,
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-50',
    verb: 'accepted a comment on',
  },
  COMMENT_REJECTED: {
    icon: XCircle,
    iconColor: 'text-slate-500',
    iconBg: 'bg-slate-100',
    verb: 'rejected a comment on',
  },
  MEMBER_JOINED: {
    icon: UserPlus,
    iconColor: 'text-primary',
    iconBg: 'bg-primary-50',
    verb: 'joined',
  },
  INVITE_CREATED: {
    icon: MailPlus,
    iconColor: 'text-brand',
    iconBg: 'bg-brand-50',
    verb: 'invited',
  },
}

export default function ActivityFeed({ entries, limit }: Props) {
  const items = limit !== undefined ? entries.slice(0, limit) : entries
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <h3 className="text-sm font-semibold text-slate-900">Recent activity</h3>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {entries.length} events
        </span>
      </header>

      <ul className="divide-y divide-slate-100">
        {items.map((entry) => {
          const s = STYLES[entry.kind]
          const Icon = s.icon
          const targetEl =
            entry.part_id !== undefined && entry.target !== undefined ? (
              <Link
                href={`/parts/${entry.part_id}`}
                className="font-semibold text-slate-900 hover:text-primary hover:underline"
              >
                {entry.target}
              </Link>
            ) : entry.target !== undefined ? (
              <span className="font-semibold text-slate-900">{entry.target}</span>
            ) : null

          return (
            <li key={entry.id} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50/60">
              <Avatar name={entry.actor_name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">{entry.actor_name}</span>{' '}
                  <span className="text-slate-500">{s.verb}</span>{' '}
                  {targetEl}
                </p>
                {entry.snippet !== undefined && (
                  <p className="mt-1 truncate text-xs italic text-slate-600">
                    “{entry.snippet}”
                  </p>
                )}
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Icon className={`h-3 w-3 ${s.iconColor}`} />
                  <span>{formatTimeAgo(entry.created_at)}</span>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <footer className="border-t border-slate-200 bg-slate-50/60 px-5 py-2.5 text-center">
        <button
          type="button"
          className="text-xs font-medium text-slate-500 hover:text-primary"
        >
          View full audit log
        </button>
      </footer>
    </div>
  )
}
