import type { AbstractMesh, Scene } from '@babylonjs/core'
import { Color3 } from '@babylonjs/core'
import type { SelectionInfo } from '../../types/viewer'

const SELECTION_COLOR = Color3.FromHexString('#00d4ff')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMaterialColor(mesh: AbstractMesh): Color3 | null {
  const mat = mesh.material as any
  if (!mat) return null
  return mat.albedoColor ?? mat.diffuseColor ?? null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setMaterialColor(mesh: AbstractMesh, color: Color3) {
  const mat = mesh.material as any
  if (!mat) return
  if      (mat.albedoColor  !== undefined) mat.albedoColor  = color
  else if (mat.diffuseColor !== undefined) mat.diffuseColor = color
}

// ── Per-mesh saved state ──────────────────────────────────────────────────────

const originalColors = new Map<AbstractMesh, Color3>()

function tintMesh(mesh: AbstractMesh) {
  if (originalColors.has(mesh)) return   // already selected
  const orig = getMaterialColor(mesh)
  if (orig) originalColors.set(mesh, orig.clone())
  setMaterialColor(mesh, SELECTION_COLOR)
}

function untintMesh(mesh: AbstractMesh) {
  const orig = originalColors.get(mesh)
  if (orig) setMaterialColor(mesh, orig)
  originalColors.delete(mesh)
}

// ── Public API ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function initHighlight(_scene: Scene) { /* no-op */ }

/** Add a mesh to the selection. Returns its SelectionInfo. */
export function selectMesh(mesh: AbstractMesh): SelectionInfo {
  tintMesh(mesh)
  const bb  = mesh.getBoundingInfo().boundingBox
  const min = bb.minimumWorld
  const max = bb.maximumWorld
  return {
    meshName: mesh.name,
    width:  parseFloat((max.x - min.x).toFixed(3)),
    depth:  parseFloat((max.y - min.y).toFixed(3)),
    height: parseFloat((max.z - min.z).toFixed(3)),
  }
}

/** Remove a single mesh from the selection. */
export function deselectMesh(mesh: AbstractMesh) {
  untintMesh(mesh)
}

/** Clear the entire selection. */
export function deselectAll() {
  for (const mesh of [...originalColors.keys()]) untintMesh(mesh)
}

export function isOverlayMesh(name: string): boolean {
  const prefixes = ['viewerGrid', 'originAxis', 'originTip', 'measure_', 'pickMarker', 'marker_', 'face_', 'compass', 'cubeBody', 'axisStub', 'edges_']
  return prefixes.some((p) => name.startsWith(p))
}
