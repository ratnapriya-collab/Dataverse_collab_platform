/**
 * Proprietary - Copyright (c) 2026 datavers.ai. All rights reserved.
 *
 * Ported from dv-3d-viewer (Datavers.ai) — runs alongside the existing
 * _viewer/lib/babylon/ShadingManager during the engine port. Differences
 * vs the older copy:
 *   · SKIP_PREFIXES list extended for compare-mode overlays (diff_*,
 *     __cap_, __inst_sel_, __stencil_, __voxel) so fit-to-scene and the
 *     model-mesh enumeration don't pick them up as real geometry.
 *   · Edge LinesMeshes (edges_*) get show/hide flips on mode change so
 *     wireframe vs shaded-with-edges actually look different.
 *
 * No external coupling — pure Babylon scene mutation.
 */

import type { AbstractMesh, Scene } from '@babylonjs/core'
import type { ShadingMode } from '../../types/viewer-v2'

// Edge meshes created by StepLoader for BREP topology edges
const EDGE_PREFIX = 'edges_'
// Skip prefixes for "this is not a model part" filtering. Includes the
// compare-mode face-diff overlays (`diff_*` — red/green/yellow tints created
// by renderFaceDiff) so fit-to-scene, getModelMeshes, etc. don't treat them
// as real model geometry.
const SKIP_PREFIXES = [
  'viewerGrid',
  'originAxis',
  'originTip',
  'measure_',
  'pickMarker',
  'marker_',
  '__cap_',
  '__inst_sel_',
  '__stencil_',
  '__voxel',
  'diff_',
  EDGE_PREFIX,
]

export function getModelMeshes(scene: Scene): AbstractMesh[] {
  return scene.meshes.filter(
    (m) =>
      m.material &&
      m.getTotalVertices() > 0 &&
      !SKIP_PREFIXES.some((p) => m.name.startsWith(p)),
  )
}

export function getEdgeMeshes(scene: Scene): AbstractMesh[] {
  return scene.meshes.filter((m) => m.name.startsWith(EDGE_PREFIX))
}

export function applyShadingMode(mode: ShadingMode, meshes: AbstractMesh[]) {
  if (!meshes.length) return
  const scene = meshes[0]!.getScene()

  // Show/hide BREP edge LinesMeshes based on mode
  getEdgeMeshes(scene).forEach((m) => m.setEnabled(mode === 'shadedEdges'))

  meshes.forEach((mesh) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mat = mesh.material as any
    if (!mat) return

    // Store originals on first call
    if (!mat.metadata?._orig) {
      mat.metadata = mat.metadata || {}
      mat.metadata._orig = {
        wireframe: mat.wireframe ?? false,
        alpha: mat.alpha ?? 1,
        backFaceCulling: mat.backFaceCulling ?? true,
        roughness: mat.roughness,
        metallic: mat.metallic,
      }
    }

    if (mesh.edgesRenderer) mesh.disableEdgesRendering()

    switch (mode) {
      case 'shaded':
      case 'shadedEdges':
        mat.wireframe = false
        mat.alpha = mat.metadata._orig.alpha
        mat.backFaceCulling = mat.metadata._orig.backFaceCulling
        if (mat.roughness !== undefined) mat.roughness = mat.metadata._orig.roughness
        if (mat.metallic !== undefined) mat.metallic = mat.metadata._orig.metallic
        break

      case 'wireframe':
        mat.wireframe = true
        break
    }
  })
}
