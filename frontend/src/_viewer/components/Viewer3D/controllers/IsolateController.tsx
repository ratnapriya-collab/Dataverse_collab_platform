import { useEffect, useRef } from 'react'
import { useViewerStore } from '../../../store/viewerStore'
import { getModelMeshes } from '../../../lib/babylon/ShadingManager'

export default function IsolateController() {
  const scene         = useViewerStore((s) => s.babylonScene)
  const isolatedNames = useViewerStore((s) => s.isolatedNames)

  // Track which meshes we hid so we can restore them on unisolate
  const hiddenRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!scene) return

    const solids = getModelMeshes(scene)

    if (isolatedNames.size === 0) {
      // Unisolate — restore all previously hidden meshes
      for (const name of hiddenRef.current) {
        const m  = scene.getMeshByName(name)
        const em = scene.getMeshByName(`edges_${name}`)
        if (m)  m.setEnabled(true)
        if (em) em.setEnabled(true)
      }
      hiddenRef.current.clear()
      return
    }

    // Isolate — hide everything not in the set
    const newHidden = new Set<string>()
    for (const m of solids) {
      const shouldShow = isolatedNames.has(m.name)
      m.setEnabled(shouldShow)
      const em = scene.getMeshByName(`edges_${m.name}`)
      if (em) em.setEnabled(shouldShow)
      if (!shouldShow) newHidden.add(m.name)
    }
    hiddenRef.current = newHidden
  }, [scene, isolatedNames])

  return null
}
