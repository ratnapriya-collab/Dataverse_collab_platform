'use client'

import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Images, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import Logo from '@/components/ui/Logo'
import UserBadge from '@/components/ui/UserBadge'
import CreateDecisionModal from '@/components/decisions/CreateDecisionModal'
import RoleSwitcher, { type ViewRole } from '@/components/redaction/RoleSwitcher'
import PartnerViewBanner from '@/components/redaction/PartnerViewBanner'
import PartViewTabs from '@/components/parts/PartViewTabs'
import PartConversationHub from '@/components/parts/PartConversationHub'
import { useCommentsStore } from '@/features/comments/store/commentsStore'
import { useThreads as useV2Threads } from '@/features/comments/hooks/useThreadsStorage'
import CaptureButton from '@/features/capture/components/CaptureButton'
import CaptureGallery from '@/features/capture/components/CaptureGallery'
import { useViewerCapture } from '@/features/capture/hooks/useViewerCapture'
import { useCaptureStore } from '@/features/capture/store/captureStore'
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

// Visual ceiling for "+" anchor pins drawn on the viewer. More pins than
// this turn the model into a confetti field; the side panel still lists
// every decision so nothing is hidden, just not redundantly rendered.
const MAX_VISIBLE_PINS = 7

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
    // Spread anchor centroids across the sample geometry (cylinder · sphere
    // · cube) using a deterministic pseudo-random so 15+ pins don't stack.
    // Hash the index with three coprime primes → reproducible-but-varied XYZ.
    const seed = (i + 1) * 31
    const centroid = {
      x: -2.4 + ((seed * 73) % 100) / 20,       // -2.4 → +2.6
      y: -0.9 + ((seed * 47) % 100) / 55,       // -0.9 → +0.9
      z: 0.1 + ((seed * 19) % 100) / 60,        //  0.1 → +1.8
    }
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
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [slowWarning, setSlowWarning] = useState(false)
  const [screenSignal, setScreenSignal] = useState<{
    redactedCount: number
    safeSummary?: string | null
    source: string
    confidence?: number
  } | null>(null)
  // Right rail (conversation hub) collapse state — gives the 3D viewer the
  // full width when the user wants to focus on geometry without distractions.
  const [rightRailCollapsed, setRightRailCollapsed] = useState(false)

  // Capture-View feature — wraps the WebGL canvas + DOM overlays in a ref
  // we can hand to html2canvas. Gallery slides in from the right edge.
  const viewerContainerRef = useRef<HTMLDivElement | null>(null)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const captureCount = useCaptureStore((s) => s.captures.length)
  const cleanupCaptures = useCaptureStore((s) => s.cleanup)
  const loadCapturesForPart = useCaptureStore((s) => s.loadForPart)

  // Hydrate captures from Postgres whenever the part loads. We wait for the
  // part record so we can pass partName (used in PDF cover + thumbnails).
  // The store guards against stale loads when the partId changes mid-fetch.
  useEffect(() => {
    if (partId === undefined || part === null) return
    void loadCapturesForPart(part.id, part.name)
  }, [partId, part, loadCapturesForPart])

  // Release blob URLs on unmount. Do NOT delete the server-side captures
  // here — they're the persistent source of truth and should survive
  // every page nav, browser close, and re-login.
  useEffect(() => {
    return () => cleanupCaptures()
  }, [cleanupCaptures])

  // Smart-pin visibility (v2): the floating annotation card in the viewer
  // only shows when the user clicks a comment in the panel OR clicks the
  // matching pin on the model. Pins are always visible; the expensive card
  // chrome stays collapsed until summoned. Click anywhere else clears.
  const [selectedFaceUuid, setSelectedFaceUuid] = useState<string | null>(null)
  // Toggle: if you click the same face twice, the card closes.
  const handleSelectFace = useCallback((faceUuid: string | null) => {
    setSelectedFaceUuid((prev) => (prev === faceUuid ? null : faceUuid))
  }, [])

  // Bridge: when the v2 CommentsPanel selects a thread, derive its faceUuid
  // and drive the floating-card visibility on the viewer. One state, two
  // surfaces — sidebar + viewer stay locked in sync.
  const selectedThreadId = useCommentsStore((s) => s.selectedThreadId)
  const { threads: v2Threads } = useV2Threads(partId ?? '')
  useEffect(() => {
    if (selectedThreadId === null) {
      setSelectedFaceUuid(null)
      return
    }
    const thread = v2Threads.find((t) => t.id === selectedThreadId)
    if (thread !== undefined) setSelectedFaceUuid(thread.anchor.faceUuid)
  }, [selectedThreadId, v2Threads])

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
    setError(null)
    setSlowWarning(false)
    const slowTimer = setTimeout(() => {
      if (!cancelled) setSlowWarning(true)
    }, 6_000)

    function handleAuthFailure(err: unknown): boolean {
      if (err instanceof ApiError && err.status === 401) {
        clearToken()
        router.replace('/login')
        return true
      }
      return false
    }

    function commonErrorMessage(err: unknown, fallback: string): string {
      if (err instanceof ApiError) {
        if (err.code === 'timeout') return 'Request timed out — backend may be slow or offline.'
        if (err.code === 'network_error') return 'Network error — is the backend running on :4000?'
        if (err.status === 404) return 'Part not found, or you do not have access to it.'
        return err.message
      }
      return err instanceof Error ? err.message : fallback
    }

    // User loads independently so the layout can render as soon as auth resolves.
    api.auth
      .me()
      .then((u) => {
        if (!cancelled) setUser(u)
      })
      .catch((err: unknown) => {
        if (cancelled || handleAuthFailure(err)) return
        setError(commonErrorMessage(err, 'Failed to load your profile'))
      })

    if (isMockPartId(partId)) {
      // Mock fast path — no network calls needed for part/decisions.
      if (!cancelled) {
        setPart(buildMockPart(partId))
        setDecisions(buildMockDecisions(partId))
      }
      return () => {
        cancelled = true
        clearTimeout(slowTimer)
      }
    }

    api.parts
      .get(partId)
      .then((p) => {
        if (!cancelled) setPart(p)
      })
      .catch((err: unknown) => {
        if (cancelled || handleAuthFailure(err)) return
        setError(commonErrorMessage(err, 'Failed to load part'))
      })

    api.decisions
      .list(partId)
      .then((d) => {
        if (!cancelled) setDecisions(d)
      })
      .catch((err: unknown) => {
        if (cancelled || handleAuthFailure(err)) return
        // Decisions failure is non-fatal — the viewer still works without pins.
        // eslint-disable-next-line no-console
        console.warn('Failed to load decisions', err)
      })

    return () => {
      cancelled = true
      clearTimeout(slowTimer)
    }
  }, [partId, router, loadAttempt])

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

  // Datum AI · Hook 3 · Screen Boundary
  // Call once per (part, role) when partner/oem view becomes active. The
  // response writes a DATUM_CALLED audit row on the backend (Rule #6) and
  // surfaces a "Live screen" badge in the redaction explainer. Fire-and-forget;
  // failures are non-fatal — the client heuristic still drives the actual UI
  // redaction so partner view always works even if Datum is offline.
  useEffect(() => {
    if (!isPartner || partId === undefined || partId === null || partId === '') return
    if (decisions.length === 0) return
    let cancelled = false
    api.datum
      .screenBoundary({
        thread_id: `part:${partId}`,
        viewer_role: activeRole,
        decision_ids: decisions.map((d) => d.id),
      })
      .then((res) => {
        if (cancelled) return
        setScreenSignal({
          redactedCount: res.redacted_comment_ids.length,
          safeSummary: res.safe_summary,
          source: res.source,
          confidence: res.redacted_comment_ids.length > 0 ? 0.78 : 1.0,
        })
      })
      .catch(() => {
        // Non-fatal — clear any stale signal so the badge disappears cleanly.
        if (!cancelled) setScreenSignal(null)
      })
    return () => {
      cancelled = true
    }
  }, [isPartner, partId, activeRole, decisions])

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
    // Cap visible pins to keep the viewer readable. The side-panel
    // decisions list still shows everything; we just stop painting the
    // SVG markers past N so the model isn't a sea of "+" glyphs.
    return labelList.slice(0, MAX_VISIBLE_PINS)
  }, [labelSourceDecisions])

  function handleSignOut(): void {
    clearToken()
    router.replace('/login')
  }

  if (error !== null) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md text-center">
          <p role="alert" className="text-sm font-semibold text-red-600">
            {error}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setError(null)
                setLoadAttempt((n) => n + 1)
              }}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-700"
            >
              Retry
            </button>
            <Link
              href="/home"
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300"
            >
              ← Back to your parts
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (user === null || part === null) {
    const stage = user === null ? 'Authenticating…' : 'Loading part…'
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 text-slate-500">
        <span className="inline-flex h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-primary" aria-hidden="true" />
        <span className="text-sm">{stage}</span>
        {slowWarning && (
          <div className="mt-2 max-w-md text-center text-[11.5px] leading-relaxed text-slate-500">
            Taking longer than expected. Check that the backend is running on <code className="font-mono text-slate-700">localhost:4000</code> — requests will time out automatically after 15s.
            <button
              type="button"
              onClick={() => setLoadAttempt((n) => n + 1)}
              className="ml-2 rounded border border-slate-300 bg-white px-2 py-0.5 font-semibold text-slate-700 transition hover:border-primary/40 hover:text-primary"
            >
              Retry now
            </button>
          </div>
        )}
      </main>
    )
  }

  const rawExt = (part.file_name.split('.').pop() ?? '').toLowerCase()
  // The viewer's Babylon SceneLoader can't tessellate STEP directly, so the
  // backend converts STEP → GLB on upload (see step_to_glb.py). We route the
  // viewer to that GLB instead of the raw STEP — the /glb endpoint accepts
  // the same short-lived file token as /file, so a plain URL swap works.
  const ext = rawExt === 'step' || rawExt === 'stp' ? 'glb' : rawExt
  const fileUrl =
    rawExt === 'step' || rawExt === 'stp'
      ? apiUrl(part.file_url.replace('/file?', '/glb?'))
      : apiUrl(part.file_url)

  return (
    <main className="flex h-screen flex-col">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            {/* Panel toggle — first thing on the left so the user can free up
                viewer space without traveling across the header. */}
            <button
              type="button"
              onClick={() => setRightRailCollapsed((c) => !c)}
              aria-label={rightRailCollapsed ? 'Show conversation panel' : 'Hide conversation panel'}
              aria-pressed={rightRailCollapsed}
              title={rightRailCollapsed ? 'Show conversation panel' : 'Hide conversation panel (more space for the 3D viewer)'}
              className={[
                'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition',
                rightRailCollapsed
                  ? 'border-primary/30 bg-primary-50 text-primary hover:bg-primary-100'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900',
              ].join(' ')}
            >
              {rightRailCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
            <Link
              href="/home"
              aria-label="Back to home"
              title="Back to home"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-primary hover:text-primary hover:shadow-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
            <Logo compact markClassName="h-7 w-7" />
            <div className="min-w-0 border-l border-slate-200 pl-3">
              <h1 className="truncate text-[13px] font-semibold leading-tight text-slate-900">
                {part.name}
              </h1>
              <p className="truncate text-[10.5px] text-slate-500">
                {part.file_name} · {part.content_hash.slice(0, 12)}…
              </p>
            </div>
            <span className="hidden h-5 w-px shrink-0 bg-slate-200 sm:inline-block" aria-hidden="true" />
            <PartViewTabs
              partId={partId ?? ''}
              active="3d"
              contextChip={`${labels.length} pins · ${decisions.length} ${decisions.length === 1 ? 'decision' : 'decisions'}`}
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <RoleSwitcher active={activeRole} />
            <span className="hidden h-5 w-px bg-slate-200 sm:inline-block" aria-hidden="true" />
            <UserBadge name={user.name} email={user.email} />
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-slate-900"
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

      <section
        className={[
          'grid flex-1 overflow-hidden transition-[grid-template-columns] duration-200',
          rightRailCollapsed ? 'grid-cols-[1fr]' : 'grid-cols-[360px_1fr]',
        ].join(' ')}
      >
        {/* Left rail — Part conversation hub (compact, tabbed).
            Fully hidden when collapsed → the 3D viewer takes the full width.
            The toggle button lives in the page header (top-right). */}
        {!rightRailCollapsed && (
          <PartConversationHub
            partId={part.id}
            partName={part.name}
            partFileName={part.file_name}
            partContentHash={part.content_hash}
            partCreatedAt={part.created_at}
            decisions={decisions}
            visibleDecisions={visibleDecisions}
            redactedDecisions={redactedDecisions}
            onDecisionChanged={handleDecisionChanged}
            highlightedFaceUuid={hoveredFaceUuid}
            onHoverDecision={setHoveredFaceUuid}
            isPartner={isPartner}
            showWhatsHidden={showWhatsHidden}
            hiddenCommentsCount={hiddenCommentsCount}
            screenSignal={screenSignal}
            reasonFor={redactionReason}
            currentUser={{ id: user.id, name: user.name }}
          />
        )}

        <div ref={viewerContainerRef} className="relative bg-slate-100">
          <ViewerCanvas
            onFacePick={handleFacePick}
            partUrl={fileUrl}
            partExt={ext}
            labels={labels}
            // Step 1: clicking a pin toggles its floating card. Same pin
            // twice closes the card.
            onLabelClick={(faceUuid) => {
              setHoveredFaceUuid(faceUuid)
              handleSelectFace(faceUuid)
            }}
            // Step 2: clicking the floating card opens the right-side
            // thread drawer for that comment.
            onCardClick={(faceUuid) => {
              const thread = v2Threads.find((t) => t.anchor.faceUuid === faceUuid)
              if (thread !== undefined) {
                useCommentsStore.getState().selectThread(thread.id, 'pin')
                useCommentsStore.getState().openDrawer()
              }
            }}
            cardVisibility="selected-only"
            visibleCardFor={selectedFaceUuid}
          />
          {/* Capture-view affordance — floats over the viewer top-right. */}
          <CaptureToolbar
            viewerContainerRef={viewerContainerRef}
            partId={part.id}
            partName={part.name}
            captureCount={captureCount}
            onOpenGallery={() => setGalleryOpen(true)}
            onCaptureError={(err) => {
              // eslint-disable-next-line no-console
              console.error('Capture failed:', err)
              window.alert(`Capture failed: ${err.message}`)
            }}
            onCaptureSuccess={() => {
              if (!galleryOpen) setGalleryOpen(true)
            }}
          />
        </div>

        {/* STEP-stub notice was moved into the hub footer once partner mode
            is off — surface only when relevant. Inline here for now so we
            don't lose it. */}
        {(ext === 'step' || ext === 'stp') && (
          <p className="hidden">
            STEP rendering is stubbed in this build.
          </p>
        )}
      </section>

      {pendingFace !== null && (
        <CreateDecisionModal
          partId={part.id}
          partName={part.name}
          face={{ uuid: pendingFace.uuid, centroid: pendingFace.centroid }}
          user={user}
          onClose={() => setPendingFace(null)}
          onCreated={handleDecisionCreated}
        />
      )}

      {/* Capture gallery — slides in from the right edge over everything. */}
      <CaptureGallery
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        partName={part.name}
      />
    </main>
  )
}

