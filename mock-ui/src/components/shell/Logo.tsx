interface Props {
  size?: number
  withWordmark?: boolean
  tone?: 'light' | 'dark'
}

/**
 * DataVerse logomark — a hexagonal D with an anchor-dot inside,
 * symbolising "decision anchored to geometry".
 */
export default function Logo({ size = 24, withWordmark = false, tone = 'light' }: Props) {
  const inkClass = tone === 'dark' ? 'text-p-text' : 'text-ink'
  return (
    <span className="inline-flex items-center gap-2 select-none">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="dv-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#1f7a6d" />
            <stop offset="1" stopColor="#15524a" />
          </linearGradient>
        </defs>
        <path
          d="M16 2 L28.124 9 L28.124 23 L16 30 L3.876 23 L3.876 9 Z"
          fill="url(#dv-grad)"
        />
        <path
          d="M11.5 9.5 L11.5 22.5 L17.5 22.5 C20.8 22.5 22.5 20.2 22.5 16 C22.5 11.8 20.8 9.5 17.5 9.5 Z"
          fill="white"
        />
        <circle cx="17" cy="16" r="2.5" fill="#15524a" />
        <circle cx="17" cy="16" r="1" fill="white" />
      </svg>
      {withWordmark && (
        <span className={`flex flex-col leading-none ${inkClass}`}>
          <span className="text-sm font-bold tracking-tight">
            DataVerse<span className="text-accent">.Collab</span>
          </span>
          <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.18em] text-ink-mute">
            Anchored decisions on geometry
          </span>
        </span>
      )}
    </span>
  )
}
