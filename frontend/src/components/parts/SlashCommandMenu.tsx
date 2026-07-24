'use client'

/**
 * SlashCommandMenu — Notion / Quarter20-style block-insertion menu.
 *
 * Trigger:  user types `/` at the start of a line (or after whitespace)
 * anywhere in the contentEditable. A floating menu appears next to the
 * caret listing insertable blocks. Live-filtered by anything typed after
 * the slash.
 *
 * Keys:
 *   · ↑ / ↓        navigate
 *   · Enter / Tab  insert the highlighted command
 *   · Esc          close
 *   · anything else typed → keeps filtering (parent's onInput calls
 *     back into detectSlashTrigger)
 *
 * Same shape as MentionsTagsPicker on purpose — the parent uses a
 * single `pickerKeydownRef` slot for both, and they never open together.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  AtSign,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Code2,
  FileText,
  Hash,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Link2,
  List,
  ListOrdered,
  Minus,
  MessageSquare,
  Sparkles,
  Table as TableIcon,
  Tag,
} from 'lucide-react'

export interface SlashCommand {
  id: string
  label: string
  hint: string
  group: 'basic' | 'headings' | 'lists' | 'blocks' | 'inserts' | 'workflow'
  icon: typeof FileText
  keywords: string[]
  /** Return the HTML to insert. */
  build: () => string
  /**
   * Optional side-effect hook after insertion — used by inserts that
   * need to open a picker (e.g. Part number opens the P/N picker).
   * Return true to skip the HTML insertion (the side-effect owns it).
   */
  action?: 'insertPartPicker' | 'insertMentionPicker' | 'insertTagPicker' | 'insertImage' | 'insertLink'
}

