'use client'

/**
 * ImageContextToolbar — Notion / Quarter20-style floating action bar
 * that pops above the currently-hovered image inside the doc editor.
 *
 * Actions:
 *   · Caption       — toggle an editable <figcaption> under the image
 *   · Comment pin   — arm pin-drop mode, next click on the image places
 *                     a numbered marker at that location
 *   · Replace       — swap the image src via file picker
 *   · Draw          — hands off to the Pencil tool (annotate mode)
 *   · View 3D       — placeholder link to open the source CAD viewer
 *   · Delete        — remove the image wrapper (including strokes/pins)
 *
 * All actions mutate the DOM directly (the image is inside a
 * contentEditable), then call onAfterChange() so the parent persists.
 */

import { useEffect, useRef, useState } from 'react'
import {
  Type,
  MessageSquarePlus,
  Replace,
  Pencil,
  Box,
  Trash2,
  X,
} from 'lucide-react'

interface Props {
  /** Client-viewport coords of the hovered image's top-right corner. */
  anchor: { x: number; y: number } | null
  /** The <img> being acted on. Toolbar disables itself when this
   *  reference goes stale (image removed / editor cleared). */
  img: HTMLImageElement | null
  /** True while pencil (draw) mode is active — button reflects state. */
  drawActive: boolean
  /** Toggle pencil mode from the toolbar's Draw button. */
  onToggleDraw: () => void
  /** Arm pin-drop mode — parent handles the next-click on the image. */
  onArmPinDrop: () => void
  /** Called after any DOM change so the parent can autosave. */
  onAfterChange: () => void
  /** Called when the toolbar wants to be hidden. */
  onClose: () => void
}

export default function ImageContextToolbar({
  anchor,
  img,
  drawActive,
  onToggleDraw,
  onArmPinDrop,
  onAfterChange,
  onClose,
}: Props): JSX.Element | null {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [confirming, setConfirming] = useState(false)

  // Reset confirm state whenever the target image changes.
  useEffect(() => {
    setConfirming(false)
  }, [img])

  if (anchor === null || img === null) return null

  /** Toggle a figcaption editable line beneath the image. If the image
   *  is a bare <img>, wrap it in a <figure> first. Existing captions
   *  are removed on second click. */
  const toggleCaption = (): void => {
    const wrap = img.closest('.dv-annotatable') as HTMLElement | null
    // A figure is our caption container. If the image is inside .dv-annotatable
    // we place the figcaption AFTER the wrapper (since caption should sit
    // outside the pencil overlay), grouping them inside a <figure> block.
    const target = wrap ?? img
    let figure = target.closest('figure.dv-figure') as HTMLElement | null
    if (figure !== null) {
      // Toggle off — unwrap.
      const cap = figure.querySelector('figcaption')
      if (cap !== null) cap.remove()
      figure.replaceWith(...Array.from(figure.childNodes))
      onAfterChange()
      onClose()
      return
    }
    // Wrap target in a new <figure> with a figcaption.
    figure = document.createElement('figure')
    figure.className = 'dv-figure'
    figure.setAttribute('contenteditable', 'false')
    const parent = target.parentNode
    if (parent === null) return
    parent.insertBefore(figure, target)
    figure.appendChild(target)
    const cap = document.createElement('figcaption')
    cap.className = 'dv-figcaption'
    cap.setAttribute('contenteditable', 'true')
    cap.setAttribute('data-placeholder', 'Add a caption…')
    // Auto-fill with a timestamp on first insertion — matches the
    // Quarter20 pattern of "Apr 23, 2026 09:07 AM" under each image.
    cap.textContent = formatNow()
    figure.appendChild(cap)
    onAfterChange()
  }

  /** Replace the image via file picker — reads the selected file as a
   *  data URL and swaps the src (keeps the wrapper / caption / pins). */
  const replaceImage = (): void => {
    if (fileRef.current === null) return
    fileRef.current.value = ''
    fileRef.current.click()
  }
  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const f = e.target.files?.[0]
    if (f === undefined) return
    const reader = new FileReader()
    reader.onload = (): void => {
      if (typeof reader.result !== 'string') return
      img.src = reader.result
      onAfterChange()
    }
    reader.readAsDataURL(f)
  }

  /** Delete the entire figure / annotatable wrapper (image + strokes
   *  + pins + caption). Requires a confirm click first. */
  const deleteImage = (): void => {
    if (!confirming) {
      setConfirming(true)
      return
    }
    const figure = img.closest('figure.dv-figure')
    const wrap = img.closest('.dv-annotatable')
    const target: HTMLElement | null =
      (figure as HTMLElement | null) ?? (wrap as HTMLElement | null) ?? img
    target.remove()
    onAfterChange()
    onClose()
  }

  return (
    <div
      role="toolbar"
      aria-label="Image actions"
      onMouseDown={(e) => e.preventDefault()}
      style={{ top: anchor.y - 44, left: anchor.x }}
      className="fixed z-[90] flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-1 shadow-2xl"
    >
      <IconBtn label="Caption" onClick={toggleCaption}>
        <Type className="h-3.5 w-3.5" />
      </IconBtn>
      <IconBtn label="Add comment pin" onClick={onArmPinDrop}>
        <MessageSquarePlus className="h-3.5 w-3.5" />
      </IconBtn>
      <IconBtn label="Replace image" onClick={replaceImage}>
        <Replace className="h-3.5 w-3.5" />
      </IconBtn>
      <IconBtn
        label={drawActive ? 'Turn off pencil' : 'Draw on image'}
        onClick={onToggleDraw}
        active={drawActive}
      >
        <Pencil className="h-3.5 w-3.5" />
      </IconBtn>
      <IconBtn label="View in 3D viewer" onClick={() => {
        // Anchor is a click hint; the actual 3D viewer link lives on the
        // parent Part page. Fire a document event the host can listen for.
        img.dispatchEvent(new CustomEvent('dv:image:open-in-3d', { bubbles: true }))
      }}>
        <Box className="h-3.5 w-3.5" />
      </IconBtn>
      <div className="mx-0.5 h-4 w-px bg-slate-200" />
      <IconBtn
        label={confirming ? 'Click again to confirm delete' : 'Delete image'}
        onClick={deleteImage}
        danger={confirming}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </IconBtn>
      <IconBtn label="Close toolbar" onClick={onClose}>
        <X className="h-3.5 w-3.5" />
      </IconBtn>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={onFilePicked}
      />
    </div>
  )
}

function IconBtn({
  label,
  onClick,
  children,
  active = false,
  danger = false,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  active?: boolean
  danger?: boolean
}): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={[
        'inline-flex h-7 w-7 items-center justify-center rounded transition active:scale-95',
        active
          ? 'bg-primary text-white'
          : danger
            ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
            : 'text-slate-700 hover:bg-slate-100',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

/** Format the current date/time like "Apr 23, 2026 09:07 AM" — matches
 *  the Quarter20 caption style shown in the reference screenshot. */
function formatNow(): string {
  const d = new Date()
  const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]
  const hh = d.getHours()
  const mm = String(d.getMinutes()).padStart(2, '0')
  const hr12 = ((hh + 11) % 12) + 1
  const ampm = hh >= 12 ? 'PM' : 'AM'
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${String(hr12).padStart(2, '0')}:${mm} ${ampm}`
}
