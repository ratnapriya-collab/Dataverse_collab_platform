'use client'

/**
 * CanvasBottomToolbar — the floating tool row at the bottom-center of
 * the canvas. Matches the video reference: Select · Sticky · Text ·
 * Rectangle · Arrow · Pencil · Eraser · Clear.
 *
 * Also shows zoom controls at bottom-left and a "0%" label — mimics
 * the Miro / FigJam pattern the user showed.
 */

import {
  Eraser, Minus, MousePointer2, PenLine, Plus, Square,
  StickyNote as StickyIcon, Trash2, Type, ArrowRight,
} from 'lucide-react'
import { useCanvasStore, type ToolKind } from './canvasStore'

interface Tool {
  key: ToolKind
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const TOOLS: Tool[] = [
  { key: 'select',  label: 'Select',    icon: MousePointer2 },
  { key: 'sticky',  label: 'Sticky',    icon: StickyIcon },
  { key: 'text',    label: 'Text',      icon: Type },
  { key: 'rect',    label: 'Rectangle', icon: Square },
  { key: 'arrow',   label: 'Arrow',     icon: ArrowRight },
  { key: 'pencil',  label: 'Pencil',    icon: PenLine },
  { key: 'eraser',  label: 'Eraser',    icon: Eraser },
]

export default function CanvasBottomToolbar(): JSX.Element {
  const tool = useCanvasStore((s) => s.tool)
  const setTool = useCanvasStore((s) => s.setTool)
  const zoom = useCanvasStore((s) => s.zoom)
  const setZoom = useCanvasStore((s) => s.setZoom)
  const clearAll = useCanvasStore((s) => s.clearAll)

  const bumpZoom = (delta: number): void => {
    const next = Math.max(0.2, Math.min(3, zoom + delta))
    setZoom(next)
  }

  return (
    <>
      {/* Zoom pill — bottom-left */}
      <div className="pointer-events-auto absolute bottom-3 left-3 z-20 flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 px-2 py-1 shadow-lg backdrop-blur">
        <button
          type="button"
          onClick={() => bumpZoom(-0.1)}
          aria-label="Zoom out"
          className="flex h-6 w-6 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          className="min-w-[42px] text-center text-[11px] font-bold text-slate-700 hover:text-primary"
          title="Reset zoom to 100%"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => bumpZoom(0.1)}
          aria-label="Zoom in"
          className="flex h-6 w-6 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tool row — bottom-center */}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white/95 px-1.5 py-1.5 shadow-2xl backdrop-blur">
          {TOOLS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTool(t.key)}
              aria-pressed={tool === t.key}
              title={t.label}
              className={[
                'flex h-8 w-8 items-center justify-center rounded-lg transition',
                tool === t.key
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              ].join(' ')}
            >
              <t.icon className="h-4 w-4" />
            </button>
          ))}
          <div className="mx-0.5 h-6 w-px bg-slate-200" />
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Clear the whole canvas? This cannot be undone.')) {
                clearAll()
              }
            }}
            aria-label="Clear canvas"
            title="Clear canvas"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  )
}
