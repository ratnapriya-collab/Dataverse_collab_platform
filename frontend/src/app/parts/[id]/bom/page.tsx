'use client'

/**
 * /parts/[id]/bom — Bill of Materials view.
 *
 * CoLab-style layout: PartViewTabs at top (3D | 2D | BOM), collapsible
 * BOM tree on the left, selected-item detail panel on the right.
 */

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowUpRight,
  Download,
  Hash,
  ListTree,
  MessageSquare,
  Package,
  Search,
} from 'lucide-react'
import Logo from '@/components/ui/Logo'
import UserBadge from '@/components/ui/UserBadge'
import PartViewTabs from '@/components/parts/PartViewTabs'
import BOMTree from '@/components/bom/BOMTree'
import { ApiError, api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import { SEED_BOM, type MockBomNode } from '@/lib/mockWorkspace'
import type { UserRead } from '@/types/api'

function flatten(node: MockBomNode): MockBomNode[] {
  return [node, ...(node.children ?? []).flatMap(flatten)]
}

function findById(root: MockBomNode, id: string): MockBomNode | null {
  if (root.id === id) return root
  for (const c of root.children ?? []) {
    const hit = findById(c, id)
    if (hit !== null) return hit
  }
  return null
}

export default function PartBomPage(): JSX.Element {
  const params = useParams<{ id: string }>()
  const partId = params?.id ?? 'demo_part'
  const router = useRouter()
  const [user, setUser] = useState<UserRead | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(SEED_BOM.id)

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

  const flat = useMemo(() => flatten(SEED_BOM), [])
  const selected = useMemo<MockBomNode | null>(
    () => (selectedId !== null ? findById(SEED_BOM, selectedId) : null),
    [selectedId],
  )
  const partsCount = flat.filter((n) => (n.children?.length ?? 0) === 0).length
  const totalDecisions = flat.reduce((s, n) => s + n.decisions_count, 0)

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
                {SEED_BOM.name}
              </h1>
              <p className="truncate text-xs text-slate-500">
                {SEED_BOM.part_number} · Rev B · {partsCount} parts · {flat.length - 1} BOM lines
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
        active="bom"
        contextChip={`${flat.length - 1} lines · ${totalDecisions} decisions`}
      />

      <section className="grid flex-1 grid-cols-[1fr_360px] overflow-hidden bg-slate-50">
        {/* BOM tree */}
        <div className="overflow-y-auto px-6 py-6">
          {/* Top stats */}
          <div className="mb-4 grid grid-cols-3 gap-3">
            <StatTile icon={ListTree} label="BOM lines" value={flat.length - 1} accent="text-primary" bg="bg-primary-50" />
            <StatTile icon={Package} label="Unique parts" value={partsCount} accent="text-emerald-700" bg="bg-emerald-50" />
            <StatTile icon={MessageSquare} label="Decisions" value={totalDecisions} accent="text-amber-700" bg="bg-amber-50" hint="across the assembly" />
          </div>

          {/* Filter / actions row */}
          <div className="mb-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter BOM (decorative)"
                aria-label="Filter BOM"
                className="h-8 w-full rounded-md border border-slate-200 bg-white pl-7 pr-3 text-xs placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Download className="h-3 w-3" />
              Export CSV
            </button>
          </div>

          <BOMTree root={SEED_BOM} selectedId={selectedId} onSelect={setSelectedId} />
        </div>

        {/* Detail panel */}
        <aside className="border-l border-slate-200 bg-white">
          {selected !== null ? (
            <div className="dv-thin-scroll h-full overflow-y-auto px-5 py-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary">
                  <Package className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {selected.children !== undefined && selected.children.length > 0 ? 'Subassembly' : 'Leaf part'}
                  </p>
                  <h2 className="mt-0.5 text-base font-bold text-slate-900">{selected.name}</h2>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-500">{selected.part_number}</p>
                </div>
              </div>

              <dl className="mt-5 space-y-2 text-[12px]">
                <Row label="Quantity">
                  <span className="font-mono tabular-nums">× {selected.quantity}</span>
                </Row>
                {selected.material !== undefined && (
                  <Row label="Material">{selected.material}</Row>
                )}
                {selected.supplier_ref !== undefined && (
                  <Row label="Supplier">
                    <span className="font-mono text-[11px]">{selected.supplier_ref}</span>
                  </Row>
                )}
                <Row label="Decisions on this row">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ${
                      selected.decisions_count > 0
                        ? 'bg-amber-50 text-amber-700 ring-amber-200'
                        : 'bg-slate-100 text-slate-600 ring-slate-200'
                    }`}
                  >
                    <MessageSquare className="h-2.5 w-2.5" />
                    {selected.decisions_count}
                  </span>
                </Row>
              </dl>

              {selected.part_id !== undefined && (
                <Link
                  href={`/parts/${selected.part_id}`}
                  className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-700"
                >
                  Open in viewer
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              )}

              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-[11px] text-slate-600">
                <Hash className="-mt-0.5 mr-1 inline h-2.5 w-2.5 text-slate-400" />
                BOM line · derived from the latest assembly upload · always traced back to a decision history.
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-xs text-slate-500">
              Pick any row to see its details.
            </div>
          )}
        </aside>
      </section>

      <footer className="border-t border-slate-200 bg-slate-50/80 px-6 py-2 text-[10px] text-slate-500">
        <ListTree className="-mt-0.5 mr-1.5 inline h-3 w-3" />
        Click a row to inspect · expand subassemblies with the chevrons · jump to any sub-part&rsquo;s viewer with Open
      </footer>
    </main>
  )
}

// ── tiny helpers ────────────────────────────────────────────────────────────

function StatTile({
  icon: Icon,
  label,
  value,
  accent,
  bg,
  hint,
}: {
  icon: typeof ListTree
  label: string
  value: number
  accent: string
  bg: string
  hint?: string
}): JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-md ${bg} ${accent}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      </div>
      <p className="mt-1.5 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      {hint !== undefined && <p className="text-[10px] text-slate-500">{hint}</p>}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-1.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{children}</dd>
    </div>
  )
}
