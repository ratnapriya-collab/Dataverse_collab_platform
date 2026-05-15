interface Props {
  name: string
  initials?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  online?: boolean
}

const SIZE = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-[11px]',
  lg: 'h-10 w-10 text-sm',
}

const DOT_SIZE = { xs: 'h-1.5 w-1.5', sm: 'h-2 w-2', md: 'h-2.5 w-2.5', lg: 'h-3 w-3' }

/**
 * Deterministic hue from the name string so each person gets a stable color.
 */
function hueOf(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return h % 360
}

export default function Avatar({ name, initials, size = 'md', online }: Props) {
  const hue = hueOf(name)
  const ini = initials ?? deriveInitials(name)
  return (
    <span className="relative inline-flex shrink-0">
      <span
        className={`inline-flex items-center justify-center rounded-full font-bold text-white ring-2 ring-white shadow-sm ${SIZE[size]}`}
        style={{
          background: `linear-gradient(135deg, hsl(${hue}, 64%, 45%) 0%, hsl(${(hue + 28) % 360}, 64%, 38%) 100%)`,
        }}
        aria-label={name}
      >
        {ini}
      </span>
      {online !== undefined && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-paper ${DOT_SIZE[size]} ${
            online ? 'bg-state-accepted' : 'bg-rule'
          }`}
          aria-hidden="true"
        />
      )}
    </span>
  )
}

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
  return (first + last).toUpperCase() || '?'
}
