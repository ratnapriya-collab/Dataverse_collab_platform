'use client'

/**
 * WorkspaceSidebar — minimal left rail.
 *
 * The whole product hierarchy is: Workspace → Projects → Parts/Comments.
 * The sidebar reflects only the top of that tree:
 *
 *   1. Brand lockup
 *   2. Three nav items: Dashboard, Projects, Admin
 *   3. User card at bottom with sign-out menu
 *
 * Files, Inbox, Search, Workspace switcher and Pinned have all been pulled
 * out — they either belong inside Projects (Files), live globally already
 * (Cmd+K search), or aren't part of the MVP feature set (Inbox).
 */

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  Crown,
  FileCheck2,
  FolderKanban,
  History,
  Home,
  Inbox,
  LogOut,
  Network,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { HexMark } from '@/components/ui/Logo'
import Avatar from '@/components/workspace/Avatar'
import { SEED_PROJECTS, SEED_WORK_ITEMS } from '@/lib/mockWorkspace'
import type { UserRead } from '@/types/api'

export type SidebarSection =
  | 'dashboard'
  | 'my_work'
  | 'projects'
  | 'decisions'
  | 'audit'
  | 'admin'
  | 'architecture'

interface NavItem {
  id: SidebarSection
  label: string
  icon: LucideIcon
  href: string
  badge?: number
  iconAccent?: string
}

interface Props {
  user: UserRead
  current?: SidebarSection
  onSignOut: () => void
}

export default function WorkspaceSidebar({ user, current, onSignOut }: Props) {
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement | null>(null)

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

  const assignedToYou = SEED_WORK_ITEMS.filter((w) => w.tab === 'assigned').length

  const items: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, href: '/workspace' },
    {
      id: 'my_work',
      label: 'My Work',
      icon: Inbox,
      href: '/my-work',
      badge: assignedToYou > 0 ? assignedToYou : undefined,
    },
    {
      id: 'projects',
      label: 'Projects',
      icon: FolderKanban,
      href: '/workspace',
      badge: SEED_PROJECTS.length,
    },
    {
      id: 'decisions',
      label: 'Decisions',
      icon: FileCheck2,
      href: '/decisions',
    },
    {
      id: 'audit',
      label: 'Audit',
      icon: History,
      href: '/audit',
    },
    {
      id: 'admin',
      label: 'Admin',
      icon: Crown,
      href: '/admin',
      iconAccent: 'text-primary',
    },
    {
      id: 'architecture',
      label: 'Architecture',
      icon: Network,
      href: '/architecture',
    },
  ]

  return (
    <aside className="sticky top-0 flex h-screen w-[220px] shrink-0 flex-col border-r border-slate-200 bg-gradient-to-b from-white via-white to-slate-50/80 shadow-[1px_0_0_0_rgba(15,23,42,0.04)]">
      {/* ── Brand ──────────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200/80 px-4 py-4">
        <Link
          href="/workspace"
          className="group flex items-center gap-2.5 select-none transition"
        >
          <HexMark className="h-8 w-8 text-brand transition-transform duration-300 group-hover:rotate-[18deg]" />
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

      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-5">
        <ul className="space-y-1">
          {items.map((item) => {
            const active = current === item.id
            const Icon = item.icon
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200',
                    active
                      ? 'bg-gradient-to-r from-primary-50 via-primary-50 to-brand-50/60 font-semibold text-primary-700 shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900',
                  ].join(' ')}
                >
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute -left-3 bottom-1.5 top-1.5 w-1 rounded-r-full bg-gradient-to-b from-primary to-brand"
                    />
                  )}
                  <Icon
                    className={[
                      'h-[18px] w-[18px] shrink-0 transition-all duration-200',
                      active
                        ? 'scale-110 text-primary'
                        : item.iconAccent ??
                          'text-slate-400 group-hover:scale-110 group-hover:text-slate-700',
                    ].join(' ')}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={[
                        'rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums shadow-sm',
                        active
                          ? 'bg-primary text-white'
                          : 'bg-slate-100 text-slate-600 group-hover:bg-white group-hover:text-slate-800',
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
      </nav>

      {/* ── User card at bottom ────────────────────────────────────────── */}
      <div
        ref={userMenuRef}
        className="relative border-t border-slate-200/80 bg-gradient-to-b from-transparent to-slate-50/60 p-3"
      >
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
