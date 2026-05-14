'use client'

/**
 * QuickActionsFAB — floating action button in the bottom-right corner.
 * Click expands a small radial-feel menu of common actions. Mostly an
 * accelerator for first-time users to discover the platform's verbs.
 */

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  MailPlus,
  MessageSquarePlus,
  Plus,
  Search,
  Upload,
  type LucideIcon,
} from 'lucide-react'
import { openCommandPalette } from './CommandPalette'

interface Action {
  id: string
  label: string
  icon: LucideIcon
  /** Either an href or a click handler. */
  href?: string
  onClick?: () => void
  tint: string // tailwind bg class for the icon tile
  iconColor: string
}

const ACTIONS: Action[] = [
  {
    id: 'search',
    label: 'Quick search',
    icon: Search,
    onClick: () => openCommandPalette(),
    tint: 'bg-slate-900',
    iconColor: 'text-white',
  },
  {
    id: 'upload',
    label: 'Upload a part',
    icon: Upload,
    href: '/home',
    tint: 'bg-violet-600',
    iconColor: 'text-white',
  },
  {
    id: 'invite',
    label: 'Invite a member',
    icon: MailPlus,
    href: '/admin',
    tint: 'bg-brand',
    iconColor: 'text-white',
  },
  {
    id: 'comment',
    label: 'Leave a comment',
    icon: MessageSquarePlus,
    href: '/workspace',
    tint: 'bg-red-500',
    iconColor: 'text-white',
  },
]

export default function QuickActionsFAB() {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  // Close on outside click / ESC.
  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div
      ref={wrapperRef}
      className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2"
    >
      {/* Action chips — render only when open, staggered slide-up. */}
      {open && (
        <div className="mb-1 flex flex-col items-end gap-2">
          {ACTIONS.map((a, i) => {
            const Icon = a.icon
            const inner = (
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full shadow-lg ring-1 ring-black/5 ${a.tint}`}
              >
                <Icon className={`h-4 w-4 ${a.iconColor}`} />
              </span>
            )
            return (
              <div
                key={a.id}
                className="dv-anim-fade-up flex items-center gap-2"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <span className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white shadow-md">
                  {a.label}
                </span>
                {a.href !== undefined ? (
                  <Link href={a.href} onClick={() => setOpen(false)} aria-label={a.label}>
                    {inner}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      a.onClick?.()
                      setOpen(false)
                    }}
                    aria-label={a.label}
                  >
                    {inner}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Main FAB */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close quick actions' : 'Open quick actions'}
        aria-expanded={open}
        className={[
          'group flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-700 text-white shadow-xl ring-1 ring-black/5 transition duration-300 hover:shadow-2xl',
          open ? 'rotate-45' : 'hover:scale-105',
        ].join(' ')}
      >
        <Plus className="h-6 w-6 transition-transform" />
      </button>
    </div>
  )
}
