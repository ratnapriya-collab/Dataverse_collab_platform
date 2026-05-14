/**
 * FacePickController — emits face-pick events out of the viewer.
 *
 * Added by DataVerse Collab on top of the in-house viewer. Not part of the
 * original viewer module. The existing SelectionController picks whole meshes;
 * this one picks BREP faces using FacePicker.pickFace() and exposes the
 * resulting FaceData via a global emitter.
 *
 * When `facePickMode` is true in the viewer store, this controller takes
 * priority over the mesh-level SelectionController.
 */

import { useEffect } from 'react'
import { PointerEventTypes } from '@babylonjs/core'
import { useViewerStore } from '../../../store/viewerStore'
import { pickFace, type FaceData } from '../../../lib/babylon/FacePicker'
import { isOverlayMesh } from '../../../lib/babylon/SelectionManager'

export interface PickedFace {
  meshName: string
  face: FaceData
}

type Listener = (picked: PickedFace) => void

class FacePickEmitter {
  private readonly listeners = new Set<Listener>()

  on(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  emit(picked: PickedFace): void {
    for (const l of this.listeners) l(picked)
  }
}

export const facePickEmitter = new FacePickEmitter()

export default function FacePickController() {
  const scene = useViewerStore((s) => s.babylonScene)
  const activeMeasureTool = useViewerStore((s) => s.activeMeasureTool)
  const facePickMode = useViewerStore((s) => s.facePickMode)

  useEffect(() => {
    if (!scene || activeMeasureTool || !facePickMode) return

    const observer = scene.onPointerObservable.add((info) => {
      if (info.type !== PointerEventTypes.POINTERTAP) return
      const mesh = info.pickInfo?.pickedMesh
      const triId = info.pickInfo?.faceId
      if (!mesh || triId === undefined || triId < 0) return
      if (isOverlayMesh(mesh.name)) return

      const face = pickFace(mesh, triId)
      facePickEmitter.emit({ meshName: mesh.name, face })
    })

    return () => {
      scene.onPointerObservable.remove(observer)
    }
  }, [scene, activeMeasureTool, facePickMode])

  return null
}
