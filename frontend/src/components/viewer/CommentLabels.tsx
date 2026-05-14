'use client'

/**
 * CommentLabels — CAD-style leader-line callouts for anchored comments.
 *
 * Each comment renders as:
 *   1. An SVG leader line going from the comment box to the anchor centroid
 *   2. A triangular arrowhead at the geometry end of the line
 *   3. An HTML box with the comment text, positioned at an offset from the
 *      anchor so the leader is visible
 *
 * Position updates happen via requestAnimationFrame writing directly to the
 * DOM (transform + SVG attributes) — no React re-renders on camera move.
 * Labels staggered slightly per-anchor so multiple callouts don't overlap.
 */

import { useEffect, useRef } from 'react'
import { useViewerStore } from '@/_viewer/store/viewerStore'
import { projectAnchor } from '@/lib/viewerPins'

export interface LabeledMarker {
  faceUuid: string
  /** 3D centroid the leader points at. */
  centroid: { x: number; y: number; z: number }
  text: string
  tone: 'red' | 'green' | 'gray' | 'amber' | 'cyan'
}

// Per-tone colour palette. Used both for SVG stroke/fill and the HTML box.
const TONE_HEX: Record<LabeledMarker['tone'], string> = {
  red: '#dc2626',
  green: '#059669',
  gray: '#64748b',
  amber: '#d97706',
  cyan: '#0891b2',
}

const TONE_BG: Record<LabeledMarker['tone'], string> = {
  red: 'bg-red-50',
  green: 'bg-emerald-50',
  gray: 'bg-slate-50',
  amber: 'bg-amber-50',
  cyan: 'bg-cyan-50',
}

const TONE_TEXT: Record<LabeledMarker['tone'], string> = {
  red: 'text-red-900',
  green: 'text-emerald-900',
  gray: 'text-slate-800',
  amber: 'text-amber-900',
  cyan: 'text-cyan-900',
}

interface Props {
  labels: LabeledMarker[]
  onClick?: (faceUuid: string) => void
}

// Spiral-ish offsets so labels at clustered anchors don't stack on top of
// each other. Index hashed off the face_uuid keeps the offset stable.
const OFFSETS: { dx: number; dy: number }[] = [
  { dx: 90, dy: -50 },
  { dx: 100, dy: 30 },
  { dx: -110, dy: -40 },
  { dx: -120, dy: 50 },
  { dx: 80, dy: 80 },
  { dx: -90, dy: -90 },
]

function offsetFor(faceUuid: string): { dx: number; dy: number } {
  let h = 0
  for (let i = 0; i < faceUuid.length; i++) h = (h * 31 + faceUuid.charCodeAt(i)) | 0
  return OFFSETS[Math.abs(h) % OFFSETS.length] as { dx: number; dy: number }
}

export default function CommentLabels({ labels, onClick }: Props) {
  const scene = useViewerStore((s) => s.babylonScene)
  const labelRefs = useRef<Map<string, HTMLElement>>(new Map())
  const lineRefs = useRef<Map<string, SVGLineElement>>(new Map())
  const dotRefs = useRef<Map<string, SVGCircleElement>>(new Map())

  // Per-frame position sync. Writes directly to DOM/SVG attributes — no React.
  useEffect(() => {
    if (!scene) return
    let raf = 0
    const tick = () => {
      raf = window.requestAnimationFrame(tick)
      for (const marker of labels) {
        const proj = projectAnchor(scene, marker.centroid)
        const labelEl = labelRefs.current.get(marker.faceUuid)
        const lineEl = lineRefs.current.get(marker.faceUuid)
        const dotEl = dotRefs.current.get(marker.faceUuid)
        if (proj === null || proj.behind) {
          if (labelEl) labelEl.style.opacity = '0'
          if (lineEl) lineEl.style.opacity = '0'
          if (dotEl) dotEl.style.opacity = '0'
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
        if (dotEl) {
          dotEl.style.opacity = '1'
          dotEl.setAttribute('cx', String(proj.x))
          dotEl.setAttribute('cy', String(proj.y))
        }
      }
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [scene, labels])

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {/* SVG layer for leader lines + arrowheads + anchor dots. */}
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          {Object.entries(TONE_HEX).map(([tone, hex]) => (
            <marker
              key={tone}
              id={`dv-arrow-${tone}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <polygon points="0 0, 10 5, 0 10" fill={hex} />
            </marker>
          ))}
        </defs>
        {labels.map((m) => (
          <g key={m.faceUuid}>
            <line
              ref={(el) => {
                if (el !== null) lineRefs.current.set(m.faceUuid, el)
                else lineRefs.current.delete(m.faceUuid)
              }}
              stroke={TONE_HEX[m.tone]}
              strokeWidth={1.5}
              strokeLinecap="round"
              markerEnd={`url(#dv-arrow-${m.tone})`}
              style={{ opacity: 0 }}
            />
            <circle
              ref={(el) => {
                if (el !== null) dotRefs.current.set(m.faceUuid, el)
                else dotRefs.current.delete(m.faceUuid)
              }}
              r="2.5"
              fill={TONE_HEX[m.tone]}
              style={{ opacity: 0 }}
            />
          </g>
        ))}
      </svg>

      {/* HTML labels — positioned each frame via direct DOM writes. */}
      {labels.map((m) => (
        <button
          key={m.faceUuid}
          ref={(el) => {
            if (el !== null) labelRefs.current.set(m.faceUuid, el)
            else labelRefs.current.delete(m.faceUuid)
          }}
          type="button"
          onClick={() => onClick?.(m.faceUuid)}
          className={[
            'pointer-events-auto absolute left-0 top-0 max-w-[220px] rounded-md border-2 px-2.5 py-1 text-left text-[11px] font-semibold leading-snug shadow-md transition hover:shadow-lg',
            TONE_BG[m.tone],
            TONE_TEXT[m.tone],
          ].join(' ')}
          style={{
            opacity: 0,
            borderColor: TONE_HEX[m.tone],
            transform: 'translate3d(-9999px, -9999px, 0)',
          }}
        >
          {m.text}
        </button>
      ))}
    </div>
  )
}
