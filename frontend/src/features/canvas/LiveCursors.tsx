'use client'

/**
 * LiveCursors — simulated live-cursor overlay for the demo.
 *
 * The reference video shows 4 named collaborators (Design Engineer,
 * Engineering Manager, Tony Martini, Tooling Engineer) drifting around
 * the canvas with coloured cursor arrows + labels. Full real-time
 * collab needs WebSockets + CRDT — a big lift. For the demo we simulate
 * it with 4 fake cursors that meander slowly along Bezier-like paths,
 * pausing occasionally at "interesting" spots so the board feels alive.
 *
 * Positioned in canvas WORLD coordinates and translated to screen via
 * the parent's pan/zoom transform (identity here — the parent applies
 * the transform to the whole svg / cursor layer).
 */

import { useEffect, useState } from 'react'

interface Cursor {
  id: string
  name: string
  color: string
  path: { x: number; y: number }[]
}

// Four cursors matching the video. World coords assumed to sit inside a
// ~1400×900 board — same order-of-magnitude the canvas uses.
const COLLABORATORS: readonly Cursor[] = [
  {
    id: 'design',
    name: 'Design Engineer',
    color: '#22c55e',
    path: [
      { x: 340, y: 560 }, { x: 420, y: 590 }, { x: 380, y: 610 },
      { x: 300, y: 570 }, { x: 250, y: 540 }, { x: 340, y: 560 },
    ],
  },
  {
    id: 'mgr',
    name: 'Engineering Manager',
    color: '#a855f7',
    path: [
      { x: 560, y: 320 }, { x: 620, y: 310 }, { x: 660, y: 335 },
      { x: 640, y: 360 }, { x: 590, y: 355 }, { x: 560, y: 320 },
    ],
  },
  {
    id: 'tony',
    name: 'Tony Martini',
    color: '#3b82f6',
    path: [
      { x: 760, y: 590 }, { x: 830, y: 585 }, { x: 900, y: 605 },
      { x: 870, y: 630 }, { x: 800, y: 620 }, { x: 760, y: 590 },
    ],
  },
  {
    id: 'tool',
    name: 'Tooling Engineer',
    color: '#ec4899',
    path: [
      { x: 850, y: 130 }, { x: 900, y: 140 }, { x: 940, y: 165 },
      { x: 910, y: 190 }, { x: 860, y: 175 }, { x: 850, y: 130 },
    ],
  },
] as const

/** Bezier-lite interpolation — moves smoothly through path points on a
 *  loop, with a mild ease-in-out per segment. */
function positionAt(path: readonly { x: number; y: number }[], t: number): { x: number; y: number } {
  const segCount = path.length - 1
  const total = t * segCount
  const i = Math.floor(total) % segCount
  const local = total - Math.floor(total)
  // Ease in/out
  const e = local < 0.5 ? 2 * local * local : 1 - Math.pow(-2 * local + 2, 2) / 2
  const a = path[i]!
  const b = path[i + 1]!
  return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e }
}

export default function LiveCursors(): JSX.Element {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (): void => {
      const now = performance.now()
      // Advance ~12s per full loop — slow, natural drift.
      setTick((prev) => (prev + (now - last) / 12000) % 1)
      last = now
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {COLLABORATORS.map((c) => {
        const p = positionAt(c.path, tick)
        return (
          <div
            key={c.id}
            className="absolute transition-transform duration-75"
            style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
          >
            {/* Cursor arrow SVG */}
            <svg
              width="18"
              height="20"
              viewBox="0 0 18 20"
              fill={c.color}
              stroke="white"
              strokeWidth="1.5"
              style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))' }}
            >
              <path d="M1 1 L1 16 L5 12 L8 19 L11 18 L8 11 L14 11 Z" />
            </svg>
            {/* Name label */}
            <span
              className="absolute left-4 top-4 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-md"
              style={{ backgroundColor: c.color }}
            >
              {c.name}
            </span>
          </div>
        )
      })}
    </div>
  )
}
