'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import Logo from '@/components/ui/Logo'
import UserBadge from '@/components/ui/UserBadge'
import CreateDecisionModal from '@/components/decisions/CreateDecisionModal'
import DecisionsPanel from '@/components/decisions/DecisionsPanel'
import { ApiError, api, apiUrl } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import type {
  AnchorRead,
  Centroid,
  DecisionRead,
  DecisionState,
  PartDetail,
  UserRead,
} from '@/types/api'
import type { ViewerFace } from '@/components/viewer/ViewerCanvas'
import type { LabeledMarker } from '@/components/viewer/CommentLabels'

const ViewerCanvas = dynamic(() => import('@/components/viewer/ViewerCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
      Loading 3D viewer…
    </div>
  ),
})

// ── State → tone map (used by SVG leader lines + HTML labels) ───────────────

const STATE_TONE: Record<DecisionState, LabeledMarker['tone']> = {
  DRAFT: 'gray',
  PROPOSED: 'red',
  ACCEPTED: 'green',
  REJECTED: 'gray',
  SUPERSEDED: 'amber',
}

// PROPOSED beats ACCEPTED beats SUPERSEDED beats REJECTED beats DRAFT — the
// "loudest" state wins for the pin colour, so an open comment shows even if
// older accepted comments exist on the same face.
const STATE_PRIORITY: Record<DecisionState, number> = {
  PROPOSED: 4,
  ACCEPTED: 3,
  SUPERSEDED: 2,
  REJECTED: 1,
  DRAFT: 0,
}

