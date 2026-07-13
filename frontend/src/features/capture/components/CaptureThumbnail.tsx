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
import { useRouter } from 'next/navigation'
import { FileText, GripVertical, History, Loader2, Trash2 } from 'lucide-react'
import type { Capture } from '../types/capture.types'
import { appendImageToDoc } from '../lib/sendToDoc'

interface Props {
  capture: Capture
  index: number
  total: number
  // Store actions are async (server round-trip), but we treat them as
  // fire-and-forget here — store handles optimistic UI + rollback on error.
  onUpdateCaption: (id: string, caption: string) => void | Promise<void>
  onRemove: (id: string) => void | Promise<void>
  onReorder: (fromIdx: number, toIdx: number) => void | Promise<void>
  /** Restore the 3D viewer to this capture's saved view state. */
  onRestoreView: (capture: Capture) => void | Promise<void>
  /** True while this thumbnail's restore animation is running. */
  isRestoring?: boolean
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
  onRestoreView,
  isRestoring = false,
  isBeingDragged = false,
  isDropTarget = false,
  setDraggingIndex,
  draggingIndex,
}: Props): JSX.Element {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(capture.caption)
  // Local "sending to doc" state — drives the button spinner and the
  // "✓ Sent" flash so the user gets clear feedback even though the
  // action is instant (localStorage write).
  const [sending, setSending] = useState(false)
  const [sentFlash, setSentFlash] = useState(false)

  const commitCaption = (): void => {
    setEditing(false)
    if (draft.trim() !== capture.caption) onUpdateCaption(capture.id, draft.trim())
  }

  /** Ship this capture to the Part's doc editor and jump to the doc.
   *  The image lands inside a <figure> with the same annotatable shell
   *  as images inserted via the doc's own image button, so Pencil /
   *  Pin / Caption tools work on it immediately. */
  const sendToDoc = async (): Promise<void> => {
    if (sending) return
    setSending(true)
    try {
      await appendImageToDoc(capture.id, {
        partId: capture.partId,
        caption: capture.caption,
        width: capture.width,
        height: capture.height,
      })
      setSentFlash(true)
      // Show the ✓ flash for 600ms, then navigate the user to the doc
      // so they can see the freshly-added image in context.
      window.setTimeout(() => {
        router.push(`/parts/${capture.partId}/doc`)
      }, 600)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[capture→doc] send failed', err)
      window.alert(
        `Couldn't send to doc: ${err instanceof Error ? err.message : 'unknown error'}`,
      )
      setSending(false)
    }
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

      {/* Thumbnail — also the "Restore View" affordance. Clicking flies
          the 3D viewer back to the camera + display state that was active
          at capture time. */}
      <div className="shrink-0">
        <button
          type="button"
          onClick={() => onRestoreView(capture)}
          disabled={isRestoring || capture.camera === null}
          aria-label={`Restore view ${index + 1}`}
          title={
            capture.camera === null
              ? 'View state was not captured for this snapshot'
              : 'Restore this view in the 3D viewer'
          }
          className={[
            'group/restore relative block h-16 w-24 overflow-hidden rounded border bg-slate-100 transition focus:outline-none focus:ring-2 focus:ring-primary/40',
            isRestoring
              ? 'border-primary ring-2 ring-primary/40'
              : 'border-slate-200 hover:border-primary/60',
            capture.camera === null ? 'cursor-not-allowed' : 'cursor-pointer',
          ].join(' ')}
        >
          <img
            src={capture.previewUrl}
            alt={capture.caption !== '' ? capture.caption : `Capture ${index + 1}`}
            width={96}
            height={64}
            loading="lazy"
            className="block h-full w-full object-cover transition group-hover/restore:scale-105"
          />
          {/* Hover overlay — only shown when restoring is possible. */}
          {capture.camera !== null && !isRestoring && (
            <span
              aria-hidden="true"
              className="absolute inset-0 flex items-center justify-center bg-slate-900/55 opacity-0 transition group-hover/restore:opacity-100"
            >
              <span className="flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary shadow-sm">
                <History className="h-2.5 w-2.5" />
                Restore
              </span>
            </span>
          )}
          {/* Active state — spinner while the camera tweens. */}
          {isRestoring && (
            <span
              aria-hidden="true"
              className="absolute inset-0 flex items-center justify-center bg-primary/30 backdrop-blur-[1px]"
            >
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            </span>
          )}
        </button>
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

      {/* Action cluster — Send-to-doc + Remove.
          Send-to-doc is always visible (primary "submit" affordance),
          Remove appears on hover.

          The send button flips through three visual states:
            · idle   → paper-icon + tooltip "Send to doc"
            · sending → spinner (transient, ~300ms)
            · sent   → green ✓ flash (~600ms) before navigating away  */}
      <div className="flex shrink-0 flex-col items-center gap-1 self-start">
        <button
          type="button"
          onClick={sendToDoc}
          disabled={sending}
          aria-label={`Send capture ${index + 1} to doc`}
          title={sentFlash ? 'Sent!' : 'Send this screenshot to the doc'}
          className={[
            'flex h-6 w-6 items-center justify-center rounded transition',
            sentFlash
              ? 'bg-emerald-500 text-white'
              : sending
                ? 'bg-primary/20 text-primary'
                : 'text-primary hover:bg-primary/10',
          ].join(' ')}
        >
          {sending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : sentFlash ? (
            <span className="text-[10px] font-black leading-none">✓</span>
          ) : (
            <FileText className="h-3 w-3" />
          )}
        </button>
        <button
          type="button"
          onClick={() => onRemove(capture.id)}
          aria-label={`Remove capture ${index + 1}`}
          className="flex h-6 w-6 items-center justify-center rounded text-slate-400 opacity-0 transition focus:opacity-100 hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </li>
  )
}
