'use client'

/**
 * DrawingCanvas — paper-style 2D engineering drawing rendered as inline SVG.
 *
 * Three orthographic views (Front + Top + Side) with dimension lines, hidden
 * features, datum flags and a title block in the lower-right. PMI callouts
 * are positioned absolutely in HTML overlay so they stay crisp at any zoom.
 */

import { type MouseEvent, useState } from 'react'
import { Maximize2, Minus, Move, Plus, RotateCcw } from 'lucide-react'
import PMICallout from './PMICallout'
import type { MockPMICallout } from '@/lib/mockWorkspace'

interface Props {
  callouts: MockPMICallout[]
  selectedId: string | null
  hoveredId: string | null
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
  partNumber: string
  partName: string
  partRev: string
}

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2]

export default function DrawingCanvas({
  callouts,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  partNumber,
  partName,
  partRev,
}: Props): JSX.Element {
  const [zoomIdx, setZoomIdx] = useState(2) // 1.0x default
  const zoom = ZOOM_STEPS[zoomIdx] ?? 1

  function setZoom(next: number): void {
    setZoomIdx(Math.max(0, Math.min(ZOOM_STEPS.length - 1, next)))
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-200">
      {/* Paper background with subtle grid */}
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div
          className="relative aspect-[4/3] w-full max-w-5xl overflow-hidden rounded-md bg-white shadow-2xl ring-1 ring-slate-300"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform 180ms ease' }}
          onClick={(e: MouseEvent<HTMLDivElement>) => {
            // Click empty drawing → clear selection
            if (e.target === e.currentTarget) onHover(null)
          }}
        >
          {/* Faint blue engineering grid */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.5]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(96,165,250,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,0.10) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* The drawing itself — 1200x900 viewBox = 4:3 */}
          <svg viewBox="0 0 1200 900" className="absolute inset-0 h-full w-full">
            {/* Drawing border */}
            <rect x="20" y="20" width="1160" height="860" fill="none" stroke="#0f172a" strokeWidth="1.5" />
            <rect x="32" y="32" width="1136" height="836" fill="none" stroke="#0f172a" strokeWidth="0.6" />

            {/* Inner zone markers (A B C D / 1 2 3 4) */}
            {['A', 'B', 'C', 'D'].map((l, i) => (
              <text key={`row-${l}`} x="40" y={120 + i * 200} textAnchor="middle" fontSize="11" fill="#475569" fontFamily="ui-monospace,monospace">
                {l}
              </text>
            ))}
            {[1, 2, 3, 4].map((n, i) => (
              <text key={`col-${n}`} x={180 + i * 280} y="32" textAnchor="middle" fontSize="11" fill="#475569" fontFamily="ui-monospace,monospace">
                {n}
              </text>
            ))}

            {/* ── FRONT VIEW (top-left) ──────────────────────────────────── */}
            <g transform="translate(120, 80)">
              <ViewLabel x={0} y={-10} text="FRONT" />
              {/* base plate */}
              <rect x="40" y="180" width="360" height="40" fill="#fff" stroke="#0f172a" strokeWidth="1.5" />
              {/* vertical riser */}
              <rect x="100" y="40" width="240" height="160" fill="#fff" stroke="#0f172a" strokeWidth="1.5" />
              {/* central boss outline */}
              <circle cx="220" cy="120" r="42" fill="#fff" stroke="#0f172a" strokeWidth="1.5" />
              <circle cx="220" cy="120" r="22" fill="none" stroke="#0f172a" strokeWidth="1.2" strokeDasharray="4 3" />
              {/* small inlet (right) */}
              <circle cx="310" cy="120" r="20" fill="#fff" stroke="#0f172a" strokeWidth="1.2" />
              <circle cx="310" cy="120" r="10" fill="none" stroke="#0f172a" strokeWidth="1" strokeDasharray="4 3" />
              {/* bolt holes on base */}
              {[80, 160, 280, 360].map((cx) => (
                <g key={`bh-${cx}`}>
                  <circle cx={cx} cy="200" r="6" fill="#fff" stroke="#0f172a" strokeWidth="1" />
                  <line x1={cx - 9} y1="200" x2={cx + 9} y2="200" stroke="#0f172a" strokeWidth="0.4" />
                  <line x1={cx} y1="191" x2={cx} y2="209" stroke="#0f172a" strokeWidth="0.4" />
                </g>
              ))}
              {/* Width dimension under the view */}
              <DimLine x1={40} x2={400} y={250} value="360.00" />
              <DimLine x1={100} x2={340} y={278} value="240.00" />
              <DimVertical x={20} y1={40} y2={220} value="180.00" />
            </g>

            {/* ── TOP VIEW (top-right) ───────────────────────────────────── */}
            <g transform="translate(620, 80)">
              <ViewLabel x={0} y={-10} text="TOP" />
              <rect x="40" y="40" width="360" height="120" fill="#fff" stroke="#0f172a" strokeWidth="1.5" />
              {/* center boss */}
              <circle cx="220" cy="100" r="32" fill="#fff" stroke="#0f172a" strokeWidth="1.2" />
              <circle cx="220" cy="100" r="14" fill="none" stroke="#0f172a" strokeWidth="1" strokeDasharray="3 3" />
              {/* secondary boss */}
              <circle cx="310" cy="100" r="14" fill="#fff" stroke="#0f172a" strokeWidth="1" />
              {/* hidden ribs */}
              <line x1="180" y1="40" x2="180" y2="160" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="3 3" />
              <line x1="260" y1="40" x2="260" y2="160" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="3 3" />
              {/* center marks */}
              <g stroke="#0f172a" strokeWidth="0.6">
                <line x1="220" y1="60" x2="220" y2="140" />
                <line x1="180" y1="100" x2="260" y2="100" />
              </g>
              <DimLine x1={40} x2={400} y={195} value="360.00" />
            </g>

            {/* ── SIDE VIEW (bottom-left, above title block) ─────────────── */}
            <g transform="translate(120, 480)">
              <ViewLabel x={0} y={-10} text="SIDE" />
              <rect x="40" y="80" width="200" height="40" fill="#fff" stroke="#0f172a" strokeWidth="1.5" />
              <rect x="80" y="20" width="120" height="60" fill="#fff" stroke="#0f172a" strokeWidth="1.5" />
              {/* boss in profile */}
              <ellipse cx="140" cy="50" rx="36" ry="14" fill="#fff" stroke="#0f172a" strokeWidth="1.2" />
              <ellipse cx="140" cy="50" rx="18" ry="6" fill="none" stroke="#0f172a" strokeWidth="0.9" strokeDasharray="3 3" />
              <DimLine x1={40} x2={240} y={150} value="200.00" />
              <DimVertical x={20} y1={20} y2={120} value="100.00" />
              {/* Datum A flag */}
              <DatumFlag x={250} y={100} letter="A" />
              <DatumFlag x={250} y={50} letter="B" />
            </g>

            {/* ── TITLE BLOCK (bottom-right) ─────────────────────────────── */}
            <g transform="translate(640, 580)">
              <rect x="0" y="0" width="540" height="280" fill="#fff" stroke="#0f172a" strokeWidth="1.5" />
              {/* Inner cells */}
              <g stroke="#0f172a" strokeWidth="0.6">
                <line x1="0" y1="60" x2="540" y2="60" />
                <line x1="0" y1="120" x2="540" y2="120" />
                <line x1="0" y1="170" x2="540" y2="170" />
                <line x1="0" y1="220" x2="540" y2="220" />
                <line x1="260" y1="0" x2="260" y2="170" />
                <line x1="180" y1="220" x2="180" y2="280" />
                <line x1="360" y1="220" x2="360" y2="280" />
              </g>

              <TitleCell x={12} y={20} label="DRAWN BY" value="Sarah Chen" />
              <TitleCell x={270} y={20} label="CHECKED BY" value="David Kim" />
              <TitleCell x={12} y={80} label="DATE" value="2026-05-12" />
              <TitleCell x={270} y={80} label="APPROVED" value="Maria Garcia" />
              <TitleCell x={12} y={135} label="SCALE" value="1 : 2" />
              <TitleCell x={270} y={135} label="UNITS" value="mm" />

              {/* Part name + number */}
              <text x="12" y="195" fontSize="11" fill="#0f172a" fontFamily="ui-monospace,monospace" fontWeight="600">
                {partName.toUpperCase()}
              </text>
              <text x="12" y="212" fontSize="9" fill="#475569" fontFamily="ui-monospace,monospace">
                Compressor housing redesign — 2.0L turbocharged platform
              </text>

              <TitleCell x={12} y={240} label="PART NO." value={partNumber} mono />
              <TitleCell x={190} y={240} label="REV" value={partRev} mono large />
              <TitleCell x={370} y={240} label="SHEET" value="1 OF 1" />

              {/* Company mark */}
              <text x="528" y="44" textAnchor="end" fontSize="14" fontWeight="800" fill="#0f172a" fontFamily="ui-monospace,monospace">
                DATAVERS.AI
              </text>
              <text x="528" y="56" textAnchor="end" fontSize="7" fill="#15524a" fontFamily="ui-monospace,monospace" letterSpacing="0.1em">
                ENGINEERING INTELLIGENCE
              </text>
            </g>

            {/* Tolerance block — top right */}
            <g transform="translate(820, 50)">
              <rect x="0" y="0" width="320" height="100" fill="#fff" stroke="#0f172a" strokeWidth="1" />
              <text x="160" y="18" textAnchor="middle" fontSize="9" fill="#0f172a" fontWeight="700" fontFamily="ui-monospace,monospace">
                GENERAL TOLERANCES (UNLESS NOTED)
              </text>
              <line x1="0" y1="26" x2="320" y2="26" stroke="#0f172a" strokeWidth="0.5" />
              <text x="14" y="44" fontSize="9" fill="#0f172a" fontFamily="ui-monospace,monospace">LINEAR  ±0.20 mm</text>
              <text x="14" y="60" fontSize="9" fill="#0f172a" fontFamily="ui-monospace,monospace">ANGULAR  ±0.5°</text>
              <text x="14" y="76" fontSize="9" fill="#0f172a" fontFamily="ui-monospace,monospace">SURFACE  Ra 3.2 µm</text>
              <text x="14" y="92" fontSize="9" fill="#0f172a" fontFamily="ui-monospace,monospace">PER ISO 2768-mK</text>
            </g>
          </svg>

          {/* PMI callouts — HTML overlay so they stay crisp at zoom */}
          <div className="absolute inset-0 pointer-events-none">
            {callouts.map((c, i) => (
              <div key={c.id} className="pointer-events-auto">
                <PMICallout
                  callout={c}
                  index={i}
                  selected={selectedId === c.id}
                  hovered={hoveredId === c.id}
                  onSelect={() => onSelect(c.id)}
                  onHover={(state) => {
                    if (state) onHover(c.id)
                    else if (!selectedId) onHover(null)
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Zoom controls — top right */}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-md">
        <button type="button" onClick={() => setZoom(zoomIdx - 1)} disabled={zoomIdx === 0} className="flex h-7 w-7 items-center justify-center rounded text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Zoom out">
          <Minus className="h-3 w-3" />
        </button>
        <button type="button" onClick={() => setZoomIdx(2)} className="rounded px-2 py-0.5 font-mono text-[10px] font-bold text-slate-700 hover:bg-slate-100" aria-label="Reset zoom">
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" onClick={() => setZoom(zoomIdx + 1)} disabled={zoomIdx === ZOOM_STEPS.length - 1} className="flex h-7 w-7 items-center justify-center rounded text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Zoom in">
          <Plus className="h-3 w-3" />
        </button>
        <span className="mx-0.5 h-4 w-px bg-slate-200" />
        <button type="button" onClick={() => setZoomIdx(2)} className="flex h-7 w-7 items-center justify-center rounded text-slate-600 transition hover:bg-slate-100" aria-label="Fit to screen">
          <Maximize2 className="h-3 w-3" />
        </button>
        <button type="button" onClick={() => setZoomIdx(2)} className="flex h-7 w-7 items-center justify-center rounded text-slate-600 transition hover:bg-slate-100" aria-label="Reset view">
          <RotateCcw className="h-3 w-3" />
        </button>
        <button type="button" className="flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100" aria-label="Pan mode (decorative)">
          <Move className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

// ─── Helper SVG bits ────────────────────────────────────────────────────────

function ViewLabel({ x, y, text }: { x: number; y: number; text: string }): JSX.Element {
  return (
    <text x={x} y={y} fontSize="11" fontWeight="700" fill="#0f172a" fontFamily="ui-monospace,monospace" letterSpacing="0.12em">
      {text}
    </text>
  )
}

function DimLine({ x1, x2, y, value }: { x1: number; x2: number; y: number; value: string }): JSX.Element {
  return (
    <g stroke="#0f172a" strokeWidth="0.6">
      <line x1={x1} y1={y - 4} x2={x1} y2={y + 4} />
      <line x1={x2} y1={y - 4} x2={x2} y2={y + 4} />
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <polygon points={`${x1 + 2},${y - 2} ${x1 + 2},${y + 2} ${x1 + 8},${y}`} fill="#0f172a" />
      <polygon points={`${x2 - 2},${y - 2} ${x2 - 2},${y + 2} ${x2 - 8},${y}`} fill="#0f172a" />
      <text x={(x1 + x2) / 2} y={y - 6} textAnchor="middle" fontSize="10" fill="#0f172a" fontFamily="ui-monospace,monospace" stroke="none">
        {value}
      </text>
    </g>
  )
}

function DimVertical({ x, y1, y2, value }: { x: number; y1: number; y2: number; value: string }): JSX.Element {
  return (
    <g stroke="#0f172a" strokeWidth="0.6">
      <line x1={x - 4} y1={y1} x2={x + 4} y2={y1} />
      <line x1={x - 4} y1={y2} x2={x + 4} y2={y2} />
      <line x1={x} y1={y1} x2={x} y2={y2} />
      <text x={x - 8} y={(y1 + y2) / 2} textAnchor="end" fontSize="10" fill="#0f172a" fontFamily="ui-monospace,monospace" stroke="none">
        {value}
      </text>
    </g>
  )
}

function DatumFlag({ x, y, letter }: { x: number; y: number; letter: string }): JSX.Element {
  return (
    <g>
      <rect x={x} y={y - 8} width="20" height="16" fill="#fff" stroke="#0f172a" strokeWidth="1" />
      <text x={x + 10} y={y + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#0f172a" fontFamily="ui-monospace,monospace">
        {letter}
      </text>
      <line x1={x - 4} y1={y} x2={x} y2={y} stroke="#0f172a" strokeWidth="1" />
    </g>
  )
}

function TitleCell({
  x,
  y,
  label,
  value,
  mono,
  large,
}: {
  x: number
  y: number
  label: string
  value: string
  mono?: boolean
  large?: boolean
}): JSX.Element {
  return (
    <g>
      <text x={x} y={y - 3} fontSize="7" fill="#64748b" fontFamily="ui-monospace,monospace" letterSpacing="0.06em">
        {label}
      </text>
      <text
        x={x}
        y={y + 14}
        fontSize={large === true ? 18 : 11}
        fontWeight={large === true ? '800' : '600'}
        fill="#0f172a"
        fontFamily={mono === true || large === true ? 'ui-monospace,monospace' : 'system-ui,sans-serif'}
      >
        {value}
      </text>
    </g>
  )
}
