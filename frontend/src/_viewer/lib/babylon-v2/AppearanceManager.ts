/**
 * Proprietary - Copyright (c) 2026 datavers.ai. All rights reserved.
 *
 * Ported from dv-3d-viewer. Pure scene mutation — no external coupling.
 *
 * Three appearance operations, all save/restore via mesh material metadata:
 *   · applyAppearanceColor   — override every part's albedo with one colour
 *                              (or RAINBOW = cycle through DEFAULT_COLORS)
 *   · applyAppearanceMaterial — roughness + metallic for the whole scene
 *   · applyCompareNeutralize — drop everything to a single neutral grey for
 *                              compare-mode diff readability (SolidWorks
 *                              Compare / Onshape Compare convention)
 *   · resetAppearance        — restore the original values stashed on first
 *                              call to either of the above
 */

import type { Scene } from '@babylonjs/core'
import { Color3, PBRMaterial } from '@babylonjs/core'
import { getModelMeshes } from './ShadingManager'

// Muted, darker palette — applied per-mesh when the user picks the Rainbow
// preset in the Appearance panel.
export const DEFAULT_COLORS = [
  '#3a7d5c', // dark green
  '#5a3e8a', // dark purple
  '#a0522d', // dark orange/sienna
  '#2a7a9a', // dark cyan
  '#8a6a2e', // dark tan/gold
  '#2e4f8a', // dark blue
  '#8a3a3a', // dark rose
  '#3a6b50', // dark sage
  '#2e6e6e', // dark teal
  '#6b6b1e', // dark yellow-green
]

// Sentinel value for appearanceColor that means "apply DEFAULT_COLORS per
// mesh" rather than a single hex override.
export const RAINBOW = 'rainbow' as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function storeOriginals(mat: any) {
  if (!mat.metadata) mat.metadata = {}
  if (mat.metadata._origAlbedo === undefined)
    mat.metadata._origAlbedo = mat.albedoColor?.clone?.() ?? null
  if (mat.metadata._origRoughness === undefined)
    mat.metadata._origRoughness = mat.roughness ?? 0.3
  if (mat.metadata._origMetallic === undefined)
    mat.metadata._origMetallic = mat.metallic ?? 0.15
}

export function applyAppearanceColor(scene: Scene, overrideColor: string | null) {
  const meshes = getModelMeshes(scene)
  meshes.forEach((mesh, idx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mat = mesh.material as any
    if (!mat) return
    storeOriginals(mat)
    if (overrideColor === RAINBOW) {
      mat.albedoColor = Color3.FromHexString(DEFAULT_COLORS[idx % DEFAULT_COLORS.length]!)
    } else if (overrideColor) {
      mat.albedoColor = Color3.FromHexString(overrideColor)
    } else if (mat.metadata._origAlbedo) {
      mat.albedoColor = mat.metadata._origAlbedo.clone()
    }
  })
}

export function applyAppearanceMaterial(scene: Scene, roughness: number, metallic: number) {
  getModelMeshes(scene).forEach((mesh) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mat = mesh.material as any
    if (!mat) return
    storeOriginals(mat)
    if (mat.roughness !== undefined) {
      mat.roughness = roughness
      if (mat.metadata?._orig) mat.metadata._orig.roughness = roughness
    }
    if (mat.metallic !== undefined) {
      mat.metallic = metallic
      if (mat.metadata?._orig) mat.metadata._orig.metallic = metallic
    }
  })
}

// Compare-mode neutralization. Per-part colors fight the red/green diff
// overlay's visual hierarchy — every CAD compare viewer (SolidWorks Compare,
// Onshape Compare, Bananaz, GrabCAD Compare) drops the model to a single
// translucent neutral so the change colors dominate. We do the same when
// compareMode is on, unless the user explicitly opts into "show real colors".
//
// Stashed under separate metadata keys (`_preCompareAlbedo` / `_preCompareAlpha`)
// so it composes with the appearance-panel overrides without clobbering their
// `_origAlbedo` baseline — exiting compare restores to whatever was on screen
// before compare entry, not to the file's original color.
const NEUTRAL_HEX = '#727980' // FreeCAD 1.0 default slate-gray
// Fully opaque. Safe now because the compare pipeline replaces the
// original full meshes with the per-pair A∩B intersection mesh; the green
// (B−A) and red (A−B) deltas are disjoint from common by construction,
// so no surfaces coincide and there's nothing for the depth-test to fight
// over. Matches the Onshape Compare / SolidWorks Compare look exactly.
const NEUTRAL_ALPHA = 1.0