function pickDominantDecision(decisions: DecisionRead[]): DecisionRead | null {
  if (decisions.length === 0) return null
  return [...decisions].sort(
    (a, b) => STATE_PRIORITY[b.state] - STATE_PRIORITY[a.state],
  )[0]
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + '…'
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function PartPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const partId = params?.id

  const [user, setUser] = useState<UserRead | null>(null)
  const [part, setPart] = useState<PartDetail | null>(null)
  const [decisions, setDecisions] = useState<DecisionRead[]>([])
  const [error, setError] = useState<string | null>(null)

  // Face-pick & modal flow.
  //
  // We don't create an anchor on pick anymore — that would leave orphan
  // cyan pins on every face the user clicked then cancelled out of. Instead
  // we keep the picked face in local state; the anchor is upserted only on
  // modal submit (inside CreateDecisionModal). Cancel = no DB write.
  const [pendingFace, setPendingFace] = useState<ViewerFace | null>(null)

  // Hover sync between cards and 3D pins.
  const [hoveredFaceUuid, setHoveredFaceUuid] = useState<string | null>(null)

  useEffect(() => {
    if (!partId) return
    let cancelled = false
    Promise.all([api.auth.me(), api.parts.get(partId), api.decisions.list(partId)])
      .then(([u, p, d]) => {
        if (cancelled) return
        setUser(u)
        setPart(p)
        setDecisions(d)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          clearToken()
          router.replace('/login')
          return
        }
        if (err instanceof ApiError && err.status === 404) {
          setError('Part not found, or you do not have access to it.')
          return
        }
        setError(err instanceof Error ? err.message : 'Failed to load part')
      })
    return () => {
      cancelled = true
    }
  }, [partId, router])

  // On face pick: stash the face data and open the modal. No API call yet.
  const handleFacePick = useCallback((face: ViewerFace) => {
    setPendingFace(face)
  }, [])

  const handleDecisionCreated = useCallback((_a: AnchorRead, d: DecisionRead) => {
    setDecisions((prev) => [d, ...prev])
    setPendingFace(null)
  }, [])

  const handleDecisionChanged = useCallback((d: DecisionRead) => {
    setDecisions((prev) => prev.map((x) => (x.id === d.id ? d : x)))
  }, [])

  // Derive the SVG/HTML callout list directly from decisions. Anchors
  // without comments are intentionally NOT rendered — the user's mental
  // model is "a pin = a comment", not "a pin = a click history".
  const labels = useMemo<LabeledMarker[]>(() => {
    const byFace = new Map<string, { decisions: DecisionRead[]; centroid: Centroid }>()
    for (const d of decisions) {
      if (d.anchor === null) continue
      const existing = byFace.get(d.anchor.face_uuid)
      if (existing) {
        existing.decisions.push(d)
      } else {
        byFace.set(d.anchor.face_uuid, {
          decisions: [d],
          centroid: d.anchor.centroid,
        })
      }
    }

    const labelList: LabeledMarker[] = []
    for (const [faceUuid, group] of byFace) {
      const dominant = pickDominantDecision(group.decisions)
      if (dominant === null) continue
      labelList.push({
        faceUuid,
        centroid: group.centroid,
        text: truncate(dominant.rationale, 48),
        tone: STATE_TONE[dominant.state],
      })
    }
    return labelList
  }, [decisions])

  function handleSignOut(): void {
    clearToken()
    router.replace('/login')
  }

  if (error !== null) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
          <Link
            href="/home"
            className="mt-3 inline-block text-xs text-primary hover:underline"
          >
            ← Back to your parts
          </Link>
        </div>
      </main>
    )
  }

  if (user === null || part === null) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-500">
        <span className="text-sm">Loading…</span>
      </main>
    )
  }

  const ext = (part.file_name.split('.').pop() ?? '').toLowerCase()
  const fileUrl = apiUrl(part.file_url)

  return (
    <main className="flex h-screen flex-col">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href="/home"
              aria-label="Back to home"
              title="Back to home"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-primary hover:text-primary hover:shadow-sm"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Logo compact markClassName="h-8 w-8" />
            <div className="min-w-0 border-l border-slate-200 pl-4">
              <h1 className="truncate text-sm font-semibold text-slate-900">
                {part.name}
              </h1>
              <p className="truncate text-xs text-slate-500">
                {part.file_name} · {part.content_hash.slice(0, 12)}…
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

      <section className="grid flex-1 grid-cols-[1fr_360px] overflow-hidden">
        <div className="relative bg-slate-100">
          <ViewerCanvas
            onFacePick={handleFacePick}
            partUrl={fileUrl}
            partExt={ext}
            labels={labels}
            onLabelClick={setHoveredFaceUuid}
          />
        </div>

        <aside className="dv-thin-scroll overflow-y-auto border-l border-slate-200 bg-white px-5 py-6">
          <h2 className="text-sm font-semibold text-slate-900">Part</h2>
          <dl className="mt-3 space-y-1 text-xs">
            <KV label="Name" value={part.name} />
            <KV label="File" value={part.file_name} mono />
            <KV label="Hash" value={part.content_hash.slice(0, 16) + '…'} mono />
            <KV
              label="Created"
              value={new Date(part.created_at).toLocaleString()}
            />
          </dl>

          <hr className="my-5 border-slate-200" />

          <DecisionsPanel
            decisions={decisions}
            onChanged={handleDecisionChanged}
            highlightedFaceUuid={hoveredFaceUuid}
            onHoverDecision={setHoveredFaceUuid}
          />

          {(ext === 'step' || ext === 'stp') && (
            <p className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              STEP rendering is stubbed in this build. The file is stored and
              downloadable; sample geometry is shown so you can still test
              face-pick.
            </p>
          )}
        </aside>
      </section>

      {pendingFace !== null && (
        <CreateDecisionModal
          partId={part.id}
          partName={part.name}
          face={{ uuid: pendingFace.uuid, centroid: pendingFace.centroid }}
          onClose={() => setPendingFace(null)}
          onCreated={handleDecisionCreated}
        />
      )}
    </main>
  )
}

function KV({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd
        className={`text-right text-slate-900 ${mono ? 'font-mono' : ''} break-all`}
      >
        {value}
      </dd>
    </div>
  )
}
