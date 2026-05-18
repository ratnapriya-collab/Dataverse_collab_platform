'use client'

import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import Logo from '@/components/ui/Logo'
import UserBadge from '@/components/ui/UserBadge'
import CreateDecisionModal from '@/components/decisions/CreateDecisionModal'
import DecisionsPanel from '@/components/decisions/DecisionsPanel'
import RoleSwitcher, { type ViewRole } from '@/components/redaction/RoleSwitcher'
import PartnerViewBanner from '@/components/redaction/PartnerViewBanner'
import RedactedDecisionCard from '@/components/redaction/RedactedDecisionCard'
import DatumRedactionExplainer from '@/components/redaction/DatumRedactionExplainer'
import PartViewTabs from '@/components/parts/PartViewTabs'
import { ApiError, api, apiUrl } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import { SEED_FULL_DECISIONS, SEED_MEMBERS } from '@/lib/mockWorkspace'
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

// ── Mock-ID detection + seed-data builders ──────────────────────────────────

/** Demo part IDs surfaced by the Project Hub Parts grid look like `demo_1`. */
function isMockPartId(id: string): boolean {
  return /^demo_[A-Za-z0-9_-]+$/.test(id)
}

/**
 * Build a self-contained PartDetail for a demo id — name + file-name derived
 * from any decision that references this part_id, with a stable fake hash.
 * Field shape exactly matches the real /api/parts/{id} response so the rest
 * of the page doesn't have to special-case anything.
 */
