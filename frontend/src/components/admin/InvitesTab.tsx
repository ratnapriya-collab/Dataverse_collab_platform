'use client'

import { useMemo, useState } from 'react'
import { Copy, Mail, Plus, Trash2 } from 'lucide-react'
import {
  formatRelative,
  type MockInvite,
  type WorkspaceRole,
} from '@/lib/mockWorkspace'
import ConfirmDialog from './ConfirmDialog'
import GenerateInviteModal from './GenerateInviteModal'

const ROLE_STYLES: Record<WorkspaceRole, string> = {
  ADMIN: 'bg-primary-50 text-primary-700 border-primary-200',
  MEMBER: 'bg-slate-100 text-slate-700 border-slate-200',
  VIEWER: 'bg-amber-50 text-amber-700 border-amber-200',
}

type Filter = 'ALL' | 'PENDING' | 'REDEEMED'

interface Props {
  invites: MockInvite[]
  invitedByName: string
  onCreate: (invite: MockInvite) => void
  onRevoke: (inviteId: string) => void
  onInfo: (message: string) => void
}

export default function InvitesTab({
  invites,
  invitedByName,
  onCreate,
  onRevoke,
  onInfo,
}: Props) {
  const [showModal, setShowModal] = useState(false)
  const [pendingRevoke, setPendingRevoke] = useState<MockInvite | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('ALL')

  async function copyCode(invite: MockInvite): Promise<void> {
    try {
      await navigator.clipboard.writeText(invite.code)
      setCopiedId(invite.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      onInfo('Could not copy — select the code and copy manually.')
    }
  }

  const pendingCount = useMemo(() => invites.filter((i) => !i.used).length, [invites])
  const redeemedCount = useMemo(() => invites.filter((i) => i.used).length, [invites])

  const filtered = useMemo(() => {
    if (filter === 'PENDING') return invites.filter((i) => !i.used)
    if (filter === 'REDEEMED') return invites.filter((i) => i.used)
    return invites
  }, [invites, filter])

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: 'ALL', label: 'All', count: invites.length },
    { id: 'PENDING', label: 'Pending', count: pendingCount },
    { id: 'REDEEMED', label: 'Redeemed', count: redeemedCount },
  ]

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Invites</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Single-use codes. Each invite expires automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-primary to-primary-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
          Generate invite
        </button>
      </div>

      {/* Filter pills */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        {filters.map((f) => {
          const active = filter === f.id
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
                {f.count}
              </span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <Mail className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-700">
            {filter === 'ALL'
              ? 'No invites yet'
              : filter === 'PENDING'
                ? 'No pending invites'
                : 'No invites have been redeemed'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {filter === 'ALL'
              ? 'Generate a code to share with someone outside the workspace.'
              : 'Try changing the filter or generate a new invite.'}
          </p>
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2.5">Code</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Invited</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((inv) => (
                <tr
                  key={inv.id}
                  className={`transition hover:bg-slate-50/60 ${inv.used ? 'opacity-75' : ''}`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">
                    {inv.code.slice(0, 8)}…{inv.code.slice(-6)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ROLE_STYLES[inv.role]}`}
                    >
                      {inv.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="text-slate-700">
                      {inv.invited_email ?? <em className="text-slate-400">No email</em>}
                    </div>
                    <div className="text-slate-400">by {inv.invited_by_name}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {inv.used ? (
                      <div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Redeemed
                        </span>
                        {inv.used_by_name && (
                          <div className="mt-0.5 text-[11px] text-slate-500">
                            by {inv.used_by_name}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          Pending
                        </span>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          expires {formatRelative(inv.expires_at)}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {!inv.used && (
                        <>
                          <button
                            type="button"
                            onClick={() => void copyCode(inv)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            {copiedId === inv.id ? 'Copied' : 'Copy'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingRevoke(inv)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 transition hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Revoke
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <GenerateInviteModal
          invitedByName={invitedByName}
          onClose={() => setShowModal(false)}
          onCreated={onCreate}
        />
      )}

      {pendingRevoke !== null && (
        <ConfirmDialog
          title="Revoke invite?"
          description={
            <>
              The invite code{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
                {pendingRevoke.code.slice(0, 8)}…{pendingRevoke.code.slice(-6)}
              </code>{' '}
              will stop working immediately.
            </>
          }
          confirmLabel="Revoke"
          confirmTone="danger"
          onConfirm={() => {
            onRevoke(pendingRevoke.id)
            setPendingRevoke(null)
          }}
          onCancel={() => setPendingRevoke(null)}
        />
      )}
    </>
  )
}
