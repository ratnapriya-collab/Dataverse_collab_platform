/**
 * ConfidencePill — colored chip showing resolver confidence in [0, 1].
 *
 * Bands per the design tokens:
 *   green   ≥ 0.95
 *   yellow  0.7 – 0.95
 *   orange  0.5 – 0.7
 *   red     < 0.5
 *
 * Renders as `92% confidence` with a leading dot in the band colour.
 */

interface Props {
  confidence: number
  /** Optional resolver layer (1, 2 or 3) shown as a prefix label. */
  layer?: 1 | 2 | 3
  size?: 'sm' | 'md'
  className?: string
}

interface Band {
  bg: string
  fg: string
  ring: string
  dot: string
  label: string
}

function bandFor(c: number): Band {
  if (c >= 0.95) {
    return {
      bg: 'bg-emerald-50',
      fg: 'text-emerald-700',
      ring: 'ring-emerald-200',
      dot: 'bg-emerald-500',
      label: 'high',
    }
  }
  if (c >= 0.7) {
    return {
      bg: 'bg-amber-50',
      fg: 'text-amber-700',
      ring: 'ring-amber-200',
      dot: 'bg-amber-500',
      label: 'medium',
    }
  }
  if (c >= 0.5) {
    return {
      bg: 'bg-orange-50',
      fg: 'text-orange-700',
      ring: 'ring-orange-200',
      dot: 'bg-orange-500',
      label: 'low',
    }
  }
  return {
    bg: 'bg-rose-50',
    fg: 'text-rose-700',
    ring: 'ring-rose-200',
    dot: 'bg-rose-500',
    label: 'risk',
  }
}

export default function ConfidencePill({
  confidence,
  layer,
  size = 'sm',
  className = '',
}: Props): JSX.Element {
  const b = bandFor(confidence)
  const sizing = size === 'sm' ? 'text-[10px] px-1.5 py-0.5 gap-1' : 'text-xs px-2 py-1 gap-1.5'
  return (
    <span
      title={`Resolver confidence · ${b.label}`}
      className={`inline-flex items-center rounded-full font-semibold ring-1 ${b.bg} ${b.fg} ${b.ring} ${sizing} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${b.dot}`} aria-hidden="true" />
      {layer !== undefined && (
        <>
          <span className="font-bold tabular-nums uppercase tracking-wide">L{layer}</span>
          <span className="text-current opacity-30">·</span>
        </>
      )}
      <span className="tabular-nums">{(confidence * 100).toFixed(0)}%</span>
    </span>
  )
}
