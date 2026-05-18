'use client'

/**
 * /parts/[id]/drawing — 2D engineering drawing viewer.
 *
 * CoLab-style layout: PartViewTabs at top (3D | 2D | BOM), DrawingCanvas
 * fills the center, PMISidebar on the right. Same conversation/decisions
 * model as the 3D viewer — click a callout to surface a decision link.
 */

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, FileText } from 'lucide-react'
import Logo from '@/components/ui/Logo'
import UserBadge from '@/components/ui/UserBadge'
import PartViewTabs from '@/components/parts/PartViewTabs'
import DrawingCanvas from '@/components/drawing/DrawingCanvas'
import PMISidebar from '@/components/drawing/PMISidebar'
import { ApiError, api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import { SEED_PMI_CALLOUTS } from '@/lib/mockWorkspace'
import type { UserRead } from '@/types/api'

export default function PartDrawingPage(): JSX.Element {
  const params = useParams<{ id: string }>()
  const partId = params?.id ?? 'demo_part'
  const router = useRouter()
  const [user, setUser] = useState<UserRead | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

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

  const linkedCount = useMemo(
    () => SEED_PMI_CALLOUTS.filter((c) => c.linked_decision_id !== undefined).length,
    [],
  )

  if (error !== null) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p role="alert" className="text-sm text-red-600">{error}</p>
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
              <h1 className="truncate text-sm font-semibold text-slate-900">
                Wing Spar Bracket Assembly
              </h1>
              <p className="truncate text-xs text-slate-500">
                BR-AERO-014 · Rev B · 2D engineering drawing
              </p>
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

      <PartViewTabs
        partId={partId}
        active="2d"
        contextChip={`${SEED_PMI_CALLOUTS.length} PMI · ${linkedCount} linked to decisions`}
      />

      <section className="grid flex-1 grid-cols-[1fr_360px] overflow-hidden">
        <div className="relative">
          <DrawingCanvas
            callouts={SEED_PMI_CALLOUTS}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelect={(id) => setSelectedId(id)}
            onHover={(id) => setHoveredId(id)}
            partNumber="BR-AERO-014"
            partName="Wing Spar Bracket"
            partRev="B"
          />
        </div>

        <PMISidebar
          callouts={SEED_PMI_CALLOUTS}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onSelect={(id) => setSelectedId(id)}
          onHover={(id) => setHoveredId(id)}
          partId={partId}
        />
      </section>

      <footer className="border-t border-slate-200 bg-slate-50/80 px-6 py-2 text-[10px] text-slate-500">
        <FileText className="-mt-0.5 mr-1.5 inline h-3 w-3" />
        2D drawing rendered as inline SVG · click any PMI pin to drill in · switch to 3D Model or BOM at the top
      </footer>
    </main>
  )
}
