'use client'

/**
 * /login — Screen A.1
 *
 * Mock-only auth — submit always navigates to /home.
 * Demo credentials are pre-filled so reviewers can sign in by just hitting Enter.
 */

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Logo from '@/components/shell/Logo'

const DEMO_EMAIL = 'demo@dataverse.io'
const DEMO_PASSWORD = 'password123'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState(DEMO_EMAIL)
  const [password, setPassword] = useState(DEMO_PASSWORD)
  const [submitting, setSubmitting] = useState(false)

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    window.setTimeout(() => router.push('/home'), 350)
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper px-4">
      {/* Background accent */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 800px 400px at 20% 10%, rgba(31,122,109,0.08), transparent 60%), radial-gradient(ellipse 700px 500px at 80% 100%, rgba(21,82,74,0.06), transparent 60%)',
        }}
      />
      <div className="absolute inset-0 cad-grid-fine opacity-[0.5] pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm animate-fade-up">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo size={48} />
          <h1 className="mt-4 text-xl font-bold tracking-tight text-ink">
            DataVerse<span className="text-accent">.Collab</span>
          </h1>
          <p className="mt-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Anchored decisions on geometry
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="overflow-hidden rounded-xl border border-rule bg-white shadow-pop"
        >
          <div className="space-y-4 p-6">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-ink">
                Work email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between">
                <label htmlFor="password" className="text-xs font-semibold text-ink">
                  Password
                </label>
                <button
                  type="button"
                  className="text-[11px] font-medium text-ink-mute transition-colors hover:text-accent"
                >
                  Forgot password?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            <Button type="submit" loading={submitting} className="w-full" size="lg">
              Sign in
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="border-t border-rule bg-rule-soft/60 px-6 py-4">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-ink">Demo credentials</p>
                <p className="font-mono text-[10px] text-ink-mute">
                  {DEMO_EMAIL} · {DEMO_PASSWORD}
                </p>
              </div>
            </div>
          </div>
        </form>

        <p className="mt-6 text-center text-[11px] text-ink-mute">
          By signing in you agree to the{' '}
          <a className="text-ink-soft underline-offset-2 hover:underline">Terms</a> &amp;{' '}
          <a className="text-ink-soft underline-offset-2 hover:underline">Privacy Policy</a>.
        </p>
      </div>
    </main>
  )
}
