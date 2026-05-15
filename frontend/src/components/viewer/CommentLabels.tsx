'use client'

/**
 * CommentLabels — CoLab-style floating annotation cards anchored to geometry.
 *
 * Each anchored decision renders as:
 *   • A round "+" pin on the model — uniform colour, drop shadow (the
 *     invitation to click, not a state read-out)
 *   • A floating card next to the pin with:
 *       - Header row : avatar + author name + role + verified mark
 *       - Body       : rationale text (truncated)
 *       - Tag chips  : citations + state pill (AS9100, DEC-…, Accepted)
 *       - Footer     : "N replies" + action icons
 *   • A subtle dashed leader line connecting card → pin
 *
 * Position sync runs in requestAnimationFrame writing directly to the DOM —
 * no React re-renders on camera move. Card offsets are stable per face_uuid
 * so callouts at clustered anchors don't overlap.
 */

import { useEffect, useRef, type ReactNode } from 'react'
import { useViewerStore } from '@/_viewer/store/viewerStore'
import { projectAnchor } from '@/lib/viewerPins'

export interface LabeledMarker {
  faceUuid: string
  /** 3D centroid the leader points at. */
  centroid: { x: number; y: number; z: number }
  /** Rationale / body text — key terms inside will be auto-bolded. */
  text: string
  tone: 'red' | 'green' | 'gray' | 'amber' | 'cyan'
  /** Author name shown in the card header (initials derived if avatar omitted). */
  authorName?: string
  /** Optional role line under the name, e.g. "Senior Engineering Manager". */
  authorRole?: string
  /** Optional relative timestamp shown in footer, e.g. "2h ago". */
  when?: string
  /** Chip tags shown under the body — citation IDs, decision IDs, labels. */
  tags?: string[]
  /** "N replies" count shown in footer. Hidden when undefined. */
  replyCount?: number
  /** Show a lock icon in the top-right of the header (state = locked/resolved). */
  locked?: boolean
  /** Override the state pill label (defaults to a tone-derived label). */
  headerLabel?: string
}

// ── Tone palette ────────────────────────────────────────────────────────────

const TONE_HEX: Record<LabeledMarker['tone'], string> = {
  red: '#dc2626',
  green: '#059669',
  gray: '#64748b',
  amber: '#d97706',
  cyan: '#0891b2',
}

const TONE_LABEL: Record<LabeledMarker['tone'], string> = {
  red: 'Proposed',
  green: 'Accepted',
  amber: 'Superseded',
  gray: 'Note',
  cyan: 'In review',
}

// Tag chip colours — auto-selected by content shape.
//   AS / ISO / ASME / MIL / DIN  → blue (standards)
//   DEC-…                        → primary teal (prior decisions)
//   Anything else                → slate
function tagToneFor(tag: string): { bg: string; fg: string; ring: string } {
  if (/^(AS\s?\d|ISO|ASME|MIL-STD|DIN|OSHA|§)/i.test(tag)) {
    return { bg: 'bg-blue-50', fg: 'text-blue-700', ring: 'ring-blue-200' }
  }
  if (/^DEC-/i.test(tag)) {
    return { bg: 'bg-primary-50', fg: 'text-primary-700', ring: 'ring-primary-200' }
  }
  if (/cost|dfm|vave/i.test(tag)) {
    return { bg: 'bg-emerald-50', fg: 'text-emerald-700', ring: 'ring-emerald-200' }
  }
  return { bg: 'bg-slate-100', fg: 'text-slate-700', ring: 'ring-slate-200' }
}

// State-pill tones — shown as a chip next to the author name.
const STATE_PILL_TONE: Record<LabeledMarker['tone'], { bg: string; fg: string }> = {
  red: { bg: 'bg-amber-50', fg: 'text-amber-700' },
  green: { bg: 'bg-emerald-50', fg: 'text-emerald-700' },
  gray: { bg: 'bg-slate-100', fg: 'text-slate-600' },
  amber: { bg: 'bg-amber-50', fg: 'text-amber-700' },
  cyan: { bg: 'bg-cyan-50', fg: 'text-cyan-700' },
}

// ── Avatar (photo from pravatar.cc, deterministic per name) ─────────────────

/**
 * Photo URL derived from the author name. Same name → same photo, every time.
 * Falls back gracefully to a tinted background if the image can't load
 * (no network, blocked, etc.).
 */
function HeaderAvatar({ name }: { name: string }) {
  const url = `https://i.pravatar.cc/80?u=${encodeURIComponent(name)}`
  return (
    <img
      src={url}
      alt={name}
      width={28}
      height={28}
      loading="lazy"
      className="h-7 w-7 shrink-0 rounded-full bg-slate-200 object-cover ring-2 ring-white shadow-sm"
    />
  )
}

// ── Auto-bolding of technical terms in body text ────────────────────────────

