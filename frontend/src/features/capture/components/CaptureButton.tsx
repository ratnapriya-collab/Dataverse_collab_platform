'use client'

/**
 * CaptureButton — floating "Capture view" button on the 3D viewer.
 *
 * Two-state: idle / capturing. Disables while in-flight so a user can't
 * spam-click and create 20 captures in a frame. Errors are surfaced via
 * onError callback to whoever owns the toast.
 */

import { useState, type CSSProperties } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import type { Capture, CaptureOptions } from '../types/capture.types'

interface Props {
  onCapture: (options?: CaptureOptions) => Promise<Capture>
  onSuccess?: (capture: Capture) => void
  onError?: (err: Error) => void
  isReady: boolean
  /** Position override — defaults to absolute top-left, but the host page
   * sometimes wants it elsewhere on the viewer. */
  className?: string
  style?: CSSProperties
}

export default function CaptureButton({
  onCapture,
  onSuccess,
  onError,
  isReady,
  className,
  style,
}: Props): JSX.Element {
  const [busy, setBusy] = useState(false)

  const handle = async (): Promise<void> => {
    if (busy || !isReady) return
    setBusy(true)
    try {
      const cap = await onCapture()
      onSuccess?.(cap)
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy || !isReady}
      aria-label={busy ? 'Capturing view…' : 'Capture current view'}
      title={
        !isReady
          ? '3D viewer is still loading'
          : busy
            ? 'Capturing…'
            : 'Capture this view (no shortcut)'
      }
      className={[
        'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-md backdrop-blur transition',
        'hover:border-primary/40 hover:text-primary hover:shadow-lg',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className ?? '',
      ].join(' ')}
      style={style}
    >
      {busy ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Capturing…
        </>
      ) : (
        <>
          <Camera className="h-3.5 w-3.5 text-primary" />
          Capture view
        </>
      )}
    </button>
  )
}
