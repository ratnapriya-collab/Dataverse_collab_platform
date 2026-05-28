'use client'

/**
 * /parts/[id]/doc — Doc tab on the part viewer.
 *
 * Google-Docs-style rich-text editor scoped to the part. Same chrome as the
 * BOM page (back button · brand · part header · PartViewTabs) so switching
 * between 3D / 2D / BOM / Doc feels native.
 *
 * The editor itself + autosave + toolbar live in DocEditor.tsx.
 */

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import Logo from '@/components/ui/Logo'
import UserBadge from '@/components/ui/UserBadge'
import PartViewTabs from '@/components/parts/PartViewTabs'
import DocEditor from '@/components/parts/DocEditor'
import { ApiError, api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import { SEED_FULL_DECISIONS } from '@/lib/mockWorkspace'
import type { UserRead } from '@/types/api'

function isMockPartId(id: string): boolean {
  return /^demo_[A-Za-z0-9_-]+$/.test(id)
}

export default function PartDocPage(): JSX.Element {
  const params = useParams<{ id: string }>()
  const partId = params?.id ?? 'demo_part'
  const router = useRouter()
  const [user, setUser] = useState<UserRead | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.auth
      .me()
      .then((u) => {
        if (!cancelled) setUser(u)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          clearToken()
          router.replace('/login')
          return
        }
        setError(err instanceof Error ? err.message : 'Failed to load')
      })
    return () => {
      cancelled = true
    }
  }, [router])

  function handleSignOut(): void {
    clearToken()
    router.replace('/login')
  }

  if (error !== null) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      </main>
    )
  }
  if (user === null) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-500">
        <span className="text-sm">Loading…</span>
      </main>
    )
  }

  // Derive a friendly part name for the editor header. Mock parts pull from
  // SEED_FULL_DECISIONS; real parts would be fetched but we keep the doc
  // chrome minimal so the editor itself is the centerpiece.
  const partName = isMockPartId(partId)
    ? SEED_FULL_DECISIONS.find((d) => d.part_id === partId)?.part_name ?? partId
    : partId

  return (
    <main className="flex h-screen flex-col">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href={`/parts/${partId}`}
              aria-label="Back to 3D viewer"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-primary hover:text-primary hover:shadow-sm"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Logo compact markClassName="h-8 w-8" />
            <div className="min-w-0 border-l border-slate-200 pl-4">
              <h1 className="truncate text-sm font-semibold text-slate-900">{partName}</h1>
              <p className="truncate text-xs text-slate-500">Design notes · autosaved locally</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <UserBadge name={user.name} email={user.email} />
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <PartViewTabs partId={partId} active="doc" />

      <section className="flex flex-1 overflow-hidden">
        <DocEditor partId={partId} partName={partName} />
      </section>
    </main>
  )
}
