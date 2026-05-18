/**
 * PriorityIndicator — colored dot + label for issue priority.
 *
 *   blocker  bright red, animated dot (urgent)
 *   high     rose
 *   medium   amber
 *   low      slate
 */

import type { IssuePriority } from '@/lib/mockWorkspace'

interface Tone {
  bg: string
  fg: string
  ring: string
  dot: string
  /** Bar shown to the left of the row in the table — adds quick visual scan. */
  bar: string
  label: string
}

const PRIORITY_TONES: Record<IssuePriority, Tone> = {
  blocker: {
    bg: 'bg-rose-100',
    fg: 'text-rose-800',
    ring: 'ring-rose-300',
    dot: 'bg-rose-600',
    bar: 'bg-rose-500',
    label: 'Blocker',
  },
  high: {
    bg: 'bg-rose-50',
    fg: 'text-rose-700',
    ring: 'ring-rose-200',
    dot: 'bg-rose-500',
    bar: 'bg-rose-400',
    label: 'High',
  },
  medium: {
    bg: 'bg-amber-50',
    fg: 'text-amber-800',
    ring: 'ring-amber-200',
    dot: 'bg-amber-500',
    bar: 'bg-amber-400',
    label: 'Medium',
  },
  low: {
    bg: 'bg-slate-100',
    fg: 'text-slate-600',
    ring: 'ring-slate-200',
    dot: 'bg-slate-400',
    bar: 'bg-slate-300',
    label: 'Low',
  },
}

interface Props {
  priority?: IssuePriority
  size?: 'sm' | 'md'
  className?: string
}

export default function PriorityIndicator({
  priority,
  size = 'sm',
  className = '',
}: Props): JSX.Element {
  if (priority === undefined) {
    return <span className={`text-[11px] text-slate-400 ${className}`}>—</span>
  }
  const t = PRIORITY_TONES[priority]
  const sizing = size === 'sm' ? 'text-[10px] px-1.5 py-0.5 gap-1' : 'text-xs px-2 py-1 gap-1.5'
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold uppercase tracking-wider ring-1 ${t.bg} ${t.fg} ${t.ring} ${sizing} ${className}`}
    >
      <span
        className={`relative h-1.5 w-1.5 rounded-full ${t.dot}`}
        aria-hidden="true"
      >
        {priority === 'blocker' && (
          <span className="absolute inset-0 animate-ping rounded-full bg-rose-400 opacity-75" />
        )}
      </span>
      {t.label}
    </span>
  )
}

/** Reusable list of every IssuePriority for filter dropdowns. */
export const ALL_PRIORITIES: IssuePriority[] = ['blocker', 'high', 'medium', 'low']

/** Get just the left-edge bar tone for a priority — used by the row strip. */
export function priorityBarClass(priority?: IssuePriority): string {
  if (priority === undefined) return 'bg-slate-200'
  return PRIORITY_TONES[priority].bar
}
