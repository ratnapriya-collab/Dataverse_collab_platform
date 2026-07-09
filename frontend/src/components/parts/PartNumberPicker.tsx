'use client'

/**
 * PartNumberPicker — dropdown triggered from a dedicated toolbar button.
 *
 * Insert a part-number chip carrying the metadata Quarter20's marketing
 * highlights: part number, torque spec, material. Renders inline like
 * `<span data-part="DV-HSG-100" class="dv-part-chip">DV-HSG-100 · Al 6061-T6 · 25 Nm</span>`
 * so the referenced part is unambiguous in the doc body.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { DOC_PARTS, type DocPart } from './docReferenceData'

interface Props {
  onPick: (p: DocPart) => void
  onClose: () => void
}

export default function PartNumberPicker({ onPick, onClose }: Props): JSX.Element {
  const [q, setQ] = useState('')
  const rootRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

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

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (s === '') return DOC_PARTS
    return DOC_PARTS.filter(
      (p) =>
        p.partNumber.toLowerCase().includes(s) ||
        p.name.toLowerCase().includes(s) ||
        p.material.toLowerCase().includes(s) ||
        (p.supplier ?? '').toLowerCase().includes(s),
    )
  }, [q])

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Insert part number"
      className="dv-anim-pop absolute right-0 top-9 z-30 w-[380px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-3 py-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Insert part number
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close part number picker"
          className="flex h-5 w-5 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="relative border-b border-slate-100 px-3 py-2">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search P/N · name · material · supplier"
          className="w-full rounded border border-slate-200 pl-6 pr-2 py-1 text-[12px] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
      </div>

      <div className="dv-thin-scroll max-h-[280px] overflow-y-auto py-1">
        {filtered.length === 0 && (
          <p className="px-3 py-3 text-center text-[11px] text-slate-500">
            No parts matching &ldquo;{q}&rdquo;
          </p>
        )}
        {filtered.map((p) => (
          <button
            key={p.partNumber}
            type="button"
            onClick={() => onPick(p)}
            className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition hover:bg-slate-50"
          >
            <div className="flex w-full items-center gap-2">
              <span className="font-mono text-[11.5px] font-bold text-primary">
                {p.partNumber}
              </span>
              <span className="truncate text-[12px] text-slate-700">{p.name}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-slate-500">
              <span>
                <strong className="font-semibold text-slate-700">Material:</strong>{' '}
                {p.material}
              </span>
              {p.torque !== undefined && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>
                    <strong className="font-semibold text-slate-700">Torque:</strong>{' '}
                    {p.torque}
                  </span>
                </>
              )}
              {p.supplier !== undefined && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>{p.supplier}</span>
                </>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
