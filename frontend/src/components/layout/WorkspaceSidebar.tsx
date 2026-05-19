'use client'

/**
 * WorkspaceSidebar — Slingshot-style left rail.
 *
 * Top → bottom:
 *   1. Hamburger + brand (brand hidden when collapsed)
 *   2. Create dropdown · Search
 *   3. Primary nav: My Overview · My Tasks · Shared with Me · My Analytics · My Pins · My Cloud Storage · More...
 *   4. Workspaces / Bookmarks tab toggle
 *   5. Workspaces panel — collapsible, shows current workspace + its projects
 *   6. User card with sign-out menu
 *
 * The rail folds from 220px to 60px (icon-only).
 */

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  Activity,
  BarChart3,
  Bookmark,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Cloud,
  Crown,
  FileCheck2,
  History,
  Layers,
  LogOut,
  Menu,
  MoreHorizontal,
  Pin,
  Plus,
  Search,
  Settings,
  UserCheck,
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
  | 'pins'
  | 'storage'

interface NavItem {
  id: SidebarSection
  label: string
  icon: LucideIcon
  href: string
  badge?: number
}

interface Props {
  user: UserRead
  current?: SidebarSection
  onSignOut: () => void
}

const TONE_DOT: Record<string, string> = {
  cyan: 'bg-cyan-500',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
  rose: 'bg-rose-500',
  violet: 'bg-violet-500',
  slate: 'bg-slate-500',
  sky: 'bg-sky-500',
}

