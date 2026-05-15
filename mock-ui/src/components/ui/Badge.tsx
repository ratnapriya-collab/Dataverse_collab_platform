import type { ReactNode } from 'react'

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

interface Props {
  tone?: Tone
  children: ReactNode
  className?: string
}

const TONE: Record<Tone, string> = {
  neutral: 'bg-rule-soft text-ink-soft border-rule',
  accent: 'bg-accent-soft text-accent border-accent/20',
  success: 'bg-state-accepted/10 text-state-accepted border-state-accepted/30',
  warning: 'bg-state-proposed/10 text-state-proposed border-state-proposed/30',
  danger: 'bg-state-rejected/10 text-state-rejected border-state-rejected/30',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
}

export default function Badge({ tone = 'neutral', children, className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TONE[tone]} ${className}`}
    >
      {children}
    </span>
  )
}
