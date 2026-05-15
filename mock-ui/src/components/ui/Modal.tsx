'use client'

import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: ReactNode
  /** Tailwind max-width class, default max-w-lg. */
  maxWidth?: string
  /** Optional sticky footer (typically Cancel + Submit). */
  footer?: ReactNode
}

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-lg',
  footer,
}: Props) {
  // ESC to close + lock body scroll while open
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto px-4 py-12"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 bg-ink/30 backdrop-blur-sm animate-fade-in"
      />
      <div
        className={`relative z-10 w-full ${maxWidth} animate-scale-in overflow-hidden rounded-lg border border-rule bg-white shadow-pop`}
      >
        {(title !== undefined || subtitle !== undefined) && (
          <header className="flex items-start justify-between gap-4 border-b border-rule px-5 py-4">
            <div className="min-w-0">
              {title !== undefined && (
                <h2 className="text-base font-bold tracking-tight text-ink">{title}</h2>
              )}
              {subtitle !== undefined && (
                <p className="mt-0.5 text-xs text-ink-mute">{subtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-ink-mute hover:bg-rule-soft hover:text-ink focus-ring"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer !== undefined && (
          <footer className="flex items-center justify-end gap-2 border-t border-rule bg-rule-soft/40 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}