export default function WorkspaceSidebar({ user, current, onSignOut }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [workspaceOpen, setWorkspaceOpen] = useState(true)
  const [tab, setTab] = useState<'workspaces' | 'bookmarks'>('workspaces')

  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const createRef = useRef<HTMLDivElement | null>(null)
  const moreRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUserMenuOpen(false)
        setCreateOpen(false)
        setMoreOpen(false)
      }
    }
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (userMenuRef.current && !userMenuRef.current.contains(t)) setUserMenuOpen(false)
      if (createRef.current && !createRef.current.contains(t)) setCreateOpen(false)
      if (moreRef.current && !moreRef.current.contains(t)) setMoreOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onMouseDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onMouseDown)
    }
  }, [])

  const assignedToYou = SEED_WORK_ITEMS.filter((w) => w.tab === 'assigned').length

  const items: NavItem[] = [
    { id: 'dashboard', label: 'My Overview', icon: Activity, href: '/workspace' },
    {
      id: 'my_work',
      label: 'My Tasks',
      icon: ClipboardCheck,
      href: '/my-work',
      badge: assignedToYou > 0 ? assignedToYou : undefined,
    },
    { id: 'decisions', label: 'Shared with Me', icon: UserCheck, href: '/decisions' },
    { id: 'audit', label: 'My Analytics', icon: BarChart3, href: '/audit' },
    { id: 'pins', label: 'My Pins', icon: Pin, href: '/workspace' },
    { id: 'storage', label: 'My Cloud Storage', icon: Cloud, href: '/workspace' },
  ]

  const workspaceProjects = SEED_PROJECTS.slice(0, 4)

  return (
    <aside
      style={{ width: collapsed ? 60 : 220 }}
      className="sticky top-0 flex h-screen shrink-0 flex-col border-r border-slate-200 bg-gradient-to-b from-white via-white to-slate-50/80 shadow-[1px_0_0_0_rgba(15,23,42,0.04)] transition-[width] duration-200"
    >
      {/* ── Hamburger + Brand ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 px-3 py-3.5">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <Menu className="h-4 w-4" />
        </button>
        {!collapsed && (
          <Link href="/workspace" className="group flex min-w-0 items-center gap-2 select-none">
            <HexMark className="h-7 w-7 shrink-0 text-brand transition-transform duration-300 group-hover:rotate-[18deg]" />
            <div className="flex min-w-0 flex-col leading-none">
              <span className="truncate text-[13px] font-black tracking-tight text-slate-900">
                DATAVERS<span className="text-brand">.AI</span>
              </span>
              <span className="mt-0.5 truncate text-[7px] font-semibold tracking-[0.2em] text-brand">
                ENGINEERING INTELLIGENCE
              </span>
            </div>
          </Link>
        )}
      </div>

      {/* ── Create + Search ────────────────────────────────────────────── */}
      <div className="space-y-1 border-b border-slate-100 px-2.5 py-2.5">
        <div ref={createRef} className="relative">
          <button
            type="button"
            onClick={() => setCreateOpen((o) => !o)}
            aria-expanded={createOpen}
            className={[
              'flex w-full items-center gap-2 rounded-md bg-gradient-to-r from-primary to-primary-700 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:shadow-md',
              collapsed ? 'justify-center' : '',
            ].join(' ')}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span className="truncate">Create</span>}
          </button>
          {createOpen && (
            <div
              role="menu"
              className={[
                'dv-anim-pop absolute z-50 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl',
                collapsed ? 'left-full top-0 ml-1.5 w-44' : 'left-0 right-0 mt-1.5',
              ].join(' ')}
            >
              {[
                { label: 'Project', href: '/workspace' },
                { label: 'Part', href: '/workspace' },
                { label: 'Decision', href: '/decisions' },
                { label: 'Issue', href: '/decisions' },
                { label: 'Comment', href: '/workspace' },
              ].map((c) => (
                <Link
                  key={c.label}
                  href={c.href}
                  role="menuitem"
                  onClick={() => setCreateOpen(false)}
                  className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50"
                >
                  <span>{c.label}</span>
                  <ChevronRight className="h-3 w-3 text-slate-300" />
                </Link>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          aria-label="Search"
          className={[
            'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100 hover:text-slate-900',
            collapsed ? 'justify-center' : '',
          ].join(' ')}
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          {!collapsed && <span className="truncate text-slate-500">Search · ⌘K</span>}
        </button>
      </div>

      {/* ── Primary nav ────────────────────────────────────────────────── */}
      <nav className="dv-thin-scroll flex-1 overflow-y-auto px-2 py-2">
        <ul className="space-y-0.5">
          {items.map((item) => {
            const active = current === item.id
            const Icon = item.icon
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  title={collapsed ? item.label : undefined}
                  className={[
                    'group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[12.5px] transition-all duration-200',
                    active
                      ? 'bg-gradient-to-r from-primary-50 via-primary-50 to-brand-50/60 font-semibold text-primary-700'
                      : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900',
                    collapsed ? 'justify-center' : '',
                  ].join(' ')}
                >
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute -left-2 bottom-1.5 top-1.5 w-[3px] rounded-r-full bg-gradient-to-b from-primary to-brand"
                    />
                  )}
                  <Icon
                    className={[
                      'h-[16px] w-[16px] shrink-0 transition-transform duration-200',
                      active
                        ? 'text-primary'
                        : 'text-slate-400 group-hover:scale-110 group-hover:text-slate-700',
                    ].join(' ')}
                  />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span
                          className={[
                            'rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums',
                            active ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600',
                          ].join(' ')}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              </li>
            )
          })}

          {/* More... */}
          <li className="relative">
            <div ref={moreRef}>
              <button
                type="button"
                onClick={() => setMoreOpen((o) => !o)}
                aria-expanded={moreOpen}
                title={collapsed ? 'More' : undefined}
                className={[
                  'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[12.5px] text-slate-500 transition hover:bg-slate-100/70 hover:text-slate-900',
                  collapsed ? 'justify-center' : '',
                ].join(' ')}
              >
                <MoreHorizontal className="h-[16px] w-[16px] shrink-0 text-slate-400" />
                {!collapsed && <span className="flex-1 truncate text-left">More...</span>}
              </button>
              {moreOpen && (
                <div
                  role="menu"
                  className={[
                    'dv-anim-pop absolute z-50 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl',
                    collapsed ? 'left-full top-0 ml-1.5 w-40' : 'left-0 right-0 top-full mt-1',
                  ].join(' ')}
                >
                  <Link
                    href="/admin"
                    role="menuitem"
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50"
                  >
                    <Crown className="h-3.5 w-3.5 text-primary" />
                    Admin
                  </Link>
                  <Link
                    href="/decisions"
                    role="menuitem"
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-2 border-t border-slate-100 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50"
                  >
                    <FileCheck2 className="h-3.5 w-3.5 text-slate-500" />
                    All Decisions
                  </Link>
                  <Link
                    href="/audit"
                    role="menuitem"
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-2 border-t border-slate-100 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50"
                  >
                    <History className="h-3.5 w-3.5 text-slate-500" />
                    Audit Timeline
                  </Link>
                </div>
              )}
            </div>
          </li>
        </ul>

        {/* ── Workspaces / Bookmarks ───────────────────────────────────── */}
        {!collapsed && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <div className="mb-2 flex items-center justify-center gap-1 rounded-md bg-slate-100/70 p-0.5">
              <button
                type="button"
                onClick={() => setTab('workspaces')}
                aria-label="Workspaces"
                aria-pressed={tab === 'workspaces'}
                className={[
                  'flex flex-1 items-center justify-center rounded py-1 transition',
                  tab === 'workspaces'
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-slate-400 hover:text-slate-700',
                ].join(' ')}
              >
                <Layers className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setTab('bookmarks')}
                aria-label="Bookmarks"
                aria-pressed={tab === 'bookmarks'}
                className={[
                  'flex flex-1 items-center justify-center rounded py-1 transition',
                  tab === 'bookmarks'
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-slate-400 hover:text-slate-700',
                ].join(' ')}
              >
                <Bookmark className="h-3.5 w-3.5" />
              </button>
            </div>

            {tab === 'workspaces' ? (
              <div>
                <div className="mb-1 flex items-center justify-between px-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Workspaces
                  </span>
                  <button
                    type="button"
                    onClick={() => setWorkspaceOpen((o) => !o)}
                    aria-label={workspaceOpen ? 'Collapse workspaces' : 'Expand workspaces'}
                    className="flex h-5 w-5 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    <ChevronDown
                      className={`h-3 w-3 transition-transform ${
                        workspaceOpen ? '' : '-rotate-90'
                      }`}
                    />
                  </button>
                </div>
                {workspaceOpen && (
                  <div className="space-y-0.5">
                    <Link
                      href="/workspace"
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12px] font-semibold text-slate-800 transition hover:bg-slate-100/70"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-gradient-to-br from-primary to-brand text-[10px] font-black text-white shadow-sm">
                        F
                      </span>
                      <span className="flex-1 truncate">F-Bracket Program</span>
                      <ChevronDown className="h-3 w-3 text-slate-400" />
                    </Link>
                    <ul className="ml-3 space-y-0.5 border-l border-slate-100 pl-2">
                      {workspaceProjects.map((p) => (
                        <li key={p.id}>
                          <Link
                            href={`/projects/${p.id}`}
                            className="flex items-center gap-2 rounded-md px-2 py-1 text-[11.5px] text-slate-600 transition hover:bg-slate-100/70 hover:text-slate-900"
                          >
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                TONE_DOT[p.tone] ?? 'bg-slate-400'
                              }`}
                            />
                            <span className="truncate">
                              {p.name.split(' ').slice(0, 3).join(' ')}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="px-2 py-3 text-center text-[10.5px] text-slate-400">
                No bookmarks yet
              </div>
            )}
          </div>
        )}
      </nav>

      {/* ── User card ──────────────────────────────────────────────────── */}
      <div
        ref={userMenuRef}
        className="relative border-t border-slate-200/80 bg-gradient-to-b from-transparent to-slate-50/60 p-2.5"
      >
        <button
          type="button"
          onClick={() => setUserMenuOpen((o) => !o)}
          aria-expanded={userMenuOpen}
          className={[
            'flex w-full items-center gap-2 rounded-md p-1.5 text-left transition hover:bg-slate-100/70',
            collapsed ? 'justify-center' : '',
          ].join(' ')}
        >
          <Avatar name={user.name} size="md" online />
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-900">{user.name}</p>
                <p className="truncate text-[10px] text-slate-500">{user.email}</p>
              </div>
              <ChevronDown
                className={`h-3 w-3 shrink-0 text-slate-400 transition-transform ${
                  userMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </>
          )}
        </button>

        {userMenuOpen && (
          <div
            role="menu"
            className={[
              'dv-anim-pop absolute overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl',
              collapsed ? 'bottom-2 left-full ml-1.5 w-44' : 'inset-x-3 bottom-full mb-2',
            ].join(' ')}
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
