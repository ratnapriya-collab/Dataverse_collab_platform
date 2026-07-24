'use client'

/**
 * ViewerPickController — pointer observers on the Babylon scene so hover
 * / click in the viewer drives the same hoveredMesh / selectedMesh
 * store fields the Assembly Tree drives. Bidirectional sync.
 *
 * Only dispatches to the store when the picked mesh CHANGES — the raw
 * pointer-move event fires ~60Hz which would trigger a store update
 * every frame. We remember the last dispatched name and skip repeats.
 */

import { useEffect, useRef } from 'react'
import { PointerEventTypes } from '@babylonjs/core'
import { useViewerStore } from '@/_viewer/store/viewerStore'

function isPickable(name: string): boolean {
  return (
    !name.startsWith('grid') &&
    !name.startsWith('axis') &&
    !name.startsWith('sample') &&
    !name.startsWith('__root__')
  )
}

export default function ViewerPickController(): null {
  const scene = useViewerStore((s) => s.babylonScene)
  const setHoveredMesh = useViewerStore((s) => s.setHoveredMesh)
  const setSelectedMesh = useViewerStore((s) => s.setSelectedMesh)
  // Reads from store synchronously via getState() when we need the
  // current selection — avoids stale-closure bugs in the observer.
  const lastHoveredRef = useRef<string | null>(null)

  useEffect(() => {
    if (!scene) return

    const obs = scene.onPointerObservable.add((info) => {
      if (info.type === PointerEventTypes.POINTERMOVE) {
        const hit = scene.pick(scene.pointerX, scene.pointerY)
        const name =
          hit?.hit && hit.pickedMesh && isPickable(hit.pickedMesh.name)
            ? hit.pickedMesh.name
            : null
        if (name !== lastHoveredRef.current) {
          lastHoveredRef.current = name
          setHoveredMesh(name)
        }
      } else if (info.type === PointerEventTypes.POINTERTAP) {
        const hit = scene.pick(scene.pointerX, scene.pointerY)
        if (hit?.hit && hit.pickedMesh && isPickable(hit.pickedMesh.name)) {
          const name = hit.pickedMesh.name
          const current = useViewerStore.getState().selectedMesh
          setSelectedMesh(current === name ? null : name)
        } else {
          setSelectedMesh(null)
        }
      }
    })

    return () => {
      if (obs) scene.onPointerObservable.remove(obs)
      lastHoveredRef.current = null
      setHoveredMesh(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene])

  return null
}
