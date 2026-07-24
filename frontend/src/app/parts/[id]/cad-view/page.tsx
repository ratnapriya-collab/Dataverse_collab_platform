'use client'

/**
 * CAD View — three-column layout inspired by Quarter20:
 *   [ Assembly Tree | Operations | 3D Viewer + Bottom Toolbar ]
 *
 * Route: /parts/{id}/cad-view — separate from /parts/{id} so the
 * existing viewer/comments page stays unchanged. Re-uses ViewerCanvas
 * + the STEP→GLB pipeline + the modelTree that Viewer3D already
 * populates on GLB load.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Box, FileText, Loader2 } from 'lucide-react'
import { ApiError, api, apiUrl } from '@/lib/api'
import type { PartDetail } from '@/types/api'
import { clearToken } from '@/lib/auth'
import ViewerCanvas from '@/components/viewer/ViewerCanvas'
import AssemblyTreePanel from '@/features/cad-view/AssemblyTreePanel'
import OperationsPanel from '@/features/cad-view/OperationsPanel'
import ViewerBottomToolbar from '@/features/cad-view/ViewerBottomToolbar'
import MeshHighlightController from '@/features/cad-view/MeshHighlightController'
import ViewerPickController from '@/features/cad-view/ViewerPickController'
import { useOperationsStore } from '@/features/cad-view/operationsStore'
import { useViewerStore } from '@/_viewer/store/viewerStore'

export default function CadViewPage(): JSX.Element {
  const params = useParams<{ id: string }>()
  const partId = params?.id ?? ''
  const router = useRouter()

  const [part, setPart] = useState<PartDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [treeCollapsed, setTreeCollapsed] = useState(false)

  const loadForPart = useOperationsStore((s) => s.loadForPart)
  const hoveredMesh = useViewerStore((s) => s.hoveredMesh)

  useEffect(() => {
    if (partId === '') return
    let cancelled = false
    api.parts
      .get(partId)
      .then((p) => {
        if (cancelled) return
        setPart(p)
        loadForPart(partId)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          clearToken()
          router.replace('/login')
          return
        }
        setError(err instanceof Error ? err.message : 'Failed to load part')
      })
    return () => {
      cancelled = true
    }
  }, [partId, loadForPart, router])

  if (error !== null) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50">
        <p role="alert" className="text-sm font-semibold text-rose-600">
          {error}
        </p>
        <Link
          href="/home"
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:border-slate-400"
        >
          ← Back to your parts
        </Link>
      </main>
    )
  }

  if (part === null) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </main>
    )
  }

  // STEP → GLB URL swap (same as /parts/[id]/page.tsx). Server-side
  // tessellation runs on upload; here we just point at the /glb endpoint.
  const rawExt = (part.file_name.split('.').pop() ?? '').toLowerCase()
  const ext = rawExt === 'step' || rawExt === 'stp' ? 'glb' : rawExt
  const fileUrl =
    rawExt === 'step' || rawExt === 'stp'
      ? apiUrl(part.file_url.replace('/file?', '/glb?'))
      : apiUrl(part.file_url)

  return (
    <main className="flex h-screen flex-col bg-white">
      {/* Top header — Projects | CAD View (active) | Document Editor */}
      <header className="flex items-center gap-4 border-b border-slate-200 bg-slate-900 px-4 py-2 text-white">
        <Link
          href="/home"
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >
          <ArrowLeft className="h-3 w-3" />
          Projects
        </Link>
        <div className="h-4 w-px bg-slate-700" />
        <nav className="flex items-center gap-1">
          <button
            type="button"
            aria-current="page"
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-3 py-1 text-[11.5px] font-bold text-cyan-300"
          >
            <Box className="h-3 w-3" />
            CAD View
          </button>
          <Link
            href={`/parts/${partId}/doc`}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[11.5px] font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <FileText className="h-3 w-3" />
            Document Editor
          </Link>
        </nav>
        <div className="ml-auto text-[11px] text-slate-400">
          {part.name} · {part.file_name}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <AssemblyTreePanel
          collapsed={treeCollapsed}
          onToggleCollapsed={() => setTreeCollapsed((v) => !v)}
        />
        <OperationsPanel partId={partId} />

        <section className="relative flex-1 bg-slate-100">
          <ViewerCanvas partUrl={fileUrl} partExt={ext} />
          <MeshHighlightController />
          <ViewerPickController />
          <ViewerBottomToolbar />

          {hoveredMesh !== null && (
            <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-slate-900/85 px-3 py-1 text-[11px] font-semibold text-white shadow-md">
              {hoveredMesh}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
