/**
 * Blueprint-style project thumbnail.
 *
 * A dark gradient with a subtle technical grid background, plus a wireframe
 * SVG silhouette suggesting the kind of CAD geometry inside the project.
 * Each tone produces a distinct accent colour for the silhouette glow.
 */

import type { ProjectShape, ProjectTone } from '@/lib/mockWorkspace'

const TONE_GRADIENT: Record<ProjectTone, string> = {
  cyan: 'from-slate-900 via-cyan-950 to-cyan-900',
  amber: 'from-slate-900 via-amber-950 to-orange-900',
  emerald: 'from-slate-900 via-emerald-950 to-teal-900',
  rose: 'from-slate-900 via-rose-950 to-pink-900',
  violet: 'from-slate-900 via-violet-950 to-fuchsia-900',
  slate: 'from-slate-800 via-slate-900 to-slate-950',
  sky: 'from-slate-900 via-sky-950 to-blue-900',
}

const TONE_ACCENT: Record<ProjectTone, string> = {
  cyan: 'text-cyan-300',
  amber: 'text-amber-300',
  emerald: 'text-emerald-300',
  rose: 'text-rose-300',
  violet: 'text-violet-300',
  slate: 'text-slate-300',
  sky: 'text-sky-300',
}

interface Props {
  shape: ProjectShape
  tone: ProjectTone
  /** Tailwind aspect ratio class. Default 16/9. */
  aspectClass?: string
}

export default function ProjectThumbnail({
  shape,
  tone,
  aspectClass = 'aspect-[16/10]',
}: Props) {
  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br ${TONE_GRADIENT[tone]} ${aspectClass}`}
    >
      {/* Technical grid */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      {/* Centred cross-hair */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.18) 1px, transparent 1px)',
          backgroundPosition: 'center',
          backgroundSize: '50% 50%',
        }}
      />
      {/* Accent glow */}
      <div
        className={`pointer-events-none absolute inset-0 ${TONE_ACCENT[tone]} opacity-20 blur-2xl`}
        style={{ background: 'radial-gradient(circle at center, currentColor 0%, transparent 60%)' }}
      />
      {/* Silhouette */}
      <div className="absolute inset-0 flex items-center justify-center">
        <ShapeSilhouette shape={shape} className={`${TONE_ACCENT[tone]} h-3/5 w-3/5 drop-shadow-lg`} />
      </div>
    </div>
  )
}

function ShapeSilhouette({
  shape,
  className,
}: {
  shape: ProjectShape
  className?: string
}) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.2,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  }
  switch (shape) {
    case 'gear':
      return (
        <svg viewBox="0 0 100 100" className={className} {...common}>
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 30 * Math.PI) / 180
            const r1 = 38
            const r2 = 46
            return (
              <line
                key={i}
                x1={50 + Math.cos(angle) * r1}
                y1={50 + Math.sin(angle) * r1}
                x2={50 + Math.cos(angle) * r2}
                y2={50 + Math.sin(angle) * r2}
              />
            )
          })}
          <circle cx="50" cy="50" r="38" />
          <circle cx="50" cy="50" r="28" />
          <circle cx="50" cy="50" r="10" />
          <circle cx="50" cy="50" r="3" fill="currentColor" />
        </svg>
      )
    case 'bracket':
      return (
        <svg viewBox="0 0 100 100" className={className} {...common}>
          <polygon points="18,82 18,30 70,30 70,42 30,42 30,82" />
          <line x1="30" y1="42" x2="70" y2="30" strokeDasharray="2 2" />
          <circle cx="24" cy="36" r="2.5" />
          <circle cx="62" cy="36" r="2.5" />
          <circle cx="24" cy="76" r="2.5" />
        </svg>
      )
    case 'housing':
      return (
        <svg viewBox="0 0 100 100" className={className} {...common}>
          <rect x="22" y="32" width="56" height="40" rx="6" />
          <rect x="32" y="42" width="36" height="20" rx="3" />
          <circle cx="30" cy="40" r="2" />
          <circle cx="70" cy="40" r="2" />
          <circle cx="30" cy="64" r="2" />
          <circle cx="70" cy="64" r="2" />
          <line x1="50" y1="32" x2="50" y2="20" />
          <circle cx="50" cy="18" r="3" />
        </svg>
      )
    case 'cylinder':
      return (
        <svg viewBox="0 0 100 100" className={className} {...common}>
          <ellipse cx="50" cy="28" rx="22" ry="6" />
          <line x1="28" y1="28" x2="28" y2="72" />
          <line x1="72" y1="28" x2="72" y2="72" />
          <ellipse cx="50" cy="72" rx="22" ry="6" />
          <ellipse cx="50" cy="72" rx="22" ry="6" strokeDasharray="2 2" transform="translate(0,-44)" />
          <line x1="50" y1="22" x2="50" y2="78" strokeDasharray="3 3" />
        </svg>
      )
    case 'plate':
      return (
        <svg viewBox="0 0 100 100" className={className} {...common}>
          <rect x="18" y="38" width="64" height="28" rx="3" />
          <circle cx="28" cy="52" r="4" />
          <circle cx="50" cy="52" r="4" />
          <circle cx="72" cy="52" r="4" />
          <line x1="14" y1="52" x2="86" y2="52" strokeDasharray="2 3" />
        </svg>
      )
    case 'manifold':
      return (
        <svg viewBox="0 0 100 100" className={className} {...common}>
          <rect x="22" y="58" width="56" height="14" rx="4" />
          <line x1="32" y1="58" x2="32" y2="36" />
          <line x1="50" y1="58" x2="50" y2="28" />
          <line x1="68" y1="58" x2="68" y2="36" />
          <ellipse cx="32" cy="34" rx="6" ry="3" />
          <ellipse cx="50" cy="26" rx="6" ry="3" />
          <ellipse cx="68" cy="34" rx="6" ry="3" />
          <circle cx="50" cy="72" r="2.5" />
        </svg>
      )
  }
}
