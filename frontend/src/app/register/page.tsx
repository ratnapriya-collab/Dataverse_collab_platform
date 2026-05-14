'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'
import Logo, { HexMark } from '@/components/ui/Logo'
import { ApiError, api } from '@/lib/api'
import { setToken } from '@/lib/auth'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await api.auth.register({ email, password, name })
      const loggedIn = await api.auth.login({ email, password })
      setToken(loggedIn.access_token)
      router.replace('/home')
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Unexpected error. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col md:flex-row">
      {/* ── Brand panel ─────────────────────────────────────────────────────── */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary-900 via-slate-900 to-brand-900 md:flex md:w-[55%] md:flex-col md:justify-between md:p-12">
        <div className="absolute -left-24 top-24 h-96 w-96 rounded-full bg-brand opacity-25 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-primary opacity-30 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />

        <div className="relative z-10">
          <Logo theme="dark" markClassName="h-10 w-10" />
        </div>

        <div className="relative z-10 max-w-md text-white">
          <HexMark className="mb-8 h-20 w-20 text-brand drop-shadow-[0_0_28px_rgba(6,182,212,0.5)]" />
          <h2 className="text-3xl font-bold leading-tight">
            Start collaborating on{' '}
            <span className="bg-gradient-to-r from-brand-300 to-white bg-clip-text text-transparent">
              CAD decisions
            </span>{' '}
            today.
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-white/70">
            Create your free account to upload parts, anchor decisions to
            geometry, and keep a tamper-evident audit trail of every change.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-white/85">
            <Bullet>Private uploads with signed download URLs</Bullet>
            <Bullet>Stable face IDs survive every revision</Bullet>
            <Bullet>Push approved ECNs straight to your PLM</Bullet>
          </ul>
        </div>

        <div className="relative z-10 text-[11px] tracking-wider text-white/40">
          © DATAVERS.AI · ENGINEERING INTELLIGENCE
        </div>
      </aside>

      {/* ── Form panel ─────────────────────────────────────────────────────── */}
      <section className="relative flex flex-1 items-center justify-center bg-slate-50 px-6 py-10">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white via-slate-50 to-brand-50 md:hidden" />

        <form
          onSubmit={handleSubmit}
          className="relative z-10 w-full max-w-sm space-y-5 rounded-xl border border-slate-200 bg-white p-8 shadow-lg"
        >
          <div className="flex justify-center">
            <Logo compact markClassName="h-10 w-10" />
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-900">Create account</h1>
            <p className="mt-1 text-sm text-slate-500">
              Free, no credit card required
            </p>
          </div>

          <label className="block text-sm">
            <span className="text-slate-700">Name</span>
            <input
              type="text"
              required
              minLength={1}
              maxLength={120}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>

          <label className="block text-sm">
            <span className="text-slate-700">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>

          <label className="block text-sm">
            <span className="text-slate-700">Password</span>
            <input
              type="password"
              required
              minLength={8}
              maxLength={64}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <span className="mt-1 block text-xs text-slate-400">
              8–64 characters.
            </span>
          </label>

          {error !== null && (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-gradient-to-r from-primary to-primary-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:shadow-lg hover:from-primary-600 hover:to-primary-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Creating…' : 'Create account'}
          </button>

          <p className="text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-medium text-primary hover:text-primary-700 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </form>
      </section>
    </main>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
      <span>{children}</span>
    </li>
  )
}
