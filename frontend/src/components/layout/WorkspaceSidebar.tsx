'use client'

/**
 * WorkspaceSidebar — premium left rail for all main app pages.
 *
 * Sections (top → bottom):
 *   1. Brand lockup (DV hex + DATAVERS.AI wordmark + tagline)
 *   2. Workspace switcher (mock)
 *   3. Cmd+K search trigger
 *   4. Main nav  — Dashboard / Projects / Inbox / Activity
 *   5. Workspace nav — Files / Members / Admin
 *   6. Pinned projects (top 3 status-dotted)
 *   7. User card with sign-out menu
 *
 * Active state is driven by an explicit `current` prop, not the URL —
 * keeps highlight logic predictable when multiple items share an href.
 */

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  ChevronDown,
  Crown,
  Files,
  FolderKanban,
  Home,
  Inbox,
  LogOut,
  Search,
  Settings,
  Star,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { HexMark } from '@/components/ui/Logo'
import Avatar from '@/components/workspace/Avatar'
import { openCommandPalette } from './CommandPalette'
import {
  SEED_NOTIFICATIONS,
  SEED_PROJECTS,
  SEED_WORKSPACE,
  type ProjectStatus,
} from '@/lib/mockWorkspace'
import type { UserRead } from '@/types/api'

export type SidebarSection =
  | 'dashboard'
  | 'projects'
  | 'inbox'
  | 'activity'
  | 'files'
  | 'members'
  | 'admin'

interface NavItem {
  id: SidebarSection
  label: string
  icon: LucideIcon
  href: string
  badge?: number
  iconAccent?: string
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const STATUS_DOT: Record<ProjectStatus, string> = {
  ACTIVE: 'bg-emerald-500',
  IN_REVIEW: 'bg-amber-500',
  APPROVED: 'bg-primary-500',
  ARCHIVED: 'bg-slate-400',
}

interface Props {
  user: UserRead
  /** Which nav item should be highlighted as active. */
  current?: SidebarSection
  onSignOut: () => void
}

export default function WorkspaceSidebar({ user, current, onSignOut }: Props) {
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement | null>(null)

  // Close user menu on outside click + ESC.
  useEffect(() => {
    if (!userMenuOpen) return
    const onMouseDown = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUserMenuOpen(false)
    }
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [userMenuOpen])

  const unreadCount = SEED_NOTIFICATIONS.filter((n) => n.unread).length
  const pinned = SEED_PROJECTS.filter((p) => p.status !== 'ARCHIVED').slice(0, 4)

  const groups: NavGroup[] = [
    {
      title: 'Main',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: Home, href: '/workspace' },
        {
          id: 'projects',
          label: 'Projects',
          icon: FolderKanban,
          href: '/workspace',
          badge: SEED_PROJECTS.length,
        },
        {
          id: 'inbox',
          label: 'Inbox',
          icon: Inbox,
          href: '/workspace',
          badge: unreadCount > 0 ? unreadCount : undefined,
        },
        { id: 'activity', label: 'Activity', icon: Activity, href: '/workspace' },
      ],
    },
    {
      title: 'Workspace',
      items: [
        { id: 'files', label: 'Files', icon: Files, href: '/home' },
        { id: 'members', label: 'Members', icon: Users, href: '/admin' },
        {
          id: 'admin',
          label: 'Admin',
          icon: Crown,
          href: '/admin',
          iconAccent: 'text-primary',
        },
      ],
    },
  ]

  return (
    <aside className="sticky top-0 flex h-screen w-[268px] shrink-0 flex-col border-r border-slate-200 bg-white">
      {/* ── Brand ──────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 px-4 py-3.5">
        <Link href="/workspace" className="flex items-center gap-2.5 select-none">
          <HexMark className="h-8 w-8 text-brand" />
          <div className="flex flex-col leading-none">
            <span className="text-sm font-black tracking-tight text-slate-900">
              DATAVERS<span className="text-brand">.AI</span>
            </span>
            <span className="mt-0.5 text-[8px] font-semibold tracking-[0.2em] text-brand">
              ENGINEERING INTELLIGENCE
            </span>
          </div>
        </Link>
      </div>

      {/* ── Workspace switcher + Cmd+K ────────────────────────────────── */}
      <div className="space-y-2 border-b border-slate-200 p-3">
        <button
          type="button"
          className="group flex w-full items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left transition hover:border-slate-300 hover:bg-slate-100"
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gradient-to-br from-primary to-brand text-[10px] font-bold text-white">
            DD
          </div>
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-900">
            {SEED_WORKSPACE.name}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-slate-600" />
        </button>

        <button
          type="button"
          onClick={() => openCommandPalette()}
          className="flex w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Quick search…</span>
          <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono text-[9px] text-slate-500">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* ── Nav groups + pinned ────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3">
        {groups.map((group) => (
          <div key={group.title} className="px-3 pb-4">
            <p className="px-2 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = current === item.id
                const Icon = item.icon
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={[
                        'group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition duration-150',
                        active
                          ? 'bg-primary-50 font-semibold text-primary-700'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                      ].join(' ')}
                    >
                      {active && (
                        <span
                          aria-hidden="true"
                          className="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-r bg-primary"
                        />
                      )}
                      <Icon
                        className={[
                          'h-4 w-4 shrink-0 transition-transform group-hover:scale-110',
                          active
                            ? 'text-primary'
                            : item.iconAccent ?? 'text-slate-400 group-hover:text-slate-600',
                        ].join(' ')}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span
                          className={[
                            'rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums',
                            active
                              ? 'bg-primary text-white'
                              : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200',
                          ].join(' ')}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}

        {/* Pinned projects */}
        <div className="px-3 pb-4">
          <div className="flex items-center justify-between px-2 pb-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Pinned
            </p>
            <Star className="h-2.5 w-2.5 text-slate-300" />
          </div>
          <ul className="space-y-0.5">
            {pinned.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  title={p.name}
                  className="group flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition hover:bg-slate-50"
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ring-2 ring-white ${STATUS_DOT[p.status]}`}
                  />
                  <span className="flex-1 truncate text-slate-600 group-hover:text-slate-900">
                    {p.name}
                  </span>
                  {p.open_comments > 0 && (
                    <span className="text-[9px] font-bold text-red-600">
                      {p.open_comments}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* ── User card at bottom ────────────────────────────────────────── */}
      <div ref={userMenuRef} className="relative border-t border-slate-200 p-3">
        <button
          type="button"
          onClick={() => setUserMenuOpen((o) => !o)}
          aria-expanded={userMenuOpen}
          className="flex w-full items-center gap-2.5 rounded-md p-2 text-left transition hover:bg-slate-50"
        >
          <Avatar name={user.name} size="md" online />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-900">{user.name}</p>
            <p className="truncate text-[10px] text-slate-500">{user.email}</p>
          </div>
          <ChevronDown
            className={`h-3 w-3 shrink-0 text-slate-400 transition-transform ${
              userMenuOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {userMenuOpen && (
          <div
            className="dv-anim-pop absolute inset-x-3 bottom-full mb-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
            role="menu"
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 transition hover:bg-slate-50"
            >
              <Settings className="h-3.5 w-3.5 text-slate-400" />
              Profile settings
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={onSignOut}
              className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
