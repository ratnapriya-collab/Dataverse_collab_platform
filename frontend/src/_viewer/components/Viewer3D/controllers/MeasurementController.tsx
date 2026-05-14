import { useEffect, useRef } from 'react'
import { PointerEventTypes } from '@babylonjs/core'
import type { AbstractMesh, Vector3 } from '@babylonjs/core'
import { useViewerStore } from '../../../store/viewerStore'
import {
  createPickMarker,
  buildMeasurement,
  buildFaceAreaMeasurement,
  buildAngleMeasurement,
  buildRadiusMeasurement,
  buildMinDistMeasurement,
  buildEdgeLengthMeasurement,
} from '../../../lib/babylon/MeasurementManager'
import { pickFace, pickEdge, minFaceDistance } from '../../../lib/babylon/FacePicker'
import type { FaceData } from '../../../lib/babylon/FacePicker'
import { isOverlayMesh } from '../../../lib/babylon/SelectionManager'

export default function MeasurementController() {
  const scene            = useViewerStore((s) => s.babylonScene)
  const activeTool       = useViewerStore((s) => s.activeMeasureTool)
  const addMeasurement   = useViewerStore((s) => s.addMeasurement)

  // Pending state for tools that require 2 picks
  const pendingPoint     = useRef<Vector3 | null>(null)
  const pendingMarker    = useRef<AbstractMesh | null>(null)
  const pendingFace      = useRef<{ mesh: AbstractMesh; face: FaceData } | null>(null)

  // Clear pending state when tool changes or is deactivated
  useEffect(() => {
    pendingPoint.current  = null
    pendingFace.current   = null
    if (pendingMarker.current) {
      try { pendingMarker.current.dispose() } catch (_) {}
      pendingMarker.current = null
    }
  }, [activeTool])

  useEffect(() => {
    if (!scene || !activeTool) return

    const observer = scene.onPointerObservable.add((info) => {
      if (info.type !== PointerEventTypes.POINTERTAP) return
      if (!info.pickInfo?.hit || !info.pickInfo.pickedPoint) return

      const mesh    = info.pickInfo.pickedMesh
      if (!mesh || isOverlayMesh(mesh.name)) return

      const point   = info.pickInfo.pickedPoint.clone()
      const triId   = info.pickInfo.faceId   // triangle index within the mesh

      // ── Distance ───────────────────────────────────────────────────────────
      if (activeTool === 'distance') {
        if (!pendingPoint.current) {
          pendingMarker.current = createPickMarker(scene, point, `pickMarker_${Date.now()}`)
          pendingPoint.current  = point
        } else {
          const marker2 = createPickMarker(scene, point, `pickMarker_${Date.now()}`)
          const entry   = buildMeasurement(scene, pendingPoint.current, point, pendingMarker.current!, marker2)
          addMeasurement(entry)
          pendingPoint.current  = null
          pendingMarker.current = null
        }
        return
      }

      // For face tools, skip edge/overlay meshes (no face triangulation)
      if (mesh.getTotalVertices() === 0) return
      if (triId === undefined || triId < 0) return

      // ── Face Area ──────────────────────────────────────────────────────────
      if (activeTool === 'face-area') {
        const face  = pickFace(mesh, triId)
        const entry = buildFaceAreaMeasurement(scene, mesh, face)
        addMeasurement(entry)
        return
      }

      // ── Radius ─────────────────────────────────────────────────────────────
      if (activeTool === 'radius') {
        const face  = pickFace(mesh, triId)
        const entry = buildRadiusMeasurement(scene, mesh, face)
        if (entry) {
          addMeasurement(entry)
        } else {
          // Flat face — user clicked a non-cylindrical surface
          console.info('[Measure] Selected face is not cylindrical.')
        }
        return
      }

      // ── Angle (2-click) ────────────────────────────────────────────────────
      if (activeTool === 'angle') {
        const face = pickFace(mesh, triId)
        if (!pendingFace.current) {
          pendingFace.current = { mesh, face }
        } else {
          const entry = buildAngleMeasurement(
            scene,
            pendingFace.current.mesh, pendingFace.current.face,
            mesh, face,
          )
          addMeasurement(entry)
          pendingFace.current = null
        }
        return
      }

      // ── Minimum Distance (2-click) ─────────────────────────────────────────
      if (activeTool === 'min-distance') {
        const face = pickFace(mesh, triId)
        if (!pendingFace.current) {
          pendingFace.current = { mesh, face }
        } else {
          const result = minFaceDistance(
            pendingFace.current.mesh, pendingFace.current.face,
            mesh, face,
          )
          const entry = buildMinDistMeasurement(
            scene,
            pendingFace.current.mesh, pendingFace.current.face,
            mesh, face, result,
          )
          addMeasurement(entry)
          pendingFace.current = null
        }
        return
      }

      // ── Edge Length (1-click) ──────────────────────────────────────────────
      if (activeTool === 'edge-length') {
        const result = pickEdge(mesh, point)
        if (result) {
          const entry = buildEdgeLengthMeasurement(scene, result)
          addMeasurement(entry)
        } else {
          console.info('[Measure] No edge mesh found for this part.')
        }
        return
      }
    })

    return () => { scene.onPointerObservable.remove(observer) }
  }, [scene, activeTool, addMeasurement])

  return null
}
