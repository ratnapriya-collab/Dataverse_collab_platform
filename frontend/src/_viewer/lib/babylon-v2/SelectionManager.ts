/**
 * Proprietary - Copyright (c) 2026 datavers.ai. All rights reserved.
 *
 * Ported from dv-3d-viewer. Pure scene mutation — no external coupling.
 *
 * Body-fill selection (Onshape-style warm orange) for whole-mesh selections
 * driven from the model tree, plus a separate "mate outline" mode for
 * compare-view cross-pane sync (cool cyan stroke around the BREP edges).
 * Per-mesh state is held in module-local Maps so callers can call select /
 * deselect on the same mesh repeatedly without losing the original colour.
 */

import type { AbstractMesh, Scene, LinesMesh } from '@babylonjs/core'
import { Color3 } from '@babylonjs/core'
import type { SelectionInfo } from '../../types/viewer-v2'

// Onshape's warm orange — body-fill tint when an entire mesh is selected
// via the model tree. Matches the sub-element highlight color set in
// FaceEdgeHighlightController so tree-driven and viewport-driven
// selections look the same.
const SELECTION_COLOR = Color3.FromHexString('#dd7e2a')
// Mate-outline color (compare-mode cross-pane sync). Kept distinct from
// the primary selection orange so the user can tell "this is the mate,
// not the primary selection" — using a cool cyan as the contrast.
const MATE_OUTLINE_COLOR = Color3.FromHexString('#22d3ee')

function getMaterialColor(mesh: AbstractMesh): Color3 | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mat = mesh.material as any
  if (!mat) return null
  return mat.albedoColor ?? mat.diffuseColor ?? null
}

function setMaterialColor(mesh: AbstractMesh, color: Color3) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mat = mesh.material as any
  if (!mat) return
  if (mat.albedoColor !== undefined) mat.albedoColor = color
  else if (mat.diffuseColor !== undefined) mat.diffuseColor = color
}

// ── Per-mesh saved state ──────────────────────────────────────────────────

const originalColors = new Map<AbstractMesh, Color3>()
// Mate-outline edge meshes whose colors have been overridden; restored
// on deselectMate / deselectAll.
const mateEdgeOriginals = new Map<LinesMesh, Color3>()

function tintMesh(mesh: AbstractMesh) {
  if (originalColors.has(mesh)) return // already selected
  const orig = getMaterialColor(mesh)
  if (orig) originalColors.set(mesh, orig.clone())
  setMaterialColor(mesh, SELECTION_COLOR)
}

function untintMesh(mesh: AbstractMesh) {
  const orig = originalColors.get(mesh)
  if (orig) setMaterialColor(mesh, orig)
  originalColors.delete(mesh)
}

// ── Public API ────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function initHighlight(_scene: Scene) {
  /* no-op — kept for API compat */
}

/** Compute and return a mesh's SelectionInfo without changing its
 *  appearance. Used by viewport pick handlers that show the visual
 *  state via face/edge sub-element overlays instead of body fill. */
export function getMeshSelectionInfo(mesh: AbstractMesh): SelectionInfo {
  const bb = mesh.getBoundingInfo().boundingBox
  const min = bb.minimumWorld
  const max = bb.maximumWorld
  return {
    meshName: mesh.name,
    width: parseFloat((max.x - min.x).toFixed(3)),
    depth: parseFloat((max.y - min.y).toFixed(3)),
    height: parseFloat((max.z - min.z).toFixed(3)),
  }
}

/** Add a mesh to the selection with the body-fill tint. Used by the
 *  tree panel for whole-body selection from outside the viewport. */
export function selectMesh(mesh: AbstractMesh): SelectionInfo {
  tintMesh(mesh)
  return getMeshSelectionInfo(mesh)
}

/** Remove a single mesh from the selection. */
export function deselectMesh(mesh: AbstractMesh) {
  untintMesh(mesh)
}

/** Outline a mesh as a compare-mode "mate" — thin cyan stroke around
 *  its BREP edges, no body fill. Picks up the sibling `edges_<name>`
 *  line mesh and recolors it; original color is restored on
 *  deselectMate / deselectAll. Returns SelectionInfo (or null when
 *  the mesh has no sibling edges mesh). */
export function selectMeshAsMate(mesh: AbstractMesh): SelectionInfo | null {
  const scene = mesh.getScene()
  const edgeMesh = scene.getMeshByName(`edges_${mesh.name}`) as LinesMesh | null
  if (!edgeMesh) return null
  if (!mateEdgeOriginals.has(edgeMesh)) {
    mateEdgeOriginals.set(edgeMesh, edgeMesh.color.clone())
  }
  edgeMesh.color = MATE_OUTLINE_COLOR
  return getMeshSelectionInfo(mesh)
}

/** Reverse selectMeshAsMate: restore the mate's edge mesh color. */
export function deselectMate(mesh: AbstractMesh) {
  const scene = mesh.getScene()
  const edgeMesh = scene.getMeshByName(`edges_${mesh.name}`) as LinesMesh | null
  if (!edgeMesh) return
  const orig = mateEdgeOriginals.get(edgeMesh)
  if (orig) edgeMesh.color = orig
  mateEdgeOriginals.delete(edgeMesh)
}

/** Clear the entire selection. */
export function deselectAll() {
  for (const mesh of [...originalColors.keys()]) untintMesh(mesh)
  for (const [edgeMesh, orig] of mateEdgeOriginals) edgeMesh.color = orig
  mateEdgeOriginals.clear()
}

export function isOverlayMesh(name: string): boolean {
  const prefixes = [
    'viewerGrid',
    'originAxis',
    'originTip',
    'measure_',
    'pickMarker',
    'marker_',
    'face_',
    'compass',
    'cubeBody',
    'axisStub',
    'edges_',
    '__inst_sel_',
    '__cap_',
    '__stencil_',
    '__sub_hl_',
    '__sub_sel_',
  ]
  return prefixes.some((p) => name.startsWith(p))
}
