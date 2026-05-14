/**
 * PipelineStrip — horizontal mini timeline showing where a project sits
 * across the 5-team handoff:  Design → CAE → Review → Supplier → Mfg
 *
 * Each team gets a small chip with the 3-letter abbreviation and a state
 * indicator drawn around it:
 *   • DONE         — solid team-color fill with check
 *   • IN_PROGRESS  — coloured ring with a static clock glyph
 *   • PENDING      — slate outline, muted text
 *   • BLOCKED      — red ring with ⚠ overlay
 *
 * Connector lines between stages encode flow:
 *   • completed flow (DONE→DONE or DONE→IN_PROGRESS) — solid emerald, fully filled
 *   • leaving an IN_PROGRESS stage — gradient from team color → slate (work
 *     is moving but hasn't reached the next station yet)
 *   • any segment touching BLOCKED — red-200
 *   • unstarted (PENDING→PENDING) — slate
 */

import { AlertTriangle, Check, Clock } from 'lucide-react'
import {
  TEAM_META,
  TEAM_ORDER,
  type EngineeringTeam,
  type PipelineStage,
  type ProjectPipeline,
} from '@/lib/mockWorkspace'

interface Props {
  pipeline: ProjectPipeline
  /** Smaller variant used inside dense card layouts. */
  compact?: boolean
}

export default function PipelineStrip({ pipeline, compact = false }: Props) {
  const dotSize = compact ? 'h-6 w-6' : 'h-7 w-7'
  const labelSize = compact ? 'text-[9px]' : 'text-[10px]'

  return (
    <div
      role="group"
      aria-label="Project pipeline status"
      className="flex items-center gap-0"
    >
      {TEAM_ORDER.map((team, idx) => {
        const stage = pipeline[team]
        const isLast = idx === TEAM_ORDER.length - 1
        const nextStage = !isLast ? pipeline[TEAM_ORDER[idx + 1] as EngineeringTeam] : null
        const leftHex = TEAM_META[team].hex
        return (
          <div key={team} className="flex flex-1 items-center">
            <Stage
              team={team}
              stage={stage}
              dotSize={dotSize}
              labelSize={labelSize}
              compact={compact}
            />
            {!isLast && nextStage !== null && (
              <Connector left={stage} right={nextStage} leftHex={leftHex} />
            )}
          </div>
        )
      })}
    </div>
  )
}

interface StageProps {
  team: EngineeringTeam
  stage: PipelineStage
  dotSize: string
  labelSize: string
  compact: boolean
}

function Stage({ team, stage, dotSize, labelSize, compact }: StageProps) {
  const meta = TEAM_META[team]
  const ariaLabel = `${meta.label}: ${stage.toLowerCase().replace('_', ' ')}`

  return (
    <div
      className="flex shrink-0 flex-col items-center"
      title={ariaLabel}
      aria-label={ariaLabel}
    >
      <DotForStage stage={stage} hex={meta.hex} dotSize={dotSize} />
      {!compact && (
        <span
          className={`mt-1 font-bold uppercase tracking-wide ${labelSize}`}
          style={{ color: stage === 'PENDING' ? '#94a3b8' : meta.hex }}
        >
          {meta.abbr}
        </span>
      )}
    </div>
  )
}

function DotForStage({
  stage,
  hex,
  dotSize,
}: {
  stage: PipelineStage
  hex: string
  dotSize: string
}) {
  if (stage === 'DONE') {
    return (
      <div
        className={`flex ${dotSize} items-center justify-center rounded-full shadow-sm ring-2 ring-white`}
        style={{ backgroundColor: hex }}
      >
        <Check className="h-3 w-3 text-white" strokeWidth={3} />
      </div>
    )
  }
  if (stage === 'IN_PROGRESS') {
    return (
      <div
        className={`flex ${dotSize} items-center justify-center rounded-full ring-2 ring-white`}
        style={{ backgroundColor: `${hex}1A`, boxShadow: `inset 0 0 0 1.5px ${hex}` }}
      >
        <Clock className="h-3 w-3" style={{ color: hex }} strokeWidth={2.5} />
      </div>
    )
  }
  if (stage === 'BLOCKED') {
    return (
      <div
        className={`flex ${dotSize} items-center justify-center rounded-full bg-red-50 ring-2 ring-white`}
        style={{ borderColor: '#dc2626', boxShadow: 'inset 0 0 0 2px #dc2626' }}
      >
        <AlertTriangle className="h-3 w-3 text-red-600" strokeWidth={2.5} />
      </div>
    )
  }
  // PENDING
  return (
    <div
      className={`flex ${dotSize} items-center justify-center rounded-full bg-white ring-2 ring-white`}
      style={{ boxShadow: 'inset 0 0 0 1.5px #cbd5e1' }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-slate-300" aria-hidden="true" />
    </div>
  )
}

/**
 * Connector between two stages. Encodes flow visually:
 *  - DONE → DONE / IN_PROGRESS  : solid emerald, fully filled bar
 *  - IN_PROGRESS → anything     : team-color → slate gradient (work in flight)
 *  - anything ↔ BLOCKED         : red-200
 *  - PENDING → PENDING          : slate, dim
 */
function Connector({
  left,
  right,
  leftHex,
}: {
  left: PipelineStage
  right: PipelineStage
  leftHex: string
}) {
  const base = 'mx-1 h-1 flex-1 rounded-full'

  if (left === 'DONE' && (right === 'DONE' || right === 'IN_PROGRESS')) {
    return (
      <span
        className={base}
        style={{ backgroundColor: '#10b981' }}
        aria-hidden="true"
      />
    )
  }
  if (left === 'IN_PROGRESS') {
    return (
      <span
        className={base}
        style={{
          background: `linear-gradient(to right, ${leftHex} 0%, ${leftHex}99 35%, #e2e8f0 100%)`,
        }}
        aria-hidden="true"
      />
    )
  }
  if (left === 'BLOCKED' || right === 'BLOCKED') {
    return (
      <span
        className={base}
        style={{ backgroundColor: '#fca5a5' }}
        aria-hidden="true"
      />
    )
  }
  return (
    <span
      className={base}
      style={{ backgroundColor: '#e2e8f0' }}
      aria-hidden="true"
    />
  )
}