function buildMockPart(partId: string): PartDetail {
  const sample = SEED_FULL_DECISIONS.find((d) => d.part_id === partId)
  const name = sample?.part_name ?? partId
  // Pseudo-deterministic 64-hex "content hash" so the header chip looks real.
  let h = 0
  for (let i = 0; i < partId.length; i++) h = (h * 31 + partId.charCodeAt(i)) >>> 0
  const hash = (h.toString(16).padStart(8, '0') + '0').repeat(8).slice(0, 64)
  return {
    id: partId,
    name,
    file_name: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.step`,
    content_hash: hash,
    face_count: 0,
    edge_count: 0,
    owner_id: 'mock',
    created_at: new Date().toISOString(),
    file_url: '',
    file_url_expires_in: 3600,
  }
}

/**
 * Synthesise DecisionRead[] for a demo part from SEED_FULL_DECISIONS. The
 * resulting objects are shape-compatible with the real DecisionRead so the
 * DecisionsPanel + CommentLabels render without any branching.
 */
function buildMockDecisions(partId: string): DecisionRead[] {
  const memberById = new Map(SEED_MEMBERS.map((m) => [m.name, m]))
  return SEED_FULL_DECISIONS.filter((d) => d.part_id === partId).map((d, i) => {
    // Map our mock state union to the real DecisionState (DRAFT is API-only).
    const state: DecisionState =
      d.state === 'DRAFT' ? 'DRAFT' : (d.state as DecisionState)
    const author = memberById.get(d.author_name)
    // Spread anchor centroids over a small grid so pins don't stack.
    const centroid = { x: -1 + (i % 3) * 0.8, y: ((i % 2) - 0.5) * 0.6, z: 0.5 }
    return {
      id: d.id,
      part_id: partId,
      anchor_id: d.anchor_id,
      author_id: author?.id ?? 'mock',
      state,
      rationale: d.rationale,
      accepted_at: state === 'ACCEPTED' ? d.created_at : null,
      accepted_by_id: state === 'ACCEPTED' ? 'mock' : null,
      created_at: d.created_at,
      updated_at: d.created_at,
      author:
        author !== undefined
          ? { id: author.id, name: author.name, email: author.email }
          : null,
      anchor: {
        id: d.anchor_id,
        face_uuid: d.anchor_id,
        centroid,
      },
    }
  })
}

// ── Partner-view redaction heuristic ────────────────────────────────────────

/**
 * Stable demo rule for "is this decision internal-only?":
 *   • DRAFT state         → internal-flag
 *   • Cost-y keywords     → cost-keyword
 *   • Every 4th by hash   → admin-only-thread
 *
 * Real product would lean on an explicit visibility column. The heuristic
 * keeps the demo deterministic against the live backend.
 */
type RedactionReason = 'internal-flag' | 'cost-keyword' | 'admin-only-thread'

function redactionReason(d: DecisionRead): RedactionReason | null {
  if (d.state === 'DRAFT') return 'internal-flag'
  if (/(\bcost\b|\bmargin\b|\bquote\b|\bsupplier\s+rate\b|\bpricing\b|\binternal\b)/i.test(d.rationale)) {
    return 'cost-keyword'
  }
  // Hash the id so every 4th decision is "admin-only-thread" — adds variety
  // even on a workspace with only ACCEPTED decisions.
  let h = 0
  for (let i = 0; i < d.id.length; i++) h = (h * 31 + d.id.charCodeAt(i)) | 0
  if (Math.abs(h) % 4 === 0) return 'admin-only-thread'
  return null
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function PartPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const partId = params?.id

  // Partner-view state — driven by ?view=<role>
  const viewParam = (searchParams?.get('view') ?? 'admin') as ViewRole
  const activeRole: ViewRole = viewParam === 'partner' ? 'partner' : viewParam === 'oem' ? 'oem' : 'admin'
  const isPartner = activeRole === 'partner'
  const [showWhatsHidden, setShowWhatsHidden] = useState(false)

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

    // ── Mock-ID fast path ────────────────────────────────────────────
    // The Workspace → Project Hub flow surfaces part cards whose ids look
    // like `demo_1`, `demo_2` (derived from SEED_FULL_DECISIONS). Those
    // ids don't exist in the real backend, so a normal fetch would 404.
    // For any id matching that mock shape we skip the API entirely and
    // build a self-contained PartDetail + decisions list from seed data,
    // so the same viewer renders with sample geometry.
    if (isMockPartId(partId)) {
      api.auth
        .me()
        .then((u) => {
          if (cancelled) return
          setUser(u)
          setPart(buildMockPart(partId))
          setDecisions(buildMockDecisions(partId))
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
    }

    // ── Real-backend fetch (unchanged) ──────────────────────────────
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

  // Partition decisions by redaction policy when in partner view.
  const { visibleDecisions, redactedDecisions } = useMemo(() => {
    if (!isPartner) return { visibleDecisions: decisions, redactedDecisions: [] as DecisionRead[] }
    const visible: DecisionRead[] = []
    const redacted: DecisionRead[] = []
    for (const d of decisions) {
      if (redactionReason(d) !== null) redacted.push(d)
      else visible.push(d)
    }
    return { visibleDecisions: visible, redactedDecisions: redacted }
  }, [decisions, isPartner])

  // Comments redacted by Datum — a counter for the banner copy (real product
  // would deep-comment-scan; here we just attribute 2 redacted comments per
  // hidden decision so the banner shows realistic numbers).
  const hiddenCommentsCount = redactedDecisions.length * 2

  // Decisions actually used to build labels + the side panel.
  const labelSourceDecisions = isPartner && !showWhatsHidden ? visibleDecisions : decisions

  // Derive the SVG/HTML callout list directly from decisions. Anchors
  // without comments are intentionally NOT rendered — the user's mental
  // model is "a pin = a comment", not "a pin = a click history".
  const labels = useMemo<LabeledMarker[]>(() => {
    const byFace = new Map<string, { decisions: DecisionRead[]; centroid: Centroid }>()
    for (const d of labelSourceDecisions) {
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
      const ts = new Date(dominant.created_at).getTime()
      const ageMin = Math.max(1, Math.round((Date.now() - ts) / 60_000))
      const when =
        ageMin < 60
          ? `${ageMin}m ago`
          : ageMin < 1440
          ? `${Math.round(ageMin / 60)}h ago`
          : `${Math.round(ageMin / 1440)}d ago`

      // Auto-extract citation-like tokens from the rationale to render as
      // chip tags in the card. Matches AS9100 §6.4.3, ISO 1101, DEC-…, etc.
      const tagMatches = dominant.rationale.match(
        /\b(?:AS\s?\d+(?:\s§\d+(?:\.\d+)+)?|ISO\s?\d+(?:-\d+)?|ASME\s?Y?\d+\.\d+|MIL-STD-\d+|DIN\s?\d+|OSHA-\d+\.\d+|DEC-[A-Z0-9-]+)/g,
      )
      const tags = tagMatches !== null ? Array.from(new Set(tagMatches)).slice(0, 3) : []

      labelList.push({
        faceUuid,
        centroid: group.centroid,
        text: truncate(dominant.rationale, 180),
        tone: STATE_TONE[dominant.state],
        authorName: dominant.author?.name ?? 'You',
        when,
        tags,
        replyCount: group.decisions.length > 1 ? group.decisions.length - 1 : 0,
        locked: dominant.state === 'ACCEPTED' || dominant.state === 'SUPERSEDED',
      })
    }
    return labelList
  }, [labelSourceDecisions])

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
            <RoleSwitcher active={activeRole} />
            <span className="hidden h-5 w-px bg-slate-200 sm:inline-block" aria-hidden="true" />
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

      {/* Partner-view banner — admin previewing as supplier */}
      {isPartner && (
        <PartnerViewBanner
          partnerName="Sarah Chen"
          partnerOrg="Supplier Reviewer · Acme Manufacturing"
          hiddenDecisions={redactedDecisions.length}
          hiddenComments={hiddenCommentsCount}
          showWhatsHidden={showWhatsHidden}
          onToggleShow={() => setShowWhatsHidden((v) => !v)}
          partPath={`/parts/${partId ?? ''}`}
        />
      )}

      <PartViewTabs
        partId={partId ?? ''}
        active="3d"
        contextChip={`${labels.length} pins · ${decisions.length} ${decisions.length === 1 ? 'decision' : 'decisions'}`}
      />

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

          {/* Part tools quick-nav (mock companion screens) */}
          <div className="mt-4 grid grid-cols-2 gap-1.5">
            <Link
              href={`/parts/${part.id}/what-changed`}
              className="group flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-primary hover:bg-primary-50 hover:text-primary"
            >
              <span className="text-base leading-none">↻</span>
              What changed
            </Link>
            <Link
              href={`/parts/${part.id}/walkthrough`}
              className="group flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-primary hover:bg-primary-50 hover:text-primary"
            >
              <span className="text-base leading-none">▶</span>
              Walkthrough
            </Link>
            <Link
              href={`/parts/${part.id}/concierge`}
              className="group flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700"
            >
              <span className="text-base leading-none">✨</span>
              Concierge
            </Link>
            <Link
              href={`/parts/${part.id}/plm-push`}
              className="group flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-primary hover:bg-primary-50 hover:text-primary"
            >
              <span className="text-base leading-none">↗</span>
              Push to PLM
            </Link>
          </div>

          <hr className="my-5 border-slate-200" />

          {/* Partner-view redaction layer — only when previewing as supplier */}
          {isPartner && (
            <div className="mb-5 space-y-3">
              <DatumRedactionExplainer
                hiddenDecisions={redactedDecisions.length}
                hiddenComments={hiddenCommentsCount}
              />
              {redactedDecisions.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden="true" />
                    Hidden by Datum ({redactedDecisions.length})
                  </div>
                  <div className="space-y-2">
                    {redactedDecisions.map((d) => {
                      const reason = redactionReason(d) ?? 'internal-flag'
                      return (
                        <RedactedDecisionCard
                          key={d.id}
                          decisionId={d.id}
                          reason={reason}
                          showWhatsHidden={showWhatsHidden}
                          hiddenRationale={d.rationale}
                          hiddenAuthorName={d.author?.name}
                        />
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <DecisionsPanel
            decisions={isPartner ? visibleDecisions : decisions}
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
