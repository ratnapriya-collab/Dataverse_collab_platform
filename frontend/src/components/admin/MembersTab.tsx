'use client'

import { useMemo, useState } from 'react'
import { Search, Shield, Trash2 } from 'lucide-react'
import Avatar from '@/components/workspace/Avatar'
import {
  canChangeRoleTo,
  canRemove,
  formatDate,
  formatTimeAgo,
  type MockMember,
  type WorkspaceRole,
} from '@/lib/mockWorkspace'
import ConfirmDialog from './ConfirmDialog'

const ROLE_ORDER: WorkspaceRole[] = ['ADMIN', 'MEMBER', 'VIEWER']

const ROLE_STYLES: Record<WorkspaceRole, { pill: string; text: string }> = {
  ADMIN: { pill: 'bg-primary-50 border-primary-200', text: 'text-primary-700' },
  MEMBER: { pill: 'bg-slate-100 border-slate-200', text: 'text-slate-700' },
  VIEWER: { pill: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
}

interface Props {
  members: MockMember[]
  onChangeRole: (memberId: string, role: WorkspaceRole) => void
  onRemove: (memberId: string) => void
  onError: (message: string) => void
}

export default function MembersTab({
  members,
  onChangeRole,
  onRemove,
  onError,
}: Props) {
  const [query, setQuery] = useState('')
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    member: MockMember
    to: WorkspaceRole
  } | null>(null)
  const [pendingRemove, setPendingRemove] = useState<MockMember | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length === 0) return members
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q),
    )
  }, [members, query])

  const onlineCount = useMemo(() => members.filter((m) => m.online).length, [members])

  function handleRoleSelect(member: MockMember, to: WorkspaceRole): void {
    const check = canChangeRoleTo(members, member.id, to)
    if (!check.ok) {
      onError(check.reason)
      return
    }
    setPendingRoleChange({ member, to })
  }

  function handleRemoveClick(member: MockMember): void {
    const check = canRemove(members, member.id)
    if (!check.ok) {
      onError(check.reason)
      return
    }
    setPendingRemove(member)
  }

  return (
    <>
      {/* Header with search */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Members</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {members.length} {members.length === 1 ? 'person has' : 'people have'} access
            ·{' '}
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {onlineCount} online
            </span>
          </p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, or role"
            className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-7 pr-3 text-xs shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <Search className="mx-auto h-7 w-7 text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-700">No members found</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Try a different name, email, or role.
          </p>
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2.5">Member</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Last active</th>
                <th className="px-4 py-2.5">Joined</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((m) => (
                <tr key={m.id} className="transition hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.name} size="md" online={m.online ?? false} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-slate-900">
                            {m.name}
                          </span>
                          {m.is_you && (
                            <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[9px] font-bold text-brand-700">
                              YOU
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-slate-500">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ROLE_STYLES[m.role].pill} ${ROLE_STYLES[m.role].text}`}
                      >
                        {m.role === 'ADMIN' && <Shield className="h-2.5 w-2.5" />}
                        {m.role}
                      </span>
                      <select
                        value={m.role}
                        onChange={(e) =>
                          handleRoleSelect(m, e.target.value as WorkspaceRole)
                        }
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 transition hover:border-slate-300 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        {ROLE_ORDER.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {m.online ? (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Online
                      </span>
                    ) : (
                      <span className="text-slate-500">
                        {formatTimeAgo(m.last_active_at)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {formatDate(m.joined_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemoveClick(m)}
                      disabled={m.is_you}
                      title={m.is_you ? "You can't remove yourself" : 'Remove from workspace'}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pendingRoleChange !== null && (
        <ConfirmDialog
          title="Change role?"
          description={
            <>
              Change <strong>{pendingRoleChange.member.name}</strong>'s role from{' '}
              <strong>{pendingRoleChange.member.role}</strong> to{' '}
              <strong>{pendingRoleChange.to}</strong>?
            </>
          }
          confirmLabel="Change role"
          confirmTone="primary"
          onConfirm={() => {
            onChangeRole(pendingRoleChange.member.id, pendingRoleChange.to)
            setPendingRoleChange(null)
          }}
          onCancel={() => setPendingRoleChange(null)}
        />
      )}

      {pendingRemove !== null && (
        <ConfirmDialog
          title="Remove member?"
          description={
            <>
              Remove <strong>{pendingRemove.name}</strong> from the workspace? They will
              immediately lose access to all parts, decisions, and audit history.
            </>
          }
          confirmLabel="Remove"
          confirmTone="danger"
          onConfirm={() => {
            onRemove(pendingRemove.id)
            setPendingRemove(null)
          }}
          onCancel={() => setPendingRemove(null)}
        />
      )}
    </>
  )
}
