'use client'

/**
 * ShapesIconsPicker — drop-down picker for inserting SVG shapes, arrows,
 * and engineering icons into the DocEditor.
 *
 * How it works:
 *   · 3 tabs (Shapes / Arrows / Icons), each a grid of click-to-insert tiles
 *   · Each tile holds a self-contained inline-SVG string with viewBox + a
 *     `data-doc-shape` attribute (handy if we ever want to enumerate or
 *     restyle them post-insert) and inline width/height so the saved HTML
 *     renders at the right size without external CSS
 *   · Clicking calls `onInsert(svgString)`. The caller (DocEditor) restores
 *     the saved selection and runs `document.execCommand('insertHTML', ...)`
 *     so the shape lands exactly where the cursor was
 *   · A colour swatch row lets the user pick a fill before inserting —
 *     defaults to the brand teal so engineering docs look consistent
 *
 * Why hand-built SVG vs. rendering from lucide-react with ReactDOMServer:
 *   · The DocEditor persists `innerHTML` to localStorage. We need stable,
 *     self-contained SVG strings without React-only attributes. Hand-built
 *     SVG is portable, deterministic, and tiny.
 *   · Lucide ships a 24×24 stroke-based set; for shapes/arrows we want
 *     filled geometry with a controllable colour — different aesthetic.
 *
 * Accessibility:
 *   · Each tile is a <button> with an aria-label of the shape's name
 *   · Tabs are keyboard-reachable (focus + Enter)
 *   · Esc closes the popover (handled by the parent which renders it)
 */

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Shapes } from 'lucide-react'

interface Props {
  /** Called with a raw SVG string when the user picks an item. */
  onInsert: (svg: string) => void
  /** Called whenever the popover wants to close (after pick, or Esc). */
  onClose: () => void
}

// ── Colour palette ─────────────────────────────────────────────────────────

