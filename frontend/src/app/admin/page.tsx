'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Building2,
  ChevronRight,
  Crown,
  FileClock,
  Lock,
  MailPlus,
  Settings,
  Shield,
  UserCheck,
  Users,
} from 'lucide-react'
import Toast, { type ToastState } from '@/components/ui/Toast'
import NotificationsBell from '@/components/layout/NotificationsBell'
import WorkspaceSidebar from '@/components/layout/WorkspaceSidebar'
import MembersTab from '@/components/admin/MembersTab'
import InvitesTab from '@/components/admin/InvitesTab'
import SettingsTab from '@/components/admin/SettingsTab'
import StatCard from '@/components/workspace/StatCard'
import { ApiError, api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import {
  SEED_INVITES,
  SEED_MEMBERS,
  SEED_WORKSPACE,
  formatDate,
  type MockInvite,
  type MockMember,
  type MockWorkspace,
  type WorkspaceRole,
  withCurrentUser,
} from '@/lib/mockWorkspace'
import type { UserRead } from '@/types/api'

type Tab = 'members' | 'invites' | 'settings'

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserRead | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('members')

  // Mock state — refresh resets everything.
  const [workspace, setWorkspace] = useState<MockWorkspace>(SEED_WORKSPACE)
  const [members, setMembers] = useState<MockMember[]>(SEED_MEMBERS)
  const [invites, setInvites] = useState<MockInvite[]>(SEED_INVITES)
  const [toast, setToast] = useState<ToastState | null>(null)

  // Fetch the signed-in user once so we can show them as "You" in the members
  // list. Server-side auth gate is still real; the workspace/role is mocked.
  useEffect(() => {
    let cancelled = false
    api.auth
      .me()
      .then((u) => {
        if (cancelled) return
        setUser(u)
        setMembers((prev) => withCurrentUser(prev, u.name, u.email))
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          clearToken()
          router.replace('/login')
          return
        }
        setError(err instanceof Error ? err.message : 'Failed to load')
      })
    return () => {
      cancelled = true
    }
  }, [router])

  const showToast = useCallback((message: string, tone: ToastState['tone'] = 'success') => {
    setToast({ message, tone })
  }, [])

  const handleChangeRole = useCallback(
    (memberId: string, role: WorkspaceRole) => {
      setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role } : m)))
      const member = members.find((m) => m.id === memberId)
      showToast(`${member?.name ?? 'Member'} is now ${role}`, 'success')
    },
    [members, showToast],
  )

  const handleRemove = useCallback(
    (memberId: string) => {
      const member = members.find((m) => m.id === memberId)
      setMembers((prev) => prev.filter((m) => m.id !== memberId))
      showToast(`${member?.name ?? 'Member'} removed from workspace`, 'success')
    },
    [members, showToast],
  )

  const handleCreateInvite = useCallback(
    (invite: MockInvite) => {
      setInvites((prev) => [invite, ...prev])
      showToast('Invite generated', 'success')
    },
    [showToast],
  )

  const handleRevokeInvite = useCallback(
    (inviteId: string) => {
      setInvites((prev) => prev.filter((i) => i.id !== inviteId))
      showToast('Invite revoked', 'success')
    },
    [showToast],
  )

  const handleSaveSettings = useCallback(
    (next: { name: string; description: string }) => {
      setWorkspace((prev) => ({ ...prev, name: next.name, description: next.description }))
      showToast('Workspace updated', 'success')
    },
    [showToast],
  )

  function handleSignOut(): void {
    clearToken()
    router.replace('/login')
  }

  const youName = useMemo(() => user?.name ?? 'You', [user])

  const TABS: { id: Tab; label: string; icon: typeof Users; badge?: number }[] = useMemo(
    () => [
      { id: 'members', label: 'Members', icon: Users, badge: members.length },
      {
        id: 'invites',
        label: 'Invites',
        icon: MailPlus,
        badge: invites.filter((i) => !i.used).length,
      },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
    [members.length, invites],
  )

  if (error !== null) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      </main>
    )
  }

  if (user === null) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-500">
        <span className="text-sm">Loading…</span>
      </main>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <WorkspaceSidebar user={user} current="admin" onSignOut={handleSignOut} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Toast toast={toast} onClose={() => setToast(null)} />

        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/85 px-6 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Crown className="h-3 w-3 text-primary" />
            <span className="font-semibold uppercase tracking-wider text-slate-400">
              Workspace
            </span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-900">Admin</span>
          </div>
          <NotificationsBell />
        </header>

      <section className="mx-auto w-full max-w-6xl px-6 py-8">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-primary-900 p-6 text-white shadow-lg">
          <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-brand opacity-25 blur-3xl" />
          <div className="pointer-events-none absolute -left-10 -bottom-10 h-60 w-60 rounded-full bg-primary opacity-30 blur-3xl" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />
          <div className="relative z-10 flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm ring-1 ring-white/20">
              <Building2 className="h-7 w-7 text-brand-300" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-200">
                <Shield className="h-3 w-3" />
                Admin · workspace settings
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">{workspace.name}</h1>
              <p className="mt-1 text-sm leading-relaxed text-white/70">
                {workspace.description}
              </p>
              <p className="mt-2 text-[11px] text-white/40">
                <span className="font-mono">{workspace.slug}</span> · created{' '}
                {formatDate(workspace.created_at)}
              </p>
            </div>
          </div>
        </div>

        {/* ── Stat tiles ───────────────────────────────────────────────── */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Users}
            label="Members"
            value={members.length}
            hint={`${members.filter((m) => m.role === 'ADMIN').length} admin${members.filter((m) => m.role === 'ADMIN').length === 1 ? '' : 's'}`}
            accent="text-primary"
            accentBg="bg-primary-50"
          />
          <StatCard
            icon={Shield}
            label="Admins"
            value={members.filter((m) => m.role === 'ADMIN').length}
            hint="can manage workspace"
            accent="text-primary-700"
            accentBg="bg-primary-100"
          />
          <StatCard
            icon={UserCheck}
            label="Viewers"
            value={members.filter((m) => m.role === 'VIEWER').length}
            hint="read-only access"
            accent="text-amber-600"
            accentBg="bg-amber-50"
          />
          <StatCard
            icon={MailPlus}
            label="Pending invites"
            value={invites.filter((i) => !i.used).length}
            hint={`${invites.filter((i) => i.used).length} redeemed`}
            accent="text-brand-700"
            accentBg="bg-brand-50"
          />
        </div>

        {/* ── Side-rail nav + tab content ────────────────────────────────── */}
        <div className="mt-8 grid gap-6 md:grid-cols-[220px_1fr]">
          <aside>
            <nav className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <ul className="py-1.5" aria-label="Admin sections">
                {TABS.map(({ id, label, icon: Icon, badge }) => {
                  const active = activeTab === id
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => setActiveTab(id)}
                        aria-current={active ? 'page' : undefined}
                        className={[
                          'group relative flex w-full items-center gap-2.5 px-4 py-2 text-sm font-medium transition',
                          active
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                        ].join(' ')}
                      >
                        {active && (
                          <span className="absolute left-0 top-0 h-full w-0.5 bg-primary" />
                        )}
                        <Icon
                          className={`h-4 w-4 ${active ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600'}`}
                        />
                        <span className="flex-1 text-left">{label}</span>
                        {badge !== undefined && badge > 0 && (
                          <span
                            className={[
                              'rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                              active
                                ? 'bg-primary text-white'
                                : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200',
                            ].join(' ')}
                          >
                            {badge}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
              <div className="border-t border-slate-100 py-1.5">
                {[
                  { label: 'Activity log', icon: Activity },
                  { label: 'Audit history', icon: FileClock },
                ].map(({ label, icon: Icon }) => (
                  <button
                    key={label}
                    type="button"
                    disabled
                    title="Coming soon"
                    className="flex w-full cursor-not-allowed items-center gap-2.5 px-4 py-2 text-sm text-slate-400"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1 text-left">{label}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                      <Lock className="h-2 w-2" />
                      Soon
                    </span>
                  </button>
                ))}
              </div>
            </nav>

            <div className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Need help?
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Read the admin guide or contact support — both placeholders for the demo.
              </p>
              <button
                type="button"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-700"
              >
                Open docs <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </aside>

          <div className="min-w-0">
            {activeTab === 'members' && (
              <MembersTab
                members={members}
                onChangeRole={handleChangeRole}
                onRemove={handleRemove}
                onError={(msg) => showToast(msg, 'error')}
              />
            )}
            {activeTab === 'invites' && (
              <InvitesTab
                invites={invites}
                invitedByName={youName}
                onCreate={handleCreateInvite}
                onRevoke={handleRevokeInvite}
                onInfo={(msg) => showToast(msg, 'info')}
              />
            )}
            {activeTab === 'settings' && (
              <SettingsTab
                workspace={workspace}
                memberCount={members.length}
                onSave={handleSaveSettings}
                onInfo={(msg) => showToast(msg, 'info')}
              />
            )}
          </div>
        </div>

      </section>
      </div>
    </div>
  )
}
