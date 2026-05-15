/**
 * BracketSvg — a clean, abstract isometric rendering of a machined
 * bracket part. Used as the static "3D model" in the mock viewer.
 * Pure SVG, no external assets.
 */
export default function BracketSvg({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 800 500"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Bracket part rendering"
    >
      <defs>
        <linearGradient id="metal-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3d4a5c" />
          <stop offset="1" stopColor="#1f2733" />
        </linearGradient>
        <linearGradient id="metal-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a323f" />
          <stop offset="1" stopColor="#13181f" />
        </linearGradient>
        <linearGradient id="metal-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#222933" />
          <stop offset="1" stopColor="#0e131a" />
        </linearGradient>
        <radialGradient id="boss-shade" cx="0.35" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#4d5b6e" />
          <stop offset="1" stopColor="#1a212c" />
        </radialGradient>
        <linearGradient id="rib-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a4554" />
          <stop offset="1" stopColor="#1d2530" />
        </linearGradient>
        <filter id="part-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="8" />
          <feOffset dx="0" dy="6" result="off" />
          <feComponentTransfer><feFuncA type="linear" slope="0.4" /></feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="400" cy="430" rx="280" ry="20" fill="#000" opacity="0.45" filter="url(#part-shadow)" />

      {/* Main bracket body — isometric */}
      <g filter="url(#part-shadow)">
        {/* Base plate top face */}
        <polygon
          points="160,300 640,300 700,260 220,260"
          fill="url(#metal-top)"
          stroke="#5b6a80"
          strokeWidth="1"
        />
        {/* Base plate front face */}
        <polygon
          points="160,300 640,300 640,360 160,360"
          fill="url(#metal-front)"
          stroke="#4a5666"
          strokeWidth="1"
        />
        {/* Base plate side face */}
        <polygon
          points="640,300 700,260 700,320 640,360"
          fill="url(#metal-side)"
          stroke="#3e4a5a"
          strokeWidth="1"
        />

        {/* Vertical riser (back wall) */}
        <polygon
          points="280,260 560,260 600,220 320,220 280,260 280,140 320,100 600,100 600,180"
          fill="url(#metal-front)"
          stroke="#4a5666"
          strokeWidth="1"
        />
        <polygon
          points="280,140 320,100 600,100 560,140"
          fill="url(#metal-top)"
          stroke="#5b6a80"
          strokeWidth="1"
        />
        <polygon
          points="560,140 600,100 600,220 560,260"
          fill="url(#metal-side)"
          stroke="#3e4a5a"
          strokeWidth="1"
        />
        <polygon
          points="280,140 280,260 320,220 320,100"
          fill="#1a212c"
          stroke="#3e4a5a"
          strokeWidth="1"
          opacity="0.85"
        />
        <rect x="320" y="140" width="240" height="80" fill="#10151c" stroke="#3e4a5a" strokeWidth="1" />

        {/* Rib (gusset) — left */}
        <polygon
          points="200,300 280,260 280,140 200,300 200,330 250,330"
          fill="url(#rib-grad)"
          stroke="#4a5666"
          strokeWidth="1"
          opacity="0.92"
        />
        {/* Rib (gusset) — right */}
        <polygon
          points="600,300 560,260 560,140 600,300 600,330 550,330"
          fill="url(#rib-grad)"
          stroke="#4a5666"
          strokeWidth="1"
          opacity="0.92"
        />

        {/* Bolt holes on base plate */}
        {[220, 320, 480, 580].map((cx) => (
          <g key={`bolt-${cx}`}>
            <ellipse cx={cx} cy="282" rx="11" ry="5" fill="#0a0d11" stroke="#3e4a5a" strokeWidth="1" />
            <ellipse cx={cx} cy="280" rx="11" ry="5" fill="#1a212c" />
            <ellipse cx={cx} cy="280" rx="6" ry="2.8" fill="#05080b" />
          </g>
        ))}

        {/* Central boss with hole */}
        <ellipse cx="440" cy="180" rx="44" ry="28" fill="url(#boss-shade)" stroke="#5b6a80" strokeWidth="1.2" />
        <ellipse cx="440" cy="180" rx="22" ry="14" fill="#0a0d11" stroke="#3e4a5a" strokeWidth="1" />
        <ellipse cx="440" cy="178" rx="22" ry="14" fill="#1a212c" />
        <ellipse cx="440" cy="178" rx="12" ry="7" fill="#05080b" />

        {/* Inlet flange (smaller boss on right) */}
        <ellipse cx="540" cy="180" rx="22" ry="14" fill="url(#boss-shade)" stroke="#5b6a80" strokeWidth="1" />
        <ellipse cx="540" cy="180" rx="11" ry="7" fill="#0a0d11" />
        <ellipse cx="540" cy="178" rx="11" ry="7" fill="#1a212c" />

        {/* Pocket on left of riser */}
        <rect x="345" y="158" width="48" height="40" rx="2" fill="#10151c" stroke="#3e4a5a" strokeWidth="1" />
        <rect x="349" y="162" width="40" height="32" rx="2" fill="#080b10" opacity="0.85" />

        {/* Fillet hint */}
        <path
          d="M 280 260 Q 280 230 320 230"
          fill="none"
          stroke="#5b6a80"
          strokeWidth="0.6"
          opacity="0.6"
        />
        <path
          d="M 560 260 Q 560 230 600 230"
          fill="none"
          stroke="#5b6a80"
          strokeWidth="0.6"
          opacity="0.6"
        />
      </g>

      {/* Dim lines (technical drawing flavor) */}
      <g opacity="0.32" stroke="#7c8a9d" strokeWidth="0.5" fill="none">
        <line x1="160" y1="380" x2="640" y2="380" />
        <line x1="160" y1="376" x2="160" y2="384" />
        <line x1="640" y1="376" x2="640" y2="384" />
        <text x="400" y="396" fill="#7c8a9d" fontSize="10" fontFamily="ui-monospace,monospace" textAnchor="middle">
          480.00
        </text>
      </g>
    </svg>
  )
}
