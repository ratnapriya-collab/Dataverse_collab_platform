/**
 * TeamBadge — small coloured pill identifying which engineering team
 * someone belongs to. Drops into member rows, comment author lines,
 * activity feed entries, anywhere we render a person.
 */

import { TEAM_META, type EngineeringTeam } from '@/lib/mockWorkspace'

type BadgeSize = 'xs' | 'sm' | 'md'

const SIZE: Record<BadgeSize, { wrap: string; text: string }> = {
  xs: { wrap: 'h-4 px-1.5', text: 'text-[9px] tracking-wide' },
  sm: { wrap: 'h-5 px-1.5', text: 'text-[10px] tracking-wide' },
  md: { wrap: 'h-6 px-2', text: 'text-[11px] tracking-wider' },
}

interface Props {
  team: EngineeringTeam
  size?: BadgeSize
  /** Show the full label ("Design") instead of the 3-letter abbr ("DES"). */
  full?: boolean
  /** Subtle "dot" variant — just a coloured circle, no pill. Useful inline. */
  variant?: 'pill' | 'dot'
}

export default function TeamBadge({
  team,
  size = 'sm',
  full = false,
  variant = 'pill',
}: Props) {
  const meta = TEAM_META[team]

  if (variant === 'dot') {
    return (
      <span
        title={meta.label}
        aria-label={meta.label}
        className="inline-block h-2 w-2 rounded-full ring-2 ring-white"
        style={{ backgroundColor: meta.hex }}
      />
    )
  }

  const sz = SIZE[size]
  return (
    <span
      title={meta.label}
      className={[
        'inline-flex items-center rounded-full border font-semibold uppercase',
        sz.wrap,
        sz.text,
        meta.bg,
        meta.text,
        meta.border,
      ].join(' ')}
    >
      {full ? meta.label : meta.abbr}
    </span>
  )
}
