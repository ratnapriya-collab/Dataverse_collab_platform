import { useEffect, useRef } from 'react'
import { PointerEventTypes } from '@babylonjs/core'
import { useViewerStore } from '../../../store/viewerStore'
import { initHighlight, selectMesh, deselectMesh, deselectAll, isOverlayMesh } from '../../../lib/babylon/SelectionManager'

export default function SelectionController() {
  const scene             = useViewerStore((s) => s.babylonScene)
  const activeMeasureTool = useViewerStore((s) => s.activeMeasureTool)
  const selectModeActive  = useViewerStore((s) => s.selectModeActive)
  const addSelection      = useViewerStore((s) => s.addSelection)
  const removeSelection= useViewerStore((s) => s.removeSelection)
  const clearSelection = useViewerStore((s) => s.clearSelection)
  const selectedMeshNames = useViewerStore((s) => s.selectedMeshNames)

  // Keep a ref so the pointer handler can read current selection without stale closure
  const selectedRef = useRef(selectedMeshNames)
  useEffect(() => { selectedRef.current = selectedMeshNames }, [selectedMeshNames])

  useEffect(() => {
    if (!scene) return
    initHighlight(scene)
  }, [scene])

  useEffect(() => {
    if (!scene || activeMeasureTool || !selectModeActive) return

    const observer = scene.onPointerObservable.add((info) => {
      if (info.type !== PointerEventTypes.POINTERTAP) return

      const mesh    = info.pickInfo?.pickedMesh
      const isShift = info.event.shiftKey

      if (!mesh || isOverlayMesh(mesh.name)) {
        // Click on background — deselect all
        deselectAll()
        clearSelection()
        return
      }

      const alreadySelected = selectedRef.current.has(mesh.name)

      if (isShift) {
        // Shift+click: toggle this mesh
        if (alreadySelected) {
          deselectMesh(mesh)
          removeSelection(mesh.name)
        } else {
          const info = selectMesh(mesh)
          addSelection(mesh.name, info)
        }
      } else {
        // Plain click: deselect everything, then select only this mesh
        deselectAll()
        clearSelection()
        const selInfo = selectMesh(mesh)
        addSelection(mesh.name, selInfo)
      }
    })

    return () => { scene.onPointerObservable.remove(observer) }
  }, [scene, activeMeasureTool, selectModeActive, addSelection, removeSelection, clearSelection])

  return null
}
