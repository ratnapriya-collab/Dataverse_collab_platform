'use client'

/**
 * MeshColorPicker — right-click any mesh in the viewer to get an
 * on-canvas palette that recolours THAT part in place. Persists per-mesh
 * choice in a Map inside the store; new GLB loads reset the state.
 *
 * Doubles as the "where do I click for colours?" answer. Also fires on
 * left-click when the toolbar's Appearance mode is active (future hook).
 */

import { useEffect, useState } from 'react'
import { Color3, PointerEventTypes, StandardMaterial, type AbstractMesh } from '@babylonjs/core'
import { useViewerStore } from '../../store/viewerStore'

const PALETTE: readonly { name: string; hex: string }[] = [
  { name: 'Original', hex: '' },      // sentinel — restore first-seen colour
  { name: 'Orange',   hex: '#f97316' },
  { name: 'Yellow',   hex: '#facc15' },
  { name: 'Green',    hex: '#22c55e' },
  { name: 'Teal',     hex: '#14b8a6' },
  { name: 'Blue',     hex: '#3b82f6' },
  { name: 'Indigo',   hex: '#6366f1' },
  { name: 'Purple',   hex: '#a855f7' },
  { name: 'Pink',     hex: '#ec4899' },
  { name: 'Red',      hex: '#ef4444' },
  { name: 'Slate',    hex: '#64748b' },
  { name: 'Silver',   hex: '#cbd5e1' },
] as const

function hexToColor3(hex: string): Color3 {
  const n = parseInt(hex.replace('#', ''), 16)
  return new Color3(
    ((n >> 16) & 255) / 255,
    ((n >> 8) & 255) / 255,
    (n & 255) / 255,
  )
}

export default function MeshColorPicker(): JSX.Element | null {
  const scene = useViewerStore((s) => s.babylonScene)
  const [target, setTarget] = useState<{
    mesh: AbstractMesh
    x: number
    y: number
  } | null>(null)
  // Cache of "original" diffuse per mesh, so "Original" can restore.
  const [originals] = useState(() => new Map<string, Color3>())

  // Wire right-click on the scene canvas.
  useEffect(() => {
    if (!scene) return
    const isTargetable = (m: AbstractMesh): boolean =>
      m.getTotalVertices() > 0 &&
      !m.name.startsWith('grid') &&
      !m.name.startsWith('axis') &&
      !m.name.startsWith('__root__')

    const obs = scene.onPointerObservable.add((info) => {
      // Right-click for menu. Also close on any other pointer down.
      if (info.type !== PointerEventTypes.POINTERDOWN) return
      const evt = info.event as PointerEvent
      if (evt.button !== 2) {
        setTarget(null)
        return
      }
      evt.preventDefault()
      const hit = scene.pick(scene.pointerX, scene.pointerY)
      if (hit?.hit && hit.pickedMesh && isTargetable(hit.pickedMesh)) {
        const mesh = hit.pickedMesh
        // Snapshot original diffuse so "Restore" works later.
        if (!originals.has(mesh.name)) {
          const mat = mesh.material as StandardMaterial | null
          if (mat !== null && 'diffuseColor' in mat) {
            originals.set(mesh.name, mat.diffuseColor.clone())
          }
        }
        setTarget({ mesh, x: evt.clientX, y: evt.clientY })
      } else {
        setTarget(null)
      }
    })

    // Suppress the browser's context menu on the canvas so our picker
    // is the only right-click reaction.
    const canvas = scene.getEngine().getRenderingCanvas()
    const onCtx = (e: Event): void => e.preventDefault()
    canvas?.addEventListener('contextmenu', onCtx)

    return () => {
      if (obs) scene.onPointerObservable.remove(obs)
      canvas?.removeEventListener('contextmenu', onCtx)
    }
  }, [scene, originals])

  // Close on Escape.
  useEffect(() => {
    if (target === null) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setTarget(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [target])

  if (target === null) return null

  const applyColour = (hex: string): void => {
    const mat = target.mesh.material as StandardMaterial | null
    if (mat === null || !('diffuseColor' in mat)) return
    if (hex === '') {
      // Restore original
      const orig = originals.get(target.mesh.name)
      if (orig !== undefined) mat.diffuseColor.copyFrom(orig)
    } else {
      mat.diffuseColor.copyFrom(hexToColor3(hex))
    }
    setTarget(null)
  }

  return (
    <div
      role="menu"
      aria-label="Change part colour"
      style={{
        position: 'fixed',
        top: target.y,
        left: target.x,
        transform: 'translate(4px, 4px)',
        zIndex: 100,
      }}
      className="dv-anim-pop w-[172px] rounded-lg border border-slate-200 bg-white p-2 shadow-2xl"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Colour · {target.mesh.name}
        </p>
        <button
          type="button"
          onClick={() => setTarget(null)}
          aria-label="Close"
          className="flex h-4 w-4 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          ×
        </button>
      </div>
      <div className="grid grid-cols-6 gap-1">
        {PALETTE.map((p) => (
          <button
            key={p.name}
            type="button"
            title={p.name}
            aria-label={p.name}
            onClick={() => applyColour(p.hex)}
            className={[
              'h-6 w-6 rounded-md border transition hover:scale-110',
              p.hex === ''
                ? 'border-dashed border-slate-400 bg-white text-[9px] font-bold text-slate-500'
                : 'border-slate-200',
            ].join(' ')}
            style={{ backgroundColor: p.hex || undefined }}
          >
            {p.hex === '' ? '↺' : ''}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[9.5px] leading-tight text-slate-500">
        Right-click any part to change its colour · Esc to close
      </p>
    </div>
  )
}
