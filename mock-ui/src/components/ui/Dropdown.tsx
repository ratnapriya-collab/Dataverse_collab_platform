'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, Check } from 'lucide-react'

interface Option<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  value: T
  onChange: (v: T) => void
  options: ReadonlyArray<Option<T>>
  placeholder?: string
  size?: 'sm' | 'md'
  className?: string
  /** Optional render override for the trigger label. */
  triggerLabel?: ReactNode
}

export default function Dropdown<T extends string>({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  size = 'md',
  className = '',
  triggerLabel,
}: Props<T>) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const sizing = size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-3 text-sm'
  const selected = options.find((o) => o.value === value)

  return (
    <div ref={wrapRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 rounded border border-rule bg-white text-ink hover:border-ink-mute/50 focus-ring transition-colors ${sizing}`}
      >
        <span className="truncate text-left">
          {triggerLabel ?? selected?.label ?? <span className="text-ink-mute">{placeholder}</span>}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-ink-mute transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 max-h-64 min-w-[8rem] overflow-y-auto rounded border border-rule bg-white py-1 shadow-pop animate-fade-in thin-scroll"
        >
          {options.map((opt) => {
            const active = opt.value === value
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm transition-colors ${
                    active ? 'bg-accent-soft text-accent' : 'text-ink hover:bg-rule-soft'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {active && <Check className="h-3.5 w-3.5 text-accent" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
