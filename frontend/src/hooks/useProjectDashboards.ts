'use client'

/**
 * useProjectDashboards — per-project list of dashboard "views" surfaced
 * at the top of ProjectOverviewTab.
 *
 * Each project starts with a single "Project Overview" dashboard. Users
 * can add new dashboards from the title dropdown, rename via the pencil
 * button or the header menu, duplicate, and delete (with a guard that
 * keeps at least one dashboard around).
 *
 * Persisted to localStorage under `dataverse.dashboards.{projectId}`.
 * The active selection is persisted separately so reloading the tab
 * lands you back on the same view.
 *
 * The store is intentionally lightweight — it owns *what dashboards
 * exist* and *which one is active*. The actual cards rendered inside a
 * dashboard live in ProjectOverviewTab today; if/when widget layouts
 * become per-dashboard, we extend the Dashboard interface here without
 * changing the public API.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

const DASHBOARDS_PREFIX = 'dataverse.dashboards.'
const ACTIVE_PREFIX = 'dataverse.dashboards.active.'

export interface Dashboard {
  id: string
  name: string
  /** When the dashboard was created — used for de-dupe of default IDs across sessions. */
  createdAt: string
}

export interface DashboardsApi {
  dashboards: Dashboard[]
  activeId: string
  active: Dashboard
  setActiveId: (id: string) => void
  add: (name?: string) => Dashboard
  rename: (id: string, name: string) => void
  remove: (id: string) => void
  duplicate: (id: string) => Dashboard | null
}

function makeId(): string {
  // Crypto.randomUUID isn't available everywhere; this is good enough for a UI key.
  return 'dash_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

function defaultDashboards(): Dashboard[] {
  return [{ id: 'default', name: 'Project Overview', createdAt: new Date(0).toISOString() }]
}

function load(projectId: string): { list: Dashboard[]; activeId: string } {
  if (typeof window === 'undefined') return { list: defaultDashboards(), activeId: 'default' }
  let list = defaultDashboards()
  try {
    const raw = window.localStorage.getItem(DASHBOARDS_PREFIX + projectId)
    if (raw !== null) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter(
          (d): d is Dashboard =>
            d !== null &&
            typeof d === 'object' &&
            typeof d.id === 'string' &&
            typeof d.name === 'string',
        )
        // Always guarantee at least one — even if user wiped the array.
        if (cleaned.length > 0) list = cleaned
      }
    }
  } catch {
    // ignored — fall back to default
  }
  let activeId = list[0]!.id
  try {
    const rawActive = window.localStorage.getItem(ACTIVE_PREFIX + projectId)
    if (rawActive !== null && list.some((d) => d.id === rawActive)) activeId = rawActive
  } catch {
    // ignored
  }
  return { list, activeId }
}

function persistList(projectId: string, list: Dashboard[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DASHBOARDS_PREFIX + projectId, JSON.stringify(list))
  } catch {
    // quota / private mode — silent
  }
}

function persistActive(projectId: string, id: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ACTIVE_PREFIX + projectId, id)
  } catch {
    // silent
  }
}

export function useProjectDashboards(projectId: string): DashboardsApi {
  const [dashboards, setDashboards] = useState<Dashboard[]>(defaultDashboards)
  const [activeId, setActiveIdState] = useState<string>('default')

  // Hydrate from localStorage on mount / when projectId changes.
  useEffect(() => {
    const { list, activeId: a } = load(projectId)
    setDashboards(list)
    setActiveIdState(a)
  }, [projectId])

  const setActiveId = useCallback(
    (id: string) => {
      setActiveIdState(id)
      persistActive(projectId, id)
    },
    [projectId],
  )

  const add = useCallback(
    (name?: string): Dashboard => {
      const trimmed = (name ?? '').trim()
      const created: Dashboard = {
        id: makeId(),
        name: trimmed === '' ? `Dashboard ${Date.now().toString().slice(-4)}` : trimmed,
        createdAt: new Date().toISOString(),
      }
      setDashboards((prev) => {
        const next = [...prev, created]
        persistList(projectId, next)
        return next
      })
      setActiveId(created.id)
      return created
    },
    [projectId, setActiveId],
  )

  const rename = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim()
      if (trimmed === '') return
      setDashboards((prev) => {
        const next = prev.map((d) => (d.id === id ? { ...d, name: trimmed } : d))
        persistList(projectId, next)
        return next
      })
    },
    [projectId],
  )

  const remove = useCallback(
    (id: string) => {
      setDashboards((prev) => {
        // Guard: never delete the last dashboard.
        if (prev.length <= 1) return prev
        const next = prev.filter((d) => d.id !== id)
        persistList(projectId, next)
        // If we removed the active one, jump to the first remaining.
        if (id === activeId) {
          const fallback = next[0]!.id
          setActiveIdState(fallback)
          persistActive(projectId, fallback)
        }
        return next
      })
    },
    [projectId, activeId],
  )

  const duplicate = useCallback(
    (id: string): Dashboard | null => {
      // Build the new dashboard OUTSIDE the setter so we can safely return
      // it and switch to it without depending on React running the updater
      // synchronously (it doesn't have to).
      const src = dashboards.find((d) => d.id === id)
      if (src === undefined) return null
      const created: Dashboard = {
        id: makeId(),
        name: `${src.name} (copy)`,
        createdAt: new Date().toISOString(),
      }
      setDashboards((prev) => {
        const next = [...prev, created]
        persistList(projectId, next)
        return next
      })
      setActiveId(created.id)
      return created
    },
    [projectId, setActiveId, dashboards],
  )

  const active = useMemo<Dashboard>(
    () => dashboards.find((d) => d.id === activeId) ?? dashboards[0]!,
    [dashboards, activeId],
  )

  return { dashboards, activeId, active, setActiveId, add, rename, remove, duplicate }
}
