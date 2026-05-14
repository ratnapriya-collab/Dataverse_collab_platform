'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'
import Logo, { HexMark } from '@/components/ui/Logo'
import { ApiError, api } from '@/lib/api'
import { setToken } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const response = await api.auth.login({ email, password })
      setToken(response.access_token)
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
      {/* ── Brand panel (hidden on mobile) ────────────────────────────────── */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary-900 via-slate-900 to-brand-900 md:flex md:w-[55%] md:flex-col md:justify-between md:p-12">
        {/* Soft glow accents */}
        <div className="absolute -left-24 top-24 h-96 w-96 rounded-full bg-brand opacity-25 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-primary opacity-30 blur-3xl" />
        {/* Subtle dot-grid pattern */}
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
            Engineering decisions,
            <br />
            <span className="bg-gradient-to-r from-brand-300 to-white bg-clip-text text-transparent">
              anchored to geometry.
            </span>
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-white/70">
            Review CAD parts, pin decisions to specific faces, and let
            DATAVERS.AI keep them stable across every revision.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-white/85">
            <Bullet>Click any BREP face to anchor a decision</Bullet>
            <Bullet>Topology-hash UUIDs survive re-uploads</Bullet>
            <Bullet>Hash-chained audit log of every change</Bullet>
          </ul>
        </div>

        <div className="relative z-10 text-[11px] tracking-wider text-white/40">
          © DATAVERS.AI · ENGINEERING INTELLIGENCE
        </div>
      </aside>

      {/* ── Form panel ─────────────────────────────────────────────────────── */}
      <section className="relative flex flex-1 items-center justify-center bg-slate-50 px-6 py-10">
        {/* Soft mobile-only background tint so the page isn't flat on small screens */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white via-slate-50 to-brand-50 md:hidden" />

        <form
          onSubmit={handleSubmit}
          className="relative z-10 w-full max-w-sm space-y-5 rounded-xl border border-slate-200 bg-white p-8 shadow-lg"
        >
          <div className="flex justify-center">
            <Logo compact markClassName="h-10 w-10" />
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
            <p className="mt-1 text-sm text-slate-500">
              Sign in to continue to your workspace
            </p>
          </div>

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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
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
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-center text-sm text-slate-500">
            No account?{' '}
            <Link
              href="/register"
              className="font-medium text-primary hover:text-primary-700 hover:underline"
            >
              Create one
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
