'use client'

/**
 * NavigationLoader — global pill-shaped bubble loader that appears during
 * client-side route transitions (Next.js App Router doesn't expose an
 * `isPending` hook for cross-route navigation, so we have to plumb this
 * ourselves).
 *
 * How it works:
 *   1. A capture-phase global click listener watches for clicks on any
 *      <a href="..."> that points at an INTERNAL route (relative paths
 *      / starting with "/"), not a hash link, not a new-tab modifier,
 *      not the current page.
 *   2. On a qualifying click → show the loader.
 *   3. When `usePathname()` reports a new pathname → hide it. (The new
 *      page has finished its initial render at that point.)
 *   4. Safety timeout (8s) clears the loader if navigation was cancelled
 *      or somehow stuck — prevents a permanent loader on edge cases.
 *
 * Why a global listener and not a wrapper component:
 *   - The app has dozens of <Link> usages; wrapping each would touch a
 *     lot of files. A single event-delegation listener catches them all
 *     including future links without further wiring.
 *   - The same listener also catches programmatic clicks (e.g. menu items
 *     that wrap a button-as-link) as long as they bubble through an <a>.
 *
 * Accessibility:
 *   - role="status" + aria-live="polite" so AT users get the "Loading"
 *     announcement without yanking focus.
 *   - Honors prefers-reduced-motion via the .dv-bubble CSS rule.
 */

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const SAFETY_TIMEOUT_MS = 8_000

export default function NavigationLoader(): JSX.Element | null {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<number | null>(null)

  // Whenever the resolved pathname OR query changes, the navigation is done.
  // (Some tabs only flip ?tab=... without changing the path; watch both.)
  const navKey = `${pathname}?${searchParams?.toString() ?? ''}`
  useEffect(() => {
    setLoading(false)
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [navKey])

  // Capture-phase listener so we see the click before Next.js intercepts it.
  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      // Skip if user wants a new tab / different button / a download.
      if (e.defaultPrevented) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      if (e.button !== 0) return

      const t = e.target as Element | null
      const anchor = t?.closest?.('a[href]') as HTMLAnchorElement | null
      if (anchor === null) return
      if (anchor.target === '_blank') return
      if (anchor.hasAttribute('download')) return

      const href = anchor.getAttribute('href') ?? ''
      // Internal-only: empty / relative / starts with "/".
      if (href === '' || href.startsWith('#')) return
      if (/^https?:\/\//i.test(href)) {
        // External — only show loader if it's same-origin.
        try {
          const u = new URL(href)
          if (u.origin !== window.location.origin) return
        } catch {
          return
        }
      }

      // Same-page link? Don't bother.
      try {
        const target = new URL(anchor.href, window.location.href)
        if (
          target.pathname === window.location.pathname &&
          target.search === window.location.search
        ) {
          return
        }
      } catch {
        // Malformed href — let the default flow handle it; no loader.
        return
      }

      setLoading(true)
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        setLoading(false)
        timerRef.current = null
      }, SAFETY_TIMEOUT_MS)
    }

    document.addEventListener('click', handler, true)
    return () => {
      document.removeEventListener('click', handler, true)
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    }
  }, [])

  if (!loading) return null

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading next page"
      className="dv-anim-fade-in pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-white/95 px-4 py-2.5 shadow-xl ring-1 ring-slate-200/80 backdrop-blur-sm"
    >
      <div className="flex items-center gap-1.5">
        <span className="dv-bubble" style={{ animationDelay: '0ms' }} />
        <span className="dv-bubble" style={{ animationDelay: '160ms' }} />
        <span className="dv-bubble" style={{ animationDelay: '320ms' }} />
        <span className="ml-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Loading
        </span>
      </div>
    </div>
  )
}
