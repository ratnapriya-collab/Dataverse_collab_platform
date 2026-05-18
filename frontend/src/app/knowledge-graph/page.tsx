'use client'

/**
 * /knowledge-graph — M8 Knowledge Graph view.
 *
 * Workspace-wide view linking Standards → Decisions → Parts. Three columns:
 *   Sidebar (left)  · search + filter chips + grouped node list
 *   Graph (center)  · SVG canvas (KGGraph)
 *   Drawer (right)  · KGNodeDrawer, slides in when a node is selected
 */

import Link from 'next/link'
import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  GitBranch,
  Network,
  Search,
  Sparkles,
  Workflow,
} from 'lucide-react'
import NotificationsBell from '@/components/layout/NotificationsBell'
import WorkspaceSidebar from '@/components/layout/WorkspaceSidebar'
import StatCard from '@/components/workspace/StatCard'
import Toast, { type ToastState } from '@/components/ui/Toast'
import KGGraph from '@/components/kg/KGGraph'
import KGNodeDrawer from '@/components/kg/KGNodeDrawer'
import { ApiError, api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import {
  SEED_KG_EDGES,
  SEED_KG_NODES,
  type KGEdge,
  type KGNode,
} from '@/lib/mockWorkspace'
import type { UserRead } from '@/types/api'

type KindFilter = 'all' | KGNode['kind']

const KIND_OPTIONS: ReadonlyArray<{ id: KindFilter; label: string; dot: string }> = [
  { id: 'all', label: 'All', dot: 'bg-slate-400' },
  { id: 'standard', label: 'Standards', dot: 'bg-violet-500' },
  { id: 'decision', label: 'Decisions', dot: 'bg-amber-500' },
  { id: 'part', label: 'Parts', dot: 'bg-primary' },
]

export default function KnowledgeGraphPage(): JSX.Element {
  const router = useRouter()
  const [user, setUser] = useState<UserRead | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [search, setSearch] = useState('')

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

  const filteredNodes = useMemo<KGNode[]>(() => {
    const q = search.trim().toLowerCase()
    return SEED_KG_NODES.filter((n) => {
      if (kindFilter !== 'all' && n.kind !== kindFilter) return false
      if (q.length > 0) {
        const blob = `${n.label} ${n.meta ?? ''} ${n.state ?? ''}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [kindFilter, search])

  const filteredIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes])

  // Edges where both endpoints are still in the filtered set.
  const filteredEdges = useMemo<KGEdge[]>(() => {
    return SEED_KG_EDGES.filter((e) => filteredIds.has(e.from) && filteredIds.has(e.to))
  }, [filteredIds])

  const selectedNode = useMemo<KGNode | null>(() => {
    if (selectedId === null) return null
    return SEED_KG_NODES.find((n) => n.id === selectedId) ?? null
  }, [selectedId])

  const groupedSidebar = useMemo(() => {
    return {
      standards: filteredNodes.filter((n) => n.kind === 'standard'),
      decisions: filteredNodes.filter((n) => n.kind === 'decision'),
      parts: filteredNodes.filter((n) => n.kind === 'part'),
    }
  }, [filteredNodes])

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
        <Toast toast={toast} onClose={() => setToast(null)} />

        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/85 px-6 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Network className="h-3 w-3 text-primary" />
            <span className="font-semibold uppercase tracking-wider text-slate-400">Workspace</span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-900">Knowledge graph</span>
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
                <Workflow className="h-7 w-7 text-brand-300" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-brand-200">
                  <Sparkles className="h-3 w-3" />
                  Datum knowledge graph · M8
                </div>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">How everything is connected</h1>
                <p className="mt-1 text-sm leading-relaxed text-white/75">
                  Every decision in this workspace is anchored to a part and cites at least one
                  engineering standard. Click any node to see what it touches.
                </p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="dv-anim-fade-up mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" style={{ animationDelay: '60ms' }}>
            <StatCard
              icon={Workflow}
              label="Total nodes"
              value={SEED_KG_NODES.length}
              hint="standards + decisions + parts"
              accent="text-primary"
              accentBg="bg-primary-50"
            />
            <StatCard
              icon={GitBranch}
              label="Relations"
              value={SEED_KG_EDGES.length}
              hint="cites · supersedes · applies-to"
              accent="text-brand-700"
              accentBg="bg-brand-50"
            />
            <StatCard
              icon={Sparkles}
              label="Most-cited standard"
              value="ISO 1101"
              hint="2 decisions reference it"
              accent="text-violet-700"
              accentBg="bg-violet-50"
            />
            <StatCard
              icon={Network}
              label="Linked parts"
              value={SEED_KG_NODES.filter((n) => n.kind === 'part').length}
              hint="each has at least one decision"
              accent="text-emerald-700"
              accentBg="bg-emerald-50"
            />
          </div>

          {/* Filters + graph + sidebar */}
          <div className="dv-anim-fade-up mt-6 grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]" style={{ animationDelay: '120ms' }}>
            {/* Left sidebar — filters + node list */}
            <aside className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search nodes…"
                    className="h-8 w-full rounded-md border border-slate-200 bg-white pl-7 pr-3 text-[12px] placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {KIND_OPTIONS.map((opt) => {
                    const active = kindFilter === opt.id
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setKindFilter(opt.id)}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
                          active
                            ? 'bg-primary text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${opt.dot}`} />
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <SidebarGroup label="Standards" tone="violet" nodes={groupedSidebar.standards} selectedId={selectedId} onSelect={setSelectedId} onHover={setHoveredId} />
              <SidebarGroup label="Decisions" tone="amber" nodes={groupedSidebar.decisions} selectedId={selectedId} onSelect={setSelectedId} onHover={setHoveredId} />
              <SidebarGroup label="Parts" tone="teal" nodes={groupedSidebar.parts} selectedId={selectedId} onSelect={setSelectedId} onHover={setHoveredId} />
            </aside>

            {/* Center — graph canvas */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
                <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <Network className="h-3 w-3" />
                  Standards → Decisions → Parts
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
                style={{ aspectRatio: '1000 / 620', minHeight: 460 }}
                onClick={() => {
                  setSelectedId(null)
                }}
              >
                {/* Faint dot-grid */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-40"
                  style={{
                    backgroundImage:
                      'radial-gradient(rgba(15,23,42,0.07) 1px, transparent 1px)',
                    backgroundSize: '24px 24px',
                  }}
                />
                <KGGraph
                  nodes={filteredNodes}
                  edges={filteredEdges}
                  selectedId={selectedId}
                  hoveredId={hoveredId}
                  onSelect={(id) => {
                    setSelectedId(id)
                    setToast({ message: `Selected · ${id}`, tone: 'success' })
                  }}
                  onHover={setHoveredId}
                />
              </div>
            </div>
          </div>

          <Link
            href="/decisions"
            className="mt-6 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-primary"
          >
            ← Back to decisions feed
          </Link>
        </section>
      </div>

      <KGNodeDrawer
        open={selectedNode !== null}
        node={selectedNode}
        allNodes={SEED_KG_NODES}
        allEdges={SEED_KG_EDGES}
        onClose={() => setSelectedId(null)}
        onSelect={(id) => setSelectedId(id)}
      />
    </div>
  )
}

// ── Sidebar group ──────────────────────────────────────────────────────────

const SB_TONE: Record<'violet' | 'amber' | 'teal', { fg: string; dot: string }> = {
  violet: { fg: 'text-violet-700', dot: 'bg-violet-500' },
  amber: { fg: 'text-amber-700', dot: 'bg-amber-500' },
  teal: { fg: 'text-primary-700', dot: 'bg-primary' },
}

function SidebarGroup({
  label,
  tone,
  nodes,
  selectedId,
  onSelect,
  onHover,
}: {
  label: string
  tone: keyof typeof SB_TONE
  nodes: KGNode[]
  selectedId: string | null
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
}): JSX.Element {
  const t = SB_TONE[tone]
  if (nodes.length === 0) return <></>
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50/60 px-3 py-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} aria-hidden="true" />
        <p className={`text-[10px] font-semibold uppercase tracking-wider ${t.fg}`}>
          {label}
        </p>
        <span className="ml-auto rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-slate-600">
          {nodes.length}
        </span>
      </header>
      <ul className="divide-y divide-slate-100">
        {nodes.map((n) => {
          const active = selectedId === n.id
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onSelect(n.id)}
                onMouseEnter={() => onHover(n.id)}
                onMouseLeave={() => onHover(null)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition ${
                  active ? 'bg-primary-50' : 'hover:bg-slate-50'
                }`}
              >
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] font-semibold text-slate-900">
                  {n.label}
                </span>
                {n.state !== undefined && (
                  <span className="rounded-full bg-slate-100 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-600">
                    {n.state.slice(0, 3)}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
