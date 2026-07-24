'use client'

/**
 * CanvasColorPalette — the small floating swatch grid at the top-right
 * that sets the active colour used by new sticky notes, shapes, and
 * pencil strokes. Matches the video reference layout: swatches on top,
 * a width slider below.
 */

import { useCanvasStore } from './canvasStore'

const SWATCHES: readonly string[] = [
  '#0f172a', '#64748b', '#94a3b8', '#cbd5e1',       // greys row
  '#dc2626', '#f97316', '#facc15', '#22c55e',       // warm+cool row
  '#3b82f6', '#8b5cf6', '#ec4899', '#f9fafb',       // brand row
]

export default function CanvasColorPalette(): JSX.Element {
  const color = useCanvasStore((s) => s.color)
  const setColor = useCanvasStore((s) => s.setColor)

  return (
    <div className="pointer-events-auto absolute right-3 top-3 z-20 flex flex-col gap-1 rounded-lg border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur">
      <p className="mb-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
        Colour
      </p>
      <div className="grid grid-cols-4 gap-1">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={`Colour ${c}`}
            title={c}
            className={[
              'h-5 w-5 rounded-md border transition hover:scale-110',
              color === c
                ? 'border-slate-900 ring-2 ring-offset-1 ring-slate-900/40'
                : 'border-slate-200',
              c === '#f9fafb' ? 'ring-inset ring-1 ring-slate-200' : '',
            ].join(' ')}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  )
}
