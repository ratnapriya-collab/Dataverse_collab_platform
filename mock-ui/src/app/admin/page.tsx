'use client'

/**
 * /admin — Admin page with tabs: Members · Invites · Settings.
 */

import { useState } from 'react'
import { Copy, Plus, UserCog } from 'lucide-react'
import AppShell from '@/components/shell/AppShell'
import PageContainer from '@/components/shell/PageContainer'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Modal from '@/components/ui/Modal'
import Dropdown from '@/components/ui/Dropdown'
import { useToast } from '@/components/ui/Toast'
import MemberRow from '@/components/admin/MemberRow'
import InviteRow from '@/components/admin/InviteRow'
import {
  formatRelative,
  mockInvites,
  mockMembers,
  mockUser,
  type Invite,
  type Member,
  type Role,
} from '@/lib/mock-data'

type AdminTab = 'members' | 'invites' | 'settings'

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MEMBER', label: 'Member' },
  { value: 'VIEWER', label: 'Viewer' },
] as const

const EXPIRY_OPTIONS = [
  { value: '7d', label: '7 days' },
  { value: '14d', label: '14 days' },
  { value: '30d', label: '30 days' },
  { value: 'never', label: 'Never' },
] as const

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('members')
  const [members, setMembers] = useState<Member[]>(() => [...mockMembers])
  const [invites, setInvites] = useState<Invite[]>(() => [...mockInvites])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [workspaceName, setWorkspaceName] = useState(mockUser.workspace.name)
  const [workspaceDesc, setWorkspaceDesc] = useState(
    'F-Bracket program for aerospace structural components. OEM ↔ supplier ↔ stress review collaboration.',
  )
  const { toast } = useToast()

  function handleRoleChange(id: string, role: Role) {
    const m = members.find((x) => x.id === id)
    if (m === undefined) return
    setMembers((prev) => prev.map((x) => (x.id === id ? { ...x, role } : x)))
    toast(`${m.name.split(' ')[0]}'s role updated to ${role}`, { tone: 'success' })
  }
  function handleRemove(id: string) {
    const m = members.find((x) => x.id === id)
    setMembers((prev) => prev.filter((x) => x.id !== id))
    toast(`${m?.name.split(' ')[0] ?? 'Member'} removed`, { tone: 'success' })
  }
  function handleRevoke(id: string) {
    const inv = invites.find((x) => x.id === id)
    setInvites((prev) => prev.filter((x) => x.id !== id))
    toast(`Invite revoked`, { tone: 'success', description: inv?.email })
  }

  return (
    <AppShell>
      <PageContainer>
        <header className="mb-6 animate-fade-up">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <UserCog className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-ink">Admin</h1>
              <p className="text-sm text-ink-mute">
                Manage members, invites and workspace settings for <strong className="text-ink">{mockUser.workspace.name}</strong>.
              </p>
            </div>
          </div>

          <nav className="mt-5 flex gap-1 border-b border-rule">
            <TabBtn active={tab === 'members'} onClick={() => setTab('members')}>
              Members <Count>{members.length}</Count>
            </TabBtn>
            <TabBtn active={tab === 'invites'} onClick={() => setTab('invites')}>
              Invites <Count>{invites.length}</Count>
            </TabBtn>
            <TabBtn active={tab === 'settings'} onClick={() => setTab('settings')}>
              Settings
            </TabBtn>
          </nav>
        </header>

        {tab === 'members' && (
          <section className="overflow-hidden rounded-lg border border-rule bg-white shadow-card">
            <header className="flex items-center justify-between border-b border-rule px-4 py-3">
              <p className="text-xs font-semibold text-ink">All members</p>
              <p className="text-[10px] text-ink-mute">
                {members.filter((m) => m.online).length} online · {members.length} total
              </p>
            </header>
            <table className="w-full">
              <thead className="bg-rule-soft/60">
                <tr className="text-left">
                  <Th>Member</Th>
                  <Th>Role</Th>
                  <Th>Joined</Th>
                  <Th align="right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    isCurrentUser={m.id === mockUser.id}
                    onRoleChange={(r) => handleRoleChange(m.id, r)}
                    onRemove={() => handleRemove(m.id)}
                  />
                ))}
              </tbody>
            </table>
          </section>
        )}

        {tab === 'invites' && (
          <section>
            <div className="mb-4 flex justify-end">
              <Button onClick={() => setInviteOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Generate invite
              </Button>
            </div>
            <div className="overflow-hidden rounded-lg border border-rule bg-white shadow-card">
              <header className="flex items-center justify-between border-b border-rule px-4 py-3">
                <p className="text-xs font-semibold text-ink">Pending invites</p>
                <p className="text-[10px] text-ink-mute">{invites.length} active</p>
              </header>
              {invites.length > 0 ? (
                <table className="w-full">
                  <thead className="bg-rule-soft/60">
                    <tr className="text-left">
                      <Th>Email</Th>
                      <Th>Role</Th>
                      <Th>Code</Th>
                      <Th>Expires</Th>
                      <Th align="right">Action</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {invites.map((inv) => (
                      <InviteRow
                        key={inv.id}
                        invite={inv}
                        onCopy={() => toast('Invite code copied', { tone: 'success' })}
                        onRevoke={() => handleRevoke(inv.id)}
                      />
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-10 text-center">
                  <p className="text-sm font-medium text-ink">No pending invites</p>
                  <p className="mt-1 text-xs text-ink-mute">Generate one to add a teammate.</p>
                </div>
              )}
            </div>
          </section>
        )}

        {tab === 'settings' && (
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-lg border border-rule bg-white p-6 shadow-card">
              <h2 className="text-sm font-bold text-ink">Workspace</h2>
              <p className="mt-0.5 text-xs text-ink-mute">Visible to all members.</p>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink">Name</label>
                  <Input
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    placeholder="e.g. F-Bracket Program"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink">Description</label>
                  <Textarea
                    value={workspaceDesc}
                    onChange={(e) => setWorkspaceDesc(e.target.value)}
                    rows={3}
                  />
                </div>
                <Button onClick={() => toast('Workspace settings saved', { tone: 'success' })}>
                  Save changes
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-rule bg-white p-6 shadow-card">
              <h2 className="text-sm font-bold text-ink">Details</h2>
              <dl className="mt-4 divide-y divide-rule text-xs">
                <Row label="Slug">
                  <code className="font-mono text-ink">{mockUser.workspace.slug}</code>
                </Row>
                <Row label="Members">
                  <strong className="text-ink">{members.length}</strong>
                </Row>
                <Row label="Created">
                  <span className="text-ink-soft">{formatRelative('2026-01-04T10:00:00Z')}</span>
                </Row>
                <Row label="Region">
                  <span className="text-ink-soft">us-east-1</span>
                </Row>
                <Row label="Plan">
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                    Enterprise
                  </span>
                </Row>
              </dl>
            </div>
          </section>
        )}
      </PageContainer>

      <GenerateInviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onCreate={(email, role) => {
          const code = `DV-${rand4()}-${rand4()}`
          const newInv: Invite = {
            id: `inv-${Date.now()}`,
            code,
            email,
            role,
            expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
            createdBy: mockUser.name,
          }
          setInvites((prev) => [newInv, ...prev])
          toast('Invite generated', { tone: 'success', description: code })
        }}
      />
    </AppShell>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-colors focus-ring ${
        active ? 'text-accent' : 'text-ink-mute hover:text-ink'
      }`}
    >
      {children}
      {active && (
        <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" aria-hidden="true" />
      )}
    </button>
  )
}

function Count({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-rule-soft px-1.5 py-0.5 font-bold tabular-nums text-[9px] text-ink-soft">
      {children}
    </span>
  )
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-ink-mute ${align === 'right' ? 'text-right' : ''}`}>
      {children}
    </th>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-ink-mute">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function GenerateInviteModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (email: string, role: Role) => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('MEMBER')
  const [expiry, setExpiry] = useState<'7d' | '14d' | '30d' | 'never'>('14d')
  const [generated, setGenerated] = useState<string | null>(null)

  function generate() {
    const trimmed = email.trim()
    if (trimmed.length === 0) return
    const code = `DV-${rand4()}-${rand4()}`
    setGenerated(code)
    onCreate(trimmed, role)
  }

  function reset() {
    setEmail('')
    setRole('MEMBER')
    setExpiry('14d')
    setGenerated(null)
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="Generate invite"
      subtitle="Share the code with your teammate to add them to the workspace."
      footer={
        generated === null ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={generate} disabled={email.trim().length === 0}>
              Generate
            </Button>
          </>
        ) : (
          <Button
            onClick={() => {
              reset()
              onClose()
            }}
          >
            Done
          </Button>
        )
      }
    >
      {generated === null ? (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@company.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">Role</label>
              <Dropdown value={role} onChange={(v) => setRole(v as Role)} options={ROLE_OPTIONS} className="w-full" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink">Expires in</label>
              <Dropdown
                value={expiry}
                onChange={(v) => setExpiry(v as typeof expiry)}
                options={EXPIRY_OPTIONS}
                className="w-full"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded border border-state-accepted/30 bg-state-accepted/5 p-4 text-center">
          <p className="text-xs font-semibold text-state-accepted">Invite generated</p>
          <code className="mt-3 inline-block rounded-md border border-state-accepted/30 bg-white px-4 py-2 font-mono text-base font-bold text-ink">
            {generated}
          </code>
          <button
            type="button"
            onClick={() => {
              if (typeof navigator !== 'undefined' && navigator.clipboard) {
                void navigator.clipboard.writeText(generated)
              }
            }}
            className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-state-accepted hover:underline"
          >
            <Copy className="h-3 w-3" />
            Copy to clipboard
          </button>
        </div>
      )}
    </Modal>
  )
}

function rand4(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}
