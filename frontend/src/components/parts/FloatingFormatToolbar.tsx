'use client'

/**
 * FloatingFormatToolbar — a "bubble menu" that pops up above the current
 * text selection inside the doc editor, matching the Notion / Medium /
 * TipTap pattern. Whenever the user highlights a run of text, this bar
 * appears with quick formatting actions (Bold, Italic, Underline,
 * Strikethrough, list toggles, alignment, colour, link).
 *
 * The bar is a plain floating <div> positioned via `fixed` top/left
 * coords computed from `selection.getRangeAt(0).getBoundingClientRect()`.
 * Buttons apply changes with `document.execCommand`, which keeps the
 * selection intact so the user can immediately hit another button (e.g.
 * bold → then italic on the same text).
 *
 * The bar hides itself as soon as the selection collapses to a caret,
 * or when focus leaves the editor.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  CheckSquare,
  Link as LinkIcon,
  Palette,
  Type,
} from 'lucide-react'

interface Props {
  /** The contentEditable editor element the toolbar operates on. */
  editorRef: React.RefObject<HTMLDivElement | null>
  /** Called after any formatting action so the parent can persist(). */
  onAfterCommand: () => void
}

interface BubblePos {
  top: number
  left: number
}

const COLOURS: readonly { name: string; hex: string }[] = [
  { name: 'Default', hex: '#0f172a' },
  { name: 'Grey',    hex: '#64748b' },
  { name: 'Red',     hex: '#dc2626' },
  { name: 'Orange',  hex: '#ea580c' },
  { name: 'Yellow',  hex: '#ca8a04' },
  { name: 'Green',   hex: '#16a34a' },
  { name: 'Blue',    hex: '#2563eb' },
  { name: 'Violet',  hex: '#7c3aed' },
] as const

