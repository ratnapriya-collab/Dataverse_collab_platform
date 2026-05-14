/**
 * Sparkline — a tiny SVG line + area chart for at-a-glance trends inside
 * stat tiles. No external charting library; just a polyline and a path.
 *
 * Each tile passes a 7-element array (one number per day). We normalise to
 * the chart's height ourselves so callers don't have to think about scaling.
 */

interface Props {
  data: number[]
  width?: number
  height?: number
  /** Tailwind text-* class — the line, dot, and area all use currentColor. */
  className?: string
  /** Render the area fill under the line. Default true. */
  area?: boolean
}

export default function Sparkline({
  data,
  width = 80,
  height = 26,
  className = 'text-primary',
  area = true,
}: Props) {
  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min === 0 ? 1 : max - min

  // Build line points in viewBox coordinates.
  const stride = width / (data.length - 1)
  const pad = 2 // top/bottom padding so the line isn't flush against the edges
  const points = data.map((v, i) => {
    const x = i * stride
    const yNorm = (v - min) / range // 0..1
    const y = height - pad - yNorm * (height - pad * 2)
    return { x, y }
  })

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`

  const last = points[points.length - 1]
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      aria-hidden="true"
    >
      {area && (
        <path
          d={areaPath}
          fill="currentColor"
          opacity={0.12}
        />
      )}
      <path
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {last !== undefined && (
        <circle cx={last.x} cy={last.y} r={2} fill="currentColor" />
      )}
    </svg>
  )
}
