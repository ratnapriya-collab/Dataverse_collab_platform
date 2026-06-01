'use client'

/**
 * CaptureThumbnail — one row in the gallery.
 *   · Image preview (loaded from blob URL — cheap memory)
 *   · Caption (editable inline)
 *   · Remove button
 *   · Native HTML5 drag handle for reordering
 *
 * Native drag-and-drop is chosen over @dnd-kit because the gallery is at
 * most ~30 items and the UX is light — full-fat drag-drop libs would be
 * 30KB+ to solve a problem we get for free in vanilla.
 *
 * Accessibility:
 *   · Image has alt text (caption or default)
 *   · Drag handle has aria-grabbed (set by the parent on dragstart)
 *   · Keyboard-fallback: Alt+↑ / Alt+↓ to reorder (handled by parent)
 *   · Remove button is focusable + has descriptive aria-label
 */

import { useState, type DragEvent } from 'react'
import { GripVertical, Trash2 } from 'lucide-react'
import type { Capture } from '../types/capture.types'

interface Props {
  capture: Capture
  index: number
  total: number
  onUpdateCaption: (id: string, caption: string) => void
  onRemove: (id: string) => void
  onReorder: (fromIdx: number, toIdx: number) => void
  /** When this thumb is mid-drag, we paint a dotted outline. */
  isBeingDragged?: boolean
  /** When something else is hovering over this thumb during drag. */
  isDropTarget?: boolean
  /** From parent — drag state setters so the grid can know whose drag is active. */
  setDraggingIndex: (idx: number | null) => void
  draggingIndex: number | null
}

export default function CaptureThumbnail({
  capture,
  index,
  total,
  onUpdateCaption,
  onRemove,
  onReorder,
  isBeingDragged = false,
  isDropTarget = false,
  setDraggingIndex,
  draggingIndex,
}: Props): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(capture.caption)

  const commitCaption = (): void => {
    setEditing(false)
    if (draft.trim() !== capture.caption) onUpdateCaption(capture.id, draft.trim())
  }

  // ── Drag-and-drop handlers ──────────────────────────────────────────────

  const handleDragStart = (e: DragEvent<HTMLLIElement>): void => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
    setDraggingIndex(index)
  }

  const handleDragOver = (e: DragEvent<HTMLLIElement>): void => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: DragEvent<HTMLLIElement>): void => {
    e.preventDefault()
    const fromIdx = Number(e.dataTransfer.getData('text/plain'))
    if (Number.isFinite(fromIdx) && fromIdx !== index) onReorder(fromIdx, index)
    setDraggingIndex(null)
  }

  const handleDragEnd = (): void => setDraggingIndex(null)

  return (
    <li
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
      aria-grabbed={isBeingDragged}
      aria-label={`Capture ${index + 1} of ${total}${capture.caption !== '' ? `: ${capture.caption}` : ''}`}
      className={[
        'group flex gap-2 rounded-lg border bg-white p-2 transition',
        isBeingDragged
          ? 'border-dashed border-primary/40 opacity-60'
          : 'border-slate-200 hover:border-slate-300',
        isDropTarget && draggingIndex !== null && draggingIndex !== index
          ? 'ring-2 ring-primary/40'
          : '',
      ].join(' ')}
    >
      {/* Drag handle — purely visual cue. The whole row is draggable. */}
      <span
        aria-hidden="true"
        className="flex w-4 shrink-0 cursor-grab items-center justify-center text-slate-300 transition group-hover:text-slate-500"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </span>

      {/* Thumbnail — fixed aspect, blob URL src */}
      <div className="shrink-0">
        <img
          src={capture.previewUrl}
          alt={capture.caption !== '' ? capture.caption : `Capture ${index + 1}`}
          width={96}
          height={64}
          loading="lazy"
          className="block h-16 w-24 rounded border border-slate-200 bg-slate-100 object-cover"
        />
      </div>

      {/* Caption + meta */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="font-mono text-[9px] font-bold text-slate-400">
            #{String(index + 1).padStart(2, '0')}
          </span>
          <span className="text-[9px] text-slate-400">
            {capture.width}×{capture.height}
          </span>
          <span className="text-[9px] text-slate-300">·</span>
          <time className="text-[9px] text-slate-400">
            {new Date(capture.capturedAt).toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>
        </div>
        {editing ? (
          <input
            type="text"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitCaption}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitCaption()
              else if (e.key === 'Escape') {
                setDraft(capture.caption)
                setEditing(false)
              }
            }}
            placeholder="Add a caption…"
            className="mt-0.5 w-full rounded border border-primary/30 bg-white px-1 py-0.5 text-[11px] focus:border-primary focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(capture.caption)
              setEditing(true)
            }}
            aria-label="Edit caption"
            className="mt-0.5 block w-full truncate rounded px-1 py-0.5 text-left text-[11px] text-slate-700 transition hover:bg-slate-50"
          >
            {capture.caption !== '' ? capture.caption : (
              <span className="italic text-slate-400">Add a caption…</span>
            )}
          </button>
        )}
      </div>

      {/* Remove button — appears on hover, keyboard-focusable always */}
      <button
        type="button"
        onClick={() => onRemove(capture.id)}
        aria-label={`Remove capture ${index + 1}`}
        className="flex h-6 w-6 shrink-0 items-center justify-center self-start rounded text-slate-400 opacity-0 transition focus:opacity-100 hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </li>
  )
}
