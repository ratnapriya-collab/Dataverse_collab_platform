'use client'

/**
 * RoleSwitcher — "View as: [Admin ▾]" dropdown in the part-viewer header.
 *
 * Selecting a role drives the page's redaction layer via the ?view=<mode>
 * URL param. The switcher itself is mock — just visual + URL navigation.
 */

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Eye, Shield, ShieldOff, Users } from 'lucide-react'

export type ViewRole = 'admin' | 'oem' | 'partner'

interface RoleOption {
  id: ViewRole
  label: string
  hint: string
  icon: typeof Shield
  org: string
}

const ROLES: RoleOption[] = [
  { id: 'admin', label: 'Admin', hint: 'Sees everything · default', icon: Shield, org: 'DataVerse' },
  { id: 'oem', label: 'OEM Engineer', hint: 'Same view as Admin', icon: Users, org: 'Acme Aerospace' },
  { id: 'partner', label: 'Supplier Reviewer', hint: 'Redacted by Datum', icon: ShieldOff, org: 'Acme Manufacturing' },
]

interface Props {
  active: ViewRole
}

export default function RoleSwitcher({ active }: Props): JSX.Element {
  const pathname = usePathname() ?? '/'
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function pick(role: ViewRole): void {
    setOpen(false)
    // Drive the active view via ?view=<mode> on the current path.
    const target = role === 'admin' ? pathname : `${pathname}?view=${role}`
    router.push(target)
  }

  const activeOpt = ROLES.find((r) => r.id === active) ?? ROLES[0]!
  const Icon = activeOpt.icon

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs font-semibold shadow-sm transition ${
          active === 'partner'
            ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
        }`}
      >
        <Eye className="h-3 w-3 text-slate-400" />
        <span className="text-slate-500">View as</span>
        <Icon className={`h-3.5 w-3.5 ${active === 'partner' ? 'text-amber-700' : 'text-slate-700'}`} />
        <span className="font-bold">{activeOpt.label}</span>
        <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="dv-anim-pop absolute right-0 top-full z-50 mt-1.5 w-72 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
        >
          <div className="border-b border-slate-100 bg-slate-50/60 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Preview the part as someone else sees it
            </p>
          </div>
          <ul>
            {ROLES.map((r) => {
              const RoleIcon = r.icon
              const isActive = r.id === active
              const isPartner = r.id === 'partner'
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => pick(r.id)}
                    className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition ${
                      isActive
                        ? 'bg-primary-50'
                        : isPartner
                        ? 'hover:bg-amber-50'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                        isPartner
                          ? 'bg-amber-100 text-amber-700'
                          : isActive
                          ? 'bg-primary-100 text-primary-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <RoleIcon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-sm font-semibold ${isActive ? 'text-primary-900' : 'text-slate-900'}`}>
                          {r.label}
                        </p>
                        {isActive && <Check className="h-3 w-3 text-primary" />}
                      </div>
                      <p className="text-[10px] text-slate-500">
                        {r.org} · {r.hint}
                      </p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-1.5 text-[10px] text-slate-500">
            Datum applies redactions based on internal-only flags, cost keywords, and admin-only threads.
          </div>
        </div>
      )}
    </div>
  )
}
