/**
 * IssueTagChip — colored label chip for the Feedback issue table.
 *
 * Tag → tone mapping matches the CoLab palette: DFM blue, Manufacturing
 * emerald, Machining cyan, Tolerancing violet, Sourcing amber,
 * Materials rose, Complexity tied to severity, Blocker red.
 */

import type { IssueTag } from '@/lib/mockWorkspace'

interface Tone {
  bg: string
  fg: string
  ring: string
  dot: string
}

const TAG_TONES: Record<IssueTag, Tone> = {
  DFM: { bg: 'bg-blue-50', fg: 'text-blue-700', ring: 'ring-blue-200', dot: 'bg-blue-500' },
  Manufacturing: { bg: 'bg-emerald-50', fg: 'text-emerald-700', ring: 'ring-emerald-200', dot: 'bg-emerald-500' },
  Machining: { bg: 'bg-cyan-50', fg: 'text-cyan-700', ring: 'ring-cyan-200', dot: 'bg-cyan-500' },
  Tolerancing: { bg: 'bg-violet-50', fg: 'text-violet-700', ring: 'ring-violet-200', dot: 'bg-violet-500' },
  Sourcing: { bg: 'bg-amber-50', fg: 'text-amber-800', ring: 'ring-amber-200', dot: 'bg-amber-500' },
  Materials: { bg: 'bg-rose-50', fg: 'text-rose-700', ring: 'ring-rose-200', dot: 'bg-rose-500' },
  'Complexity: High': { bg: 'bg-rose-50', fg: 'text-rose-700', ring: 'ring-rose-200', dot: 'bg-rose-500' },
  'Complexity: Medium': { bg: 'bg-amber-50', fg: 'text-amber-800', ring: 'ring-amber-200', dot: 'bg-amber-500' },
  'Complexity: Low': { bg: 'bg-emerald-50', fg: 'text-emerald-700', ring: 'ring-emerald-200', dot: 'bg-emerald-500' },
  Blocker: { bg: 'bg-rose-100', fg: 'text-rose-800', ring: 'ring-rose-300', dot: 'bg-rose-600' },
  'Cost Reduction': { bg: 'bg-emerald-50', fg: 'text-emerald-700', ring: 'ring-emerald-200', dot: 'bg-emerald-500' },
  VAVE: { bg: 'bg-pink-50', fg: 'text-pink-700', ring: 'ring-pink-200', dot: 'bg-pink-500' },
}

interface Props {
  tag: IssueTag
  size?: 'sm' | 'md'
  className?: string
}

export default function IssueTagChip({ tag, size = 'sm', className = '' }: Props): JSX.Element {
  const t = TAG_TONES[tag]
  const sizing = size === 'sm' ? 'text-[10px] px-1.5 py-0.5 gap-1' : 'text-xs px-2 py-1 gap-1.5'
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ring-1 ${t.bg} ${t.fg} ${t.ring} ${sizing} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} aria-hidden="true" />
      {tag}
    </span>
  )
}

/** Reusable list of every IssueTag, for filter dropdowns. */
export const ALL_TAGS: IssueTag[] = [
  'Blocker',
  'DFM',
  'Manufacturing',
  'Machining',
  'Tolerancing',
  'Sourcing',
  'Materials',
  'Complexity: High',
  'Complexity: Medium',
  'Complexity: Low',
  'Cost Reduction',
  'VAVE',
]
