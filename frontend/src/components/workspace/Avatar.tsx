import { initialsFor } from '@/lib/mockWorkspace'

interface Props {
  name: string
  /** Tailwind size class for both width and height. Default h-8 w-8. */
  size?: 'sm' | 'md' | 'lg'
  /** Show a small green online dot in the corner. */
  online?: boolean
  /** Ring around the avatar — used in stacked groups. */
  ring?: boolean
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', { wrap: string; text: string; dot: string }> = {
  sm: { wrap: 'h-7 w-7', text: 'text-[9px]', dot: 'h-2 w-2' },
  md: { wrap: 'h-9 w-9', text: 'text-[11px]', dot: 'h-2.5 w-2.5' },
  lg: { wrap: 'h-12 w-12', text: 'text-sm', dot: 'h-3 w-3' },
}

// Deterministic gradient seeded by the name so each member gets a stable
// colour without looking samey.
const PALETTES: { from: string; to: string }[] = [
  { from: 'from-primary', to: 'to-brand' },
  { from: 'from-rose-500', to: 'to-amber-500' },
  { from: 'from-violet-500', to: 'to-fuchsia-500' },
  { from: 'from-sky-500', to: 'to-emerald-500' },
  { from: 'from-orange-500', to: 'to-rose-500' },
  { from: 'from-indigo-500', to: 'to-cyan-500' },
]

function paletteFor(name: string): { from: string; to: string } {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return PALETTES[Math.abs(h) % PALETTES.length] as { from: string; to: string }
}

export default function Avatar({ name, size = 'md', online = false, ring = false }: Props) {
  const initials = initialsFor(name)
  const sz = SIZE_CLASSES[size]
  const p = paletteFor(name)
  return (
    <div className="relative inline-block">
      <div
        title={name}
        className={[
          'flex items-center justify-center rounded-full font-bold tracking-wider text-white',
          'bg-gradient-to-br',
          p.from,
          p.to,
          sz.wrap,
          sz.text,
          ring ? 'ring-2 ring-white' : '',
        ].join(' ')}
      >
        {initials}
      </div>
      {online && (
        <span
          aria-label="online"
          className={`absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white bg-emerald-500 ${sz.dot}`}
        />
      )}
    </div>
  )
}

/** Horizontal stack of avatars with overlap. Caps at 4 + "+N" pill. */
export function AvatarStack({
  names,
  size = 'sm',
  max = 4,
}: {
  names: string[]
  size?: 'sm' | 'md'
  max?: number
}) {
  const shown = names.slice(0, max)
  const overflow = names.length - shown.length
  return (
    <div className="flex -space-x-1.5">
      {shown.map((n) => (
        <Avatar key={n} name={n} size={size} ring />
      ))}
      {overflow > 0 && (
        <div
          className={[
            'flex items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700 ring-2 ring-white',
            size === 'sm' ? 'h-7 w-7' : 'h-9 w-9',
          ].join(' ')}
          title={`+${overflow} more`}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
