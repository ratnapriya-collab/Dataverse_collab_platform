'use client'

/**
 * TemplatesPicker — popover for choosing a Quarter20-style document template.
 *
 * Opens from the "Templates" chip above the editor canvas. Picking a
 * template replaces the current doc's content (with a confirm first, so
 * the user doesn't lose in-progress writing).
 *
 * Tightly scoped surface — one job, one place: the picker itself doesn't
 * save state; it just calls onPick(template) and the parent DocEditor
 * handles the innerHTML swap + writeDoc call.
 *
 * Closes on outside click, Esc, or an explicit Cancel button. Uses
 * capture-phase mousedown so clicking the trigger while open doesn't
 * race the toggle handler.
 */

import { useEffect, useRef } from 'react'
import {
  ClipboardCheck,
  FileText,
  MessageSquareText,
  Sparkles,
  Truck,
  Wrench,
  X,
} from 'lucide-react'
import { DOC_TEMPLATES, type DocTemplate, type DocTemplateId } from './docTemplates'

interface Props {
  activeId: DocTemplateId | null
  onPick: (t: DocTemplate) => void
  onClose: () => void
}

// Map template id → lucide icon so the picker cards read at a glance.
const ICON: Record<DocTemplateId, typeof FileText> = {
  blank: FileText,
  'work-instructions': ClipboardCheck,
  'design-review': MessageSquareText,
  'quality-check': Sparkles,
  maintenance: Wrench,
  'field-operations': Truck,
}

// Tone → chip colour classes. Kept inline (no config file) so this
// component is drop-in and doesn't rely on Tailwind's safelist config.
const TONE_CLASSES: Record<DocTemplate['tone'], { bg: string; fg: string; ring: string }> = {
  primary: { bg: 'bg-primary-50',  fg: 'text-primary',      ring: 'ring-primary/30' },
  amber:   { bg: 'bg-amber-50',    fg: 'text-amber-700',    ring: 'ring-amber-300/50' },
  emerald: { bg: 'bg-emerald-50',  fg: 'text-emerald-700',  ring: 'ring-emerald-300/50' },
  sky:     { bg: 'bg-sky-50',      fg: 'text-sky-700',      ring: 'ring-sky-300/50' },
  violet:  { bg: 'bg-violet-50',   fg: 'text-violet-700',   ring: 'ring-violet-300/50' },
  slate:   { bg: 'bg-slate-100',   fg: 'text-slate-600',    ring: 'ring-slate-300/60' },
}

export default function TemplatesPicker({ activeId, onPick, onClose }: Props): JSX.Element {
  const rootRef = useRef<HTMLDivElement | null>(null)

  // Esc + outside-click close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    const onMouseDown = (e: MouseEvent): void => {
      const t = e.target as Node | null
      if (rootRef.current !== null && t !== null && !rootRef.current.contains(t)) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onMouseDown, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onMouseDown, true)
    }
  }, [onClose])

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Choose a document template"
      className="dv-anim-pop absolute left-0 top-full z-40 mt-2 w-[520px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Templates</p>
          <p className="text-[12.5px] font-bold text-slate-900">
            Multi-doc-type generation
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close templates picker"
          className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Grid of template cards */}
      <div className="dv-thin-scroll grid max-h-[420px] grid-cols-2 gap-2 overflow-y-auto p-3">
        {DOC_TEMPLATES.map((t) => {
          const Icon = ICON[t.id]
          const tone = TONE_CLASSES[t.tone]
          const isActive = activeId === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick(t)}
              className={[
                'group flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition',
                isActive
                  ? 'border-primary/60 bg-primary-50/40 ring-2 ring-primary/30'
                  : 'border-slate-200 bg-white hover:border-primary/40 hover:bg-slate-50/60',
              ].join(' ')}
            >
              <div className="flex w-full items-center gap-2">
                <span
                  className={[
                    'flex h-7 w-7 items-center justify-center rounded-md ring-1',
                    tone.bg,
                    tone.fg,
                    tone.ring,
                  ].join(' ')}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-slate-900">
                  {t.label}
                </span>
                <span
                  className={[
                    'shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider',
                    tone.bg,
                    tone.fg,
                  ].join(' ')}
                >
                  {t.abbr}
                </span>
              </div>
              <p className="text-[10.5px] leading-relaxed text-slate-500">{t.hint}</p>
            </button>
          )
        })}
      </div>

      {/* Footer note — matches Quarter20's "Multi-doc-type generation" language */}
      <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-2 text-[10.5px] text-slate-500">
        Picking a template <strong>replaces</strong> the current doc content. You'll be asked to confirm.
      </div>
    </div>
  )
}
