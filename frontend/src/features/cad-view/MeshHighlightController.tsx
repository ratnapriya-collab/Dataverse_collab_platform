'use client'

/**
 * MeshHighlightController — non-destructive hover / selection tint on
 * Babylon meshes.
 *
 * Uses Babylon's built-in `renderOverlay` + `overlayColor` fields:
 *   · When `renderOverlay = true`, Babylon draws the mesh again on top
 *     of itself with the overlay colour blended in. No material
 *     mutation, no cache to keep in sync.
 *   · Turning `renderOverlay` off restores the original look exactly.
 *
 * Selection = solid emerald (persistent until deselected).
 * Hover     = softer green (transient — replaced on next hover / clear).
 *
 * Previous version cached each mesh's emissiveColor and swapped it on
 * hover — but the cache captured PBR emissives BEFORE Viewer3D converted
 * to StandardMaterial, leaving stale refs and painting the model in
 * unexpected greens/yellows. Overlay dodges that whole class of bug.
 */

import { useEffect } from 'react'
import { Color3, type AbstractMesh } from '@babylonjs/core'
import { useViewerStore } from '@/_viewer/store/viewerStore'

const HOVER_COLOR = new Color3(0.10, 0.75, 0.35)
const SELECT_COLOR = new Color3(0.05, 0.90, 0.35)

function isTargetableMesh(mesh: AbstractMesh): boolean {
  const n = mesh.name
  return (
    !n.startsWith('grid') &&
    !n.startsWith('axis') &&
    !n.startsWith('__root__') &&
    mesh.getTotalVertices() > 0
  )
}

export default function MeshHighlightController(): null {
  const scene = useViewerStore((s) => s.babylonScene)
  const hovered = useViewerStore((s) => s.hoveredMesh)
  const selected = useViewerStore((s) => s.selectedMesh)

  useEffect(() => {
    if (!scene) return

    // Clear every overlay each pass — cheap iteration over the mesh
    // list, and guarantees no leftover highlights from previous states.
    for (const mesh of scene.meshes) {
      if (!isTargetableMesh(mesh)) continue
      mesh.renderOverlay = false
    }

    const applyOverlay = (name: string, color: Color3): void => {
      const mesh = scene.getMeshByName(name)
      if (mesh === null || !isTargetableMesh(mesh)) return
      mesh.overlayColor = color
      mesh.overlayAlpha = 0.35
      mesh.renderOverlay = true
    }

    if (hovered !== null) applyOverlay(hovered, HOVER_COLOR)
    if (selected !== null) applyOverlay(selected, SELECT_COLOR)

    return () => {
      // Clean up on unmount / scene swap.
      for (const mesh of scene.meshes) {
        if (!isTargetableMesh(mesh)) continue
        mesh.renderOverlay = false
      }
    }
  }, [scene, hovered, selected])

  return null
}
