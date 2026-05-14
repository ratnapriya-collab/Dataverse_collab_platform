'use client'

import { useEffect } from 'react'
import { CheckCircle2, XCircle, Info } from 'lucide-react'

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastState {
  message: string
  tone: ToastTone
}

interface Props {
  toast: ToastState | null
  onClose: () => void
  /** Auto-dismiss after this many ms. Default 2500. */
  durationMs?: number
}

const TONE_CLASSES: Record<ToastTone, { wrap: string; icon: string }> = {
  success: {
    wrap: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    icon: 'text-emerald-600',
  },
  error: {
    wrap: 'border-red-200 bg-red-50 text-red-900',
    icon: 'text-red-600',
  },
  info: {
    wrap: 'border-slate-200 bg-white text-slate-900',
    icon: 'text-slate-600',
  },
}

const ICONS: Record<ToastTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
}

export default function Toast({ toast, onClose, durationMs = 2500 }: Props) {
  useEffect(() => {
    if (toast === null) return
    const id = window.setTimeout(onClose, durationMs)
    return () => window.clearTimeout(id)
  }, [toast, onClose, durationMs])

  if (toast === null) return null
  const cls = TONE_CLASSES[toast.tone]
  const Icon = ICONS[toast.tone]
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-auto flex items-center gap-2.5 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-lg ${cls.wrap}`}
      >
        <Icon className={`h-4 w-4 shrink-0 ${cls.icon}`} />
        <span>{toast.message}</span>
      </div>
    </div>
  )
}
