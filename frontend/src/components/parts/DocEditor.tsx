'use client'

/**
 * DocEditor — Google-Docs-style rich-text editor scoped to a part.
 *
 * Implementation uses contentEditable + document.execCommand (the lowest-
 * dependency way to ship a real editor without pulling in Tiptap / Lexical /
 * Slate). execCommand is deprecated but works in every current browser and
 * is fine for a mock workspace.
 *
 * Per-part autosave to localStorage under `dataverse.doc.<partId>.<tabId>`.
 *
 * Supports the toolbar slice that matters for engineering design notes:
 *   · Undo / Redo · Print
 *   · Heading style (Normal · Title · Heading 1/2/3)
 *   · Font family · Font size +/-
 *   · Bold · Italic · Underline · Strikethrough
 *   · Text color · Highlight color
 *   · Insert link · Insert image (data-URL via FileReader)
 *   · Align left/center/right/justify
 *   · Bulleted · Numbered · Checklist (uses ul.checklist CSS)
 *   · Decrease/Increase indent
 *   · Clear formatting
 *
 * Left rail carries "Document tabs" (Tab 1, Tab 2) and template chips above
 * the cursor row mirror the Google Docs blank-doc affordance.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlertTriangle,
  Bold,
  CheckCircle2,
  ChevronDown,
  Eraser,
  FileText,
  Highlighter,
  Image as ImageIcon,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Loader2,
  Mail,
  Minus,
  MoreHorizontal,
  Plus,
  Printer,
  Redo2,
  Shapes,
  Sparkles,
  Strikethrough,
  Type,
  Underline,
  Undo2,
  X,
} from 'lucide-react'
import { ApiError, api } from '@/lib/api'
import type { SummarizeDocumentResponse } from '@/types/api'
import ShapesIconsPicker from './ShapesIconsPicker'

interface DocTab {
  id: string
  name: string
}

interface Props {
  partId: string
  partName: string
}

const DEFAULT_TABS: DocTab[] = [
  { id: 'tab1', name: 'Tab 1' },
  { id: 'tab2', name: 'Tab 2' },
]

const FONT_FAMILIES = ['Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Inter']
const TEXT_STYLES: Array<{ id: string; label: string; block: string; sample: string }> = [
  { id: 'normal', label: 'Normal text', block: 'p', sample: 'Aa' },
  { id: 'title', label: 'Title', block: 'h1', sample: 'A' },
  { id: 'subtitle', label: 'Subtitle', block: 'h2', sample: 'A' },
  { id: 'h1', label: 'Heading 1', block: 'h2', sample: 'H1' },
  { id: 'h2', label: 'Heading 2', block: 'h3', sample: 'H2' },
  { id: 'h3', label: 'Heading 3', block: 'h4', sample: 'H3' },
]

const STORAGE_PREFIX = 'dataverse.doc.'

function storageKey(partId: string, tabId: string): string {
  return `${STORAGE_PREFIX}${partId}.${tabId}`
}

function readDoc(partId: string, tabId: string): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem(storageKey(partId, tabId)) ?? ''
  } catch {
    return ''
  }
}

function writeDoc(partId: string, tabId: string, html: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(partId, tabId), html)
  } catch {
    // localStorage may be unavailable — silent fail.
  }
}

export default function DocEditor({ partId, partName }: Props): JSX.Element {
  const fileInputId = useId()
  const editorRef = useRef<HTMLDivElement | null>(null)
  const [tabs, setTabs] = useState<DocTab[]>(DEFAULT_TABS)
  const [activeTabId, setActiveTabId] = useState<string>(DEFAULT_TABS[0]?.id ?? 'tab1')
  const [fontFamily, setFontFamily] = useState('Arial')
  const [fontSizePx, setFontSizePx] = useState(11)
  const [textColor, setTextColor] = useState('#0f172a')
  const [highlightColor, setHighlightColor] = useState('#fde68a')
  const [showStyles, setShowStyles] = useState(false)
  const [showFonts, setShowFonts] = useState(false)
  // Shapes/Arrows/Icons picker — popover anchored next to the toolbar button.
  const [showShapesPicker, setShowShapesPicker] = useState(false)
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle')

  // Datum AI · Hook 6 · Summarize Document
  const [datumOpen, setDatumOpen] = useState(false)
  const [datumLoading, setDatumLoading] = useState(false)
  const [datumError, setDatumError] = useState<string | null>(null)
  const [datumResult, setDatumResult] = useState<SummarizeDocumentResponse | null>(null)

  const handleSummarize = useCallback(async () => {
    const node = editorRef.current
    if (node === null) return
    const bodyText = (node.innerText ?? '').trim()
    setDatumOpen(true)
    setDatumError(null)
    setDatumResult(null)
    setDatumLoading(true)
    try {
      const result = await api.datum.summarizeDocument({
        document_id: `${partId}.${activeTabId}`,
        document_title: `${partName} — design notes`,
        body: bodyText,
        part_name: partName,
      })
      setDatumResult(result)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'timeout') {
        setDatumError('Datum timed out — please try again.')
      } else if (err instanceof ApiError && err.code === 'network_error') {
        setDatumError('Datum is offline — restart the backend on :4000.')
      } else {
        setDatumError(err instanceof Error ? err.message : 'Datum is unavailable')
      }
    } finally {
      setDatumLoading(false)
    }
  }, [partId, activeTabId, partName])

  // Restore content for the active tab.
  useEffect(() => {
    const node = editorRef.current
    if (node === null) return
    node.innerHTML = readDoc(partId, activeTabId)
  }, [partId, activeTabId])

  /**
   * Selection persistence — fixes a contentEditable gotcha. When the user
   * clicks the native color picker, focus moves to the input element and
   * the editor's text selection is lost. By the time onChange fires there's
   * no Range to apply the color to. We capture the Range whenever the
   * editor's selection changes (or just before a focus-stealing toolbar
   * action) and restore it inside exec() before document.execCommand runs.
   */
  const savedRangeRef = useRef<Range | null>(null)

  const saveSelection = useCallback(() => {
    const node = editorRef.current
    if (node === null) return
    const sel = window.getSelection()
    if (sel === null || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    // Only save selections that are INSIDE the editor — otherwise we'd
    // restore a stale selection from somewhere else on the page.
    if (node.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange()
    }
  }, [])

  const restoreSelection = useCallback(() => {
    const node = editorRef.current
    const saved = savedRangeRef.current
    if (node === null || saved === null) return false
    node.focus()
    const sel = window.getSelection()
    if (sel === null) return false
    sel.removeAllRanges()
    sel.addRange(saved)
    return true
  }, [])

  /** Run an execCommand. Re-uses the saved selection (if any) so colour /
   * font / background commands hit the right text even when the picker
   * stole focus before the user confirmed. */
  const exec = useCallback(
    (command: string, value?: string) => {
      const node = editorRef.current
      if (node === null) return
      // If we have a saved range (color/highlight pickers set this on
      // mousedown), restore it before the command. Otherwise just focus.
      const restored = restoreSelection()
      if (!restored) node.focus()
      document.execCommand(command, false, value)
      persist()
    },
    [restoreSelection],
  )

  /** Debounced-ish autosave — write current HTML to localStorage. */
  const persist = useCallback(() => {
    const node = editorRef.current
    if (node === null) return
    setSaving('saving')
    writeDoc(partId, activeTabId, node.innerHTML)
    // Tiny delay so the user sees "Saving…" briefly even though writes are sync.
    window.setTimeout(() => setSaving('saved'), 220)
  }, [partId, activeTabId])

  /** Insert image as data URL — no upload, no backend, just file → base64. */
  const handleImageInsert = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (file === undefined) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      if (typeof dataUrl === 'string') exec('insertImage', dataUrl)
    }
    reader.readAsDataURL(file)
    // Reset so the same file can be picked twice in a row.
    e.target.value = ''
  }

  const handleLinkInsert = (): void => {
    const url = window.prompt('Link URL')
    if (url === null || url.trim() === '') return
    exec('createLink', url.trim())
  }

  /** Insert a shape/arrow/icon SVG at the cursor.
   *
   * Wraps the raw SVG string in a non-breaking space pair so the user's
   * caret lands AFTER the inserted figure (browsers otherwise leave the
   * caret stuck inside the SVG, which feels like the editor froze). */
  const handleShapeInsert = (svg: string): void => {
    setShowShapesPicker(false)
    // The leading zero-width space gives the cursor a place to live just
    // before the SVG (so the caret position is sensible after insert) and
    // the trailing &nbsp; gives it a printable place to land after.
    exec('insertHTML', `${svg}&nbsp;`)
  }

  const handleFontSize = (delta: number): void => {
    const next = Math.max(8, Math.min(72, fontSizePx + delta))
    setFontSizePx(next)
    // execCommand fontSize takes 1-7 — translate px to bucket. Crude but matches
    // GDocs behaviour where the +/- buttons feel like steps.
    const bucket = Math.max(1, Math.min(7, Math.round(((next - 8) / 64) * 6) + 1))
    exec('fontSize', String(bucket))
  }

  const handleFontFamily = (family: string): void => {
    setFontFamily(family)
    setShowFonts(false)
    exec('fontName', family)
  }

  const handleStyle = (block: string): void => {
    setShowStyles(false)
    exec('formatBlock', block)
  }

  const handlePrint = (): void => {
    window.print()
  }

  const handleAddTab = (): void => {
    const nextId = `tab${tabs.length + 1}`
    setTabs((t) => [...t, { id: nextId, name: `Tab ${t.length + 1}` }])
    setActiveTabId(nextId)
  }

  const memberSaving = useMemo(() => {
    if (saving === 'saving') return 'Saving…'
    if (saving === 'saved') return 'All changes saved'
    return ' '
  }, [saving])

  return (
    <div className="flex h-full flex-col bg-white">
      {/* ── Menu bar (visual only — GDocs-style: File · Edit · …) ─────────── */}
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-3 py-1.5 text-[11px] text-slate-600">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-primary text-white">
          <FileText className="h-3 w-3" />
        </span>
        <span className="truncate font-semibold text-slate-900">
          {partName} — design notes
        </span>
        <span className="text-slate-300">·</span>
        <span className="text-slate-500" aria-live="polite">
          {memberSaving}
        </span>
        <nav className="ml-auto flex items-center gap-3 text-slate-600" aria-label="Menu">
          {['File', 'Edit', 'View', 'Insert', 'Format', 'Tools', 'Extensions', 'Help'].map((m) => (
            <button key={m} type="button" className="hover:text-slate-900">
              {m}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white px-3 py-1.5">
        <ToolGroup>
          <ToolBtn onClick={() => exec('undo')} label="Undo" icon={Undo2} />
          <ToolBtn onClick={() => exec('redo')} label="Redo" icon={Redo2} />
          <ToolBtn onClick={handlePrint} label="Print" icon={Printer} />
        </ToolGroup>

        <Separator />

        {/* Text-style dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowStyles((o) => !o)}
            className="inline-flex h-7 items-center gap-1 rounded px-2 text-[12px] font-medium text-slate-700 hover:bg-slate-100"
          >
            Normal text
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </button>
          {showStyles && (
            <div
              role="menu"
              className="dv-anim-pop absolute left-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
            >
              {TEXT_STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleStyle(s.block)}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] text-slate-700 transition hover:bg-slate-50"
                >
                  <span>{s.label}</span>
                  <span className="font-mono text-[10px] text-slate-400">{s.sample}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Font family dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowFonts((o) => !o)}
            className="inline-flex h-7 items-center gap-1 rounded px-2 text-[12px] text-slate-700 hover:bg-slate-100"
          >
            {fontFamily}
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </button>
          {showFonts && (
            <div
              role="menu"
              className="dv-anim-pop absolute left-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
            >
              {FONT_FAMILIES.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => handleFontFamily(f)}
                  className="block w-full px-3 py-1.5 text-left text-[12px] text-slate-700 transition hover:bg-slate-50"
                  style={{ fontFamily: f }}
                >
                  {f}
                </button>
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Font size +/- */}
        <div className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleFontSize(-1)}
            aria-label="Decrease font size"
            className="flex h-6 w-6 items-center justify-center text-slate-600 hover:bg-slate-100"
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="inline-flex h-6 min-w-[28px] items-center justify-center text-[11px] font-semibold text-slate-700">
            {fontSizePx}
          </span>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleFontSize(1)}
            aria-label="Increase font size"
            className="flex h-6 w-6 items-center justify-center text-slate-600 hover:bg-slate-100"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>

        <Separator />

        <ToolGroup>
          <ToolBtn onClick={() => exec('bold')} label="Bold" icon={Bold} />
          <ToolBtn onClick={() => exec('italic')} label="Italic" icon={Italic} />
          <ToolBtn onClick={() => exec('underline')} label="Underline" icon={Underline} />
          <ToolBtn onClick={() => exec('strikeThrough')} label="Strikethrough" icon={Strikethrough} />
        </ToolGroup>

        <Separator />

        {/* Text color — snapshot selection on mousedown BEFORE the native
            picker steals focus from the contentEditable. exec() restores it. */}
        <label
          className="relative inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded hover:bg-slate-100"
          title="Text color"
          onMouseDown={saveSelection}
        >
          <Type className="h-4 w-4" style={{ color: textColor }} />
          <input
            type="color"
            value={textColor}
            onChange={(e) => {
              setTextColor(e.target.value)
              exec('foreColor', e.target.value)
            }}
            className="absolute inset-0 opacity-0"
          />
        </label>

        {/* Highlight color — same trick. */}
        <label
          className="relative inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded hover:bg-slate-100"
          title="Highlight color"
          onMouseDown={saveSelection}
        >
          <Highlighter className="h-4 w-4 text-slate-700" />
          <span
            className="pointer-events-none absolute bottom-1 left-1 right-1 h-1 rounded-sm"
            style={{ background: highlightColor }}
          />
          <input
            type="color"
            value={highlightColor}
            onChange={(e) => {
              setHighlightColor(e.target.value)
              exec('hiliteColor', e.target.value)
            }}
            className="absolute inset-0 opacity-0"
          />
        </label>

        <Separator />

        <ToolGroup>
          <ToolBtn onClick={handleLinkInsert} label="Insert link" icon={Link2} />
          <label
            htmlFor={fileInputId}
            className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded text-slate-600 hover:bg-slate-100"
            title="Insert image"
          >
            <ImageIcon className="h-4 w-4" />
          </label>
          <input
            id={fileInputId}
            type="file"
            accept="image/*"
            onChange={handleImageInsert}
            className="sr-only"
          />

          {/* Insert shape / arrow / icon — opens a popover with three tabs.
              We snapshot the selection on mousedown so opening the picker
              doesn't lose the user's cursor position. */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => {
                // Save selection BEFORE the toolbar takes focus, otherwise
                // execCommand on insert lands at the wrong spot.
                saveSelection()
                // Don't let the click steal focus from the contentEditable.
                e.preventDefault()
              }}
              onClick={() => {
                // Open-only. Closing is handled by outside-click / Esc /
                // footer Close inside the picker. (A toggle here would race
                // the picker's capture-phase outside-click handler and
                // immediately re-open the popover.)
                if (!showShapesPicker) setShowShapesPicker(true)
              }}
              aria-label="Insert shape, arrow, or icon"
              aria-expanded={showShapesPicker}
              title="Insert shape, arrow, or icon"
              className={[
                'inline-flex h-7 w-7 items-center justify-center rounded transition',
                showShapesPicker
                  ? 'bg-primary-50 text-primary'
                  : 'text-slate-600 hover:bg-slate-100',
              ].join(' ')}
            >
              <Shapes className="h-4 w-4" />
            </button>
            {showShapesPicker && (
              <ShapesIconsPicker
                onInsert={handleShapeInsert}
                onClose={() => setShowShapesPicker(false)}
              />
            )}
          </div>
        </ToolGroup>

        <Separator />

        <ToolGroup>
          <ToolBtn onClick={() => exec('justifyLeft')} label="Align left" icon={AlignLeft} />
          <ToolBtn onClick={() => exec('justifyCenter')} label="Align center" icon={AlignCenter} />
          <ToolBtn onClick={() => exec('justifyRight')} label="Align right" icon={AlignRight} />
          <ToolBtn onClick={() => exec('justifyFull')} label="Justify" icon={AlignJustify} />
        </ToolGroup>

        <Separator />

        <ToolGroup>
          <ToolBtn
            onClick={() => {
              const sel = window.getSelection()?.toString() ?? ''
              exec('insertHTML', `<ul class="dv-doc-checklist"><li>${sel || 'Checklist item'}</li></ul>`)
            }}
            label="Checklist"
            icon={ListChecks}
          />
          <ToolBtn onClick={() => exec('insertUnorderedList')} label="Bulleted list" icon={List} />
          <ToolBtn onClick={() => exec('insertOrderedList')} label="Numbered list" icon={ListOrdered} />
        </ToolGroup>

        <Separator />

        <ToolGroup>
          <ToolBtn onClick={() => exec('outdent')} label="Decrease indent" icon={IndentDecrease} />
          <ToolBtn onClick={() => exec('indent')} label="Increase indent" icon={IndentIncrease} />
          <ToolBtn onClick={() => exec('removeFormat')} label="Clear formatting" icon={Eraser} />
        </ToolGroup>

        {/* Datum AI · Hook 6 — pushed to the far right so it's discoverable
            without being mashed in with the formatting tools. */}
        <button
          type="button"
          onClick={handleSummarize}
          disabled={datumLoading}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-violet-600 to-violet-700 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm transition hover:from-violet-700 hover:to-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
          title="Summarise this document with Datum"
        >
          {datumLoading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Reading…
            </>
          ) : (
            <>
              <Sparkles className="h-3 w-3" />
              Summarise with Datum
            </>
          )}
        </button>
      </div>

      {/* ── Body: left tab rail + editor canvas ───────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Document tabs rail */}
        <aside className="w-[200px] shrink-0 border-r border-slate-100 bg-slate-50/40 px-3 py-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Back"
              className="flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
            >
              <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
            </button>
            <button
              type="button"
              onClick={handleAddTab}
              aria-label="Add tab"
              className="flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Document tabs
          </p>
          <ul className="mt-2 space-y-0.5">
            {tabs.map((t) => {
              const active = t.id === activeTabId
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setActiveTabId(t.id)}
                    className={[
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] transition',
                      active
                        ? 'bg-primary-50 font-semibold text-primary'
                        : 'text-slate-700 hover:bg-slate-100/70',
                    ].join(' ')}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span className="flex-1 truncate text-left">{t.name}</span>
                    {active && <MoreHorizontal className="h-3 w-3 text-slate-400" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        {/* Editor canvas */}
        <div className="dv-thin-scroll flex-1 overflow-y-auto bg-slate-100 px-6 py-6">
          {/* Template chips above the cursor — visual nudges */}
          <div className="mx-auto mb-3 flex max-w-[850px] flex-wrap items-center gap-2">
            <Chip icon={Sparkles}>Templates</Chip>
            <Chip icon={FileText}>Meeting notes</Chip>
            <Chip icon={Mail}>Email draft</Chip>
            <Chip icon={MoreHorizontal}>More</Chip>
          </div>

          {/* The page itself */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={() => {
              // Typing invalidates any saved range (the user moved on).
              savedRangeRef.current = null
              persist()
            }}
            onMouseUp={saveSelection}
            onKeyUp={saveSelection}
            onMouseDown={(e) => {
              // Stop the editor from losing focus on toolbar click sequences.
              if ((e.target as HTMLElement).closest?.('[data-toolbar]') !== null) e.preventDefault()
            }}
            spellCheck
            role="textbox"
            aria-label="Document body"
            className="dv-doc-canvas mx-auto min-h-[1100px] max-w-[850px] rounded-sm bg-white px-[96px] py-[96px] text-[13px] leading-7 text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.06)] outline-none focus:shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
            style={{ fontFamily }}
          />
        </div>

        {/* Datum AI panel — slides in from the right when the user asks
            for a summary. Pinned to the editor area so it doesn't intrude
            on the rest of the page. */}
        {datumOpen && (
          <DatumDocPanel
            loading={datumLoading}
            error={datumError}
            result={datumResult}
            onClose={() => setDatumOpen(false)}
            onRetry={handleSummarize}
          />
        )}
      </div>
    </div>
  )
}

// ── Datum AI · Document summary side panel ─────────────────────────────

function DatumDocPanel({
  loading,
  error,
  result,
  onClose,
  onRetry,
}: {
  loading: boolean
  error: string | null
  result: SummarizeDocumentResponse | null
  onClose: () => void
  onRetry: () => void
}): JSX.Element {
  const confidencePct =
    result === null ? null : Math.round(result.confidence * 100)
  const confidenceTone =
    result === null
      ? ''
      : result.confidence >= 0.8
        ? 'bg-emerald-100 text-emerald-700 ring-emerald-200'
        : result.confidence >= 0.6
          ? 'bg-amber-100 text-amber-700 ring-amber-200'
          : 'bg-rose-100 text-rose-700 ring-rose-200'

  return (
    <aside
      className="dv-anim-fade-up dv-thin-scroll flex w-[360px] shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-gradient-to-br from-violet-50/60 via-white to-violet-50/30"
      aria-label="Datum AI · document summary"
    >
      <header className="flex items-center gap-2 border-b border-violet-100 px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-sm">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-bold text-violet-900">Datum</p>
          <p className="text-[10px] uppercase tracking-wider text-violet-500">
            Document summary
          </p>
        </div>
        {result !== null && !result.declined && confidencePct !== null && (
          <span
            title={`Confidence: ${result.source}`}
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ring-1 ${confidenceTone}`}
          >
            {confidencePct}%
          </span>
        )}
        <button
          type="button"
          aria-label="Close summary"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="flex-1 px-4 py-3">
        {loading && (
          <div className="flex items-center gap-2 text-[12px] text-violet-700">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Datum is reading the document…
          </div>
        )}

        {error !== null && !loading && (
          <div
            role="alert"
            className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700"
          >
            <p className="font-semibold">Datum couldn&apos;t summarise.</p>
            <p className="mt-0.5">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-1.5 rounded border border-rose-300 bg-white px-2 py-0.5 text-[10.5px] font-semibold text-rose-700 transition hover:border-rose-400"
            >
              Retry
            </button>
          </div>
        )}

        {result !== null && result.declined && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">
            <p className="font-semibold">Datum declined to summarise.</p>
            <p className="mt-0.5 text-[11px]">
              {result.declined_reason ??
                'Document body is too short to draft a confident summary.'}
            </p>
          </div>
        )}

        {result !== null && !result.declined && (
          <div className="space-y-3 text-[12px]">
            <p className="leading-relaxed text-slate-800">{result.summary}</p>

            {result.key_points.length > 0 && (
              <div>
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500">
                  Key points
                </p>
                <ul className="mt-1 space-y-1">
                  {result.key_points.map((p) => (
                    <li
                      key={p}
                      className="flex items-start gap-1.5 leading-snug text-slate-700"
                    >
                      <AlertTriangle className="mt-0.5 h-2.5 w-2.5 shrink-0 text-amber-500" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.action_items.length > 0 && (
              <div className="rounded-md border border-emerald-100 bg-emerald-50/70 px-3 py-2">
                <p className="flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider text-emerald-700">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  Action items
                </p>
                <ul className="mt-1 space-y-0.5">
                  {result.action_items.map((a) => (
                    <li
                      key={a}
                      className="flex items-start gap-1.5 leading-snug text-emerald-900"
                    >
                      <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-3 border-t border-slate-100 pt-2 text-[9.5px] text-slate-500">
              <span>
                <span className="font-bold tabular-nums text-slate-700">
                  {result.word_count_in}
                </span>{' '}
                words in
              </span>
              <span className="text-slate-300">→</span>
              <span>
                <span className="font-bold tabular-nums text-slate-700">
                  {result.word_count_out}
                </span>{' '}
                words out
              </span>
              <span className="ml-auto font-mono">{result.source}</span>
            </div>

            <p className="border-t border-slate-100 pt-2 text-[9.5px] text-slate-400">
              Datum drafted this —{' '}
              <span className="font-semibold text-slate-500">
                human always has the final word
              </span>
              .
            </p>

            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-white px-2.5 py-1 text-[10.5px] font-semibold text-violet-700 transition hover:border-violet-400"
            >
              <Sparkles className="h-2.5 w-2.5" />
              Re-summarise
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}

// ── Small helpers ────────────────────────────────────────────────────────

function ToolGroup({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div data-toolbar className="inline-flex items-center gap-0.5">
      {children}
    </div>
  )
}

function ToolBtn({
  onClick,
  label,
  icon: Icon,
}: {
  onClick: () => void
  label: string
  icon: typeof Bold
}): JSX.Element {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-700 transition hover:bg-slate-100"
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}

function Separator(): JSX.Element {
  return <span className="mx-1 inline-block h-5 w-px bg-slate-200" aria-hidden="true" />
}

function Chip({ icon: Icon, children }: { icon: typeof Sparkles; children: React.ReactNode }): JSX.Element {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
    >
      <Icon className="h-3 w-3 text-slate-500" />
      {children}
    </button>
  )
}
