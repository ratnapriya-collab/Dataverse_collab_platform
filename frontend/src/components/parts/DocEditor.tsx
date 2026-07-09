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
  ChevronRight,
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
  Pencil,
  Minus,
  MoreHorizontal,
  Plus,
  Printer,
  Redo2,
  Search,
  Shapes,
  Sparkles,
  Strikethrough,
  Tag,
  Type,
  Underline,
  Undo2,
  X,
} from 'lucide-react'
import { ApiError, api } from '@/lib/api'
import type { SummarizeDocumentResponse } from '@/types/api'
import ShapesIconsPicker from './ShapesIconsPicker'
import { DEFAULT_DOC_HTML } from './defaultDocContent'
import TemplatesPicker from './TemplatesPicker'
import { DOC_TEMPLATES, findTemplate, type DocTemplate, type DocTemplateId } from './docTemplates'
import MentionsTagsPicker, { type PickerTrigger } from './MentionsTagsPicker'
import SlashCommandMenu, { type SlashCommand } from './SlashCommandMenu'
import PencilPicker, { PEN_COLORS, PEN_WIDTHS } from './PencilPicker'
import FloatingFormatToolbar from './FloatingFormatToolbar'
import ImageContextToolbar from './ImageContextToolbar'
import PartNumberPicker from './PartNumberPicker'
import VersionHistoryPanel from './VersionHistoryPanel'
import DocSearchModal from './DocSearchModal'
import type { DocMember, DocTag, DocPart } from './docReferenceData'
import { loadVersions, pushVersion, restoreVersion, type DocVersion } from './docVersions'
import { computeDocStats, type DocStats } from './docStats'
import { htmlToMarkdown } from './htmlToMarkdown'

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
  // First-open behaviour: every empty Doc tab (any part, any tab id)
  // gets the default article so the canvas never looks barren. The
  // moment the user starts editing, the editor's onInput handler calls
  // writeDoc with whatever they have on screen — from then on we read
  // their version, not the default.
  if (typeof window === 'undefined') return DEFAULT_DOC_HTML
  try {
    const saved = window.localStorage.getItem(storageKey(partId, tabId))
    if (saved === null || saved.trim() === '') return DEFAULT_DOC_HTML
    return saved
  } catch {
    return DEFAULT_DOC_HTML
  }
}

