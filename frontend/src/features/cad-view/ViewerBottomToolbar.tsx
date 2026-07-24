'use client'

/**
 * ViewerBottomToolbar — 6-button bar floating over the bottom of the
 * CAD viewer: Show Axis · Appearance · Reset All · Explosions · Section
 * · Display. Wires to existing viewerStore actions.
 */

import { useState } from 'react'
import {
  Compass, Eye, Grid3x3, Layers, Paintbrush, Ruler, Scissors, Sparkles,
} from 'lucide-react'
import { useViewerStore } from '@/_viewer/store/viewerStore'

interface ToolEntry {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  onClick?: () => void
  isActive?: boolean
  menu?: {
    label: string
    icon: React.ComponentType<{ className?: string }>
    onClick: () => void
  }[]
}

export default function ViewerBottomToolbar(): JSX.Element {
  const gridVisible = useViewerStore((s) => s.gridVisible)
  const toggleGrid = useViewerStore((s) => s.toggleGrid)
  const axesVisible = useViewerStore((s) => s.axesVisible)
  const toggleAxes = useViewerStore((s) => s.toggleAxes)
  const setShadingMode = useViewerStore((s) => s.setShadingMode)
  const explodeFactor = useViewerStore((s) => s.explodeFactor)
  const setExplodeFactor = useViewerStore((s) => s.setExplodeFactor)
  const sectionPlane = useViewerStore((s) => s.sectionPlane)
  const setSectionPlane = useViewerStore((s) => s.setSectionPlane)
  const clearSelection = useViewerStore((s) => s.clearSelection)
  const setSelectedMesh = useViewerStore((s) => s.setSelectedMesh)
  const setHoveredMesh = useViewerStore((s) => s.setHoveredMesh)

  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const resetAll = (): void => {
    setExplodeFactor(0)
    setSectionPlane(null)
    clearSelection()
    setSelectedMesh(null)
    setHoveredMesh(null)
    setShadingMode('shaded')
  }

  const tools: ToolEntry[] = [
    {
      key: 'axis', label: 'Show Axis', icon: Compass,
      onClick: () => toggleAxes(), isActive: axesVisible,
    },
    {
      key: 'appearance', label: 'Appearance', icon: Paintbrush,
      menu: [
        { label: 'Colour', icon: Paintbrush, onClick: () => setShadingMode('shaded') },
        { label: 'Transparency', icon: Layers, onClick: () => setShadingMode('shadedEdges') },
        { label: 'Reset', icon: Sparkles, onClick: () => setShadingMode('shaded') },
      ],
    },
    { key: 'reset', label: 'Reset All', icon: Sparkles, onClick: resetAll },
    {
      key: 'explosions', label: 'Explosions', icon: Layers,
      menu: [
        { label: 'Lines', icon: Ruler, onClick: () => setShadingMode('wireframe') },
        { label: 'Save', icon: Sparkles, onClick: () => setExplodeFactor(Math.min(1, explodeFactor + 0.1)) },
        { label: 'Reset', icon: Sparkles, onClick: () => setExplodeFactor(0) },
      ],
    },
    {
      key: 'section', label: 'Section', icon: Scissors,
      onClick: () =>
        setSectionPlane(sectionPlane === null ? { axis: 'Y', offset: 0 } : null),
      isActive: sectionPlane !== null,
    },
    {
      key: 'display', label: 'Display', icon: Grid3x3,
      onClick: () => toggleGrid(), isActive: gridVisible,
    },
  ]

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center">
      <div
        className="pointer-events-auto flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white/95 px-1 py-1 shadow-lg backdrop-blur"
        onMouseLeave={() => setOpenMenu(null)}
      >
        {tools.map((t) => (
          <div
            key={t.key}
            className="relative"
            onMouseEnter={() => t.menu && setOpenMenu(t.key)}
          >
            <button
              type="button"
              onClick={() => {
                t.onClick?.()
                if (!t.menu) setOpenMenu(null)
              }}
              aria-pressed={t.isActive}
              className={[
                'flex min-w-[64px] flex-col items-center gap-0.5 rounded-md px-2 py-1 text-[9.5px] font-semibold transition',
                t.isActive
                  ? 'bg-primary/12 text-primary'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              ].join(' ')}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>

            {t.menu !== undefined && openMenu === t.key && (
              <div className="absolute bottom-full left-1/2 z-30 mb-1 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-slate-200 bg-white px-1 py-1 shadow-xl">
                {t.menu.map((m) => (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() => {
                      m.onClick()
                      setOpenMenu(null)
                    }}
                    className="flex min-w-[56px] flex-col items-center gap-0.5 rounded-md px-2 py-1 text-[9.5px] font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-primary"
                  >
                    <m.icon className="h-3.5 w-3.5" />
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="ml-1 border-l border-slate-200 pl-1">
          <button
            type="button"
            aria-label="Screenshot"
            title="Capture view"
            className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-white transition hover:bg-primary-700"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
