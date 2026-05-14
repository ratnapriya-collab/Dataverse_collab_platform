'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Building2, Check, X } from 'lucide-react'
import Logo, { HexMark } from '@/components/ui/Logo'
import Toast, { type ToastState } from '@/components/ui/Toast'
import { ApiError, api } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'
import { SEED_WORKSPACE } from '@/lib/mockWorkspace'
import type { UserRead } from '@/types/api'

type Phase = 'loading' | 'ready' | 'accepting' | 'accepted' | 'declined'

export default function InvitePage() {
  const params = useParams<{ code: string }>()
  const router = useRouter()
  const code = params?.code ?? ''
  const [user, setUser] = useState<UserRead | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [toast, setToast] = useState<ToastState | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!isAuthenticated()) {
      // Pass the invite code through login so we land back here after signing in.
      router.replace(`/login?invite=${encodeURIComponent(code)}`)
      return
    }
    api.auth
      .me()
      .then((u) => {
        if (cancelled) return
        setUser(u)
        setPhase('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          router.replace(`/login?invite=${encodeURIComponent(code)}`)
          return
        }
        setPhase('ready')
      })
    return () => {
      cancelled = true
    }
  }, [code, router])

  const handleAccept = useCallback(() => {
    setPhase('accepting')
    // Mock: fake a short async delay so the UI feels responsive.
    window.setTimeout(() => {
      setPhase('accepted')
      setToast({
        message: `Welcome to ${SEED_WORKSPACE.name}!`,
        tone: 'success',
      })
      window.setTimeout(() => router.replace('/home'), 1500)
    }, 600)
  }, [router])

  const handleDecline = useCallback(() => {
    setPhase('declined')
    window.setTimeout(() => router.replace('/home'), 800)
  }, [router])

  return (
    <main className="auth-bg flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="relative z-10 mb-6">
        <Logo />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-lg">
        {phase === 'loading' && (
          <div className="text-center text-sm text-slate-500">Checking invite…</div>
        )}

        {(phase === 'ready' || phase === 'accepting') && (
          <>
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-brand text-white shadow-md">
                <Building2 className="h-7 w-7" />
              </div>
            </div>
            <h1 className="mt-4 text-center text-xl font-bold text-slate-900">
              You've been invited to join
            </h1>
            <p className="mt-1 text-center text-base font-semibold text-primary">
              {SEED_WORKSPACE.name}
            </p>
            <p className="mt-3 text-center text-sm leading-relaxed text-slate-600">
              {SEED_WORKSPACE.description}
            </p>

            <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs">
              <div className="text-slate-500">Signed in as</div>
              <div className="mt-0.5 font-medium text-slate-900">
                {user?.email ?? 'loading…'}
              </div>
              <div className="mt-1 text-slate-500">
                You'll join as{' '}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                  MEMBER
                </span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleDecline}
                disabled={phase === 'accepting'}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Decline
              </button>
              <button
                type="button"
                onClick={handleAccept}
                disabled={phase === 'accepting'}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-primary to-primary-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Check className="h-4 w-4" />
                {phase === 'accepting' ? 'Joining…' : 'Accept invite'}
              </button>
            </div>

            <p className="mt-4 text-center text-[11px] text-slate-400">
              Code: <span className="font-mono">{code.slice(0, 6)}…{code.slice(-4)}</span>
            </p>
          </>
        )}

        {phase === 'accepted' && (
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Check className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-xl font-bold text-slate-900">You're in!</h1>
            <p className="mt-2 text-sm text-slate-600">
              Redirecting to your workspace…
            </p>
          </div>
        )}

        {phase === 'declined' && (
          <div className="text-center">
            <HexMark className="mx-auto h-12 w-12 text-slate-300" />
            <h1 className="mt-4 text-lg font-semibold text-slate-700">
              Invite declined
            </h1>
            <p className="mt-1 text-sm text-slate-500">Heading back home…</p>
          </div>
        )}
      </div>

      <p className="relative z-10 mt-6 text-center text-xs text-slate-500">
        Not what you expected?{' '}
        <Link href="/home" className="text-primary hover:underline">
          Go home
        </Link>
      </p>
    </main>
  )
}