/**
 * CaptureToolbar — small floating cluster on the viewer's top-right.
 * Renders the Capture button + a chip linking to the gallery when there's
 * something captured. Extracted so the hook usage stays close to the ref.
 */
function CaptureToolbar({
  viewerContainerRef,
  partId,
  partName,
  captureCount,
  onOpenGallery,
  onCaptureError,
  onCaptureSuccess,
}: {
  viewerContainerRef: React.RefObject<HTMLElement>
  partId: string
  partName: string
  captureCount: number
  onOpenGallery: () => void
  onCaptureError: (err: Error) => void
  onCaptureSuccess: () => void
}): JSX.Element {
  const { capture, isReady } = useViewerCapture({
    viewerContainerRef,
    partId,
    partName,
  })
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-20 flex items-center gap-2">
      <CaptureButton
        onCapture={capture}
        onSuccess={onCaptureSuccess}
        onError={onCaptureError}
        isReady={isReady}
        className="pointer-events-auto"
      />
      <button
        type="button"
        onClick={onOpenGallery}
        aria-label={`Open captured-views gallery (${captureCount})`}
        className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-md backdrop-blur transition hover:border-primary/40 hover:text-primary hover:shadow-lg"
      >
        <Images className="h-3.5 w-3.5 text-primary" />
        Gallery
        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9.5px] font-bold tabular-nums text-primary">
          {captureCount}
        </span>
      </button>
    </div>
  )
}