export function applyCompareNeutralize(scene: Scene, on: boolean) {
  let appliedCount = 0
  for (const mesh of getModelMeshes(scene)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mat = mesh.material as any
    if (!mat) continue
    if (!mat.metadata) mat.metadata = {}
    if (on) {
      // Stash original values exactly once (so repeated apply-on calls don't
      // capture the already-neutralized state as the "original").
      if (!mat.metadata._compareNeutralized) {
        mat.metadata._compareNeutralized = true
        mat.metadata._preCompareAlbedo = mat.albedoColor?.clone?.() ?? null
        mat.metadata._preCompareAlpha = mat.alpha ?? 1
        mat.metadata._preCompareDepthPre = mat.needDepthPrePass ?? false
        mat.metadata._preCompareZOff = mat.zOffset ?? 0
        mat.metadata._preCompareZOffU = mat.zOffsetUnits ?? 0
      }
      // ALWAYS push the current NEUTRAL_ALPHA / NEUTRAL_HEX onto the live
      // material — so a hot-reload of this module (with new constants) takes
      // effect on the next controller call without requiring a full page
      // refresh.
      mat.albedoColor = Color3.FromHexString(NEUTRAL_HEX)
      mat.alpha = NEUTRAL_ALPHA
      mat.needDepthPrePass = NEUTRAL_ALPHA < 1 // only needed for translucent
      mat.transparencyMode =
        NEUTRAL_ALPHA >= 1
          ? PBRMaterial.PBRMATERIAL_OPAQUE
          : PBRMaterial.PBRMATERIAL_ALPHABLEND
      // No polygon-offset push-back on the base. Earlier zOffset=100 caused
      // triangles to be pushed past the far clip plane, producing a 100x
      // miniature ghost render and breaking side-by-side compare. Smaller
      // values (1, 10) weren't enough to reliably win coincident-surface
      // depth-test ties against Manifold3D's re-triangulated delta output.
      // The stripe artifact at coincident delta↔base surfaces is a
      // tessellation-mismatch problem (Manifold's boolean output has its
      // own triangulation), not something the rendering pipeline can clean
      // up via depth-offset. The proper fix is to remap the delta back
      // onto the base's source tessellation post-boolean, which is a
      // larger refactor in csg_diff.py — see findings.
      mat.zOffset = 0
      mat.zOffsetUnits = 0
      appliedCount++
    } else {
      if (!mat.metadata._compareNeutralized) continue
      if (mat.metadata._preCompareAlbedo)
        mat.albedoColor = mat.metadata._preCompareAlbedo.clone()
      mat.alpha = mat.metadata._preCompareAlpha ?? 1
      mat.needDepthPrePass = mat.metadata._preCompareDepthPre ?? false
      mat.zOffset = mat.metadata._preCompareZOff ?? 0
      mat.zOffsetUnits = mat.metadata._preCompareZOffU ?? 0
      mat.metadata._compareNeutralized = false
      delete mat.metadata._preCompareAlbedo
      delete mat.metadata._preCompareAlpha
      delete mat.metadata._preCompareDepthPre
      delete mat.metadata._preCompareZOff
      delete mat.metadata._preCompareZOffU
    }
  }
  console.log(
    `[CompareAppearance] ${on ? 'neutralized' : 'restored'} ${appliedCount} meshes (alpha=${NEUTRAL_ALPHA}, color=${NEUTRAL_HEX})`,
  )
}

export function resetAppearance(scene: Scene) {
  getModelMeshes(scene).forEach((mesh) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mat = mesh.material as any
    if (!mat?.metadata) return
    if (mat.metadata._origAlbedo) mat.albedoColor = mat.metadata._origAlbedo.clone()
    if (mat.metadata._origRoughness !== undefined) {
      mat.roughness = mat.metadata._origRoughness
      if (mat.metadata._orig) mat.metadata._orig.roughness = mat.metadata._origRoughness
    }
    if (mat.metadata._origMetallic !== undefined) {
      mat.metallic = mat.metadata._origMetallic
      if (mat.metadata._orig) mat.metadata._orig.metallic = mat.metadata._origMetallic
    }
  })
}