const KEY_TERM_PATTERN =
  /(±\s?\d+(?:\.\d+)?\s?(?:mm|µm|um|°|kN|%|Ra)|\d+(?:\.\d+)?\s?(?:mm|µm|um|°|kN|%|Ra)|\b(?:AS\s?\d+|ISO\s?\d+(?:-\d+)?|ASME\s?Y?\d+\.\d+|MIL-STD-\d+|DIN\s?\d+|OSHA-\d+\.\d+)\b|\bDEC-[A-Z0-9-]+\b|§\d+(?:\.\d+)+|\b[Rr]a\s?\d+(?:\.\d+)?\s?µm)/g

function highlightTerms(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  let lastIdx = 0
  let match: RegExpExecArray | null
  let key = 0
  KEY_TERM_PATTERN.lastIndex = 0
  while ((match = KEY_TERM_PATTERN.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push(text.slice(lastIdx, match.index))
    parts.push(
      <strong key={`b-${key++}`} className="font-bold text-slate-900">
        {match[0]}
      </strong>,
    )
    lastIdx = KEY_TERM_PATTERN.lastIndex
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx))
  return parts
}

// ── Spiral offsets so clustered anchors don't stack ─────────────────────────

const OFFSETS: { dx: number; dy: number }[] = [
  { dx: 130, dy: -60 },
  { dx: 140, dy: 50 },
  { dx: -150, dy: -50 },
  { dx: -160, dy: 60 },
  { dx: 100, dy: 110 },
  { dx: -120, dy: -120 },
]

function offsetFor(faceUuid: string): { dx: number; dy: number } {
  let h = 0
  for (let i = 0; i < faceUuid.length; i++) h = (h * 31 + faceUuid.charCodeAt(i)) | 0
  return OFFSETS[Math.abs(h) % OFFSETS.length] as { dx: number; dy: number }
}

// ── Component ───────────────────────────────────────────────────────────────

const PIN_FILL = '#15524a' // primary teal — uniform pin colour, CoLab-style
const PIN_RING = '#1f7a6d'

interface Props {
  labels: LabeledMarker[]
  onClick?: (faceUuid: string) => void
}

