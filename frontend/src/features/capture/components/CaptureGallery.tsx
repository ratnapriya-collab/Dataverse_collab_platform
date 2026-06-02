'use client'

/**
 * CaptureGallery — slide-in side panel listing every capture for this part.
 *
 * Container of state hooks; CaptureThumbnail handles per-row UI.
 *
 * Empty state nudges the user toward the Capture button on the viewer.
 * Footer shows "Export to PDF" once there's at least one capture.
 */

import { useState } from 'react'
import { AlertCircle, Camera, ImageOff, Loader2, X } from 'lucide-react'
import { useCaptureStore } from '../store/captureStore'
import { useRestoreView } from '../hooks/useRestoreView'
import type { Capture } from '../types/capture.types'
import CaptureThumbnail from './CaptureThumbnail'
import ExportPdfButton from './ExportPdfButton'

interface Props {
  open: boolean
  onClose: () => void
  partName: string
}

export default function CaptureGallery({ open, onClose, partName }: Props): JSX.Element | null {
  const captures = useCaptureStore((s) => s.captures)
  const loading = useCaptureStore((s) => s.loading)
  const error = useCaptureStore((s) => s.error)
  const updateCaption = useCaptureStore((s) => s.updateCaption)
  const remove = useCaptureStore((s) => s.remove)
  const reorder = useCaptureStore((s) => s.reorder)
  const clear = useCaptureStore((s) => s.clear)
  const { restoreView } = useRestoreView()

  // Drag state lives here (parent) so siblings can highlight drop targets.
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  // Which thumb is currently animating, if any — drives the per-row spinner.
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const handleRestoreView = async (capture: Capture): Promise<void> => {
    if (restoringId !== null) return // ignore double-clicks during an animation
    setRestoringId(capture.id)
    try {
      await restoreView(capture)
    } catch (err) {
      // Surfacing via the store's error channel keeps the banner UI consistent
      // with delete/reorder/caption failures. Falling through to alert if the
      // store isn't sure how to display it.
      // eslint-disable-next-line no-console
      console.error('Restore view failed', err)
      window.alert(
        `Couldn't restore view: ${err instanceof Error ? err.message : 'unknown error'}`,
      )
    } finally {
      setRestoringId(null)
    }
  }

  if (!open) return null

  return (
    <aside
      role="dialog"
      aria-label="Captured views"
      className="dv-anim-fade-up fixed right-0 top-0 z-30 flex h-screen w-[360px] flex-col border-l border-slate-200 bg-white shadow-2xl"
    >
      {/* Header */}
      <header className="flex items-center gap-2 border-b border-slate-200 bg-gradient-to-r from-primary/5 to-brand/5 px-4 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-primary to-brand text-white shadow-sm">
          <Camera className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold text-slate-900">Captured views</p>
          <p className="text-[10.5px] text-slate-500">
            {captures.length} capture{captures.length === 1 ? '' : 's'} · {partName}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close gallery"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* Body */}
      <div className="dv-thin-scroll flex-1 overflow-y-auto px-3 py-3">
        {/* Inline error banner — surfaces store.error from server failures. */}
        {error !== null && (
          <div
            role="alert"
            className="mb-2 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] text-rose-700"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {loading && captures.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-12 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            <p className="mt-2 text-[11px] text-slate-500">Loading captures…</p>
          </div>
        ) : captures.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-12 text-center">
            <ImageOff className="h-6 w-6 text-slate-300" />
            <p className="mt-2 text-[12px] font-semibold text-slate-700">No captures yet</p>
            <p className="mt-1 max-w-[220px] text-[10.5px] leading-relaxed text-slate-500">
              Rotate to the angle you want, then click{' '}
              <strong className="font-bold text-slate-700">Capture view</strong> on the viewer.
              Captures persist to your account — they&apos;ll be here next time too.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {captures.map((c, i) => (
              <CaptureThumbnail
                key={c.id}
                capture={c}
                index={i}
                total={captures.length}
                onUpdateCaption={updateCaption}
                onRemove={remove}
                onReorder={reorder}
                onRestoreView={handleRestoreView}
                isRestoring={restoringId === c.id}
                isBeingDragged={draggingIndex === i}
                isDropTarget={draggingIndex !== null && draggingIndex !== i}
                setDraggingIndex={setDraggingIndex}
                draggingIndex={draggingIndex}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Footer — Export PDF when there's content */}
      {captures.length > 0 && (
        <footer className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/60 px-4 py-3">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Clear all captured views? This cannot be undone.')) {
                clear()
              }
            }}
            className="text-[11px] font-semibold text-slate-500 transition hover:text-rose-600"
          >
            Clear all
          </button>
          <ExportPdfButton partName={partName} />
        </footer>
      )}
    </aside>
  )
}
