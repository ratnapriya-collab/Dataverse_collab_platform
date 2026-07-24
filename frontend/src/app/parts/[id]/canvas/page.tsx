'use client'

/**
 * /parts/[id]/canvas — collaborative infinite whiteboard tied to a Part.
 *
 * Full-viewport layout: header nav + canvas board + floating toolbars.
 * Sits alongside /parts/[id] (viewer) and /parts/[id]/doc (editor) as
 * the third workspace surface — good for FMEA mapping, user-journey
 * storyboards, and design-review brainstorms.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Box, FileText, Users, Layers } from 'lucide-react'
import { ApiError, api } from '@/lib/api'
import type { PartDetail } from '@/types/api'
import { clearToken } from '@/lib/auth'
import CanvasBoard from '@/features/canvas/CanvasBoard'
import CanvasBottomToolbar from '@/features/canvas/CanvasBottomToolbar'
import CanvasColorPalette from '@/features/canvas/CanvasColorPalette'
import { useCanvasStore } from '@/features/canvas/canvasStore'

export default function CanvasPage(): JSX.Element {
  const params = useParams<{ id: string }>()
  const partId = params?.id ?? ''
  const router = useRouter()

  const [part, setPart] = useState<PartDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const nodes = useCanvasStore((s) => s.byPartId[partId] ?? [])

  useEffect(() => {
    if (partId === '') return
    let cancelled = false
    api.parts
      .get(partId)
      .then((p) => { if (!cancelled) setPart(p) })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          clearToken()
          router.replace('/login')
          return
        }
        setError(err instanceof Error ? err.message : 'Failed to load part')
      })
    return () => { cancelled = true }
  }, [partId, router])

  if (error !== null) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50">
        <p role="alert" className="text-sm font-semibold text-rose-600">{error}</p>
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
      <main className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Loading…
      </main>
    )
  }

  return (
    <main className="flex h-screen flex-col bg-white">
      {/* Header — matches the other workspace surfaces */}
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
          <Link
            href={`/parts/${partId}/cad-view`}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[11.5px] font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <Box className="h-3 w-3" />
            CAD View
          </Link>
          <Link
            href={`/parts/${partId}/doc`}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[11.5px] font-semibold text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <FileText className="h-3 w-3" />
            Document Editor
          </Link>
          <button
            type="button"
            aria-current="page"
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-800 px-3 py-1 text-[11.5px] font-bold text-cyan-300"
          >
            <Layers className="h-3 w-3" />
            Canvas
          </button>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[11px] text-slate-400">
            {part.name} · {nodes.length} element{nodes.length === 1 ? '' : 's'}
          </span>
          {/* Fake collaborator avatars — mirrors the reference video */}
          <div className="flex -space-x-2">
            {[
              { n: 'DE', c: '#22c55e' },
              { n: 'EM', c: '#a855f7' },
              { n: 'TM', c: '#3b82f6' },
              { n: 'TE', c: '#ec4899' },
            ].map((u) => (
              <span
                key={u.n}
                title={u.n}
                className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-900 text-[9px] font-bold text-white"
                style={{ backgroundColor: u.c }}
              >
                {u.n}
              </span>
            ))}
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1 text-[11px] font-bold text-white shadow-sm hover:shadow-md"
          >
            <Users className="h-3 w-3" />
            Share
          </button>
        </div>
      </header>

      {/* Canvas fills remaining height */}
      <section className="relative flex-1 overflow-hidden">
        <CanvasBoard partId={partId} />
        <CanvasColorPalette />
        <CanvasBottomToolbar />

        {/* Empty-state hint — visible only when the board is empty */}
        {nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
            <div className="rounded-lg bg-white/70 px-6 py-4 text-center backdrop-blur">
              <p className="text-[13px] font-bold text-slate-700">
                Blank canvas — start brainstorming
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                Pick <strong>Sticky</strong> below and click anywhere to drop a note ·
                <br />
                Ctrl+Scroll to zoom · middle-click to pan
              </p>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
