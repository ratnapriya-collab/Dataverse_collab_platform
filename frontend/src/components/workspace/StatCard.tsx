import type { LucideIcon } from 'lucide-react'
import AnimatedNumber from './AnimatedNumber'
import Sparkline from './Sparkline'

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
  /** 7-day trend data for the sparkline. Omit to hide the chart. */
  trend?: number[]
}

export default function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = 'text-primary',
  accentBg = 'bg-primary-50',
  animate = true,
  trend,
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
          <div className="mt-0.5 flex items-end justify-between gap-2">
            <p className="text-2xl font-bold tabular-nums leading-none text-slate-900">
              {isNumeric && animate ? (
                <AnimatedNumber value={value as number} durationMs={900} />
              ) : (
                value
              )}
            </p>
            {trend !== undefined && trend.length >= 2 && (
              <div className={`shrink-0 ${accent}`}>
                <Sparkline data={trend} width={70} height={22} />
              </div>
            )}
          </div>
          {hint !== undefined && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
      </div>
    </div>
  )
}
