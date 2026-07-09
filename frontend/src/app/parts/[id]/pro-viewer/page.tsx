'use client'

/**
 * /parts/[id]/pro-viewer — Pro Viewer tab.
 *
 * Mirrors the chrome of /parts/[id] exactly (left rail conversation hub,
 * floating capture toolbar, partner-view banner, role switcher, panel
 * collapse) but swaps the Babylon ViewerCanvas for an embedded iframe of
 * the dv-3d-viewer (Datavers.ai). All side-panel features carry over:
 * Comments / Issues / Activity / Threads, Export PDF, Hide-on-viewer
 * toggle, captures, gallery, What changed / Walkthrough / Concierge /
 * Push to PLM quick-nav, partner redaction, etc.
 *
 * Boundary the user should know about:
 *   · 3D pin overlay (SVG "+" markers anchored to faces) is NOT drawn —
 *     pin positions need face-pick events from the live Babylon scene,
 *     which lives inside the iframe and is cross-origin. SSO + a
 *     postMessage protocol will unlock this in the next port phase.
 *   · CaptureButton uses html2canvas on our DOM, which CANNOT read
 *     across iframe origins. The Pro Viewer has its own screenshot
 *     button in its toolbar — use that for now, or use Pro Viewer in
 *     conjunction with the regular 3D Model tab for captures.
 *
 * Two deployment modes via NEXT_PUBLIC_PRO_VIEWER_URL:
 *   · Dev:  http://localhost:5173    (run dv-3d-viewer's vite dev server)
 *   · Prod: /dv-viewer/              (static build copied to public/)
 */

import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  ExternalLink,
  Images,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from 'lucide-react'
