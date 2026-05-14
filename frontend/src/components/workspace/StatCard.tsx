import type { LucideIcon } from 'lucide-react'
import AnimatedNumber from './AnimatedNumber'

interface Props {
  icon: LucideIcon
  label: string
  value: string | number
  /** Subtle hint shown under the value, e.g. "+2 this week". */
  hint?: string
  /** Tailwind text-color class for the icon and accent (e.g. 'text-primary'). */
  accent?: string
  /** Background-tint class for the icon tile (e.g. 'bg-primary-50'). */
  accentBg?: string
  /** Count from 0 up to value on mount. Auto-enabled for numeric values. */
  animate?: boolean
}

export default function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = 'text-primary',
  accentBg = 'bg-primary-50',
  animate = true,
}: Props) {
  const isNumeric = typeof value === 'number'
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accentBg}`}
        >
          <Icon className={`h-4 w-4 ${accent}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">
            {isNumeric && animate ? (
              <AnimatedNumber value={value as number} durationMs={900} />
            ) : (
              value
            )}
          </p>
          {hint !== undefined && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
        </div>
      </div>
    </div>
  )
}
