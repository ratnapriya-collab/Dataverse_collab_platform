'use client'

import { MessagesSquare } from 'lucide-react'
import DecisionCard from './DecisionCard'
import type { DecisionRead } from '@/types/api'

interface Props {
  decisions: DecisionRead[]
  onChanged: (updated: DecisionRead) => void
  highlightedFaceUuid: string | null
  onHoverDecision: (faceUuid: string | null) => void
  /** Smart-pin v2: clicking a comment opens its floating card on the viewer. */
  onSelectFace?: (faceUuid: string | null) => void
}

export default function DecisionsPanel({
  decisions,
  onChanged,
  highlightedFaceUuid,
  onHoverDecision,
  onSelectFace,
}: Props) {
  const proposed = decisions.filter((d) => d.state === 'PROPOSED').length
  const accepted = decisions.filter((d) => d.state === 'ACCEPTED').length

  return (
    <section>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Comments
        </h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
          {decisions.length}
        </span>
      </div>

      {decisions.length > 0 && (
        <div className="mt-2 flex gap-2 text-[10px]">
          {proposed > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700">
              {proposed} open
            </span>
          )}
          {accepted > 0 && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
              {accepted} accepted
            </span>
          )}
        </div>
      )}

      {decisions.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center">
          <MessagesSquare className="mx-auto h-6 w-6 text-slate-400" />
          <p className="mt-2 text-xs font-medium text-slate-700">No comments yet</p>
          <p className="mt-1 text-[11px] text-slate-500">
            Click a face in the viewer to leave a comment anchored to that exact spot.
          </p>
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {decisions.map((d) => (
            <li key={d.id}>
              <DecisionCard
                decision={d}
                onChanged={onChanged}
                onHover={onHoverDecision}
                onSelectFace={onSelectFace}
                highlighted={
                  d.anchor !== null && d.anchor.face_uuid === highlightedFaceUuid
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
