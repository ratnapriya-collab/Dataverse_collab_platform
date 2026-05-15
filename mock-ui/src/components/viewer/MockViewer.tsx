'use client'

import { useState } from 'react'
import { Box, Layers } from 'lucide-react'
import BracketSvg from './BracketSvg'
import AnchorPin from './AnchorPin'
import ViewerControls from './ViewerControls'
import type { Decision, Part } from '@/lib/mock-data'

interface Props {
  part: Part
  decisions: Decision[]
  /** Currently focused decision id (e.g. from URL query or click on side panel). */
  activeDecisionId?: string | null
  onPinClick: (decisionId: string) => void
  /** Called when the user clicks empty viewer area — used by the "+ New Decision" flow. */
  onFacePick?: () => void
}

export default function MockViewer({ part, decisions, activeDecisionId, onPinClick, onFacePick }: Props) {
  const [hoverFace, setHoverFace] = useState(false)

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-p-bg cad-grid"
      onClick={onFacePick}
      role="application"
      aria-label="3D viewer (demo)"
    >
      <div className="absolute inset-0 cad-grid-fine pointer-events-none" />

      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.5) 100%)',
        }}
      />

      {/* Part info chip — top-left */}
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-lg border border-p-rule bg-p-surface/85 px-3 py-1.5 text-xs shadow-pop backdrop-blur-sm">
        <Box className="h-3.5 w-3.5 text-p-text/70" />
        <span className="font-mono text-p-text">{part.name}</span>
        <span className="text-p-text/40">·</span>
        <span className="text-p-text/80">{part.rev}</span>
        <span className="text-p-text/40">·</span>
        <span className="rounded bg-accent/20 px-1.5 py-0.5 font-mono text-[10px] text-accent-soft">{part.format}</span>
      </div>

      {/* Mode indicator — top-right */}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-lg border border-p-rule bg-p-surface/85 px-3 py-1.5 text-[11px] shadow-pop backdrop-blur-sm">
        <Layers className="h-3.5 w-3.5 text-accent" />
        <span className="font-medium text-p-text">Pick mode</span>
        <span className="text-p-text/50">·</span>
        <span className="text-p-text/60">click face to anchor</span>
      </div>

      {/* The part itself */}
      <div
        className="absolute inset-0 flex items-center justify-center p-12"
        onMouseEnter={() => setHoverFace(true)}
        onMouseLeave={() => setHoverFace(false)}
      >
        <BracketSvg className={`w-full max-w-4xl transition-transform duration-700 ${hoverFace ? 'scale-[1.02]' : ''}`} />
      </div>

      {/* Pins overlay */}
      <div className="absolute inset-0">
        {part.pins.map((pin, i) => {
          const dec = decisions.find((d) => d.id === pin.decisionId)
          if (!dec) return null
          return (
            <AnchorPin
              key={pin.id}
              number={i + 1}
              state={dec.state}
              label={`${dec.id} · ${dec.anchorId}`}
              active={activeDecisionId === dec.id}
              xPct={pin.xPct}
              yPct={pin.yPct}
              onClick={() => {
                onPinClick(dec.id)
              }}
            />
          )
        })}
      </div>

      {/* Legend — bottom-left */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-3 rounded-lg border border-p-rule bg-p-surface/85 px-3 py-2 text-[10px] shadow-pop backdrop-blur-sm">
        <LegendDot color="#d99543" label="Proposed" />
        <LegendDot color="#5ec087" label="Accepted" />
        <LegendDot color="#d56363" label="Rejected" />
        <LegendDot color="#a8b0bb" label="Superseded" />
      </div>

      {/* Controls — bottom-right */}
      <div
        className="absolute bottom-4 right-4 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <ViewerControls />
      </div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full ring-2 ring-p-bg/50" style={{ backgroundColor: color }} />
      <span className="text-p-text/70">{label}</span>
    </span>
  )
}
