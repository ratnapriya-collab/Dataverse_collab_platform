'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronDown, LogOut, Search, Settings, User } from 'lucide-react'
import Logo from './Logo'
import Avatar from '@/components/ui/Avatar'
import { mockUser } from '@/lib/mock-data'

interface NavItem {
  href: string
  label: string
  adminOnly?: boolean
}

const NAV: NavItem[] = [
  { href: '/home', label: 'Home' },
  { href: '/decisions', label: 'Decisions' },
  { href: '/audit', label: 'Audit' },
  { href: '/admin', label: 'Admin', adminOnly: true },
]

export default function TopNav() {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-6">
        <Link href="/home" className="flex items-center focus-ring rounded">
          <Logo size={28} withWordmark />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.filter((n) => !n.adminOnly || mockUser.role === 'ADMIN').map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative rounded px-3 py-1.5 text-sm font-medium transition-colors focus-ring ${
                  active ? 'text-accent' : 'text-ink-soft hover:bg-rule-soft hover:text-ink'
                }`}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-accent" aria-hidden="true" />
                )}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Decorative search (intentionally non-functional per spec) */}
          <div className="relative hidden md:block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-mute" />
            <input
              type="text"
              placeholder="Search parts, decisions…"
              aria-label="Search (demo)"
              className="h-8 w-64 rounded border border-rule bg-rule-soft/50 pl-7 pr-3 text-xs text-ink placeholder:text-ink-mute focus-ring transition-colors hover:border-ink-mute/40 hover:bg-white"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-rule bg-white px-1 py-0.5 font-mono text-[9px] text-ink-mute">
              ⌘K
            </span>
          </div>

          <button
            type="button"
            aria-label="Notifications"
            className="relative flex h-8 w-8 items-center justify-center rounded text-ink-mute hover:bg-rule-soft hover:text-ink focus-ring"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-state-rejected ring-2 ring-white" />
          </button>

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              className="flex items-center gap-2 rounded p-1 hover:bg-rule-soft focus-ring"
            >
              <Avatar name={mockUser.name} initials={mockUser.initials} size="sm" online />
              <ChevronDown
                className={`h-3 w-3 text-ink-mute transition-transform ${menuOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-lg border border-rule bg-white shadow-pop animate-fade-in">
                <div className="border-b border-rule px-3 py-2.5">
                  <p className="truncate text-xs font-semibold text-ink">{mockUser.name}</p>
                  <p className="truncate text-[11px] text-ink-mute">{mockUser.email}</p>
                </div>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-ink-soft hover:bg-rule-soft"
                >
                  <User className="h-3.5 w-3.5" />
                  Profile
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-ink-soft hover:bg-rule-soft"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Workspace settings
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/login')}
                  className="flex w-full items-center gap-2 border-t border-rule px-3 py-2 text-xs font-medium text-state-rejected hover:bg-state-rejected/5"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