const COLOR_SWATCHES = [
  { name: 'Teal', hex: '#15524a' },
  { name: 'Slate', hex: '#334155' },
  { name: 'Black', hex: '#000000' },
  { name: 'Rose', hex: '#e11d48' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Sky', hex: '#0284c7' },
  { name: 'Violet', hex: '#7c3aed' },
]

// ── SVG library ────────────────────────────────────────────────────────────
//
// Each entry returns a self-contained SVG string given a fill colour.
// We deliberately set width / height / viewBox / display:inline-block as
// inline attributes so the saved doc renders without any external CSS.
// The xmlns is required for SVG to render when re-parsed from innerHTML
// in some browsers.

type SvgBuilder = (color: string) => string

const SHAPES: Array<{ id: string; name: string; build: SvgBuilder }> = [
  {
    id: 'rectangle',
    name: 'Rectangle',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="40" viewBox="0 0 64 40" data-doc-shape="rectangle" style="display:inline-block;vertical-align:middle;margin:0 4px"><rect x="2" y="2" width="60" height="36" rx="3" fill="${c}" /></svg>`,
  },
  {
    id: 'square',
    name: 'Square',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" data-doc-shape="square" style="display:inline-block;vertical-align:middle;margin:0 4px"><rect x="2" y="2" width="36" height="36" rx="3" fill="${c}" /></svg>`,
  },
  {
    id: 'circle',
    name: 'Circle',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" data-doc-shape="circle" style="display:inline-block;vertical-align:middle;margin:0 4px"><circle cx="20" cy="20" r="18" fill="${c}" /></svg>`,
  },
  {
    id: 'ellipse',
    name: 'Ellipse',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="40" viewBox="0 0 64 40" data-doc-shape="ellipse" style="display:inline-block;vertical-align:middle;margin:0 4px"><ellipse cx="32" cy="20" rx="30" ry="18" fill="${c}" /></svg>`,
  },
  {
    id: 'triangle',
    name: 'Triangle',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" data-doc-shape="triangle" style="display:inline-block;vertical-align:middle;margin:0 4px"><polygon points="20,3 37,36 3,36" fill="${c}" /></svg>`,
  },
  {
    id: 'diamond',
    name: 'Diamond',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" data-doc-shape="diamond" style="display:inline-block;vertical-align:middle;margin:0 4px"><polygon points="20,2 38,20 20,38 2,20" fill="${c}" /></svg>`,
  },
  {
    id: 'hexagon',
    name: 'Hexagon',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="40" viewBox="0 0 44 40" data-doc-shape="hexagon" style="display:inline-block;vertical-align:middle;margin:0 4px"><polygon points="11,2 33,2 43,20 33,38 11,38 1,20" fill="${c}" /></svg>`,
  },
  {
    id: 'pentagon',
    name: 'Pentagon',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" data-doc-shape="pentagon" style="display:inline-block;vertical-align:middle;margin:0 4px"><polygon points="20,2 38,16 31,38 9,38 2,16" fill="${c}" /></svg>`,
  },
  {
    id: 'star',
    name: 'Star',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" data-doc-shape="star" style="display:inline-block;vertical-align:middle;margin:0 4px"><polygon points="20,2 25,15 39,15 28,24 32,38 20,30 8,38 12,24 1,15 15,15" fill="${c}" /></svg>`,
  },
  {
    id: 'parallelogram',
    name: 'Parallelogram',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="40" viewBox="0 0 56 40" data-doc-shape="parallelogram" style="display:inline-block;vertical-align:middle;margin:0 4px"><polygon points="12,4 54,4 44,36 2,36" fill="${c}" /></svg>`,
  },
]

const ARROWS: Array<{ id: string; name: string; build: SvgBuilder }> = [
  {
    id: 'arrow-right',
    name: 'Arrow right',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="24" viewBox="0 0 60 24" data-doc-shape="arrow-right" style="display:inline-block;vertical-align:middle;margin:0 4px"><path d="M2,10 L42,10 L42,4 L58,12 L42,20 L42,14 L2,14 Z" fill="${c}" /></svg>`,
  },
  {
    id: 'arrow-left',
    name: 'Arrow left',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="24" viewBox="0 0 60 24" data-doc-shape="arrow-left" style="display:inline-block;vertical-align:middle;margin:0 4px"><path d="M58,10 L18,10 L18,4 L2,12 L18,20 L18,14 L58,14 Z" fill="${c}" /></svg>`,
  },
  {
    id: 'arrow-up',
    name: 'Arrow up',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="60" viewBox="0 0 24 60" data-doc-shape="arrow-up" style="display:inline-block;vertical-align:middle;margin:0 4px"><path d="M10,58 L10,18 L4,18 L12,2 L20,18 L14,18 L14,58 Z" fill="${c}" /></svg>`,
  },
  {
    id: 'arrow-down',
    name: 'Arrow down',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="60" viewBox="0 0 24 60" data-doc-shape="arrow-down" style="display:inline-block;vertical-align:middle;margin:0 4px"><path d="M10,2 L10,42 L4,42 L12,58 L20,42 L14,42 L14,2 Z" fill="${c}" /></svg>`,
  },
  {
    id: 'arrow-up-right',
    name: 'Arrow up-right',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" data-doc-shape="arrow-up-right" style="display:inline-block;vertical-align:middle;margin:0 4px"><path d="M8,40 L36,12 L24,12 L24,4 L44,4 L44,24 L36,24 L36,16 L14,38 Z" fill="${c}" /></svg>`,
  },
  {
    id: 'arrow-down-right',
    name: 'Arrow down-right',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" data-doc-shape="arrow-down-right" style="display:inline-block;vertical-align:middle;margin:0 4px"><path d="M8,8 L36,36 L36,28 L44,28 L44,44 L28,44 L28,36 L14,22 Z" fill="${c}" /></svg>`,
  },
  {
    id: 'arrow-2way-h',
    name: 'Two-way (horizontal)',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="24" viewBox="0 0 72 24" data-doc-shape="arrow-2way-h" style="display:inline-block;vertical-align:middle;margin:0 4px"><path d="M2,12 L16,4 L16,10 L56,10 L56,4 L70,12 L56,20 L56,14 L16,14 L16,20 Z" fill="${c}" /></svg>`,
  },
  {
    id: 'arrow-2way-v',
    name: 'Two-way (vertical)',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="72" viewBox="0 0 24 72" data-doc-shape="arrow-2way-v" style="display:inline-block;vertical-align:middle;margin:0 4px"><path d="M12,2 L20,16 L14,16 L14,56 L20,56 L12,70 L4,56 L10,56 L10,16 L4,16 Z" fill="${c}" /></svg>`,
  },
  {
    id: 'arrow-curved',
    name: 'Curved arrow',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="40" viewBox="0 0 56 40" data-doc-shape="arrow-curved" style="display:inline-block;vertical-align:middle;margin:0 4px"><path d="M4,30 Q4,8 28,8 L28,2 L52,12 L28,22 L28,16 Q12,16 12,30 Z" fill="${c}" /></svg>`,
  },
  {
    id: 'chevron-right',
    name: 'Chevron right',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" data-doc-shape="chevron-right" style="display:inline-block;vertical-align:middle;margin:0 4px"><polygon points="12,4 32,20 12,36 6,30 20,20 6,10" fill="${c}" /></svg>`,
  },
]

// Engineering-doc icons. Each is stroke-based with currentColor so the
// colour swatch toggles it via the `color` style attribute on the SVG.
const ICONS: Array<{ id: string; name: string; build: SvgBuilder }> = [
  {
    id: 'check-circle',
    name: 'Check',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" data-doc-shape="icon-check" style="display:inline-block;vertical-align:middle;margin:0 4px"><circle cx="12" cy="12" r="10"/><polyline points="8,12 11,15 16,9"/></svg>`,
  },
  {
    id: 'alert-triangle',
    name: 'Warning',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" data-doc-shape="icon-warning" style="display:inline-block;vertical-align:middle;margin:0 4px"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  },
  {
    id: 'x-circle',
    name: 'Reject',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" data-doc-shape="icon-reject" style="display:inline-block;vertical-align:middle;margin:0 4px"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  },
  {
    id: 'info',
    name: 'Info',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" data-doc-shape="icon-info" style="display:inline-block;vertical-align:middle;margin:0 4px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  },
  {
    id: 'lightbulb',
    name: 'Idea',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" data-doc-shape="icon-idea" style="display:inline-block;vertical-align:middle;margin:0 4px"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>`,
  },
  {
    id: 'flag',
    name: 'Flag',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" data-doc-shape="icon-flag" style="display:inline-block;vertical-align:middle;margin:0 4px"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`,
  },
  {
    id: 'bookmark',
    name: 'Bookmark',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" data-doc-shape="icon-bookmark" style="display:inline-block;vertical-align:middle;margin:0 4px"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>`,
  },
  {
    id: 'wrench',
    name: 'Action',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" data-doc-shape="icon-action" style="display:inline-block;vertical-align:middle;margin:0 4px"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
  },
  {
    id: 'pin',
    name: 'Pin',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" data-doc-shape="icon-pin" style="display:inline-block;vertical-align:middle;margin:0 4px"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/></svg>`,
  },
  {
    id: 'lock',
    name: 'Lock',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" data-doc-shape="icon-lock" style="display:inline-block;vertical-align:middle;margin:0 4px"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  },
  {
    id: 'gear',
    name: 'Settings',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" data-doc-shape="icon-gear" style="display:inline-block;vertical-align:middle;margin:0 4px"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  },
  {
    id: 'ruler',
    name: 'Measure',
    build: (c) =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" data-doc-shape="icon-ruler" style="display:inline-block;vertical-align:middle;margin:0 4px"><path d="M21.3 8.7 8.7 21.3a2.41 2.41 0 0 1-3.4 0L2.7 18.7a2.41 2.41 0 0 1 0-3.4L15.3 2.7a2.41 2.41 0 0 1 3.4 0l2.6 2.6a2.41 2.41 0 0 1 0 3.4Z"/><path d="m7.5 10.5 2 2"/><path d="m10.5 7.5 2 2"/><path d="m13.5 4.5 2 2"/><path d="m4.5 13.5 2 2"/></svg>`,
  },
]

type TabId = 'shapes' | 'arrows' | 'icons'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'shapes', label: 'Shapes' },
  { id: 'arrows', label: 'Arrows' },
  { id: 'icons', label: 'Icons' },
]

export default function ShapesIconsPicker({ onInsert, onClose }: Props): JSX.Element {
  const [tab, setTab] = useState<TabId>('shapes')
  const [color, setColor] = useState<string>(COLOR_SWATCHES[0]!.hex)
  const rootRef = useRef<HTMLDivElement | null>(null)

  // Close on Esc + outside-click. Both run on the document so they catch
  // events that bubble past the popover.
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
    // Capture phase so we close BEFORE the click triggers anything else
    // (e.g. clicking the toolbar button that opened it would otherwise
    // immediately re-open it).
    document.addEventListener('mousedown', onMouseDown, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onMouseDown, true)
    }
  }, [onClose])

  const items =
    tab === 'shapes' ? SHAPES : tab === 'arrows' ? ARROWS : ICONS

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Insert shape, arrow, or icon"
      className="dv-anim-pop absolute right-0 top-9 z-30 w-[320px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
    >
      {/* Tabs */}
      <div role="tablist" className="flex border-b border-slate-100 bg-slate-50/60">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              'flex-1 px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition',
              tab === t.id
                ? 'bg-white text-primary shadow-[inset_0_-2px_0_0_currentColor]'
                : 'text-slate-500 hover:bg-white hover:text-slate-700',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Colour swatches */}
      <div className="flex items-center gap-1.5 border-b border-slate-100 px-3 py-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Colour
        </span>
        <div className="flex flex-1 items-center justify-end gap-1">
          {COLOR_SWATCHES.map((s) => (
            <button
              key={s.hex}
              type="button"
              aria-label={s.name}
              title={s.name}
              onClick={() => setColor(s.hex)}
              className={[
                'h-4 w-4 rounded-full border transition hover:scale-110',
                color === s.hex
                  ? 'border-slate-900 ring-2 ring-offset-1'
                  : 'border-slate-200',
              ].join(' ')}
              style={{ backgroundColor: s.hex }}
            />
          ))}
        </div>
      </div>

      {/* Grid of items */}
      <div className="dv-thin-scroll grid max-h-[260px] grid-cols-4 gap-1 overflow-y-auto p-2">
        {items.map((it) => {
          const svg = it.build(color)
          return (
            <button
              key={it.id}
              type="button"
              aria-label={`Insert ${it.name}`}
              title={it.name}
              onClick={() => {
                onInsert(svg)
                onClose()
              }}
              className="flex h-16 flex-col items-center justify-center rounded-md border border-transparent text-slate-600 transition hover:border-primary/40 hover:bg-primary-50/40"
              // Inline SVG preview — rendered straight from the builder.
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          )
        })}
      </div>

      {/* Footer hint */}
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-3 py-1.5">
        <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
          <Shapes className="h-3 w-3" />
          Click to insert at cursor
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] font-semibold text-slate-500 transition hover:text-slate-900"
        >
          Close
        </button>
      </div>
    </div>
  )
}

// Re-export the chevron icon so the parent's toggle button can use the
// same one without importing lucide-react twice.
export { ChevronDown as PickerChevron }
