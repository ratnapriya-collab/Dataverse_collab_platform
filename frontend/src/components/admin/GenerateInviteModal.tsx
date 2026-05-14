'use client'

import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Copy, Mail, Sparkles, X } from 'lucide-react'
import {
  generateInviteCode,
  type MockInvite,
  type WorkspaceRole,
} from '@/lib/mockWorkspace'

const ROLES: WorkspaceRole[] = ['ADMIN', 'MEMBER', 'VIEWER']
const EXPIRY_OPTIONS = [
  { days: 1, label: '1 day' },
  { days: 7, label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
]

interface Props {
  invitedByName: string
  onClose: () => void
  onCreated: (invite: MockInvite) => void
}

export default function GenerateInviteModal({
  invitedByName,
  onClose,
  onCreated,
}: Props) {
  const [role, setRole] = useState<WorkspaceRole>('MEMBER')
  const [email, setEmail] = useState('')
  const [expiresInDays, setExpiresInDays] = useState(7)
  const [created, setCreated] = useState<MockInvite | null>(null)
  const [copied, setCopied] = useState(false)
  const firstFieldRef = useRef<HTMLSelectElement | null>(null)
  const codeFieldRef = useRef<HTMLInputElement | null>(null)

  // ESC + initial focus.
  useEffect(() => {
    firstFieldRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    const now = Date.now()
    const invite: MockInvite = {
      id: `inv_${Math.random().toString(36).slice(2, 10)}`,
      code: generateInviteCode(),
      role,
      invited_email: email.trim() === '' ? null : email.trim(),
      invited_by_name: invitedByName,
      expires_at: new Date(now + expiresInDays * 86_400_000).toISOString(),
      used: false,
      used_by_name: null,
      created_at: new Date(now).toISOString(),
    }
    setCreated(invite)
    onCreated(invite)
    // Auto-select the code for easy copy.
    setTimeout(() => codeFieldRef.current?.select(), 50)
  }

  async function handleCopy(): Promise<void> {
    if (created === null) return
    try {
      await navigator.clipboard.writeText(created.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Ignore — fallback is the user manually copies from the input.
    }
  }

  const inviteUrl =
    created === null
      ? ''
      : `${typeof window === 'undefined' ? 'http://localhost:3010' : window.location.origin}/invite/${created.code}`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="invite-modal-title" className="text-base font-semibold text-slate-900">
              {created === null ? 'Generate invite' : 'Invite ready'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {created === null
                ? 'Anyone with the code can join the workspace.'
                : 'Share the code or URL below. Both are single-use.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {created === null ? (
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 px-6 py-5">
              <label className="block text-sm">
                <span className="text-slate-700">Role</span>
                <select
                  ref={firstFieldRef}
                  value={role}
                  onChange={(e) => setRole(e.target.value as WorkspaceRole)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="text-slate-700">
                  Email <span className="text-slate-400">(optional)</span>
                </span>
                <div className="relative mt-1">
                  <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="person@company.com"
                    className="w-full rounded-md border border-slate-300 pl-8 pr-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <span className="mt-1 block text-xs text-slate-400">
                  Just a label — the invite works for whoever uses the code first.
                </span>
              </label>

              <label className="block text-sm">
                <span className="text-slate-700">Expires in</span>
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(parseInt(e.target.value, 10))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {EXPIRY_OPTIONS.map((o) => (
                    <option key={o.days} value={o.days}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-primary to-primary-700 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Generate code
              </button>
            </footer>
          </form>
        ) : (
          <div>
            <div className="px-6 py-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Invite code
                </label>
                <div className="mt-1.5 flex">
                  <input
                    ref={codeFieldRef}
                    readOnly
                    value={created.code}
                    className="flex-1 rounded-l-md border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 rounded-r-md border border-l-0 border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="mt-5">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Shareable URL
                </label>
                <input
                  readOnly
                  value={inviteUrl}
                  className="mt-1.5 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Role <strong>{created.role}</strong> · expires in{' '}
                  <strong>{expiresInDays} days</strong>
                </p>
              </div>
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-gradient-to-r from-primary to-primary-700 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md"
              >
                Done
              </button>
            </footer>
          </div>
        )}
      </div>
    </div>
  )
}
