import type { DecisionState } from '@/lib/mock-data'

interface Props {
  state: DecisionState
  size?: 'sm' | 'md'
}

const STATE: Record<DecisionState, { label: string; bg: string; dot: string }> = {
  PROPOSED: { label: 'Proposed', bg: 'bg-state-proposed/12 text-state-proposed border-state-proposed/30', dot: 'bg-state-proposed' },
  ACCEPTED: { label: 'Accepted', bg: 'bg-state-accepted/12 text-state-accepted border-state-accepted/30', dot: 'bg-state-accepted' },
  REJECTED: { label: 'Rejected', bg: 'bg-state-rejected/12 text-state-rejected border-state-rejected/30', dot: 'bg-state-rejected' },
  SUPERSEDED: { label: 'Superseded', bg: 'bg-state-superseded/15 text-state-superseded border-state-superseded/30', dot: 'bg-state-superseded' },
}

export default function StatePill({ state, size = 'sm' }: Props) {
  const s = STATE[state]
  const sizing = size === 'sm' ? 'text-[10px] px-2 py-0.5 gap-1.5' : 'text-xs px-2.5 py-1 gap-2'
  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold uppercase tracking-wide ${s.bg} ${sizing}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
      {s.label}
    </span>
  )
}
