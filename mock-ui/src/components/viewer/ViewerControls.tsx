'use client'

import { Maximize2, Minus, Plus, RotateCcw } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

/** Decorative viewer controls — don't actually transform the static SVG. */
export default function ViewerControls() {
  const { toast } = useToast()
  const ping = (cmd: string) =>
    toast(`${cmd}`, { tone: 'info', description: 'Demo mode — viewer is static.' })

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-p-rule bg-p-surface/80 p-1 shadow-pop backdrop-blur-sm">
      <IconBtn label="Zoom in" onClick={() => ping('Zoom in')}>
        <Plus className="h-3.5 w-3.5" />
      </IconBtn>
      <IconBtn label="Zoom out" onClick={() => ping('Zoom out')}>
        <Minus className="h-3.5 w-3.5" />
      </IconBtn>
      <span className="mx-1 my-0.5 h-px bg-p-rule" />
      <IconBtn label="Reset view" onClick={() => ping('Reset view')}>
        <RotateCcw className="h-3.5 w-3.5" />
      </IconBtn>
      <IconBtn label="Fit to screen" onClick={() => ping('Fit to screen')}>
        <Maximize2 className="h-3.5 w-3.5" />
      </IconBtn>
    </div>
  )
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded text-p-text/70 transition-colors hover:bg-white/10 hover:text-p-text focus-ring"
    >
      {children}
    </button>
  )
}