export default function CommentLabels({ labels, onClick }: Props) {
  const scene = useViewerStore((s) => s.babylonScene)
  const labelRefs = useRef<Map<string, HTMLElement>>(new Map())
  const lineRefs = useRef<Map<string, SVGLineElement>>(new Map())
  const pinRefs = useRef<Map<string, SVGGElement>>(new Map())

  useEffect(() => {
    if (!scene) return
    let raf = 0
    const tick = () => {
      raf = window.requestAnimationFrame(tick)
      for (const marker of labels) {
        const proj = projectAnchor(scene, marker.centroid)
        const labelEl = labelRefs.current.get(marker.faceUuid)
        const lineEl = lineRefs.current.get(marker.faceUuid)
        const pinEl = pinRefs.current.get(marker.faceUuid)
        if (proj === null || proj.behind) {
          if (labelEl) labelEl.style.opacity = '0'
          if (lineEl) lineEl.style.opacity = '0'
          if (pinEl) pinEl.style.opacity = '0'
          continue
        }
        const { dx, dy } = offsetFor(marker.faceUuid)
        const labelX = proj.x + dx
        const labelY = proj.y + dy
        if (labelEl) {
          labelEl.style.opacity = '1'
          labelEl.style.transform = `translate3d(${labelX}px, ${labelY}px, 0) translate(${dx >= 0 ? '0' : '-100%'}, -50%)`
        }
        if (lineEl) {
          lineEl.style.opacity = '1'
          lineEl.setAttribute('x1', String(labelX))
          lineEl.setAttribute('y1', String(labelY))
          lineEl.setAttribute('x2', String(proj.x))
          lineEl.setAttribute('y2', String(proj.y))
        }
        if (pinEl) {
          pinEl.style.opacity = '1'
          pinEl.setAttribute('transform', `translate(${proj.x} ${proj.y})`)
        }
      }
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [scene, labels])

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {/* SVG layer: leader lines + round "+" pins */}
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <filter id="dv-pin-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" />
            <feOffset dx="0" dy="1.5" result="off" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.45" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Leader lines */}
        {labels.map((m) => (
          <line
            key={`line-${m.faceUuid}`}
            ref={(el) => {
              if (el !== null) lineRefs.current.set(m.faceUuid, el)
              else lineRefs.current.delete(m.faceUuid)
            }}
            stroke={TONE_HEX[m.tone]}
            strokeWidth={1}
            strokeDasharray="3 3"
            strokeLinecap="round"
            opacity={0.6}
            style={{ opacity: 0 }}
          />
        ))}

        {/* Round "+" pins — uniform teal, CoLab-style */}
        {labels.map((m) => (
          <g
            key={`pin-${m.faceUuid}`}
            ref={(el) => {
              if (el !== null) pinRefs.current.set(m.faceUuid, el)
              else pinRefs.current.delete(m.faceUuid)
            }}
            style={{ opacity: 0, cursor: 'pointer' }}
            onClick={() => onClick?.(m.faceUuid)}
            className="pointer-events-auto"
            filter="url(#dv-pin-shadow)"
          >
            <circle r="12" fill={PIN_FILL} stroke={PIN_RING} strokeWidth="1.5" />
            {/* "+" glyph */}
            <line x1="-5" y1="0" x2="5" y2="0" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="0" y1="-5" x2="0" y2="5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        ))}
      </svg>

      {/* HTML annotation cards — positioned per-frame via direct DOM writes */}
      {labels.map((m) => {
        const author = m.authorName ?? 'You'
        const statePill = STATE_PILL_TONE[m.tone]
        const stateText = m.headerLabel ?? TONE_LABEL[m.tone]
        return (
          <button
            key={`card-${m.faceUuid}`}
            ref={(el) => {
              if (el !== null) labelRefs.current.set(m.faceUuid, el)
              else labelRefs.current.delete(m.faceUuid)
            }}
            type="button"
            onClick={() => onClick?.(m.faceUuid)}
            className="pointer-events-auto absolute left-0 top-0 w-[300px] overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-xl ring-1 ring-black/5 transition hover:shadow-2xl"
            style={{
              opacity: 0,
              transform: 'translate3d(-9999px, -9999px, 0)',
            }}
          >
            {/* ── Header row: avatar + name + role + state pill + lock ──── */}
            <header className="flex items-center gap-2 border-b border-slate-100 px-3.5 py-2.5">
              <HeaderAvatar name={author} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <p className="truncate text-[12px] font-bold text-slate-900">{author}</p>
                  {/* tiny verified checkmark */}
                  <svg
                    viewBox="0 0 16 16"
                    width="10"
                    height="10"
                    className="shrink-0 text-primary"
                    aria-hidden="true"
                  >
                    <path
                      d="M8 1 L10 3 L13 3 L13 6 L15 8 L13 10 L13 13 L10 13 L8 15 L6 13 L3 13 L3 10 L1 8 L3 6 L3 3 L6 3 Z"
                      fill="currentColor"
                    />
                    <path
                      d="M5 8 L7 10 L11 6"
                      stroke="#fff"
                      strokeWidth="1.5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                {m.authorRole !== undefined && (
                  <p className="truncate text-[10px] text-slate-500">{m.authorRole}</p>
                )}
              </div>
              {/* State pill */}
              <span
                className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${statePill.bg} ${statePill.fg}`}
              >
                {stateText}
              </span>
              {m.locked === true && (
                <svg
                  viewBox="0 0 16 16"
                  width="11"
                  height="11"
                  className="shrink-0 text-slate-400"
                  aria-hidden="true"
                >
                  <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
                  <path
                    d="M5 7 V5 a3 3 0 0 1 6 0 V7"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                  />
                </svg>
              )}
            </header>

            {/* ── Body: rationale with bolded technical terms ─────────────── */}
            <p className="px-3.5 py-2.5 text-[12px] leading-relaxed text-slate-700">
              {highlightTerms(m.text)}
            </p>

            {/* ── Tag chips ───────────────────────────────────────────────── */}
            {m.tags !== undefined && m.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 px-3.5 pb-2.5">
                {m.tags.map((tag) => {
                  const t = tagToneFor(tag)
                  return (
                    <span
                      key={tag}
                      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${t.bg} ${t.fg} ${t.ring}`}
                    >
                      {tag}
                    </span>
                  )
                })}
              </div>
            )}

            {/* ── Footer: replies + actions ───────────────────────────────── */}
            <footer className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-3.5 py-1.5">
              {(() => {
                const replies = Math.max(1, m.replyCount ?? 1)
                return (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-primary hover:underline">
                    <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
                      <path
                        d="M3 4 h10 a1 1 0 0 1 1 1 v6 a1 1 0 0 1 -1 1 H7 l-3 2 v-2 H3 a1 1 0 0 1 -1 -1 V5 a1 1 0 0 1 1 -1 Z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {replies} {replies === 1 ? 'reply' : 'replies'}
                    {m.when !== undefined && (
                      <span className="font-medium text-slate-400">· {m.when}</span>
                    )}
                  </span>
                )
              })()}
              <div className="flex items-center gap-0.5 text-slate-400">
                {/* ··· menu */}
                <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                  <circle cx="3" cy="8" r="1.2" fill="currentColor" />
                  <circle cx="8" cy="8" r="1.2" fill="currentColor" />
                  <circle cx="13" cy="8" r="1.2" fill="currentColor" />
                </svg>
                {/* +person */}
                <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                  <circle cx="6" cy="6" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
                  <path
                    d="M2 14 a4 4 0 0 1 8 0"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    fill="none"
                  />
                  <path
                    d="M12 6 v4 M10 8 h4"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                </svg>
                {/* checkmark — green if accepted */}
                <svg
                  viewBox="0 0 16 16"
                  width="13"
                  height="13"
                  aria-hidden="true"
                  className={m.tone === 'green' ? 'text-emerald-600' : ''}
                >
                  <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
                  <path
                    d="M5 8 L7 10 L11 6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </footer>
          </button>
        )
      })}
    </div>
  )
}
