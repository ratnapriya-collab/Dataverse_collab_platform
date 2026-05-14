'use client'

/**
 * CommandPalette — global Cmd+K / Ctrl+K launcher.
 *
 * Mount once at the root layout. Listens globally for the shortcut and for a
 * `dv:open-cmdk` custom event so any "Quick search" button anywhere can
 * trigger it via `openCommandPalette()`.
 *
 * Filters across navigation, projects, members, and quick actions.
 * Arrow keys navigate, Enter selects, ESC dismisses.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  Crown,
  FolderKanban,
  Plus,
  Search,
  Upload,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react'
import {
  SEED_MEMBERS,
  SEED_PROJECTS,
  type WorkspaceRole,
} from '@/lib/mockWorkspace'

interface CmdItem {
  id: string
  label: string
  hint?: string
  icon: LucideIcon
  href?: string
  kind: 'nav' | 'action' | 'project' | 'member'
}

const KIND_LABEL: Record<CmdItem['kind'], string> = {
  nav: 'Page',
  action: 'Action',
  project: 'Project',
  member: 'Member',
}

const ROLE_PILL: Record<WorkspaceRole, string> = {
  ADMIN: 'bg-primary-50 text-primary-700',
  MEMBER: 'bg-slate-100 text-slate-700',
  VIEWER: 'bg-amber-50 text-amber-700',
}

/** Programmatically open the palette from anywhere (e.g. a Quick search button). */
export function openCommandPalette(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('dv:open-cmdk'))
}

export default function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Global keyboard listener — Cmd/Ctrl+K to toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    const onCustomOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('dv:open-cmdk', onCustomOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('dv:open-cmdk', onCustomOpen)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIdx(0)
      // Defer focus so the autofocus lands after the modal mounts.
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const items = useMemo<CmdItem[]>(() => {
    const list: CmdItem[] = [
      { id: 'nav-workspace', label: 'Go to Workspace', icon: Building2, href: '/workspace', kind: 'nav' },
      { id: 'nav-parts', label: 'Go to Parts', icon: FolderKanban, href: '/home', kind: 'nav' },
      { id: 'nav-admin', label: 'Go to Admin', icon: Crown, href: '/admin', kind: 'nav' },
      { id: 'nav-viewer', label: '3D viewer demo', icon: Search, href: '/viewer', kind: 'nav' },
      { id: 'action-upload', label: 'Upload a new part', hint: 'Drop a .step / .glb', icon: Upload, href: '/home', kind: 'action' },
      { id: 'action-invite', label: 'Invite a member', hint: 'Generate an invite code', icon: UserPlus, href: '/admin', kind: 'action' },
      { id: 'action-new-project', label: 'New project', hint: 'Start a collaboration', icon: Plus, href: '/workspace', kind: 'action' },
    ]
    for (const p of SEED_PROJECTS) {
      list.push({
        id: `proj-${p.id}`,
        label: p.name,
        hint: `${p.parts_count} parts · ${p.status.replace('_', ' ').toLowerCase()}`,
        icon: FolderKanban,
        href: `/projects/${p.id}`,
        kind: 'project',
      })
    }
    for (const m of SEED_MEMBERS) {
      list.push({
        id: `mem-${m.id}`,
        label: m.name,
        hint: `${m.role} · ${m.email}`,
        icon: Users,
        href: '/admin',
        kind: 'member',
      })
    }
    return list
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length === 0) return items
    return items.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        (i.hint?.toLowerCase().includes(q) ?? false) ||
        i.kind.toLowerCase().includes(q),
    )
  }, [items, query])

  // Keep selected within bounds when filter changes.
  useEffect(() => {
    if (selectedIdx >= filtered.length) setSelectedIdx(Math.max(0, filtered.length - 1))
  }, [filtered, selectedIdx])

  // Arrow / Enter / ESC inside the open palette.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const item = filtered[selectedIdx]
        if (item?.href !== undefined) {
          router.push(item.href)
          setOpen(false)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, filtered, selectedIdx, router])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-20"
    >
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        style={{ animation: 'dv-pop 180ms ease-out' }}
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIdx(0)
            }}
            placeholder="Search projects, members, pages…"
            className="flex-1 bg-transparent text-sm placeholder:text-slate-400 focus:outline-none"
          />
          <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 sm:inline-block">
            ESC
          </kbd>
        </div>

        <ul className="max-h-[420px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-slate-500">
              No results for &ldquo;{query}&rdquo;
            </li>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon
              const isSelected = idx === selectedIdx
              const member = item.kind === 'member' ? SEED_MEMBERS.find((m) => `mem-${m.id}` === item.id) : null
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (item.href !== undefined) router.push(item.href)
                      setOpen(false)
                    }}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    className={[
                      'flex w-full items-center gap-3 px-4 py-2 text-left transition',
                      isSelected
                        ? 'bg-primary-50'
                        : 'hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <div
                      className={[
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                        isSelected ? 'bg-white text-primary shadow-sm' : 'bg-slate-100 text-slate-500',
                      ].join(' ')}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={[
                          'truncate text-sm font-medium',
                          isSelected ? 'text-primary-700' : 'text-slate-900',
                        ].join(' ')}
                      >
                        {item.label}
                      </p>
                      {item.hint !== undefined && (
                        <p className="truncate text-[11px] text-slate-500">{item.hint}</p>
                      )}
                    </div>
                    {member !== undefined && member !== null ? (
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${ROLE_PILL[member.role]}`}
                      >
                        {member.role}
                      </span>
                    ) : (
                      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                        {KIND_LABEL[item.kind]}
                      </span>
                    )}
                  </button>
                </li>
              )
            })
          )}
        </ul>

        <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-slate-300 bg-white px-1 font-mono text-[9px]">↑</kbd>
              <kbd className="rounded border border-slate-300 bg-white px-1 font-mono text-[9px]">↓</kbd>
              navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-slate-300 bg-white px-1 font-mono text-[9px]">↵</kbd>
              select
            </span>
          </div>
          <span>{filtered.length} results</span>
        </footer>
      </div>
    </div>
  )
}

/**
 * "Quick search" button you can place anywhere in a navbar. Clicking it
 * opens the global command palette via the custom event.
 */
export function QuickSearchTrigger() {
  return (
    <button
      type="button"
      onClick={() => openCommandPalette()}
      className="hidden items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-700 md:inline-flex"
    >
      <Search className="h-3.5 w-3.5" />
      <span>Quick search…</span>
      <kbd className="ml-1 rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono text-[9px] text-slate-500">
        ⌘K
      </kbd>
    </button>
  )
}
