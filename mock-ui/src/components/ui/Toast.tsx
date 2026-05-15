'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Check, Info, X, AlertCircle } from 'lucide-react'

export type ToastTone = 'success' | 'info' | 'error'

interface ToastItem {
  id: number
  tone: ToastTone
  message: string
  description?: string
}

interface ToastContext {
  toast: (msg: string, opts?: { tone?: ToastTone; description?: string }) => void
}

const Ctx = createContext<ToastContext | null>(null)

export function useToast(): ToastContext {
  const ctx = useContext(Ctx)
  if (ctx === null) throw new Error('useToast must be inside <ToastProvider />')
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const toast = useCallback<ToastContext['toast']>((message, opts) => {
    const id = Date.now() + Math.random()
    setItems((prev) => [...prev, { id, tone: opts?.tone ?? 'success', message, description: opts?.description }])
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, 4200)
  }, [])

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed bottom-6 right-6 z-[200] flex w-full max-w-sm flex-col gap-2"
      >
        {items.map((t) => (
          <ToastCard key={t.id} item={t} onDismiss={() => setItems((p) => p.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </Ctx.Provider>
  )
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  // Trigger the fade-in by mounting fresh
  useEffect(() => {}, [])
  const TONE: Record<ToastTone, { bg: string; icon: typeof Check; ring: string }> = {
    success: { bg: 'bg-white', icon: Check, ring: 'ring-state-accepted/40 text-state-accepted' },
    info: { bg: 'bg-white', icon: Info, ring: 'ring-accent/40 text-accent' },
    error: { bg: 'bg-white', icon: AlertCircle, ring: 'ring-state-rejected/40 text-state-rejected' },
  }
  const t = TONE[item.tone]
  const Icon = t.icon
  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 rounded-lg border border-rule p-3 shadow-pop animate-slide-in-right ${t.bg}`}
    >
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-2 ${t.ring}`}>
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{item.message}</p>
        {item.description !== undefined && (
          <p className="mt-0.5 text-xs text-ink-mute">{item.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="-mr-1 -mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-mute hover:bg-rule-soft hover:text-ink focus-ring"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
