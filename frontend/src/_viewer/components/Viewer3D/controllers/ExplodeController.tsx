import { useEffect, useRef } from 'react'
import { Vector3, Matrix } from '@babylonjs/core'
import { useViewerStore } from '../../../store/viewerStore'
import { getModelMeshes } from '../../../lib/babylon/ShadingManager'

interface MeshData {
  origLocalPos: Vector3  // local position at rest (always (0,0,0) for STEP parts)
  localDir:     Vector3  // normalised explosion direction in local (parent) space
  localDist:    number   // distance of part centroid from model centre, in local space
}

export default function ExplodeController() {
  const scene         = useViewerStore((s) => s.babylonScene)
  const modelTree     = useViewerStore((s) => s.modelTree)
  const explodeFactor = useViewerStore((s) => s.explodeFactor)

  const meshDataRef       = useRef<Map<string, MeshData>>(new Map())
  const localRadiusRef    = useRef(1)

  // ── Re-scan whenever the model changes ───────────────────────────────────────
  useEffect(() => {
    if (!scene) { meshDataRef.current.clear(); return }

    // Reset previous offsets
    for (const [name, data] of meshDataRef.current) {
      const m  = scene.getMeshByName(name)
      const em = scene.getMeshByName(`edges_${name}`)
      if (m)  m.position.copyFrom(data.origLocalPos)
      if (em) em.position.copyFrom(data.origLocalPos)
    }
    meshDataRef.current.clear()

    const solids = getModelMeshes(scene)
    if (solids.length < 2) return

    // Force up-to-date world matrices
    for (const m of solids) m.computeWorldMatrix(true)

    // Parent inverse world matrix — converts world positions to local (wrapper) space.
    // The wrapper applies uniform scale + translation so all meshes share one parent.
    const parent = solids[0].parent
    const toLocal: Matrix = parent
      ? Matrix.Invert(parent.getWorldMatrix())
      : Matrix.Identity()

    // Compute model centre in LOCAL space from world-space bbox corners
    // (safe because the wrapper has no rotation, only uniform scale + translate)
    let wx0 = Infinity, wy0 = Infinity, wz0 = Infinity
    let wx1 = -Infinity, wy1 = -Infinity, wz1 = -Infinity
    for (const m of solids) {
      const bb = m.getBoundingInfo().boundingBox
      wx0 = Math.min(wx0, bb.minimumWorld.x); wx1 = Math.max(wx1, bb.maximumWorld.x)
      wy0 = Math.min(wy0, bb.minimumWorld.y); wy1 = Math.max(wy1, bb.maximumWorld.y)
      wz0 = Math.min(wz0, bb.minimumWorld.z); wz1 = Math.max(wz1, bb.maximumWorld.z)
    }

    const modelCenterLocal = Vector3.TransformCoordinates(
      new Vector3((wx0 + wx1) / 2, (wy0 + wy1) / 2, (wz0 + wz1) / 2),
      toLocal,
    )

    // Assembly radius in local space (used as size-relative minimum displacement)
    const localMin = Vector3.TransformCoordinates(new Vector3(wx0, wy0, wz0), toLocal)
    const localMax = Vector3.TransformCoordinates(new Vector3(wx1, wy1, wz1), toLocal)
    localRadiusRef.current = localMax.subtract(localMin).length() / 2

    for (const m of solids) {
      // Part centroid in local space
      const centroidLocal = Vector3.TransformCoordinates(
        m.getBoundingInfo().boundingBox.centerWorld,
        toLocal,
      )
      const delta    = centroidLocal.subtract(modelCenterLocal)
      const localDist = delta.length()

      meshDataRef.current.set(m.name, {
        origLocalPos: m.position.clone(),
        localDir:     localDist > 1e-6 ? delta.normalize() : Vector3.Up(),
        localDist,
      })
    }
  }, [scene, modelTree])

  // ── Apply offsets ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!scene) return
    const localRadius = localRadiusRef.current

    for (const [name, data] of meshDataRef.current) {
      const m  = scene.getMeshByName(name)
      const em = scene.getMeshByName(`edges_${name}`)
      if (!m) continue

      // Displacement entirely in local space.
      // = factor × (part's own local distance + 30% of local assembly radius)
      const disp = explodeFactor * (data.localDist + localRadius * 0.3)
      m.position = data.origLocalPos.add(data.localDir.scale(disp))
      if (em) em.position.copyFrom(m.position)
    }
  }, [scene, explodeFactor])

  return null
}
