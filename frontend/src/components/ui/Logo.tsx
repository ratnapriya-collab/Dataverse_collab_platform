/**
 * DATAVERS.AI brand lockup — SVG-based so it stays crisp at any DPR.
 *
 *  - `<HexMark />`         — just the hexagonal monogram (square icon)
 *  - `<Logo />`            — full lockup: monogram + "DATAVERS.AI" + tagline
 *  - `<Logo compact />`    — monogram + "DATAVERS.AI" without the tagline
 */

interface MarkProps {
  className?: string
}

export function HexMark({ className = 'h-9 w-9' }: MarkProps) {
  return (
    <svg
      viewBox="0 0 60 60"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="DATAVERS.AI"
      className={className}
    >
      <polygon
        points="30,3 55,17 55,43 30,57 5,43 5,17"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* DV monogram */}
      <text
        x="30"
        y="40"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
        fontWeight="900"
        fontSize="24"
        fill="currentColor"
        letterSpacing="-0.06em"
      >
        DV
      </text>
      {/* Small circuit dots — nod to the original brain/circuit motif */}
      <circle cx="11" cy="22" r="1.4" fill="currentColor" opacity="0.7" />
      <circle cx="11" cy="30" r="1.4" fill="currentColor" opacity="0.7" />
      <circle cx="11" cy="38" r="1.4" fill="currentColor" opacity="0.7" />
    </svg>
  )
}

interface LogoProps {
  /** Hide the "ENGINEERING INTELLIGENCE" tagline. */
  compact?: boolean
  /** Tailwind class for the hex mark size. Default h-9 w-9. */
  markClassName?: string
  /** `dark` makes the wordmark white for use on dark backgrounds. Default `light`. */
  theme?: 'light' | 'dark'
}

export default function Logo({
  compact = false,
  markClassName = 'h-9 w-9',
  theme = 'light',
}: LogoProps) {
  const wordmarkClass = theme === 'dark' ? 'text-white' : 'text-slate-900'
  return (
    <div className="flex items-center gap-2.5 select-none">
      <HexMark className={`${markClassName} text-brand`} />
      <div className="flex flex-col leading-none">
        <div className="flex items-baseline font-black tracking-tight">
          <span className={wordmarkClass}>DATAVERS</span>
          <span className="text-brand">.AI</span>
        </div>
        {!compact && (
          <span className="mt-0.5 text-[9px] font-semibold tracking-[0.2em] text-brand">
            ENGINEERING INTELLIGENCE
          </span>
        )}
      </div>
    </div>
  )
}
