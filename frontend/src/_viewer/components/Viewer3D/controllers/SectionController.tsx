import { useEffect } from 'react'
import { Plane, Vector3 } from '@babylonjs/core'
import { useViewerStore } from '../../../store/viewerStore'
import { getModelMeshes } from '../../../lib/babylon/ShadingManager'

export default function SectionController() {
  const scene        = useViewerStore((s) => s.babylonScene)
  const sectionPlane = useViewerStore((s) => s.sectionPlane)

  useEffect(() => {
    if (!scene) return

    const meshes = getModelMeshes(scene)

    if (!sectionPlane) {
      scene.clipPlane = null
      meshes.forEach((m) => {
        const mat = m.material as any
        if (!mat) return
        const o = mat.metadata?._orig
        if (o) {
          mat.backFaceCulling = o.backFaceCulling
          mat.roughness       = o.roughness
          mat.metallic        = o.metallic
        }
        mat.twoSidedLighting = false
        mat.depthPrePass     = false
      })
      return
    }

    const { axis, offset } = sectionPlane

    const normal =
      axis === 'X' ? new Vector3(1, 0, 0) :
      axis === 'Y' ? new Vector3(0, 1, 0) :
                     new Vector3(0, 0, 1)

    // ── Model bounding box ────────────────────────────────────────────────────
    let wx0 = Infinity, wy0 = Infinity, wz0 = Infinity
    let wx1 = -Infinity, wy1 = -Infinity, wz1 = -Infinity
    for (const m of meshes) {
      m.computeWorldMatrix(true)
      const bb = m.getBoundingInfo().boundingBox
      wx0 = Math.min(wx0, bb.minimumWorld.x); wx1 = Math.max(wx1, bb.maximumWorld.x)
      wy0 = Math.min(wy0, bb.minimumWorld.y); wy1 = Math.max(wy1, bb.maximumWorld.y)
      wz0 = Math.min(wz0, bb.minimumWorld.z); wz1 = Math.max(wz1, bb.maximumWorld.z)
    }
    if (!isFinite(wx0)) return

    const cx = (wx0 + wx1) / 2
    const cy = (wy0 + wy1) / 2
    const cz = (wz0 + wz1) / 2

    let worldPos: number
    if      (axis === 'X') worldPos = cx + offset * (wx1 - wx0) / 2
    else if (axis === 'Y') worldPos = cy + offset * (wy1 - wy0) / 2
    else                   worldPos = cz + offset * (wz1 - wz0) / 2

    scene.clipPlane = Plane.FromPositionAndNormal(normal.scale(worldPos), normal)

    meshes.forEach((m) => {
      const mat = m.material as any
      if (!mat) return
      // backFaceCulling=true is the only reliable fix for inter-mesh Z-fighting
      // at the cut surface — back faces of overlapping parts at the same depth
      // cause the checkerboard flicker; culling them eliminates it entirely.
      mat.backFaceCulling  = true
      mat.twoSidedLighting = false
      mat.depthPrePass     = false
      if (mat.roughness !== undefined) mat.roughness = 1.0
      if (mat.metallic  !== undefined) mat.metallic  = 0.0
    })
  }, [scene, sectionPlane])

  useEffect(() => {
    return () => {
      if (!scene) return
      scene.clipPlane = null
      getModelMeshes(scene).forEach((m) => {
        const mat = m.material as any
        if (!mat) return
        const o = mat.metadata?._orig
        if (o) {
          mat.backFaceCulling = o.backFaceCulling
          mat.roughness       = o.roughness
          mat.metallic        = o.metallic
        }
        mat.twoSidedLighting = false
        mat.depthPrePass     = false
      })
    }
  }, [scene])

  return null
}
