'use client'

import { Trash2 } from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import Dropdown from '@/components/ui/Dropdown'
import type { Member, Role } from '@/lib/mock-data'
import { formatRelative } from '@/lib/mock-data'

interface Props {
  member: Member
  isCurrentUser: boolean
  onRoleChange: (role: Role) => void
  onRemove: () => void
}

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MEMBER', label: 'Member' },
  { value: 'VIEWER', label: 'Viewer' },
] as const

export default function MemberRow({ member, isCurrentUser, onRoleChange, onRemove }: Props) {
  return (
    <tr className="border-b border-rule transition-colors hover:bg-rule-soft/50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={member.name} initials={member.initials} size="md" online={member.online} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">
              {member.name}
              {isCurrentUser && (
                <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                  You
                </span>
              )}
            </p>
            <p className="truncate text-xs text-ink-mute">{member.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <Dropdown
          value={member.role}
          onChange={(v) => onRoleChange(v as Role)}
          options={ROLE_OPTIONS}
          size="sm"
          className="w-28"
        />
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-mute">{formatRelative(member.joined)}</td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={onRemove}
          disabled={isCurrentUser}
          aria-label={`Remove ${member.name}`}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-ink-mute transition-colors hover:bg-state-rejected/10 hover:text-state-rejected disabled:cursor-not-allowed disabled:opacity-30 focus-ring"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  )
}
