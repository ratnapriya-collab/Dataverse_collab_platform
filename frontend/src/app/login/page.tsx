'use client'

/**
 * LoginPage — dark "Sign in as" role-tile UI.
 *
 * The page presents 5 named team members as clickable tiles. Clicking a
 * tile silently POSTs the shared demo password (`dataverse2026`) so the
 * user goes straight into the workspace as that persona — no typing.
 *
 * In production this screen is replaced by a Keycloak / SSO redirect;
 * the tile mapping documents which real user each demo persona
 * corresponds to (for training-data continuity).
 *
 * A collapsed "Sign in with email" fallback stays available for
 * accounts not on the tile list.
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'
import { ApiError, api } from '@/lib/api'
import { setToken } from '@/lib/auth'

interface DemoUser {
  email: string
  name: string
  initials: string
  role: string
  scope: string
  color: string
}

const DEMO_PASSWORD = 'dataverse2026'

const DEMO_USERS: readonly DemoUser[] = [
  {
    email: 'kushal@aurora.demo',
    name: 'Kushal',
    initials: 'K',
    role: 'Workspace admin · Senior TechPub Engineer',
    scope: 'All programs · full intake',
    color: 'from-cyan-400 to-cyan-600',
  },
  {
    email: 'dana.okafor@aurora.demo',
    name: 'Dana Okafor',
    initials: 'DO',
    role: 'Workspace admin · Publications director',
    scope: 'All programs · full intake',
    color: 'from-teal-400 to-teal-600',
  },
  {
    email: 'marcus.chen@aurora.demo',
    name: 'Marcus Chen',
    initials: 'MC',
    role: 'Member · Helo program lead',
    scope: 'Program lead · HELIX',
    color: 'from-amber-400 to-amber-600',
  },
  {
    email: 'priya.nair@aurora.demo',
    name: 'Priya Nair',
    initials: 'PN',
    role: 'Member · QA engineer',
    scope: 'Programs: HELIX, ORION',
    color: 'from-orange-400 to-orange-600',
  },
  {
    email: 'sam.rivera@rivera-composites.demo',
    name: 'Sam Rivera',
    initials: 'SR',
    role: 'Collaborator · Supplier — Rivera Composites',
    scope: 'External · 2 assigned modules',
    color: 'from-yellow-400 to-yellow-600',
  },
]

export default function LoginPage(): JSX.Element {
  const router = useRouter()
  const [loadingEmail, setLoadingEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showEmailFallback, setShowEmailFallback] = useState(false)

  async function signInAs(email: string): Promise<void> {
    if (loadingEmail !== null) return
    setLoadingEmail(email)
    setError(null)
    try {
      const response = await api.auth.login({ email, password: DEMO_PASSWORD })
      setToken(response.access_token)
      router.replace('/home')
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Unexpected error. Please try again.'
      setError(`${msg} · try "Sign in with email" below.`)
      setLoadingEmail(null)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      {/* Ambient background — soft radial glows + subtle dot grid */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-[520px] w-[520px] rounded-full bg-cyan-500/12 blur-3xl" />
        <div className="absolute -right-40 bottom-0 h-[560px] w-[560px] rounded-full bg-teal-500/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
      </div>

      {/* Card */}
      <section className="relative z-10 w-full max-w-[720px] rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur">
        {/* Brand */}
        <header className="text-center">
          <div className="inline-flex items-baseline gap-1 text-2xl font-black tracking-tight text-white">
            <span>DATAVERS</span>
            <span className="bg-gradient-to-r from-cyan-300 to-teal-300 bg-clip-text text-transparent">
              .AI
            </span>
          </div>
          <p className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            Engineering intelligence
          </p>
          <p className="mt-4 text-[12.5px] text-slate-300">
            TechPub · Aurora Aerospace workspace
          </p>
          <p className="mt-6 text-[13px] font-semibold text-slate-200">Sign in as</p>
        </header>

        {error !== null && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-center text-[12px] text-rose-300"
          >
            {error}
          </p>
        )}

        {/* Tiles */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {DEMO_USERS.map((u) => {
            const loading = loadingEmail === u.email
            const disabled = loadingEmail !== null && !loading
            return (
              <button
                key={u.email}
                type="button"
                onClick={() => signInAs(u.email)}
                disabled={disabled}
                aria-label={`Sign in as ${u.name}`}
                className={[
                  'group relative flex flex-col items-center gap-2 rounded-xl border border-slate-800 bg-slate-800/50 p-4 text-center transition',
                  disabled
                    ? 'cursor-not-allowed opacity-40'
                    : 'hover:-translate-y-0.5 hover:border-cyan-500/40 hover:bg-slate-800/80 hover:shadow-lg hover:shadow-cyan-500/10',
                  loading ? 'animate-pulse border-cyan-500/60' : '',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br text-[13px] font-bold text-slate-950 shadow-md',
                    u.color,
                  ].join(' ')}
                >
                  {u.initials}
                </span>
                <span className="text-[13px] font-bold text-white">{u.name}</span>
                <span className="text-[10px] font-medium leading-tight text-slate-400">
                  {u.role}
                </span>
                <span className="mt-0.5 text-[9.5px] font-medium leading-tight text-slate-500">
                  {u.scope}
                </span>
              </button>
            )
          })}
        </div>

        {/* Disclaimer */}
        <p className="mt-6 text-center text-[10.5px] leading-relaxed text-slate-500">
          Demo mode — no passwords. In production this screen is your single
          sign-on (Keycloak); usernames map to the same records.
        </p>

        {/* Collapsed email/password fallback */}
        <div className="mt-6 border-t border-slate-800 pt-5 text-center">
          {!showEmailFallback ? (
            <button
              type="button"
              onClick={() => setShowEmailFallback(true)}
              className="text-[11px] font-semibold text-slate-400 transition hover:text-cyan-300"
            >
              Sign in with email instead →
            </button>
          ) : (
            <EmailFallbackForm
              onCancel={() => setShowEmailFallback(false)}
              onSuccess={(token) => {
                setToken(token)
                router.replace('/home')
              }}
              setError={setError}
            />
          )}
          <p className="mt-4 text-[10.5px] text-slate-500">
            New collaborator?{' '}
            <Link
              href="/register"
              className="font-semibold text-cyan-300 transition hover:text-cyan-200 hover:underline"
            >
              Create an account
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}

// ── Email/password fallback (unchanged behaviour from the old login) ────────

function EmailFallbackForm({
  onCancel,
  onSuccess,
  setError,
}: {
  onCancel: () => void
  onSuccess: (token: string) => void
  setError: (msg: string | null) => void
}): JSX.Element {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const response = await api.auth.login({ email, password })
      onSuccess(response.access_token)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unexpected error.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5 text-left">
      <input
        type="email"
        required
        placeholder="you@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-[12px] text-white placeholder-slate-500 transition focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
      />
      <input
        type="password"
        required
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        className="w-full rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2 text-[12px] text-white placeholder-slate-500 transition focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-md border border-slate-700 px-3 py-2 text-[11px] font-semibold text-slate-300 transition hover:border-slate-600 hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-md bg-gradient-to-r from-cyan-500 to-teal-500 px-3 py-2 text-[11px] font-semibold text-slate-950 transition hover:from-cyan-400 hover:to-teal-400 disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </div>
    </form>
  )
}