export default function FloatingFormatToolbar({
  editorRef,
  onAfterCommand,
}: Props): JSX.Element | null {
  const [pos, setPos] = useState<BubblePos | null>(null)
  const [colorOpen, setColorOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  /** Recompute the bubble position from the current selection. Hides
   *  the toolbar when the selection is empty, outside the editor, or
   *  the range's bounding rect is degenerate. */
  const recompute = useCallback((): void => {
    const editor = editorRef.current
    if (editor === null) return
    const sel = window.getSelection()
    if (sel === null || sel.rangeCount === 0 || sel.isCollapsed) {
      setPos(null)
      setColorOpen(false)
      return
    }
    // Selection must live inside the editor node — otherwise we're
    // reacting to a selection in a different textbox.
    const anchor = sel.anchorNode
    if (anchor === null || !editor.contains(anchor)) {
      setPos(null)
      setColorOpen(false)
      return
    }
    const range = sel.getRangeAt(0)
    const r = range.getBoundingClientRect()
    // Some selection ranges (e.g. selecting a chip only) return 0×0.
    if (r.width === 0 && r.height === 0) {
      setPos(null)
      return
    }
    // Position above the selection, centered horizontally. The
    // toolbar is ~340px wide with padding; clamp so it never spills
    // outside the viewport.
    const TOOLBAR_W = 360
    const OFFSET_Y = 10
    let left = r.left + r.width / 2 - TOOLBAR_W / 2
    left = Math.max(8, Math.min(left, window.innerWidth - TOOLBAR_W - 8))
    // If there's no room above, flip below.
    const above = r.top - 44 - OFFSET_Y
    const below = r.bottom + OFFSET_Y
    const top = above < 8 ? below : above
    setPos({ top, left })
  }, [editorRef])

  useEffect(() => {
    const editor = editorRef.current
    if (editor === null) return
    // selectionchange fires globally on any selection update anywhere
    // in the document — cheap enough for our purposes.
    const onSel = (): void => recompute()
    const onScroll = (): void => recompute()
    document.addEventListener('selectionchange', onSel)
    window.addEventListener('resize', onSel)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('selectionchange', onSel)
      window.removeEventListener('resize', onSel)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [recompute, editorRef])

  /** Apply a document.execCommand and re-focus the editor so the
   *  selection stays live for a follow-up action. */
  const exec = useCallback(
    (cmd: string, arg?: string): void => {
      const editor = editorRef.current
      if (editor === null) return
      editor.focus()
      // execCommand acts on the current selection.
      document.execCommand(cmd, false, arg)
      onAfterCommand()
      // Recompute in case the DOM change shifted the range bounds.
      requestAnimationFrame(recompute)
    },
    [editorRef, onAfterCommand, recompute],
  )

  /** Insert a checkbox at the caret / around the selection. */
  const insertChecklist = useCallback((): void => {
    const html =
      '<div style="display:flex;align-items:flex-start;gap:8px;margin:4px 0;">' +
      '<input type="checkbox" style="margin-top:4px;" />' +
      '<span>&nbsp;</span></div>'
    exec('insertHTML', html)
  }, [exec])

  /** Prompt for a URL and wrap the selection in an <a>. */
  const applyLink = useCallback((): void => {
    const url = window.prompt('Link URL', 'https://')
    if (url === null || url.trim() === '') return
    exec('createLink', url.trim())
  }, [exec])

  if (pos === null) return null

  return (
    <div
      ref={rootRef}
      role="toolbar"
      aria-label="Format selection"
      onMouseDown={(e) => {
        // Prevent the toolbar itself from stealing the text selection
        // when the user clicks a button — keeps execCommand targeting
        // the highlighted text, not the button.
        e.preventDefault()
      }}
      style={{ top: pos.top, left: pos.left, width: 360 }}
      className="fixed z-[80] flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-1 shadow-2xl"
    >
      <BubbleBtn label="Bold (Ctrl+B)" onClick={() => exec('bold')}>
        <Bold className="h-3.5 w-3.5" />
      </BubbleBtn>
      <BubbleBtn label="Italic (Ctrl+I)" onClick={() => exec('italic')}>
        <Italic className="h-3.5 w-3.5" />
      </BubbleBtn>
      <BubbleBtn label="Underline (Ctrl+U)" onClick={() => exec('underline')}>
        <Underline className="h-3.5 w-3.5" />
      </BubbleBtn>
      <BubbleBtn label="Strikethrough" onClick={() => exec('strikeThrough')}>
        <Strikethrough className="h-3.5 w-3.5" />
      </BubbleBtn>
      <div className="mx-0.5 h-4 w-px bg-slate-200" />
      <BubbleBtn label="Bullet list" onClick={() => exec('insertUnorderedList')}>
        <List className="h-3.5 w-3.5" />
      </BubbleBtn>
      <BubbleBtn label="Numbered list" onClick={() => exec('insertOrderedList')}>
        <ListOrdered className="h-3.5 w-3.5" />
      </BubbleBtn>
      <BubbleBtn label="Checklist" onClick={insertChecklist}>
        <CheckSquare className="h-3.5 w-3.5" />
      </BubbleBtn>
      <div className="mx-0.5 h-4 w-px bg-slate-200" />
      <div className="relative">
        <BubbleBtn label="Text colour" onClick={() => setColorOpen((v) => !v)}>
          <span className="relative inline-flex flex-col items-center">
            <Type className="h-3.5 w-3.5" />
            <span className="mt-[-1px] block h-[2.5px] w-3.5 rounded-sm bg-primary" />
          </span>
        </BubbleBtn>
        {colorOpen && (
          <div className="absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 rounded-md border border-slate-200 bg-white p-1.5 shadow-lg">
            <div className="grid grid-cols-8 gap-1">
              {COLOURS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  title={c.name}
                  onClick={() => {
                    exec('foreColor', c.hex)
                    setColorOpen(false)
                  }}
                  className="h-5 w-5 rounded-full border border-slate-200 transition hover:scale-110"
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <BubbleBtn label="Highlight" onClick={() => exec('hiliteColor', '#fef08a')}>
        <Palette className="h-3.5 w-3.5" />
      </BubbleBtn>
      <BubbleBtn label="Link (Ctrl+K)" onClick={applyLink}>
        <LinkIcon className="h-3.5 w-3.5" />
      </BubbleBtn>
    </div>
  )
}

function BubbleBtn({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-700 transition hover:bg-slate-100 active:scale-95"
    >
      {children}
    </button>
  )
}
