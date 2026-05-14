'use client'

/**
 * AnimatedNumber — counts from 0 (or `from`) up to `value` over `durationMs`.
 *
 * Uses requestAnimationFrame with an ease-out curve. No state-thrashing —
 * the DOM text is written directly via ref each frame.
 *
 * Respects `prefers-reduced-motion`: snaps to the final value immediately.
 */

import { useEffect, useRef } from 'react'

interface Props {
  value: number
  durationMs?: number
  from?: number
  /** Number of decimal places. Default 0. */
  decimals?: number
  /** Show a unit/suffix after the number, e.g. "%" or "k". */
  suffix?: string
  className?: string
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export default function AnimatedNumber({
  value,
  durationMs = 900,
  from = 0,
  decimals = 0,
  suffix = '',
  className,
}: Props) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      if (ref.current) ref.current.textContent = value.toFixed(decimals) + suffix
      return
    }

    const node = ref.current
    if (!node) return

    startTimeRef.current = null

    const step = (now: number) => {
      if (startTimeRef.current === null) startTimeRef.current = now
      const elapsed = now - startTimeRef.current
      const t = Math.min(1, elapsed / durationMs)
      const eased = easeOutCubic(t)
      const current = from + (value - from) * eased
      node.textContent = current.toFixed(decimals) + suffix
      if (t < 1) {
        rafRef.current = window.requestAnimationFrame(step)
      }
    }

    rafRef.current = window.requestAnimationFrame(step)
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current)
    }
  }, [value, durationMs, from, decimals, suffix])

  // Initial render: show `from` so SSR + first paint match.
  return (
    <span ref={ref} className={className}>
      {from.toFixed(decimals)}
      {suffix}
    </span>
  )
}
