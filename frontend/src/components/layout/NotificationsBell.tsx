'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  AtSign,
  Bell,
  CheckCircle2,
  MailPlus,
  MessageSquare,
  Upload,
  UserPlus,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import Avatar from '@/components/workspace/Avatar'
import {
  formatTimeAgo,
  SEED_NOTIFICATIONS,
  type MockNotification,
  type NotificationKind,
} from '@/lib/mockWorkspace'

const KIND_STYLE: Record<NotificationKind, { icon: LucideIcon; bg: string; fg: string }> = {
  mention: { icon: AtSign, bg: 'bg-violet-50', fg: 'text-violet-600' },
  comment: { icon: MessageSquare, bg: 'bg-red-50', fg: 'text-red-600' },
  invite: { icon: MailPlus, bg: 'bg-brand-50', fg: 'text-brand-700' },
  decision_accepted: { icon: CheckCircle2, bg: 'bg-emerald-50', fg: 'text-emerald-600' },
  decision_rejected: { icon: XCircle, bg: 'bg-slate-100', fg: 'text-slate-500' },
  member_joined: { icon: UserPlus, bg: 'bg-primary-50', fg: 'text-primary' },
  part_uploaded: { icon: Upload, bg: 'bg-amber-50', fg: 'text-amber-600' },
}

export default function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<MockNotification[]>(SEED_NOTIFICATIONS)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  const unreadCount = items.filter((n) => n.unread).length

  // Close on outside click or ESC.
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

  function markAllRead(): void {
    setItems((prev) => prev.map((n) => ({ ...n, unread: false })))
  }

  function markRead(id: string): void {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)))
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900 hover:shadow-sm"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold leading-none text-white shadow ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-2 w-[360px] origin-top-right overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
          style={{ animation: 'dv-pop 160ms ease-out' }}
        >
          <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
              <p className="text-[10px] text-slate-500">
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : 'You’re all caught up'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-medium text-primary hover:text-primary-700"
              >
                Mark all read
              </button>
            )}
          </header>

          <ul className="dv-thin-scroll max-h-[420px] divide-y divide-slate-100 overflow-y-auto">
            {items.map((n) => {
              const s = KIND_STYLE[n.kind]
              const Icon = s.icon
              const targetEl =
                n.target_label !== undefined && n.target_href !== undefined ? (
                  <Link
                    href={n.target_href}
                    onClick={() => {
                      markRead(n.id)
                      setOpen(false)
                    }}
                    className="font-semibold text-slate-900 hover:text-primary hover:underline"
                  >
                    {n.target_label}
                  </Link>
                ) : n.target_label !== undefined ? (
                  <span className="font-semibold text-slate-900">{n.target_label}</span>
                ) : null
              return (
                <li
                  key={n.id}
                  className={`relative px-4 py-3 transition hover:bg-slate-50/60 ${
                    n.unread ? 'bg-primary-50/30' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={n.actor_name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs leading-relaxed text-slate-700">
                        <span className="font-semibold text-slate-900">{n.actor_name}</span>{' '}
                        <span className="text-slate-500">{n.message}</span>{' '}
                        {targetEl}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                        <span
                          className={`inline-flex h-4 w-4 items-center justify-center rounded ${s.bg}`}
                        >
                          <Icon className={`h-2.5 w-2.5 ${s.fg}`} />
                        </span>
                        <span>{formatTimeAgo(n.created_at)}</span>
                      </div>
                    </div>
                    {n.unread && (
                      <span
                        aria-hidden="true"
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                      />
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          <footer className="border-t border-slate-200 bg-slate-50/60 px-4 py-2 text-center">
            <button
              type="button"
              className="text-xs font-medium text-slate-500 hover:text-primary"
            >
              View all notifications
            </button>
          </footer>
        </div>
      )}
    </div>
  )
}