// Curated menu — mirrors what our toolbar already exposes plus quick-
// insert conveniences. Groups render as visual dividers in the menu.
export const SLASH_COMMANDS: SlashCommand[] = [
  // Headings
  {
    id: 'h1', label: 'Heading 1', hint: 'Section title',
    group: 'headings', icon: Heading1, keywords: ['heading', 'title', 'h1', 'large'],
    build: () => `<h1>Heading 1</h1>`,
  },
  {
    id: 'h2', label: 'Heading 2', hint: 'Sub-section',
    group: 'headings', icon: Heading2, keywords: ['heading', 'h2', 'medium'],
    build: () => `<h2>Heading 2</h2>`,
  },
  {
    id: 'h3', label: 'Heading 3', hint: 'Small heading',
    group: 'headings', icon: Heading3, keywords: ['heading', 'h3', 'small'],
    build: () => `<h3>Heading 3</h3>`,
  },

  // Lists
  {
    id: 'bullet', label: 'Bullet list', hint: 'Unordered dot list',
    group: 'lists', icon: List, keywords: ['list', 'bullet', 'unordered', 'ul'],
    build: () => `<ul><li>Item</li></ul>`,
  },
  {
    id: 'numbered', label: 'Numbered list', hint: 'Ordered 1, 2, 3',
    group: 'lists', icon: ListOrdered, keywords: ['list', 'number', 'ordered', 'ol'],
    build: () => `<ol><li>Item</li></ol>`,
  },
  {
    id: 'checklist', label: 'Checklist', hint: 'To-do checkboxes',
    group: 'lists', icon: CheckSquare, keywords: ['todo', 'check', 'task', 'checkbox'],
    build: () => `<ul class="checklist"><li>Task</li></ul>`,
  },

  // Callouts (four tones — inserted as coloured blocks)
  {
    id: 'callout-info', label: 'Callout — Info', hint: 'Neutral note',
    group: 'blocks', icon: AlertTriangle, keywords: ['callout', 'info', 'note', 'admonition'],
    build: () =>
      `<div class="dv-callout" data-tone="info"><span class="dv-callout-icon">ℹ️</span><div class="dv-callout-body"><strong>Note:</strong> Type your text here.</div></div><p><br></p>`,
  },
  {
    id: 'callout-warning', label: 'Callout — Warning', hint: 'Heads-up / risk',
    group: 'blocks', icon: AlertTriangle, keywords: ['callout', 'warning', 'warn', 'risk'],
    build: () =>
      `<div class="dv-callout" data-tone="warning"><span class="dv-callout-icon">⚠️</span><div class="dv-callout-body"><strong>Warning:</strong> Type your text here.</div></div><p><br></p>`,
  },
  {
    id: 'callout-success', label: 'Callout — Success', hint: 'Positive / done',
    group: 'blocks', icon: AlertTriangle, keywords: ['callout', 'success', 'ok', 'done'],
    build: () =>
      `<div class="dv-callout" data-tone="success"><span class="dv-callout-icon">✅</span><div class="dv-callout-body"><strong>Success:</strong> Type your text here.</div></div><p><br></p>`,
  },
  {
    id: 'callout-danger', label: 'Callout — Danger', hint: 'Do not do this',
    group: 'blocks', icon: AlertTriangle, keywords: ['callout', 'danger', 'stop'],
    build: () =>
      `<div class="dv-callout" data-tone="danger"><span class="dv-callout-icon">🚫</span><div class="dv-callout-body"><strong>Danger:</strong> Type your text here.</div></div><p><br></p>`,
  },

  // Structural blocks
  {
    id: 'divider', label: 'Divider', hint: 'Horizontal rule',
    group: 'blocks', icon: Minus, keywords: ['divider', 'hr', 'line', 'separator'],
    build: () => `<hr>`,
  },
  {
    id: 'code', label: 'Code block', hint: 'Monospaced code',
    group: 'blocks', icon: Code2, keywords: ['code', 'pre', 'mono', 'snippet'],
    build: () =>
      `<pre style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:10px;font-family:ui-monospace,Consolas,monospace;font-size:12.5px"><code>your code here</code></pre>`,
  },
  {
    id: 'blockquote', label: 'Quote', hint: 'Blockquote',
    group: 'blocks', icon: MessageSquare, keywords: ['quote', 'blockquote', 'cite'],
    build: () =>
      `<blockquote style="border-left:3px solid #cbd5e1;padding-left:12px;color:#475569;margin:8px 0">Quoted text…</blockquote>`,
  },
  {
    id: 'table', label: 'Smart Table', hint: 'Add rows/cols on hover · Tab-navigate',
    group: 'blocks', icon: TableIcon, keywords: ['table', 'grid', 'smart'],
    build: () => {
      // Smart Table markup — must be wrapped in .dv-smart-table-wrap so
      // SmartTableController can pin its + col / + row buttons.
      // Data rows are pre-filled with R1C1..R3C3 placeholders so users
      // see the shape and can type over. Headers auto-labelled Column A/B/C.
      const th = (v: string): string => `<th>${v}</th>`
      const td = (v: string): string => `<td>${v}</td>`
      const headers = `<tr>${th('Column A')}${th('Column B')}${th('Column C')}</tr>`
      const rows = Array.from({ length: 3 }, (_, r) =>
        `<tr>${Array.from({ length: 3 }, (_, c) => td(`R${r + 1} C${c + 1}`)).join('')}</tr>`,
      ).join('')
      return (
        `<div class="dv-smart-table-wrap" contenteditable="false">` +
        `<table class="dv-smart-table" contenteditable="true">` +
        `<thead>${headers}</thead>` +
        `<tbody>${rows}</tbody>` +
        `</table></div><p><br></p>`
      )
    },
  },

  // Workflow blocks (Quarter20 flavor)
  {
    id: 'bom', label: 'BOM table', hint: 'Bill of Materials scaffold',
    group: 'workflow', icon: TableIcon, keywords: ['bom', 'bill', 'materials', 'parts', 'inventory'],
    build: () => `<h3>Bill of Materials</h3><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#f1f5f9"><th style="text-align:left;padding:6px;border:1px solid #cbd5e1">Item</th><th style="text-align:left;padding:6px;border:1px solid #cbd5e1">P/N</th><th style="text-align:left;padding:6px;border:1px solid #cbd5e1">Description</th><th style="text-align:right;padding:6px;border:1px solid #cbd5e1">Qty</th><th style="text-align:left;padding:6px;border:1px solid #cbd5e1">Material</th></tr></thead><tbody><tr><td style="padding:6px;border:1px solid #e2e8f0">1</td><td style="padding:6px;border:1px solid #e2e8f0">&nbsp;</td><td style="padding:6px;border:1px solid #e2e8f0">&nbsp;</td><td style="padding:6px;border:1px solid #e2e8f0;text-align:right">1</td><td style="padding:6px;border:1px solid #e2e8f0">&nbsp;</td></tr></tbody></table><p><br></p>`,
  },
  {
    id: 'signoff', label: 'Sign-off block', hint: 'Approval table',
    group: 'workflow', icon: CheckCircle2, keywords: ['sign', 'off', 'approval', 'signature'],
    build: () => `<h3>Approval &amp; Sign-off</h3><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#f1f5f9"><th style="text-align:left;padding:6px;border:1px solid #cbd5e1">Role</th><th style="text-align:left;padding:6px;border:1px solid #cbd5e1">Name</th><th style="text-align:left;padding:6px;border:1px solid #cbd5e1">Decision</th><th style="text-align:left;padding:6px;border:1px solid #cbd5e1">Date</th></tr></thead><tbody><tr><td style="padding:6px;border:1px solid #e2e8f0">Author</td><td style="padding:6px;border:1px solid #e2e8f0">____________</td><td style="padding:6px;border:1px solid #e2e8f0">☐ Approved &nbsp; ☐ Rework</td><td style="padding:6px;border:1px solid #e2e8f0">____________</td></tr><tr><td style="padding:6px;border:1px solid #e2e8f0">Reviewer</td><td style="padding:6px;border:1px solid #e2e8f0">____________</td><td style="padding:6px;border:1px solid #e2e8f0">☐ Approved &nbsp; ☐ Rework</td><td style="padding:6px;border:1px solid #e2e8f0">____________</td></tr></tbody></table><p><br></p>`,
  },

  // Inserts — these hand off to existing pickers
  {
    id: 'part', label: 'Part number', hint: 'Open the part picker',
    group: 'inserts', icon: Tag, keywords: ['part', 'pn', 'p/n', 'bom', 'component'],
    build: () => '',
    action: 'insertPartPicker',
  },
  {
    id: 'mention', label: 'Mention', hint: '@ teammate',
    group: 'inserts', icon: AtSign, keywords: ['mention', 'at', 'person', 'user'],
    build: () => '@',
    action: 'insertMentionPicker',
  },
  {
    id: 'tag', label: 'Tag', hint: '# category (tool / procedure / …)',
    group: 'inserts', icon: Hash, keywords: ['tag', 'hash', 'label', 'category'],
    build: () => '#',
    action: 'insertTagPicker',
  },
  {
    id: 'image', label: 'Image', hint: 'Insert image',
    group: 'inserts', icon: ImageIcon, keywords: ['image', 'picture', 'photo'],
    build: () => '',
    action: 'insertImage',
  },
  {
    id: 'link', label: 'Link', hint: 'Insert link',
    group: 'inserts', icon: Link2, keywords: ['link', 'url', 'href'],
    build: () => '',
    action: 'insertLink',
  },
  {
    id: 'ai-summarize', label: 'Summarize with Datum', hint: 'AI · one-click doc summary',
    group: 'inserts', icon: Sparkles, keywords: ['ai', 'datum', 'summary', 'summarize'],
    build: () => '',
    action: 'insertLink', // reused; parent should treat this specially. Left non-functional here; parent wires the AI summary button separately.
  },
]