import Logo from '@/components/ui/Logo'
import UserBadge from '@/components/ui/UserBadge'
import RoleSwitcher, { type ViewRole } from '@/components/redaction/RoleSwitcher'
import PartnerViewBanner from '@/components/redaction/PartnerViewBanner'
import PartViewTabs from '@/components/parts/PartViewTabs'
import PartConversationHub from '@/components/parts/PartConversationHub'
import CaptureButton from '@/features/capture/components/CaptureButton'
import CaptureGallery from '@/features/capture/components/CaptureGallery'
import { useViewerCapture } from '@/features/capture/hooks/useViewerCapture'
import { useCaptureStore } from '@/features/capture/store/captureStore'
import { useThreads as useV2Threads } from '@/features/comments/hooks/useThreadsStorage'
import { useCommentsStore } from '@/features/comments/store/commentsStore'
import { ApiError, api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import { SEED_FULL_DECISIONS, SEED_MEMBERS } from '@/lib/mockWorkspace'
import type {
  DecisionRead,
  DecisionState,
  PartDetail,
  UserRead,
} from '@/types/api'

const PRO_VIEWER_URL =
  process.env.NEXT_PUBLIC_PRO_VIEWER_URL ?? 'http://localhost:5173'

// ── Mock-ID detection (mirrors /parts/[id] page) ────────────────────────────
function isMockPartId(id: string): boolean {
  return /^demo_[A-Za-z0-9_-]+$/.test(id)
}

function buildMockPart(partId: string): PartDetail {
  const sample = SEED_FULL_DECISIONS.find((d) => d.part_id === partId)
  const name = sample?.part_name ?? partId
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

function buildMockDecisions(partId: string): DecisionRead[] {
  const memberById = new Map(SEED_MEMBERS.map((m) => [m.name, m]))
  return SEED_FULL_DECISIONS.filter((d) => d.part_id === partId).map((d, i) => {
    const state: DecisionState =
      d.state === 'DRAFT' ? 'DRAFT' : (d.state as DecisionState)
    const author = memberById.get(d.author_name)
    const seed = (i + 1) * 31
    const centroid = {
      x: -2.4 + ((seed * 73) % 100) / 20,
      y: -0.9 + ((seed * 47) % 100) / 55,
      z: 0.1 + ((seed * 19) % 100) / 60,
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
      anchor: { id: d.anchor_id, face_uuid: d.anchor_id, centroid },
    }
  })
}

// Same redaction policy as the regular parts page so partner view is consistent.
function redactionReason(
  d: DecisionRead,
): 'internal-flag' | 'cost-keyword' | 'admin-only-thread' | null {
  if (d.state === 'DRAFT') return 'internal-flag'
  if (/\b(cost|price|margin|profit|markup)\b/i.test(d.rationale)) return 'cost-keyword'
  let h = 0
  for (let i = 0; i < d.id.length; i++) h = (h * 31 + d.id.charCodeAt(i)) | 0
  if (Math.abs(h) % 4 === 0) return 'admin-only-thread'
  return null
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function PartProViewerPage(): JSX.Element {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const partId = params?.id ?? 'demo_part'

  // Partner-view state — driven by ?view=<role>
  const viewParam = (searchParams?.get('view') ?? 'admin') as ViewRole
  const activeRole: ViewRole =
    viewParam === 'partner' ? 'partner' : viewParam === 'oem' ? 'oem' : 'admin'
  const isPartner = activeRole === 'partner'
  const [showWhatsHidden, setShowWhatsHidden] = useState(false)

  const [user, setUser] = useState<UserRead | null>(null)
  const [part, setPart] = useState<PartDetail | null>(null)
  const [decisions, setDecisions] = useState<DecisionRead[]>([])
  const [error, setError] = useState<string | null>(null)
  const [rightRailCollapsed, setRightRailCollapsed] = useState(false)

  // Capture-view feature carries over. We pass viewerContainerRef even
  // though html2canvas can't read iframe content — html2canvas will at
  // least capture our chrome, and any future SSO + postMessage protocol
  // will let us route capture requests to the iframe's native screenshot.
  const viewerContainerRef = useRef<HTMLDivElement | null>(null)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const captureCount = useCaptureStore((s) => s.captures.length)
  const cleanupCaptures = useCaptureStore((s) => s.cleanup)
  const loadCapturesForPart = useCaptureStore((s) => s.loadForPart)

  useEffect(() => {
    if (partId === undefined || part === null) return
    void loadCapturesForPart(part.id, part.name)
  }, [partId, part, loadCapturesForPart])

  useEffect(() => {
    return () => cleanupCaptures()
  }, [cleanupCaptures])

  // Face-pick → v2-thread compose flow. The iframe (dv-3d-viewer) emits
  // postMessage events when the user picks / clears a face — see
  // lib/parentBridge.ts in the dv-3d-viewer source. We feed the face
  // anchor into PartConversationHub's `composeAnchor` prop, which makes
  // the inline compose textarea appear under the Comments tab tied to
  // that face. User types, presses ⌘+Enter, thread is created — same
  // CommentsPanel.handleNewThread path as the regular viewer's keyboard
  // shortcut, just triggered by a 3D face pick instead of a hotkey.
  const [composeAnchor, setComposeAnchor] = useState<{
    faceUuid: string
    centroid: { x: number; y: number; z: number }
  } | null>(null)
  const [hoveredFaceUuid, setHoveredFaceUuid] = useState<string | null>(null)
  const handleSelectFace = useCallback((_faceUuid: string | null) => {
    // No-op on Pro Viewer for now — needs iframe postMessage bridge.
  }, [])

  // Iframe loading state — for the loader spinner overlay.
  const [frameLoaded, setFrameLoaded] = useState(false)
  // Iframe ref so we can postMessage TO the embedded viewer for pin sync.
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  // The iframe tells us when it's mounted via {source:'dv-3d-viewer', type:'ready'}.
  // We hold off sending pin data until we've seen that — otherwise messages
  // sent during the iframe's first compile get lost.
  const [iframeReady, setIframeReady] = useState(false)

  // v2 thread data + the currently-selected thread id (for highlight sync).
  const { threads: v2Threads } = useV2Threads(partId)
  const selectedThreadId = useCommentsStore((s) => s.selectedThreadId)
  const selectThread = useCommentsStore((s) => s.selectThread)

  // Helper — postMessage to the iframe, guarded by readiness + ref.
  const postToIframe = useCallback(
    (msg: { source: 'dataverse-host'; type: string; [k: string]: unknown }) => {
      const win = iframeRef.current?.contentWindow
      if (!win || !iframeReady) return
      try {
        // Targeting '*' is acceptable for outgoing messages — the iframe
        // filters by source on its side (parentBridge.HOST_SOURCE check).
        win.postMessage(msg, '*')
      } catch {
        // Cross-origin postMessage can occasionally throw under strict
        // sandboxing — non-fatal, the next sync attempt will retry.
      }
    },
    [iframeReady],
  )

  // ── postMessage bridge — listen for face-pick events from the iframe ──
  //
  // Origin allow-list = the configured PRO_VIEWER_URL. Anything else is
  // ignored. Messages are filtered by source: 'dv-3d-viewer' so we don't
  // pick up React DevTools / browser-extension chatter.
  useEffect(() => {
    let allowedOrigin: string | null = null
    try {
      allowedOrigin = new URL(PRO_VIEWER_URL, window.location.origin).origin
    } catch {
      // Malformed URL — fall through; we'll accept any origin in that case.
    }

    const handler = (e: MessageEvent): void => {
      if (allowedOrigin !== null && e.origin !== allowedOrigin) return
      const data = e.data as
        | { source?: unknown; type?: unknown; [k: string]: unknown }
        | undefined
      if (
        data === undefined ||
        data === null ||
        typeof data !== 'object' ||
        data.source !== 'dv-3d-viewer'
      ) {
        return
      }
      if (data.type === 'ready') {
        // The iframe has mounted + (on the second emit) the Babylon scene
        // is attached. Either signal is fine to flip readiness — we just
        // want to know "from now on, postMessage will be received".
        setIframeReady(true)
        return
      }
      if (data.type === 'face-pick') {
        const faceUuid =
          typeof data.faceUuid === 'string' ? data.faceUuid : null
        const c = data.centroid as
          | { x?: unknown; y?: unknown; z?: unknown }
          | null
          | undefined
        if (faceUuid === null) return
        const centroid =
          c !== null &&
          c !== undefined &&
          typeof c.x === 'number' &&
          typeof c.y === 'number' &&
          typeof c.z === 'number'
            ? { x: c.x, y: c.y, z: c.z }
            : { x: 0, y: 0, z: 0 }
        // Surface the face in the Comments tab's inline composer + track
        // it for sidebar highlighting once a thread lands here.
        setHoveredFaceUuid(faceUuid)
        setComposeAnchor({ faceUuid, centroid })
      } else if (data.type === 'face-clear') {
        // Don't auto-close an in-progress composer — the user may already
        // be typing. Just drop the hover highlight so the panel quietens.
        setHoveredFaceUuid(null)
      } else if (data.type === 'pin-click') {
        // User clicked a "+" pin in the iframe overlay. Select that
        // thread in our side panel so the rest of the UI lights up.
        const threadId =
          typeof data.threadId === 'string' ? data.threadId : null
        if (threadId !== null) {
          selectThread(threadId, 'pin')
        }
      }
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [selectThread])

  // Clear the compose anchor once a new thread has been written —
  // CommentsPanel dispatches `dataverse:threads-changed` from
  // handleNewThread + every other thread mutation. Listening here keeps
  // the inline composer from sticking around after the user submits.
  useEffect(() => {
    if (composeAnchor === null) return
    const onChanged = (): void => setComposeAnchor(null)
    window.addEventListener('dataverse:threads-changed', onChanged)
    return () =>
      window.removeEventListener('dataverse:threads-changed', onChanged)
  }, [composeAnchor])

  // ── Pin sync → iframe ────────────────────────────────────────────────
  // Whenever the v2 threads list changes (and once the iframe has fired
  // its 'ready' message), push the full pin set to the embedded viewer.
  // Payload now carries the rich data the iframe's HostCommentOverlay
  // needs to render the floating card next to each pin: title (first
  // sentence of the comment), author name, state, timestamp, reply count.
  useEffect(() => {
    if (!iframeReady) return
    const fallbackAuthor = user?.name ?? 'You'
    const pins = v2Threads
      .filter((t) => t.anchor !== null && t.anchor !== undefined)
      .map((t) => ({
        threadId: t.id,
        faceUuid: t.anchor.faceUuid,
        centroid: t.anchor.centroid,
        title: t.title ?? '',
        // Thread shape stores authorName on the thread itself; fall back
        // to the current user for old threads that pre-date the field.
        authorName: t.authorName ?? fallbackAuthor,
        state: t.status, // open / resolved / archived
        createdAt: t.createdAt,
        replyCount: Math.max(0, (t.replyCount ?? 1) - 1), // total - 1 (root)
      }))
    postToIframe({
      source: 'dataverse-host',
      type: 'sync-comment-pins',
      pins,
    })
  }, [v2Threads, iframeReady, postToIframe, user?.name])

  // ── Highlight sync → iframe ──────────────────────────────────────────
  // Clicking a comment in the side panel sets useCommentsStore.selectedThreadId.
  // We mirror that selection into the iframe so the matching pin turns
  // orange (matches the "active comment" affordance on the regular
  // /parts/[id] viewer).
  useEffect(() => {
    if (!iframeReady) return
    postToIframe({
      source: 'dataverse-host',
      type: 'highlight-comment-pin',
      threadId: selectedThreadId,
    })
  }, [selectedThreadId, iframeReady, postToIframe])

  // ── Auth + data load ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!partId) return
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

    if (isMockPartId(partId)) {
      setPart(buildMockPart(partId))
      setDecisions(buildMockDecisions(partId))
    } else {
      api.parts
        .get(partId)
        .then((p) => {
          if (!cancelled) setPart(p)
        })
        .catch((err: unknown) => {
          if (cancelled) return
          if (err instanceof ApiError && err.status === 404) {
            // Same fallback as the regular page — mock if the API doesn't know it.
            setPart(buildMockPart(partId))
            setDecisions(buildMockDecisions(partId))
            return
          }
          setError(err instanceof Error ? err.message : 'Failed to load')
        })
      api.decisions
        .list(partId)
        .then((d) => {
          if (!cancelled && d.length > 0) setDecisions(d)
        })
        .catch(() => {
          // Non-fatal — empty decisions array still renders the panel.
        })
    }

    return () => {
      cancelled = true
    }
  }, [partId, router])

  const handleDecisionChanged = useCallback((d: DecisionRead) => {
    setDecisions((prev) => prev.map((x) => (x.id === d.id ? d : x)))
  }, [])

  // Partition decisions by redaction policy when in partner view.
  const { visibleDecisions, redactedDecisions } = useMemo(() => {
    if (!isPartner)
      return { visibleDecisions: decisions, redactedDecisions: [] as DecisionRead[] }
    const visible: DecisionRead[] = []
    const redacted: DecisionRead[] = []
    for (const d of decisions) {
      if (redactionReason(d) !== null) redacted.push(d)
      else visible.push(d)
    }
    return { visibleDecisions: visible, redactedDecisions: redacted }
  }, [decisions, isPartner])
  const hiddenCommentsCount = redactedDecisions.length * 2

  function handleSignOut(): void {
    clearToken()
    router.replace('/login')
  }

  if (error !== null) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p role="alert" className="text-sm font-semibold text-red-600">
          {error}
        </p>
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

  return (
    <main className="flex h-screen flex-col">
      {/* ── Header — same layout as /parts/[id] ─────────────────────────── */}
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setRightRailCollapsed((c) => !c)}
              aria-label={
                rightRailCollapsed
                  ? 'Show conversation panel'
                  : 'Hide conversation panel'
              }
              aria-pressed={rightRailCollapsed}
              title={
                rightRailCollapsed
                  ? 'Show conversation panel'
                  : 'Hide conversation panel (more space for the 3D viewer)'
              }
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
              <h1 className="flex items-center gap-1.5 truncate text-[13px] font-semibold leading-tight text-slate-900">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {part.name}
              </h1>
              <p className="truncate text-[10.5px] text-slate-500">
                {part.file_name} · {part.content_hash.slice(0, 12)}…
              </p>
            </div>
            <span
              className="hidden h-5 w-px shrink-0 bg-slate-200 sm:inline-block"
              aria-hidden="true"
            />
            <PartViewTabs
              partId={partId}
              active="pro"
              contextChip="Pro Viewer · BREP tools"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={PRO_VIEWER_URL}
              target="_blank"
              rel="noopener noreferrer"
              title="Open Pro Viewer in a new tab"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-primary/40 hover:text-primary"
            >
              <ExternalLink className="h-3 w-3" />
              Open in new tab
            </a>
            <RoleSwitcher active={activeRole} />
            <span
              className="hidden h-5 w-px bg-slate-200 sm:inline-block"
              aria-hidden="true"
            />
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
          partPath={`/parts/${partId}/pro-viewer`}
        />
      )}

      {/* ── Main layout — left rail + iframe ────────────────────────────── */}
      <section
        className={[
          'grid flex-1 overflow-hidden transition-[grid-template-columns] duration-200',
          rightRailCollapsed ? 'grid-cols-[1fr]' : 'grid-cols-[360px_1fr]',
        ].join(' ')}
      >
        {/* Left rail — conversation hub. Same component as /parts/[id]:
            Comments / Issues / Activity / Threads tabs · Hide on viewer
            toggle · Export PDF · What changed · Walkthrough · Concierge ·
            Push to PLM quick-nav. */}
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
            onSelectFace={handleSelectFace}
            isPartner={isPartner}
            showWhatsHidden={showWhatsHidden}
            hiddenCommentsCount={hiddenCommentsCount}
            screenSignal={null}
            reasonFor={redactionReason}
            currentUser={{ id: user.id, name: user.name }}
            composeAnchor={composeAnchor}
          />
        )}

        {/* Center pane — iframe holding dv-3d-viewer. */}
        <div ref={viewerContainerRef} className="relative bg-slate-100">
          {/* Loading state while the iframe is fetching. */}
          {!frameLoaded && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-slate-500">
                <Sparkles className="h-6 w-6 animate-pulse text-primary" />
                <p className="text-[11.5px]">Loading Pro Viewer…</p>
                <p className="text-[10.5px]">
                  Source:{' '}
                  <code className="rounded bg-slate-200 px-1.5 py-0.5">
                    {PRO_VIEWER_URL}
                  </code>
                </p>
              </div>
            </div>
          )}

          <iframe
            ref={iframeRef}
            src={PRO_VIEWER_URL}
            title="Pro Viewer (dv-3d-viewer)"
            allow="clipboard-write; fullscreen"
            className="h-full w-full border-0"
            onLoad={() => setFrameLoaded(true)}
          />

          {/* Capture-view affordance — floats over the iframe top-right.
              Same toolbar as the regular 3D Model page. */}
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
      </section>

      {/* Capture gallery — slides in from the right edge over everything. */}
      <CaptureGallery
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        partName={part.name}
      />
    </main>
  )
}

// ── Capture toolbar — copied from /parts/[id] so the affordance is identical ──

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