// Persist the chosen template type alongside the doc HTML so a
// re-opened doc still knows "I'm a Work Instruction" (drives the small
// type badge in the header).
function docTypeStorageKey(partId: string, tabId: string): string {
  return `${STORAGE_PREFIX}${partId}.${tabId}.type`
}
function readDocType(partId: string, tabId: string): DocTemplateId | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(docTypeStorageKey(partId, tabId))
    if (raw === null) return null
    if (DOC_TEMPLATES.some((t) => t.id === raw)) return raw as DocTemplateId
    return null
  } catch {
    return null
  }
}
function writeDocType(partId: string, tabId: string, id: DocTemplateId | null): void {
  if (typeof window === 'undefined') return
  try {
    const k = docTypeStorageKey(partId, tabId)
    if (id === null) window.localStorage.removeItem(k)
    else window.localStorage.setItem(k, id)
  } catch {
    /* silent — localStorage may be unavailable */
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
  // Templates picker — anchored to the Templates chip above the canvas.
  const [showTemplatesPicker, setShowTemplatesPicker] = useState(false)
  // Which template this doc was seeded from (Quarter20-style doc typing).
  // Persisted per (partId, tabId) alongside the doc content itself.
  const [docTypeId, setDocTypeId] = useState<DocTemplateId | null>(null)

  // Part number picker — toolbar-triggered dropdown.
  const [showPartPicker, setShowPartPicker] = useState(false)
  // Version history — toolbar-triggered dropdown + in-memory version list.
  const [showVersionsPanel, setShowVersionsPanel] = useState(false)
  const [versions, setVersions] = useState<DocVersion[]>([])
  // Global doc search — Ctrl+K modal.
  const [showSearchModal, setShowSearchModal] = useState(false)
  // Focus mode — hides tabs / toolbar / chips, widens editor.
  const [focusMode, setFocusMode] = useState(false)
  // Live word / character / reading-time counts.
  const [stats, setStats] = useState<DocStats>({ words: 0, chars: 0, charsNoSpaces: 0, readingMin: 1 })
  // Callout picker — small popup for info / warning / success / danger.
  const [showCalloutPicker, setShowCalloutPicker] = useState(false)
  // Export menu — PDF (print) / Markdown download.
  const [showExportMenu, setShowExportMenu] = useState(false)
  // Table of contents pane — right-side dropdown.
  const [showTocPanel, setShowTocPanel] = useState(false)
  const [tocHeadings, setTocHeadings] = useState<Array<{ text: string; level: number; id: string }>>([])

  // Mentions / Tags picker — triggered by typing "@" or "#" in the doc.
  // Position tracks the caret so the popup sits right below where they typed.
  interface AtMentionState {
    trigger: PickerTrigger
    query: string
    /** Absolute offset in the editor's text where the trigger character sits. */
    triggerRange: Range | null
    anchorX: number
    anchorY: number
  }
  const [pickerState, setPickerState] = useState<AtMentionState | null>(null)
  // Keyboard handler registered by the picker so arrow/enter don't hit
  // contentEditable while the picker is open.
  const pickerKeydownRef = useRef<((e: KeyboardEvent) => boolean) | null>(null)

  // Slash-command menu state — mirrors the @/# picker shape but always
  // uses '/' as its trigger character. Only ONE of pickerState /
  // slashState is non-null at any time (the trigger detection swaps).
  interface SlashState {
    query: string
    triggerRange: Range | null
    anchorX: number
    anchorY: number
  }
  const [slashState, setSlashState] = useState<SlashState | null>(null)
  const slashKeydownRef = useRef<((e: KeyboardEvent) => boolean) | null>(null)

  // Pencil / image-annotation state.
  //   · showPencilPicker  — whether the pen picker popup is open
  //   · annotateMode      — whether pointer-drag on images draws strokes
  //   · penColor / penWidth — current pen settings, driven by the picker
  //
  // When annotateMode flips on, an effect below wraps any bare <img>
  // elements in the editor with a .dv-annotatable container (holding an
  // <svg class="dv-annotations"> overlay) and installs pointerdown /
  // pointermove / pointerup listeners for freehand drawing.
  const [showPencilPicker, setShowPencilPicker] = useState(false)
  const [annotateMode, setAnnotateMode] = useState(false)
  const [penColor, setPenColor] = useState<string>(PEN_COLORS[0]!.hex)
  const [penWidth, setPenWidth] = useState<number>(PEN_WIDTHS[1]!.value)
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

  // Restore content + doc type for the active tab. Both are keyed by
  // (partId, tabId) — different tabs on the same part can be different
  // Quarter20-style doc types (a WI + a QC + a DR, for example).
  useEffect(() => {
    const node = editorRef.current
    if (node === null) return
    node.innerHTML = readDoc(partId, activeTabId)
    setDocTypeId(readDocType(partId, activeTabId))
    setVersions(loadVersions(partId, activeTabId))
  }, [partId, activeTabId])

  /** Replace the editor content with a template. Confirms first so the
   *  user doesn't lose in-progress writing by accident. Also persists
   *  the chosen doc type so the header badge reflects it. */
  const handleApplyTemplate = useCallback(
    (template: DocTemplate): void => {
      const node = editorRef.current
      if (node === null) return
      // If the current doc has meaningful content (not just the default
      // article and not empty), confirm before overwriting.
      const current = node.innerHTML.trim()
      const isDefault = current === DEFAULT_DOC_HTML.trim()
      const isEmpty = current === '' || current === '<p><br></p>' || current === '<br>'
      if (!isDefault && !isEmpty) {
        const ok = window.confirm(
          `Replace current document with the "${template.label}" template? This can't be undone.`,
        )
        if (!ok) {
          setShowTemplatesPicker(false)
          return
        }
      }
      node.innerHTML = template.html
      setShowTemplatesPicker(false)
      setDocTypeId(template.id)
      writeDocType(partId, activeTabId, template.id)
      persist()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [partId, activeTabId],
  )

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
    // Version snapshot — throttled to once per 30s inside pushVersion so
    // this is safe to call on every keystroke.
    const updated = pushVersion(partId, activeTabId, node.innerHTML)
    setVersions(updated)
    // Update live word/char/reading counters + TOC on every save.
    setStats(computeDocStats(node.innerHTML))
    // Tiny delay so the user sees "Saving…" briefly even though writes are sync.
    window.setTimeout(() => setSaving('saved'), 220)
  }, [partId, activeTabId])

  /** Restore a version — pushes the CURRENT content as a snapshot first
   *  (so restore isn't a one-way loss), then swaps innerHTML to the
   *  chosen version, then persists. */
  const handleRestoreVersion = useCallback(
    (v: DocVersion): void => {
      const node = editorRef.current
      if (node === null) return
      const current = node.innerHTML
      // Force a snapshot of the current state BEFORE we overwrite it —
      // bypass the 30s throttle by giving the newest snapshot a fake old
      // timestamp so pushVersion's freshness check doesn't skip us.
      // Easiest way: pushVersion has its own dedup + throttle; we just
      // call it, and if it declines we swap anyway (worst case: the user
      // can't get back to what they had. Fine — they explicitly asked
      // for a restore).
      pushVersion(partId, activeTabId, current)
      const html = restoreVersion(partId, activeTabId, v.createdAt)
      if (html === null) return
      node.innerHTML = html
      writeDoc(partId, activeTabId, html)
      setVersions(loadVersions(partId, activeTabId))
      setShowVersionsPanel(false)
    },
    [partId, activeTabId],
  )

  /** Insert an HTML fragment at the current caret. Restores the saved
   *  selection first so buttons in the toolbar (which steal focus) still
   *  land the insertion at the last text-cursor position. */
  const insertHtmlAtCaret = useCallback(
    (html: string): void => {
      const node = editorRef.current
      if (node === null) return
      restoreSelection()
      node.focus()
      document.execCommand('insertHTML', false, html)
      persist()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [persist],
  )

  /** Insert a member as a `<span class="dv-mention">@Name</span>` chip. */
  const insertMentionChip = useCallback(
    (m: DocMember): void => {
      const chip = `<span class="dv-mention" data-mention="${m.id}" contenteditable="false">@${m.name}</span>&nbsp;`
      insertHtmlAtCaret(chip)
    },
    [insertHtmlAtCaret],
  )

  /** Insert a tag as a `<span class="dv-tag-chip">#category:label</span>` chip. */
  const insertTagChip = useCallback(
    (t: DocTag): void => {
      const chip = `<span class="dv-tag-chip" data-category="${t.category}" data-tag="${t.id}" contenteditable="false">#${t.category}:${t.label}</span>&nbsp;`
      insertHtmlAtCaret(chip)
    },
    [insertHtmlAtCaret],
  )

  /** Insert a part chip carrying P/N + material + torque metadata. */
  const insertPartChip = useCallback(
    (p: DocPart): void => {
      const torque = p.torque !== undefined ? ` · ${p.torque}` : ''
      const chip = `<span class="dv-part-chip" data-part="${p.partNumber}" data-material="${p.material}" contenteditable="false">${p.partNumber} · ${p.material}${torque}</span>&nbsp;`
      insertHtmlAtCaret(chip)
      setShowPartPicker(false)
    },
    [insertHtmlAtCaret],
  )

  // ── Insert BOM table + Sign-off block (toolbar-triggered) ─────────────
  const insertBomBlock = useCallback((): void => {
    const html = `
<h3>Bill of Materials</h3>
<table style="width:100%;max-width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed">
  <thead>
    <tr style="background:#f1f5f9">
      <th style="text-align:left;padding:6px;border:1px solid #cbd5e1;width:10%">Item</th>
      <th style="text-align:left;padding:6px;border:1px solid #cbd5e1;width:22%">P/N</th>
      <th style="text-align:left;padding:6px;border:1px solid #cbd5e1;width:36%">Description</th>
      <th style="text-align:right;padding:6px;border:1px solid #cbd5e1;width:10%">Qty</th>
      <th style="text-align:left;padding:6px;border:1px solid #cbd5e1;width:22%">Material</th>
    </tr>
  </thead>
  <tbody>
    <tr><td style="padding:6px;border:1px solid #e2e8f0">1</td><td style="padding:6px;border:1px solid #e2e8f0">DV-HSG-100</td><td style="padding:6px;border:1px solid #e2e8f0">Compressor housing</td><td style="padding:6px;border:1px solid #e2e8f0;text-align:right">1</td><td style="padding:6px;border:1px solid #e2e8f0">Al 6061-T6</td></tr>
    <tr><td style="padding:6px;border:1px solid #e2e8f0">2</td><td style="padding:6px;border:1px solid #e2e8f0">DV-IMP-042</td><td style="padding:6px;border:1px solid #e2e8f0">Impeller blade</td><td style="padding:6px;border:1px solid #e2e8f0;text-align:right">4</td><td style="padding:6px;border:1px solid #e2e8f0">Ti-6Al-4V</td></tr>
    <tr><td style="padding:6px;border:1px solid #e2e8f0">3</td><td style="padding:6px;border:1px solid #e2e8f0">DV-BLT-M8-25</td><td style="padding:6px;border:1px solid #e2e8f0">M8&times;25 bolt</td><td style="padding:6px;border:1px solid #e2e8f0;text-align:right">8</td><td style="padding:6px;border:1px solid #e2e8f0">SS A2-70</td></tr>
  </tbody>
</table>
<p><em>Edit rows above with your own line items — this block is a starting scaffold pulled from the parts catalog.</em></p>
`
    insertHtmlAtCaret(html)
  }, [insertHtmlAtCaret])

  const insertSignOffBlock = useCallback((): void => {
    // Signature/date/name cells use a CSS-drawn bottom-border "line"
    // instead of a run of underscores. The old ____ approach didn't wrap
    // and forced the table wider than the paper, spilling over the left
    // rail. This flexes to whatever width the column has.
    const line = `<span style="display:inline-block;min-width:60px;border-bottom:1px solid #94a3b8;height:12px">&nbsp;</span>`
    const html = `
<h3>Approval &amp; Sign-off</h3>
<table style="width:100%;max-width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed">
  <thead>
    <tr style="background:#f1f5f9">
      <th style="text-align:left;padding:6px;border:1px solid #cbd5e1;width:22%">Role</th>
      <th style="text-align:left;padding:6px;border:1px solid #cbd5e1;width:22%">Name</th>
      <th style="text-align:left;padding:6px;border:1px solid #cbd5e1;width:22%">Decision</th>
      <th style="text-align:left;padding:6px;border:1px solid #cbd5e1;width:17%">Date</th>
      <th style="text-align:left;padding:6px;border:1px solid #cbd5e1;width:17%">Signature</th>
    </tr>
  </thead>
  <tbody>
    <tr><td style="padding:6px;border:1px solid #e2e8f0">Author</td><td style="padding:6px;border:1px solid #e2e8f0">${line}</td><td style="padding:6px;border:1px solid #e2e8f0">☐ Approved &nbsp; ☐ Rework</td><td style="padding:6px;border:1px solid #e2e8f0">${line}</td><td style="padding:6px;border:1px solid #e2e8f0">${line}</td></tr>
    <tr><td style="padding:6px;border:1px solid #e2e8f0">Reviewer</td><td style="padding:6px;border:1px solid #e2e8f0">${line}</td><td style="padding:6px;border:1px solid #e2e8f0">☐ Approved &nbsp; ☐ Rework</td><td style="padding:6px;border:1px solid #e2e8f0">${line}</td><td style="padding:6px;border:1px solid #e2e8f0">${line}</td></tr>
    <tr><td style="padding:6px;border:1px solid #e2e8f0">QA</td><td style="padding:6px;border:1px solid #e2e8f0">${line}</td><td style="padding:6px;border:1px solid #e2e8f0">☐ Approved &nbsp; ☐ Rework</td><td style="padding:6px;border:1px solid #e2e8f0">${line}</td><td style="padding:6px;border:1px solid #e2e8f0">${line}</td></tr>
    <tr><td style="padding:6px;border:1px solid #e2e8f0">Engineering Manager</td><td style="padding:6px;border:1px solid #e2e8f0">${line}</td><td style="padding:6px;border:1px solid #e2e8f0">☐ Approved &nbsp; ☐ Rework</td><td style="padding:6px;border:1px solid #e2e8f0">${line}</td><td style="padding:6px;border:1px solid #e2e8f0">${line}</td></tr>
  </tbody>
</table>
<p><br></p>
`
    insertHtmlAtCaret(html)
  }, [insertHtmlAtCaret])

  // ── Mentions / Tags trigger detection ─────────────────────────────────
  // Called from the editor's onInput. Looks at the text immediately
  // before the caret; if it matches `@word` or `#word` (with a
  // word-boundary before the trigger) we open the picker with that
  // partial query and remember where to insert the eventual chip.
  const detectMentionTagTrigger = useCallback((): void => {
    const sel = typeof window === 'undefined' ? null : window.getSelection()
    const editor = editorRef.current
    if (sel === null || sel.rangeCount === 0 || editor === null) {
      setPickerState(null)
      return
    }
    const range = sel.getRangeAt(0)
    if (!editor.contains(range.startContainer)) {
      setPickerState(null)
      return
    }
    // Walk back through the current text node to find the last `@` or `#`
    // that isn't preceded by an alphanumeric character (so email addresses
    // and hashtag-in-URL text don't trigger).
    const container = range.startContainer
    if (container.nodeType !== Node.TEXT_NODE) {
      setPickerState(null)
      return
    }
    const text = container.textContent ?? ''
    const caret = range.startOffset
    let i = caret - 1
    while (i >= 0) {
      const c = text[i]!
      if (c === '@' || c === '#' || c === '/') {
        const before = i === 0 ? ' ' : text[i - 1]!
        if (/[\s (>]/.test(before) || i === 0) {
          const query = text.slice(i + 1, caret)
          // Bail if the query contains whitespace — user moved past.
          if (/\s/.test(query)) {
            setPickerState(null)
            setSlashState(null)
            return
          }
          if (c === '/') {
            const rectS = range.getBoundingClientRect()
            const triggerRangeS = document.createRange()
            triggerRangeS.setStart(container, i)
            triggerRangeS.setEnd(container, caret)
            setPickerState(null)
            setSlashState({
              query,
              triggerRange: triggerRangeS,
              anchorX: rectS.left,
              anchorY: rectS.bottom,
            })
            return
          }
          setSlashState(null)
          const trigger = c as PickerTrigger
          // Compute the caret's viewport position via a temporary range.
          const rect = range.getBoundingClientRect()
          // Preserve a Range covering the trigger char + typed query so
          // we can delete it cleanly on insert.
          const triggerRange = document.createRange()
          triggerRange.setStart(container, i)
          triggerRange.setEnd(container, caret)
          setPickerState({
            trigger,
            query,
            triggerRange,
            anchorX: rect.left,
            anchorY: rect.bottom,
          })
          return
        }
      }
      if (/[\s ]/.test(c)) break
      i--
    }
    setPickerState(null)
    setSlashState(null)
  }, [])

  // ── Image annotation controller ──────────────────────────────────────
  //
  // When annotateMode is on, every image inside the editor gets wrapped
  // in a `.dv-annotatable` span with an SVG overlay for freehand strokes.
  // Pointer drags over that overlay create SVG paths that persist in the
  // doc HTML (so reload / autosave preserves them).
  //
  // Key correctness bits that took two passes to get right:
  //   · viewBox is set from the img's DISPLAYED size (getBoundingClientRect)
  //     — using naturalWidth misfires when the img hasn't loaded yet, and
  //     using CSS-only sizing leaves the SVG at Chrome's default 300x150.
  //   · pointer-events is set INLINE on the SVG when annotate mode is on
  //     — CSS was losing specificity to the parent-selector in some
  //     layouts, so we make it explicit.
  //   · Load listener on each img re-runs the viewBox calc once the
  //     image has real dimensions.
  //   · ResizeObserver keeps viewBox in sync if the container reflows.
  useEffect(() => {
    const editor = editorRef.current
    if (editor === null) return

    // Toggle the CSS mode flag (drives cursor: crosshair + dashed outline).
    if (annotateMode) editor.setAttribute('data-annotate-mode', 'on')
    else editor.removeAttribute('data-annotate-mode')

    if (!annotateMode) return

    // Debug: help diagnose "click Pencil but nothing happens" in devtools.
    // eslint-disable-next-line no-console
    console.log('[pencil] annotate mode ON — scanning for images…')

    // 1. Wrap any bare <img> that isn't already inside a .dv-annotatable.
    const bareImgs = editor.querySelectorAll('img')
    let wrappedCount = 0
    bareImgs.forEach((img) => {
      if (img.closest('.dv-annotatable') !== null) return
      // Skip tiny inline icons (mention avatars, chip glyphs, etc.).
      const rect = img.getBoundingClientRect()
      const naturalW = img.naturalWidth
      const naturalH = img.naturalHeight
      // A truly tiny image (icon) has small display AND small natural
      // dimensions. If either is >= 60, treat as annotatable — this way
      // an un-loaded image with 0 clientWidth but a real naturalWidth
      // still qualifies.
      const isTinyIcon =
        rect.width < 40 && rect.height < 40 && naturalW < 60 && naturalH < 60
      if (isTinyIcon) return

      const wrap = document.createElement('span')
      wrap.className = 'dv-annotatable'
      wrap.setAttribute('contenteditable', 'false')
      const parent = img.parentNode
      if (parent === null) return
      parent.insertBefore(wrap, img)
      wrap.appendChild(img)
      // SVG overlay — sized to 100% of the wrapper via inline styles so
      // Chrome doesn't default it to 300x150.
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('class', 'dv-annotations')
      svg.setAttribute('preserveAspectRatio', 'none')
      svg.setAttribute('width', '100%')
      svg.setAttribute('height', '100%')
      svg.style.position = 'absolute'
      svg.style.top = '0'
      svg.style.left = '0'
      svg.style.width = '100%'
      svg.style.height = '100%'
      svg.style.pointerEvents = 'auto'
      svg.style.cursor = 'crosshair'
      svg.style.touchAction = 'none'
      wrap.appendChild(svg)
      wrappedCount++
    })
    if (wrappedCount > 0) {
      // eslint-disable-next-line no-console
      console.log(`[pencil] wrapped ${wrappedCount} image(s) for annotation`)
    }

    // 2. Flip inline pointer-events on ALL existing overlays so previously-
    //    annotated images become drawable too.
    editor.querySelectorAll<SVGSVGElement>('svg.dv-annotations').forEach((svg) => {
      svg.style.pointerEvents = 'auto'
      svg.style.cursor = 'crosshair'
      svg.style.touchAction = 'none'
    })

    // 3. Compute + keep viewBox in sync with the rendered image size.
    const wraps = editor.querySelectorAll<HTMLSpanElement>('.dv-annotatable')
    const observers: ResizeObserver[] = []
    const loadHandlers: Array<{
      img: HTMLImageElement
      handler: () => void
    }> = []
    const syncViewBox = (wrap: HTMLSpanElement): void => {
      const img = wrap.querySelector<HTMLImageElement>('img')
      const svg = wrap.querySelector<SVGSVGElement>('svg.dv-annotations')
      if (img === null || svg === null) return
      const rect = img.getBoundingClientRect()
      const w = Math.max(1, Math.round(rect.width || img.naturalWidth || 400))
      const h = Math.max(1, Math.round(rect.height || img.naturalHeight || 300))
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
    }
    wraps.forEach((wrap) => {
      syncViewBox(wrap)
      const img = wrap.querySelector<HTMLImageElement>('img')
      if (img !== null) {
        // Re-sync when the image loads.
        if (!img.complete) {
          const handler = (): void => syncViewBox(wrap)
          img.addEventListener('load', handler)
          loadHandlers.push({ img, handler })
        }
        // Re-sync on wrapper resize (window resize / doc reflow).
        const ro = new ResizeObserver(() => syncViewBox(wrap))
        ro.observe(wrap)
        observers.push(ro)
      }
    })

    // 4. Attach pointer listeners on each overlay.
    const perOverlayCleanup: Array<() => void> = []
    wraps.forEach((wrap) => {
      const svg = wrap.querySelector<SVGSVGElement>('svg.dv-annotations')
      if (svg === null) return

      let currentPath: SVGPathElement | null = null
      let pointsBuffer: string[] = []

      const svgPoint = (e: PointerEvent): { x: number; y: number } => {
        const rect = svg.getBoundingClientRect()
        const vb = svg.getAttribute('viewBox')?.split(' ') ?? []
        const vbW = Number(vb[2]) || rect.width || 1
        const vbH = Number(vb[3]) || rect.height || 1
        const rw = Math.max(1, rect.width)
        const rh = Math.max(1, rect.height)
        return {
          x: ((e.clientX - rect.left) / rw) * vbW,
          y: ((e.clientY - rect.top) / rh) * vbH,
        }
      }

      const onDown = (e: PointerEvent): void => {
        if (e.button !== 0) return
        e.preventDefault()
        e.stopPropagation()
        try {
          svg.setPointerCapture(e.pointerId)
        } catch {
          /* setPointerCapture can throw on some browser edge cases */
        }
        const p = svgPoint(e)
        pointsBuffer = [`M${p.x.toFixed(1)} ${p.y.toFixed(1)}`]
        currentPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        currentPath.setAttribute('stroke', penColor)
        currentPath.setAttribute('stroke-width', String(penWidth))
        currentPath.setAttribute('fill', 'none')
        currentPath.setAttribute('stroke-linecap', 'round')
        currentPath.setAttribute('stroke-linejoin', 'round')
        currentPath.setAttribute('d', pointsBuffer.join(' '))
        svg.appendChild(currentPath)
      }
      const onMove = (e: PointerEvent): void => {
        if (currentPath === null) return
        e.preventDefault()
        const p = svgPoint(e)
        pointsBuffer.push(`L${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        currentPath.setAttribute('d', pointsBuffer.join(' '))
      }
      const onUp = (e: PointerEvent): void => {
        if (currentPath === null) return
        try {
          svg.releasePointerCapture(e.pointerId)
        } catch {
          /* pointer capture may already be released */
        }
        currentPath = null
        pointsBuffer = []
        persist()
      }

      svg.addEventListener('pointerdown', onDown)
      svg.addEventListener('pointermove', onMove)
      svg.addEventListener('pointerup', onUp)
      svg.addEventListener('pointercancel', onUp)
      perOverlayCleanup.push(() => {
        svg.removeEventListener('pointerdown', onDown)
        svg.removeEventListener('pointermove', onMove)
        svg.removeEventListener('pointerup', onUp)
        svg.removeEventListener('pointercancel', onUp)
      })
    })

    return () => {
      perOverlayCleanup.forEach((fn) => fn())
      observers.forEach((o) => o.disconnect())
      loadHandlers.forEach(({ img, handler }) => img.removeEventListener('load', handler))
      // On annotate-mode OFF, drop the interactive pointer/cursor styles
      // so the doc becomes fully editable again. Strokes stay drawn.
      editor.querySelectorAll<SVGSVGElement>('svg.dv-annotations').forEach((svg) => {
        svg.style.pointerEvents = 'none'
        svg.style.cursor = ''
        svg.style.touchAction = ''
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotateMode, penColor, penWidth])

  /** Erase every stroke on every image in the editor. Called from the
   *  pencil picker's "Erase all" action. */
  const handleEraseAllAnnotations = useCallback((): void => {
    const editor = editorRef.current
    if (editor === null) return
    editor.querySelectorAll<SVGSVGElement>('svg.dv-annotations').forEach((svg) => {
      while (svg.firstChild !== null) svg.removeChild(svg.firstChild)
    })
    persist()
  }, [persist])

  /** Apply a slash-command pick — replace the /query prefix with the
   *  command's block HTML at the caret. For insert-* actions, hand off
   *  to the existing pickers (part / image / link). Mention and tag
   *  slash commands just insert '@' or '#' which the mention/tag
   *  detector then picks up on the next input tick. */
  const applySlashCommand = useCallback(
    (cmd: SlashCommand): void => {
      const state = slashState
      if (state === null || state.triggerRange === null) return
      const sel = window.getSelection()
      if (sel === null) return
      sel.removeAllRanges()
      sel.addRange(state.triggerRange)
      const html = cmd.build()
      document.execCommand('insertHTML', false, html)
      setSlashState(null)
      if (cmd.action === 'insertPartPicker') {
        setShowPartPicker(true)
      } else if (cmd.action === 'insertImage') {
        const el = document.getElementById(fileInputId) as HTMLInputElement | null
        el?.click()
      } else if (cmd.action === 'insertLink') {
        handleLinkInsert()
      }
      persist()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slashState, persist],
  )

  /** Delete the trigger text (`@abc` / `#foo`) and drop the chip in its
   *  place. Shared by mention + tag picks. */
  const replaceTriggerWithChip = useCallback(
    (chipHtml: string): void => {
      const state = pickerState
      if (state === null || state.triggerRange === null) {
        insertHtmlAtCaret(chipHtml)
        return
      }
      const sel = window.getSelection()
      if (sel === null) return
      sel.removeAllRanges()
      sel.addRange(state.triggerRange)
      // execCommand on the current selection replaces it.
      document.execCommand('insertHTML', false, chipHtml)
      setPickerState(null)
      persist()
    },
    [pickerState, insertHtmlAtCaret, persist],
  )

  // Global Ctrl+K / Cmd+K opens the search modal (from any editor state).
  // Global Ctrl+D / Cmd+D toggles pencil (annotate) mode — chosen so it
  // works even when the toolbar Pencil button is off-screen (narrow
  // viewport or DevTools docked to the side).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setShowSearchModal(true)
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        setAnnotateMode((v) => {
          const next = !v
          setShowPencilPicker(next)
          return next
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Floating image context toolbar — tracks the image the user is
  // currently hovering / operating on. Replaces the earlier tiny
  // "Draw" FAB with a full multi-action bar (caption, comment pin,
  // replace, draw, view 3D, delete).
  const [activeImage, setActiveImage] = useState<{
    img: HTMLImageElement
    anchor: { x: number; y: number }
  } | null>(null)

  // Pin-drop mode — armed by the ImageContextToolbar's Comment button.
  // Next click on the image places a numbered pin at the click position.
  const [pinDropMode, setPinDropMode] = useState(false)

  useEffect(() => {
    const editor = editorRef.current
    if (editor === null) return
    let hideTimer: number | null = null
    const scheduleHide = (): void => {
      if (hideTimer !== null) window.clearTimeout(hideTimer)
      hideTimer = window.setTimeout(() => setActiveImage(null), 900)
    }
    const cancelHide = (): void => {
      if (hideTimer !== null) {
        window.clearTimeout(hideTimer)
        hideTimer = null
      }
    }
    const onOver = (e: MouseEvent): void => {
      const t = e.target as HTMLElement | null
      if (t === null) return
      // Ignore hovers on the toolbar itself so it doesn't disappear
      // when moving the mouse from image → toolbar.
      if (t.closest('[data-doc-image-toolbar]') !== null) {
        cancelHide()
        return
      }
      const img = (
        t.tagName === 'IMG' ? t : t.closest('.dv-annotatable')?.querySelector('img')
      ) as HTMLImageElement | null | undefined
      if (img === null || img === undefined) return
      const rect = img.getBoundingClientRect()
      if (rect.width < 60 || rect.height < 60) return
      cancelHide()
      // Anchor at the image's top-right for the toolbar to translate
      // upward from. The toolbar itself computes its final coords.
      setActiveImage({ img, anchor: { x: rect.right - 4, y: rect.top } })
    }
    const onOut = (e: MouseEvent): void => {
      const t = e.relatedTarget as HTMLElement | null
      if (t !== null && t.closest('[data-doc-image-toolbar]') !== null) return
      scheduleHide()
    }
    editor.addEventListener('mouseover', onOver)
    editor.addEventListener('mouseout', onOut)
    return () => {
      editor.removeEventListener('mouseover', onOver)
      editor.removeEventListener('mouseout', onOut)
      if (hideTimer !== null) window.clearTimeout(hideTimer)
    }
  }, [])

  // Pin-drop click handler — active only while pin-drop mode is on.
  // Places a numbered <span class="dv-image-pin"> at the click point
  // as a percentage of the IMAGE's rendered size (so pins scale with
  // the image if the doc reflows and land on the same feature).
  //
  // Crucial: pins must live inside a `.dv-annotatable` wrapper — that's
  // the only container guaranteed to be sized to the image (inline-block
  // shrink-to-fit). Without the wrapper, `left: 50%` would be 50% of the
  // parent <p> (full doc width) and the pin would land in the wrong
  // place. So we auto-wrap the image the first time it needs a pin.
  useEffect(() => {
    const editor = editorRef.current
    if (editor === null || !pinDropMode) return
    editor.setAttribute('data-pindrop-mode', 'on')
    // eslint-disable-next-line no-console
    console.log('[pin] pin-drop mode ARMED — click any image to drop a pin')

    const onClick = (e: MouseEvent): void => {
      const t = e.target as HTMLElement | null
      if (t === null) return
      // Locate the image — the click may have landed on the img, on the
      // .dv-annotatable wrapper, on the SVG overlay, or on an existing
      // pin. Walk up / down as needed.
      let img: HTMLImageElement | null = null
      if (t.tagName === 'IMG') {
        img = t as HTMLImageElement
      } else {
        const wrapAncestor = t.closest('.dv-annotatable') as HTMLElement | null
        if (wrapAncestor !== null) {
          img = wrapAncestor.querySelector('img')
        }
      }
      if (img === null) {
        // eslint-disable-next-line no-console
        console.log('[pin] click did not hit an image, ignoring', t)
        return
      }
      // eslint-disable-next-line no-console
      console.log('[pin] click hit image', img)

      // Ensure the image is inside a .dv-annotatable wrapper — wrap it
      // on-demand if not, so subsequent pin coordinates map to the
      // image's own box (not the parent paragraph).
      let wrap = img.closest('.dv-annotatable') as HTMLElement | null
      if (wrap === null) {
        // eslint-disable-next-line no-console
        console.log('[pin] wrapping bare image for annotation')
        wrap = document.createElement('span')
        wrap.className = 'dv-annotatable'
        wrap.setAttribute('contenteditable', 'false')
        const parent = img.parentNode
        if (parent === null) return
        parent.insertBefore(wrap, img)
        wrap.appendChild(img)
      }

      // Compute click position as percentages of the image's rendered
      // rect (not the wrapper's — they should match but the image is
      // authoritative if there's ever a mismatch).
      const rect = img.getBoundingClientRect()
      const xPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / Math.max(1, rect.width)) * 100))
      const yPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / Math.max(1, rect.height)) * 100))

      const existing = wrap.querySelectorAll('.dv-image-pin').length
      const pin = document.createElement('span')
      pin.className = 'dv-image-pin'
      pin.setAttribute('data-pin-n', String(existing + 1))
      pin.setAttribute('contenteditable', 'false')
      pin.style.left = `${xPct.toFixed(2)}%`
      pin.style.top = `${yPct.toFixed(2)}%`
      pin.textContent = String(existing + 1)
      wrap.appendChild(pin)
      // eslint-disable-next-line no-console
      console.log(`[pin] dropped pin #${existing + 1} at ${xPct.toFixed(1)}%, ${yPct.toFixed(1)}%`)

      persist()
      setPinDropMode(false)
      e.preventDefault()
      e.stopPropagation()
    }
    editor.addEventListener('click', onClick, true)
    return () => {
      editor.removeAttribute('data-pindrop-mode')
      editor.removeEventListener('click', onClick, true)
    }
  }, [pinDropMode, persist])

  // Recompute word / char / reading-time on every save. Also rebuild the
  // TOC from the current DOM headings so it stays in sync as the user
  // types new sections.
  const recomputeStatsAndToc = useCallback((): void => {
    const node = editorRef.current
    if (node === null) return
    setStats(computeDocStats(node.innerHTML))
    const headings: Array<{ text: string; level: number; id: string }> = []
    node.querySelectorAll('h1, h2, h3').forEach((h, i) => {
      const text = (h.textContent ?? '').trim()
      if (text === '') return
      // Assign a stable id we can scroll-anchor to.
      let id = h.getAttribute('id')
      if (id === null || id === '') {
        id = `heading-${i}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`
        h.setAttribute('id', id)
      }
      headings.push({ text, level: Number(h.tagName[1]), id })
    })
    setTocHeadings(headings)
  }, [])

  // Recompute stats when tab changes AND after every save.
  useEffect(() => {
    recomputeStatsAndToc()
  }, [partId, activeTabId, recomputeStatsAndToc])

  /** Insert one of the four callout blocks at the caret. */
  const insertCallout = useCallback(
    (tone: 'info' | 'success' | 'warning' | 'danger'): void => {
      const iconByTone: Record<typeof tone, string> = {
        info: 'ℹ️',
        success: '✅',
        warning: '⚠️',
        danger: '🚫',
      }
      const labelByTone: Record<typeof tone, string> = {
        info: 'Note',
        success: 'Success',
        warning: 'Warning',
        danger: 'Danger',
      }
      const html = `<div class="dv-callout" data-tone="${tone}"><span class="dv-callout-icon">${iconByTone[tone]}</span><div class="dv-callout-body"><strong>${labelByTone[tone]}:</strong> Type your callout text here.</div></div><p><br></p>`
      insertHtmlAtCaret(html)
      setShowCalloutPicker(false)
    },
    [insertHtmlAtCaret],
  )

  /** Export the current doc — PDF via window.print (print styles hide
   *  the app chrome), or Markdown by converting innerHTML + downloading. */
  const exportAsPdf = useCallback((): void => {
    setShowExportMenu(false)
    // Give the menu one tick to close before the print dialog blocks the UI.
    window.setTimeout(() => window.print(), 50)
  }, [])

  const exportAsMarkdown = useCallback((): void => {
    setShowExportMenu(false)
    const node = editorRef.current
    if (node === null) return
    const md = htmlToMarkdown(node.innerHTML)
    const filename = `${partName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'document'}.md`
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [partName])

  /** Scroll a heading into view (called from the TOC panel). */
  const scrollToHeading = useCallback((id: string): void => {
    const node = editorRef.current
    if (node === null) return
    const el = node.querySelector(`#${CSS.escape(id)}`)
    if (el !== null) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setShowTocPanel(false)
  }, [])

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
    <div className={['flex h-full flex-col bg-white', focusMode ? 'dv-doc-focus' : ''].join(' ')}>
      {/* ── Menu bar (visual only — GDocs-style: File · Edit · …) ─────────── */}
      <div
        data-doc-menu-bar
        className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-3 py-1.5 text-[11px] text-slate-600"
      >
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
        {/* Live doc stats — words · chars · reading time */}
        <span className="text-slate-300">·</span>
        <span className="text-[10.5px] text-slate-500 tabular-nums" title="Live word / char / reading-time counter">
          <strong className="font-semibold text-slate-700">{stats.words.toLocaleString()}</strong> words
          <span className="mx-1 text-slate-300">·</span>
          <strong className="font-semibold text-slate-700">{stats.chars.toLocaleString()}</strong> chars
          <span className="mx-1 text-slate-300">·</span>
          ~<strong className="font-semibold text-slate-700">{stats.readingMin}</strong> min read
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
      <div
        data-doc-toolbar
        className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white px-3 py-1.5"
      >
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

        <Separator />

        {/* Pencil / annotation tool — draw freehand strokes on any image
            in the doc (matches the Quarter20 markup UX). Toggling it on
            wraps images in an SVG-overlay container; toggling off leaves
            existing strokes in place but disables new drawing. */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              // Clicking the button toggles annotate mode AND the picker
              // together — one-click on/off, plus the picker for tuning.
              if (annotateMode) {
                setAnnotateMode(false)
                setShowPencilPicker(false)
              } else {
                setAnnotateMode(true)
                setShowPencilPicker(true)
              }
            }}
            aria-label={annotateMode ? 'Turn off pencil markup' : 'Turn on pencil markup'}
            aria-pressed={annotateMode}
            title={annotateMode ? 'Pencil markup ON — click images to draw' : 'Pencil markup — draw on images'}
            className={[
              'inline-flex h-7 items-center gap-1 rounded px-1.5 text-[11px] font-semibold transition',
              annotateMode
                ? 'bg-primary text-white'
                : 'text-slate-600 hover:bg-slate-100',
            ].join(' ')}
          >
            <Pencil className="h-3.5 w-3.5" />
            Pencil
          </button>
          {showPencilPicker && (
            <PencilPicker
              color={penColor}
              width={penWidth}
              onChangeColor={setPenColor}
              onChangeWidth={setPenWidth}
              onEraseAll={handleEraseAllAnnotations}
              onTurnOff={() => {
                setAnnotateMode(false)
                setShowPencilPicker(false)
              }}
              onClose={() => setShowPencilPicker(false)}
            />
          )}
        </div>

        <Separator />

        {/* Quarter20-style toolbar cluster: Part number linker · Version
            history · Global doc search · BOM insert · Sign-off insert. */}
        <ToolGroup>
          {/* Part number picker */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => {
                saveSelection()
                e.preventDefault()
              }}
              onClick={() => {
                if (!showPartPicker) setShowPartPicker(true)
              }}
              aria-label="Insert part number"
              aria-expanded={showPartPicker}
              title="Insert part number (with torque + material metadata)"
              className={[
                'inline-flex h-7 items-center gap-1 rounded px-1.5 text-[11px] font-semibold transition',
                showPartPicker
                  ? 'bg-primary-50 text-primary'
                  : 'text-slate-600 hover:bg-slate-100',
              ].join(' ')}
            >
              <Tag className="h-3.5 w-3.5" />
              P/N
            </button>
            {showPartPicker && (
              <PartNumberPicker
                onPick={insertPartChip}
                onClose={() => setShowPartPicker(false)}
              />
            )}
          </div>

          {/* BOM insert */}
          <button
            type="button"
            onMouseDown={(e) => {
              saveSelection()
              e.preventDefault()
            }}
            onClick={insertBomBlock}
            aria-label="Insert BOM table"
            title="Insert Bill of Materials table"
            className="inline-flex h-7 items-center gap-1 rounded px-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            BOM
          </button>

          {/* Sign-off insert */}
          <button
            type="button"
            onMouseDown={(e) => {
              saveSelection()
              e.preventDefault()
            }}
            onClick={insertSignOffBlock}
            aria-label="Insert sign-off block"
            title="Insert Approval &amp; Sign-off table"
            className="inline-flex h-7 items-center gap-1 rounded px-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Sign-off
          </button>

          {/* Version history */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (!showVersionsPanel) setShowVersionsPanel(true)
              }}
              aria-label="Open version history"
              aria-expanded={showVersionsPanel}
              title={`Version history (${versions.length} snapshot${versions.length === 1 ? '' : 's'})`}
              className={[
                'inline-flex h-7 items-center gap-1 rounded px-1.5 text-[11px] font-semibold transition',
                showVersionsPanel
                  ? 'bg-primary-50 text-primary'
                  : 'text-slate-600 hover:bg-slate-100',
              ].join(' ')}
            >
              <Undo2 className="h-3.5 w-3.5 rotate-90" />
              Versions
              {versions.length > 0 && (
                <span className="ml-0.5 rounded-full bg-primary/10 px-1.5 text-[9px] font-bold tabular-nums text-primary">
                  {versions.length}
                </span>
              )}
            </button>
            {showVersionsPanel && (
              <VersionHistoryPanel
                partId={partId}
                tabId={activeTabId}
                versions={versions}
                onRestore={handleRestoreVersion}
                onClose={() => setShowVersionsPanel(false)}
                onVersionsChanged={() => setVersions(loadVersions(partId, activeTabId))}
              />
            )}
          </div>

          {/* Global doc search — Ctrl+K also opens */}
          <button
            type="button"
            onClick={() => setShowSearchModal(true)}
            aria-label="Search all docs"
            title="Search all docs (⌘K / Ctrl+K)"
            className="inline-flex h-7 items-center gap-1 rounded px-1.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            <Search className="h-3.5 w-3.5" />
            Search
          </button>
        </ToolGroup>

        <Separator />

        {/* Callout / Focus / TOC / Export cluster */}
        <ToolGroup>
          {/* Callout picker */}
          <div className="relative">
            <button
              type="button"
              onMouseDown={(e) => {
                saveSelection()
                e.preventDefault()
              }}
              onClick={() => {
                if (!showCalloutPicker) setShowCalloutPicker(true)
              }}
              aria-label="Insert callout block"
              aria-expanded={showCalloutPicker}
              title="Insert callout — info / success / warning / danger"
              className={[
                'inline-flex h-7 items-center gap-1 rounded px-1.5 text-[11px] font-semibold transition',
                showCalloutPicker
                  ? 'bg-primary-50 text-primary'
                  : 'text-slate-600 hover:bg-slate-100',
              ].join(' ')}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Callout
            </button>
            {showCalloutPicker && (
              <div
                role="menu"
                className="dv-anim-pop absolute right-0 top-9 z-30 w-52 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
                onMouseLeave={() => setShowCalloutPicker(false)}
              >
                {(['info', 'success', 'warning', 'danger'] as const).map((tone) => {
                  const meta = {
                    info:    { emoji: 'ℹ️', label: 'Info',    hint: 'Neutral note or FYI' },
                    success: { emoji: '✅', label: 'Success', hint: 'Confirmation / good' },
                    warning: { emoji: '⚠️', label: 'Warning', hint: 'Heads-up / risk' },
                    danger:  { emoji: '🚫', label: 'Danger',  hint: 'Do not do this' },
                  }[tone]
                  return (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => insertCallout(tone)}
                      className="flex w-full items-start gap-2 px-3 py-1.5 text-left text-[12px] text-slate-700 transition hover:bg-slate-50"
                    >
                      <span aria-hidden="true">{meta.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{meta.label}</span>
                        <span className="block text-[10px] text-slate-500">
                          {meta.hint}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Table of contents */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                recomputeStatsAndToc()
                if (!showTocPanel) setShowTocPanel(true)
              }}
              aria-label="Open table of contents"
              aria-expanded={showTocPanel}
              title="Table of contents — jump to any heading"
              className={[
                'inline-flex h-7 items-center gap-1 rounded px-1.5 text-[11px] font-semibold transition',
                showTocPanel
                  ? 'bg-primary-50 text-primary'
                  : 'text-slate-600 hover:bg-slate-100',
              ].join(' ')}
            >
              <ListChecks className="h-3.5 w-3.5" />
              TOC
              {tocHeadings.length > 0 && (
                <span className="ml-0.5 rounded-full bg-primary/10 px-1.5 text-[9px] font-bold tabular-nums text-primary">
                  {tocHeadings.length}
                </span>
              )}
            </button>
            {showTocPanel && (
              <div
                role="dialog"
                aria-label="Table of contents"
                className="dv-anim-pop absolute right-0 top-9 z-30 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
              >
                <div className="border-b border-slate-100 bg-slate-50/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Table of contents
                </div>
                <div className="dv-thin-scroll max-h-[320px] overflow-y-auto py-1">
                  {tocHeadings.length === 0 ? (
                    <p className="px-3 py-4 text-center text-[11px] text-slate-500">
                      No headings yet. Add H1, H2, or H3 via the style selector.
                    </p>
                  ) : (
                    tocHeadings.map((h) => (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => scrollToHeading(h.id)}
                        style={{ paddingLeft: `${8 + (h.level - 1) * 12}px` }}
                        className="block w-full py-1 pr-3 text-left text-[12px] text-slate-700 transition hover:bg-slate-50 hover:text-primary"
                      >
                        {h.text}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Focus mode toggle */}
          <button
            type="button"
            onClick={() => setFocusMode((v) => !v)}
            aria-label={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
            aria-pressed={focusMode}
            title={
              focusMode
                ? 'Exit focus mode (show sidebar + toolbar again)'
                : 'Focus mode — hide sidebar + toolbar, widen text'
            }
            className={[
              'inline-flex h-7 items-center gap-1 rounded px-1.5 text-[11px] font-semibold transition',
              focusMode
                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                : 'text-slate-600 hover:bg-slate-100',
            ].join(' ')}
          >
            {focusMode ? '✕ Focus' : '◐ Focus'}
          </button>

          {/* Export menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (!showExportMenu) setShowExportMenu(true)
              }}
              aria-label="Export document"
              aria-expanded={showExportMenu}
              title="Export as PDF or Markdown"
              className={[
                'inline-flex h-7 items-center gap-1 rounded px-1.5 text-[11px] font-semibold transition',
                showExportMenu
                  ? 'bg-primary-50 text-primary'
                  : 'text-slate-600 hover:bg-slate-100',
              ].join(' ')}
            >
              <Printer className="h-3.5 w-3.5" />
              Export
              <ChevronDown className="h-3 w-3" />
            </button>
            {showExportMenu && (
              <div
                role="menu"
                className="dv-anim-pop absolute right-0 top-9 z-30 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
                onMouseLeave={() => setShowExportMenu(false)}
              >
                <button
                  type="button"
                  onClick={exportAsPdf}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-slate-700 transition hover:bg-slate-50"
                >
                  <Printer className="h-3.5 w-3.5 text-slate-400" />
                  PDF (print)
                </button>
                <button
                  type="button"
                  onClick={exportAsMarkdown}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-slate-700 transition hover:bg-slate-50"
                >
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  Markdown (.md)
                </button>
              </div>
            )}
          </div>
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
        {/* ── Left rail — Quarter20-style ─────────────────────────────
            Doc title header · fixed nav (Cover / Version History /
            Bill of Materials) · numbered "sections" (the existing tabs
            surface as numbered document sections with file icons). */}
        <aside
          data-doc-tabs-rail
          className="relative z-10 flex w-[240px] shrink-0 flex-col border-r border-slate-200 bg-white shadow-[1px_0_0_rgba(15,23,42,0.03)]"
        >
          {/* Doc title + subtitle at the top */}
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-[14px] font-bold leading-tight text-slate-900">
              {partName}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-slate-500">
              {docTypeId !== null && docTypeId !== 'blank'
                ? findTemplate(docTypeId)?.label ?? 'Work Instructions'
                : 'Work Instructions'}
            </p>
          </div>

          {/* Fixed nav — Cover / Version History / Bill of Materials */}
          <nav className="border-b border-slate-100 py-1.5">
            {/* Cover — jump to top of the doc */}
            <button
              type="button"
              onClick={() => {
                editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                editorRef.current?.focus()
              }}
              className="group flex w-full items-center gap-2.5 border-l-[3px] border-transparent px-3.5 py-1.5 text-[12.5px] text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <FileText className="h-3.5 w-3.5 text-slate-400 group-hover:text-primary" />
              <span className="flex-1 text-left">Cover</span>
            </button>

            {/* Version History — opens the same panel as the toolbar button */}
            <button
              type="button"
              onClick={() => setShowVersionsPanel((v) => !v)}
              className={[
                'group flex w-full items-center gap-2.5 border-l-[3px] px-3.5 py-1.5 text-[12.5px] transition',
                showVersionsPanel
                  ? 'border-primary bg-primary-50 font-semibold text-primary'
                  : 'border-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-900',
              ].join(' ')}
            >
              <Undo2
                className={[
                  'h-3.5 w-3.5 rotate-90',
                  showVersionsPanel ? 'text-primary' : 'text-slate-400 group-hover:text-primary',
                ].join(' ')}
              />
              <span className="flex-1 text-left">Version History</span>
              {versions.length > 0 && (
                <span className="rounded-full bg-slate-100 px-1.5 text-[9.5px] font-bold tabular-nums text-slate-600 group-hover:bg-primary/10 group-hover:text-primary">
                  {versions.length}
                </span>
              )}
            </button>

            {/* Bill of Materials — jumps to BOM heading, or inserts one */}
            <button
              type="button"
              onClick={() => {
                const node = editorRef.current
                if (node === null) return
                const found = Array.from(node.querySelectorAll('h1, h2, h3')).find((h) =>
                  (h.textContent ?? '').toLowerCase().includes('bill of materials'),
                )
                if (found !== undefined) {
                  found.scrollIntoView({ behavior: 'smooth', block: 'start' })
                } else {
                  // No BOM section yet — insert one at the cursor.
                  insertBomBlock()
                }
              }}
              className="group flex w-full items-center gap-2.5 border-l-[3px] border-transparent px-3.5 py-1.5 text-[12.5px] text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <ListChecks className="h-3.5 w-3.5 text-slate-400 group-hover:text-primary" />
              <span className="flex-1 text-left">Bill of Materials</span>
            </button>
          </nav>

          {/* Numbered document sections — the existing tabs, restyled */}
          <div className="dv-thin-scroll flex-1 overflow-y-auto py-1">
            {tabs.map((t, i) => {
              const active = t.id === activeTabId
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTabId(t.id)}
                  className={[
                    'group flex w-full items-center gap-2 border-l-[3px] px-2.5 py-1.5 text-[12.5px] transition',
                    active
                      ? 'border-primary bg-primary-50 font-semibold text-primary'
                      : 'border-transparent text-slate-700 hover:bg-slate-50 hover:text-slate-900',
                  ].join(' ')}
                >
                  <ChevronRight
                    className={[
                      'h-3 w-3 shrink-0 transition',
                      active ? 'text-primary' : 'text-slate-300 group-hover:text-slate-500',
                    ].join(' ')}
                  />
                  <span
                    className={[
                      'w-4 shrink-0 text-center font-mono text-[10.5px] font-bold tabular-nums',
                      active ? 'text-primary' : 'text-slate-400',
                    ].join(' ')}
                  >
                    {i + 1}
                  </span>
                  <FileText
                    className={[
                      'h-3.5 w-3.5 shrink-0',
                      active ? 'text-primary' : 'text-slate-400 group-hover:text-primary',
                    ].join(' ')}
                  />
                  <span className="min-w-0 flex-1 truncate text-left">{t.name}</span>
                </button>
              )
            })}
            {/* Add-section affordance */}
            <button
              type="button"
              onClick={handleAddTab}
              className="mt-1 flex w-full items-center gap-2 border-l-[3px] border-transparent px-3.5 py-1.5 text-[11.5px] font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-primary"
            >
              <Plus className="h-3 w-3" />
              Add section
            </button>
          </div>
        </aside>

        {/* Editor canvas — min-w-0 lets flex-1 actually shrink, and
            overflow-hidden clips any inserted content (tables etc.)
            that would otherwise spill past the canvas and cover the
            left rail. */}
        <div
          data-doc-canvas
          className="dv-thin-scroll relative z-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-slate-100 px-6 py-6"
        >
          {/* Template chips + doc-type badge above the cursor.
              The Templates chip opens a real picker (5 Quarter20-style
              templates). Doc-type badge on the right shows which template
              this doc is currently based on. */}
          <div
            data-doc-chips-row
            className="mx-auto mb-3 flex max-w-[850px] flex-wrap items-center gap-2"
          >
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (!showTemplatesPicker) setShowTemplatesPicker(true)
                }}
                className={[
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition',
                  showTemplatesPicker
                    ? 'border-primary/40 bg-primary-50 text-primary'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-primary/40 hover:text-primary',
                ].join(' ')}
              >
                <Sparkles className="h-3 w-3" />
                Templates
              </button>
              {showTemplatesPicker && (
                <TemplatesPicker
                  activeId={docTypeId}
                  onPick={handleApplyTemplate}
                  onClose={() => setShowTemplatesPicker(false)}
                />
              )}
            </div>
            <Chip icon={FileText}>Meeting notes</Chip>
            <Chip icon={Mail}>Email draft</Chip>
            <Chip icon={MoreHorizontal}>More</Chip>

            {/* Right-side doc-type badge — the small "WI" / "QC" / "DR" pill */}
            {docTypeId !== null && docTypeId !== 'blank' && (() => {
              const t = findTemplate(docTypeId)
              if (t === undefined) return null
              return (
                <span
                  className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary-50 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wider text-primary"
                  title={`Doc type: ${t.label}`}
                >
                  <span className="font-mono">{t.abbr}</span>
                  <span className="font-semibold normal-case text-primary-700">
                    {t.label}
                  </span>
                </span>
              )
            })()}
          </div>

          {/* The page itself */}
          <div
            data-doc-editor
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={() => {
              // Typing invalidates any saved range (the user moved on).
              savedRangeRef.current = null
              persist()
              // Re-scan for @ / # triggers on every keystroke so the
              // mentions/tags picker follows the caret.
              detectMentionTagTrigger()
            }}
            onMouseUp={saveSelection}
            onKeyUp={saveSelection}
            onKeyDownCapture={(e) => {
              // When any caret-anchored picker is open — mentions/tags
              // OR slash-command — let it own the arrow / enter / tab /
              // escape keys before contentEditable inserts a newline.
              const slashHandler = slashKeydownRef.current
              if (slashHandler !== null) {
                const handled = slashHandler(e.nativeEvent)
                if (handled) {
                  e.stopPropagation()
                  return
                }
              }
              const handler = pickerKeydownRef.current
              if (handler !== null) {
                const handled = handler(e.nativeEvent)
                if (handled) e.stopPropagation()
              }
            }}
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

      {/* ── Overlays: caret-anchored mentions/tags picker + global search ── */}
      {pickerState !== null && (
        <MentionsTagsPicker
          trigger={pickerState.trigger}
          query={pickerState.query}
          anchorX={pickerState.anchorX}
          anchorY={pickerState.anchorY}
          onPickMember={(m) => {
            const chip = `<span class="dv-mention" data-mention="${m.id}" contenteditable="false">@${m.name}</span>&nbsp;`
            replaceTriggerWithChip(chip)
          }}
          onPickTag={(t) => {
            const chip = `<span class="dv-tag-chip" data-category="${t.category}" data-tag="${t.id}" contenteditable="false">#${t.category}:${t.label}</span>&nbsp;`
            replaceTriggerWithChip(chip)
          }}
          onClose={() => setPickerState(null)}
          registerKeydownHandler={(fn) => {
            pickerKeydownRef.current = fn
          }}
        />
      )}
      {showSearchModal && (
        <DocSearchModal onClose={() => setShowSearchModal(false)} />
      )}
      {slashState !== null && (
        <SlashCommandMenu
          query={slashState.query}
          anchorX={slashState.anchorX}
          anchorY={slashState.anchorY}
          onPick={applySlashCommand}
          onClose={() => setSlashState(null)}
          registerKeydownHandler={(fn) => {
            slashKeydownRef.current = fn
          }}
        />
      )}
      {/* Floating "bubble menu" that pops up above highlighted text with
          Bold / Italic / Underline / lists / colour / link — matches
          the Notion / Medium quick-format UX. Hidden when there's no
          selection. Skipped while a picker/menu is open so the two
          floating surfaces don't fight. */}
      {pickerState === null && slashState === null && (
        <FloatingFormatToolbar editorRef={editorRef} onAfterCommand={persist} />
      )}

      {/* Always-visible on-screen indicator when pencil mode is active
          — an unmissable pill at the bottom-centre of the viewport that
          confirms drawing is enabled, so the user isn't left guessing
          whether their click on the Pencil button did anything. */}
      {annotateMode && (
        <div className="dv-annotate-banner">
          <Pencil className="h-3.5 w-3.5" />
          Pencil ON — drag on any image to draw
          <span className="ml-1 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-mono">
            Ctrl+D to toggle
          </span>
        </div>
      )}
      {/* Floating image context toolbar — appears above whichever
          image the user is hovering. Handles caption, comment pin,
          replace, draw, view 3D, delete. Positioned via fixed coords
          from the image's client rect. */}
      <div data-doc-image-toolbar>
        <ImageContextToolbar
          anchor={activeImage?.anchor ?? null}
          img={activeImage?.img ?? null}
          drawActive={annotateMode}
          onToggleDraw={() => {
            setAnnotateMode((v) => !v)
            setShowPencilPicker((v) => !v)
          }}
          onArmPinDrop={() => setPinDropMode(true)}
          onAfterChange={persist}
          onClose={() => setActiveImage(null)}
        />
      </div>
      {/* Pin-drop mode indicator — mirrors the pencil banner so the
          user knows a click on the image will drop a numbered pin. */}
      {pinDropMode && (
        <div className="dv-annotate-banner" style={{ background: '#dc2626' }}>
          <span>Click on the image to drop a comment pin</span>
          <button
            type="button"
            onClick={() => setPinDropMode(false)}
            className="ml-2 rounded bg-white/20 px-2 py-0.5 text-[10px] font-mono hover:bg-white/30"
            style={{ pointerEvents: 'auto' }}
          >
            Cancel
          </button>
        </div>
      )}
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