const GROUP_LABELS: Record<SlashCommand['group'], string> = {
  basic: 'Basic',
  headings: 'Headings',
  lists: 'Lists',
  blocks: 'Blocks',
  workflow: 'Workflow',
  inserts: 'Insert…',
}

interface Props {
  query: string
  anchorX: number
  anchorY: number
  onPick: (cmd: SlashCommand) => void
  onClose: () => void
  registerKeydownHandler: (fn: ((e: KeyboardEvent) => boolean) | null) => void
}

export default function SlashCommandMenu({
  query,
  anchorX,
  anchorY,
  onPick,
  onClose,
  registerKeydownHandler,
}: Props): JSX.Element | null {
  const [activeIdx, setActiveIdx] = useState(0)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const matches = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (q === '') return SLASH_COMMANDS
    return SLASH_COMMANDS.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.keywords.some((k) => k.startsWith(q)) ||
        c.hint.toLowerCase().includes(q),
    )
  }, [query])

  useEffect(() => {
    setActiveIdx((i) => (matches.length === 0 ? 0 : Math.min(i, matches.length - 1)))
  }, [matches.length])
  useEffect(() => setActiveIdx(0), [query])

  // Keydown — same contract as MentionsTagsPicker.
  useEffect(() => {
    const handler = (e: KeyboardEvent): boolean => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return true
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => (matches.length === 0 ? 0 : (i + 1) % matches.length))
        return true
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => (matches.length === 0 ? 0 : (i - 1 + matches.length) % matches.length))
        return true
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        if (matches[activeIdx] !== undefined) onPick(matches[activeIdx]!)
        else onClose()
        return true
      }
      return false
    }
    registerKeydownHandler(handler)
    return () => registerKeydownHandler(null)
  }, [activeIdx, matches, onPick, onClose, registerKeydownHandler])

  // Outside-click closes.
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

  if (matches.length === 0) return null

  const POPUP_H_MAX = 360
  const shouldFlipUp =
    typeof window !== 'undefined' && anchorY + POPUP_H_MAX + 40 > window.innerHeight

  // Compute the visible active index → item id for the scroll-into-view
  // and rendering. Also compute where group dividers should be drawn.
  let lastGroup: SlashCommand['group'] | null = null

  return (
    <div
      ref={rootRef}
      role="listbox"
      aria-label="Slash command menu"
      style={{
        position: 'fixed',
        left: `${Math.max(8, anchorX)}px`,
        top: shouldFlipUp
          ? `${Math.max(8, anchorY - POPUP_H_MAX - 24)}px`
          : `${anchorY + 20}px`,
        width: 300,
        maxHeight: POPUP_H_MAX,
        zIndex: 60,
      }}
      className="dv-anim-pop flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
    >
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50/60 px-3 py-1.5">
        <ChevronRight className="h-3 w-3 text-slate-500" />
        <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
          Insert block
        </span>
        <span className="ml-auto text-[10px] text-slate-400">
          {query === '' ? 'type to filter' : `"/${query}"`}
        </span>
      </div>

      <div className="dv-thin-scroll flex-1 overflow-y-auto py-1">
        {matches.map((c, i) => {
          const Icon = c.icon
          const showGroupHeader = c.group !== lastGroup
          lastGroup = c.group
          return (
            <div key={c.id}>
              {showGroupHeader && (
                <p className="px-3 pb-0.5 pt-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  {GROUP_LABELS[c.group]}
                </p>
              )}
              <button
                type="button"
                role="option"
                aria-selected={i === activeIdx}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPick(c)}
                className={[
                  'flex w-full items-start gap-2.5 px-3 py-1.5 text-left text-[12px] transition',
                  i === activeIdx
                    ? 'bg-primary-50 text-primary'
                    : 'text-slate-700 hover:bg-slate-50',
                ].join(' ')}
              >
                <span
                  className={[
                    'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                    i === activeIdx
                      ? 'bg-primary/10 text-primary'
                      : 'bg-slate-100 text-slate-500',
                  ].join(' ')}
                  aria-hidden="true"
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{c.label}</span>
                  <span className="block truncate text-[10px] text-slate-500">
                    {c.hint}
                  </span>
                </span>
              </button>
            </div>
          )
        })}
      </div>

      <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-1 text-[9.5px] text-slate-500">
        <kbd className="rounded border border-slate-300 bg-white px-1 py-0.5 font-mono">↑</kbd>
        <kbd className="ml-1 rounded border border-slate-300 bg-white px-1 py-0.5 font-mono">↓</kbd>
        <span className="ml-1.5">navigate</span>
        <kbd className="ml-3 rounded border border-slate-300 bg-white px-1 py-0.5 font-mono">↵</kbd>
        <span className="ml-1.5">insert</span>
        <kbd className="ml-3 rounded border border-slate-300 bg-white px-1 py-0.5 font-mono">esc</kbd>
        <span className="ml-1.5">close</span>
      </div>
    </div>
  )
}
