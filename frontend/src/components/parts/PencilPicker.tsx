'use client'

/**
 * PencilPicker — floating popover for the toolbar pencil button.
 *
 * Matches the Quarter20 markup UX shown in the reference video:
 *   · Color-wheel row at the top (8 palette swatches)
 *   · Line-width row below (3 preset thicknesses shown as sample strokes)
 *   · Toggle-off button (turns draw mode off)
 *
 * The picker itself only edits the local pen state — actual drawing is
 * handled by the DocEditor's annotation controller which reads the
 * chosen color / width from the parent.
 */

import { useEffect, useRef } from 'react'
import { Eraser, X } from 'lucide-react'

export const PEN_COLORS: readonly { name: string; hex: string }[] = [
  { name: 'Green',  hex: '#22c55e' },
  { name: 'Red',    hex: '#ef4444' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Blue',   hex: '#3b82f6' },
  { name: 'Violet', hex: '#8b5cf6' },
  { name: 'Pink',   hex: '#ec4899' },
  { name: 'Black',  hex: '#0f172a' },
] as const

export const PEN_WIDTHS: readonly { label: string; value: number }[] = [
  { label: 'Thin',   value: 2 },
  { label: 'Medium', value: 4 },
  { label: 'Thick',  value: 7 },
] as const

interface Props {
  color: string
  width: number
  onChangeColor: (hex: string) => void
  onChangeWidth: (w: number) => void
  onEraseAll: () => void
  onTurnOff: () => void
  onClose: () => void
}

export default function PencilPicker({
  color,
  width,
  onChangeColor,
  onChangeWidth,
  onEraseAll,
  onTurnOff,
  onClose,
}: Props): JSX.Element {
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    const onDown = (e: MouseEvent): void => {
      const t = e.target as Node | null
      if (rootRef.current !== null && t !== null && !rootRef.current.contains(t)) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown, true)
    }
  }, [onClose])

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Pencil markup options"
      className="dv-anim-pop absolute right-0 top-9 z-30 w-[220px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-3 py-1.5">
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
          Pencil markup
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close pencil options"
          className="flex h-5 w-5 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Colour palette */}
      <div className="border-b border-slate-100 px-3 py-2">
        <p className="mb-1.5 text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
          Colour
        </p>
        <div className="grid grid-cols-8 gap-1">
          {PEN_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              aria-label={c.name}
              title={c.name}
              onClick={() => onChangeColor(c.hex)}
              className={[
                'h-5 w-5 rounded-full border transition hover:scale-110',
                color === c.hex
                  ? 'border-slate-900 ring-2 ring-offset-1'
                  : 'border-slate-200',
              ].join(' ')}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
      </div>

      {/* Line width — samples show the actual stroke thickness */}
      <div className="border-b border-slate-100 px-3 py-2">
        <p className="mb-1.5 text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
          Line width
        </p>
        <div className="flex gap-1.5">
          {PEN_WIDTHS.map((w) => {
            const active = width === w.value
            return (
              <button
                key={w.value}
                type="button"
                onClick={() => onChangeWidth(w.value)}
                aria-label={w.label}
                title={w.label}
                className={[
                  'flex flex-1 flex-col items-center gap-0.5 rounded-md border px-2 py-1.5 transition',
                  active
                    ? 'border-primary/60 bg-primary-50/40 ring-1 ring-primary/30'
                    : 'border-slate-200 bg-white hover:border-slate-300',
                ].join(' ')}
              >
                <svg viewBox="0 0 60 12" className="h-3 w-full">
                  <path
                    d="M 4 6 C 15 2, 30 10, 56 6"
                    stroke={color}
                    strokeWidth={w.value}
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
                <span
                  className={[
                    'text-[9.5px] font-semibold',
                    active ? 'text-primary' : 'text-slate-500',
                  ].join(' ')}
                >
                  {w.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-1.5 bg-slate-50/40 px-3 py-1.5">
        <button
          type="button"
          onClick={onEraseAll}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-semibold text-slate-600 transition hover:bg-rose-50 hover:text-rose-600"
        >
          <Eraser className="h-3 w-3" />
          Erase all
        </button>
        <button
          type="button"
          onClick={onTurnOff}
          className="rounded-md bg-slate-800 px-2.5 py-1 text-[10.5px] font-semibold text-white transition hover:bg-slate-900"
        >
          Done
        </button>
      </div>
    </div>
  )
}
