'use client'

import Link from 'next/link'
import { Shield, Users } from 'lucide-react'
import Avatar from './Avatar'
import TeamBadge from './TeamBadge'
import type { MockMember, WorkspaceRole } from '@/lib/mockWorkspace'

const ROLE_STYLES: Record<WorkspaceRole, string> = {
  ADMIN: 'bg-primary-50 text-primary-700',
  MEMBER: 'bg-slate-100 text-slate-700',
  VIEWER: 'bg-amber-50 text-amber-700',
}

interface Props {
  members: MockMember[]
  /** Mark these names as "online" for the green dot. */
  onlineNames?: Set<string>
}

export default function TeamCard({ members, onlineNames }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">Team</h3>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
          {members.length}
        </span>
      </header>

      <ul className="divide-y divide-slate-100">
        {members.map((m) => (
          <li
            key={m.id}
            className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50/60"
          >
            <Avatar name={m.name} size="sm" online={onlineNames?.has(m.name) ?? false} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-xs font-semibold text-slate-900">{m.name}</p>
                {m.is_you && (
                  <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[9px] font-bold text-brand-700">
                    YOU
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <TeamBadge team={m.team} size="xs" />
                <p className="truncate text-[11px] text-slate-500">{m.email}</p>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ROLE_STYLES[m.role]}`}
            >
              {m.role === 'ADMIN' && <Shield className="h-2.5 w-2.5" />}
              {m.role}
            </span>
          </li>
        ))}
      </ul>

      <footer className="border-t border-slate-200 bg-slate-50/60 px-5 py-2.5">
        <Link
          href="/admin"
          className="block text-center text-xs font-medium text-primary hover:text-primary-700"
        >
          Manage members →
        </Link>
      </footer>
    </div>
  )
}
