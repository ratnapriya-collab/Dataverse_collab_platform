'use client'

/**
 * MentionsTagsPicker — floating popup shown next to the caret when the
 * user types `@` (mentions) or `#` (tags) inside the Doc editor.
 *
 * Interaction (mirrors Notion / Linear / Slack conventions):
 *   · Type `@`   → picker opens filtered by the empty query
 *   · Keep typing → query filters the list live
 *   · Backspace past the trigger → closes without inserting
 *   · Esc         → closes without inserting
 *   · ↑ / ↓       → navigate list
 *   · Enter / Tab → insert the highlighted item
 *   · Click item  → same as Enter
 *   · Outside click → closes without inserting
 *
 * Positioning: caller supplies the caret's screen position (x, y). We
 * anchor the popup below-right of the caret and let it flip up if it
 * would clip the viewport bottom.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { AtSign, Hash } from 'lucide-react'
import { DOC_MEMBERS, DOC_TAGS, type DocMember, type DocTag } from './docReferenceData'

export type PickerTrigger = '@' | '#'

interface Props {
  trigger: PickerTrigger
  query: string
  /** Caret screen position (viewport coords). Popup anchors below-right. */
  anchorX: number
  anchorY: number
  onPickMember: (m: DocMember) => void
  onPickTag: (t: DocTag) => void
  onClose: () => void
  /** Callback fired for arrow-key / enter presses so the parent can
   *  swallow them before contentEditable processes them. */
  registerKeydownHandler: (fn: ((e: KeyboardEvent) => boolean) | null) => void
}

function categoryColor(cat: DocTag['category']): string {
  switch (cat) {
    case 'tool':      return '#1e40af'
    case 'procedure': return '#6d28d9'
    case 'torque':    return '#9a3412'
    case 'material':  return '#065f46'
    case 'standard':  return '#991b1b'
    default:          return '#334155'
  }
}

export default function MentionsTagsPicker({
  trigger,
  query,
  anchorX,
  anchorY,
  onPickMember,
  onPickTag,
  onClose,
  registerKeydownHandler,
}: Props): JSX.Element | null {
  const [activeIdx, setActiveIdx] = useState(0)
  const rootRef = useRef<HTMLDivElement | null>(null)

  // Filter by query — case-insensitive, matches name / role / label / detail.
  const members = useMemo(() => {
    if (trigger !== '@') return []
    const q = query.toLowerCase().trim()
    if (q === '') return DOC_MEMBERS
    return DOC_MEMBERS.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q),
    )
  }, [trigger, query])

  const tags = useMemo(() => {
    if (trigger !== '#') return []
    const q = query.toLowerCase().trim()
    if (q === '') return DOC_TAGS
    return DOC_TAGS.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        (t.detail ?? '').toLowerCase().includes(q),
    )
  }, [trigger, query])

  const totalCount = trigger === '@' ? members.length : tags.length

  // Clamp active index when the filtered list shrinks.
  useEffect(() => {
    setActiveIdx((i) => (totalCount === 0 ? 0 : Math.min(i, totalCount - 1)))
  }, [totalCount])
  // Reset to 0 when the query changes.
  useEffect(() => {
    setActiveIdx(0)
  }, [query, trigger])

  // Register a keydown handler with the parent so arrow/enter/tab keys
  // get intercepted BEFORE contentEditable does anything with them. The
  // parent calls this handler on every keydown; returning true means
  // "handled — stop propagation".
  useEffect(() => {
    const handler = (e: KeyboardEvent): boolean => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return true
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => (totalCount === 0 ? 0 : (i + 1) % totalCount))
        return true
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => (totalCount === 0 ? 0 : (i - 1 + totalCount) % totalCount))
        return true
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        if (trigger === '@' && members[activeIdx] !== undefined) {
          onPickMember(members[activeIdx]!)
        } else if (trigger === '#' && tags[activeIdx] !== undefined) {
          onPickTag(tags[activeIdx]!)
        } else {
          onClose()
        }
        return true
      }
      return false
    }
    registerKeydownHandler(handler)
    return () => registerKeydownHandler(null)
  }, [
    trigger,
    activeIdx,
    totalCount,
    members,
    tags,
    onClose,
    onPickMember,
    onPickTag,
    registerKeydownHandler,
  ])

  // Outside-click closes (capture phase so we see it first).
  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      const t = e.target as Node | null
      if (rootRef.current !== null && t !== null && !rootRef.current.contains(t)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', onDown, true)
    return () => document.removeEventListener('mousedown', onDown, true)
  }, [onClose])

  if (totalCount === 0) return null

  // Position: anchor below the caret. Flip up if we'd overflow.
  const POPUP_H_MAX = 240
  const shouldFlipUp =
    typeof window !== 'undefined' && anchorY + POPUP_H_MAX + 40 > window.innerHeight

  return (
    <div
      ref={rootRef}
      role="listbox"
      aria-label={trigger === '@' ? 'Mention teammate' : 'Insert tag'}
      style={{
        position: 'fixed',
        left: `${Math.max(8, anchorX)}px`,
        top: shouldFlipUp
          ? `${Math.max(8, anchorY - POPUP_H_MAX - 24)}px`
          : `${anchorY + 20}px`,
        width: 260,
        maxHeight: POPUP_H_MAX,
        zIndex: 60,
      }}
      className="dv-anim-pop overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
    >
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50/60 px-3 py-1.5">
        {trigger === '@' ? (
          <AtSign className="h-3 w-3 text-slate-500" />
        ) : (
          <Hash className="h-3 w-3 text-slate-500" />
        )}
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
          {trigger === '@' ? 'Mention' : 'Tag'}
        </span>
        <span className="ml-auto text-[10px] text-slate-400">
          {query === '' ? 'type to filter' : `"${query}"`}
        </span>
      </div>

      <div className="dv-thin-scroll max-h-[200px] overflow-y-auto">
        {trigger === '@' &&
          members.map((m, i) => (
            <button
              key={m.id}
              type="button"
              role="option"
              aria-selected={i === activeIdx}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseDown={(e) => {
                // preventDefault keeps the contentEditable from losing focus.
                e.preventDefault()
              }}
              onClick={() => onPickMember(m)}
              className={[
                'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition',
                i === activeIdx
                  ? 'bg-primary-50 text-primary'
                  : 'text-slate-700 hover:bg-slate-50',
              ].join(' ')}
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary"
                aria-hidden="true"
              >
                {m.name
                  .split(' ')
                  .map((s) => s[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{m.name}</span>
                <span className="block truncate text-[10px] text-slate-500">
                  {m.role}
                </span>
              </span>
            </button>
          ))}
        {trigger === '#' &&
          tags.map((t, i) => (
            <button
              key={t.id}
              type="button"
              role="option"
              aria-selected={i === activeIdx}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPickTag(t)}
              className={[
                'flex w-full items-start gap-2 px-3 py-1.5 text-left text-[12px] transition',
                i === activeIdx
                  ? 'bg-primary-50 text-primary'
                  : 'text-slate-700 hover:bg-slate-50',
              ].join(' ')}
            >
              <span
                className="mt-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                style={{
                  backgroundColor: `${categoryColor(t.category)}18`,
                  color: categoryColor(t.category),
                }}
              >
                {t.category}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{t.label}</span>
                {t.detail !== undefined && (
                  <span className="block truncate text-[10px] text-slate-500">
                    {t.detail}
                  </span>
                )}
              </span>
            </button>
          ))}
      </div>
    </div>
  )
}
