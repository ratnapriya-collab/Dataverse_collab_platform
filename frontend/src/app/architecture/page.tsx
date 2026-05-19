'use client'

/**
 * /architecture — interactive system overview (admin-only internal page).
 *
 * Layout: WorkspaceSidebar · sticky breadcrumb · stat strip · interactive
 * diagram canvas · ModuleStatusDrawer (slides in on click). Bottom legend
 * explains the colour-coding.
 *
 * Status snapshot lives in mockWorkspace.ts so it stays in sync with the
 * actual UI work shipped per module.
 */

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  CircleDashed,
  GitBranch,
  Network,
  ShieldCheck,
  Workflow,
} from 'lucide-react'
import NotificationsBell from '@/components/layout/NotificationsBell'
import WorkspaceSidebar from '@/components/layout/WorkspaceSidebar'
import StatCard from '@/components/workspace/StatCard'
import ArchitectureDiagram from '@/components/architecture/ArchitectureDiagram'
import ModuleStatusDrawer from '@/components/architecture/ModuleStatusDrawer'
import { ApiError, api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import {
  SEED_MODULES,
  SEED_MODULE_EDGES,
  type ArchitectureModule,
} from '@/lib/mockWorkspace'
import type { UserRead } from '@/types/api'

export default function ArchitecturePage(): JSX.Element {
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

  const counts = useMemo(() => {
    return {
      total: SEED_MODULES.length,
      live: SEED_MODULES.filter((m) => m.status === 'live').length,
      mocked: SEED_MODULES.filter((m) => m.status === 'mocked').length,
      planned: SEED_MODULES.filter((m) => m.status === 'planned').length,
    }
  }, [])

  const selected = useMemo<ArchitectureModule | null>(() => {
    if (selectedId === null) return null
    return SEED_MODULES.find((m) => m.id === selectedId) ?? null
  }, [selectedId])

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
    <div className="flex min-h-screen bg-slate-50">
      <WorkspaceSidebar user={user} onSignOut={handleSignOut} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/85 px-6 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Network className="h-3 w-3 text-primary" />
            <span className="font-semibold uppercase tracking-wider text-slate-400">Workspace</span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-900">Architecture</span>
          </div>
          <NotificationsBell />
        </header>

        <section className="mx-auto w-full max-w-[1280px] px-6 py-8">
          {/* Hero */}
          <div className="dv-anim-fade-up relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-primary-900 p-6 text-white shadow-lg">
            <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-brand opacity-25 blur-3xl" />
            <div className="pointer-events-none absolute -left-10 -bottom-10 h-60 w-60 rounded-full bg-primary opacity-30 blur-3xl" />
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.12]"
              style={{
                backgroundImage: 'radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            />
            <div className="relative z-10 flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm ring-1 ring-white/20">
                <Building2 className="h-7 w-7 text-brand-300" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-200">
                  <Workflow className="h-3 w-3" />
                  System overview · internal
                </div>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">DataVerse Collab — architecture</h1>
                <p className="mt-1 text-sm leading-relaxed text-white/75">
                  Click any module to see what it does and jump straight to its mocked UI page.
                  Live = shipped with real backend. Mocked = clickable UI, no real persistence yet.
                  Planned = on the spec board.
                </p>
              </div>
            </div>
          </div>

          {/* Stat strip */}
          <div className="dv-anim-fade-up mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" style={{ animationDelay: '60ms' }}>
            <StatCard icon={Workflow} label="Modules" value={counts.total} hint="across 4 layers" accent="text-primary" accentBg="bg-primary-50" />
            <StatCard icon={ShieldCheck} label="Live" value={counts.live} hint="shipped with backend" accent="text-emerald-700" accentBg="bg-emerald-50" />
            <StatCard icon={CircleDashed} label="Mocked" value={counts.mocked} hint="clickable UI, no DB yet" accent="text-amber-700" accentBg="bg-amber-50" />
            <StatCard icon={GitBranch} label="Planned" value={counts.planned} hint="on the spec board" accent="text-slate-600" accentBg="bg-slate-100" />
          </div>

          {/* Diagram canvas */}
          <div className="dv-anim-fade-up mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" style={{ animationDelay: '120ms' }}>
            <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
              <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <Network className="h-3 w-3" />
                Module map
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null)
                  setHoveredId(null)
                }}
                className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-primary"
              >
                Reset selection
              </button>
            </header>
            <div
              className="relative bg-slate-50/30"
              style={{ aspectRatio: '1100 / 700', minHeight: 540 }}
              onClick={() => setSelectedId(null)}
            >
              <ArchitectureDiagram
                modules={SEED_MODULES}
                edges={SEED_MODULE_EDGES}
                selectedId={selectedId}
                hoveredId={hoveredId}
                onSelect={(id) => setSelectedId(id)}
                onHover={setHoveredId}
              />
            </div>
          </div>

          <Link
            href="/workspace"
            className="mt-6 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-primary"
          >
            ← Back to workspace
          </Link>
        </section>
      </div>

      <ModuleStatusDrawer
        open={selected !== null}
        module={selected}
        onClose={() => setSelectedId(null)}
      />
    </div>
  )
}
