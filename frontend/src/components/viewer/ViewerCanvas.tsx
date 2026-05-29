'use client'

/**
 * ViewerCanvas — DataVerse Collab's wrapper around the in-house 3D viewer.
 *
 * Responsibilities:
 *  - Mount the viewer as a React Client Component (it cannot SSR — WebGL + WASM).
 *  - Subscribe to face-pick events from the viewer's FacePickController and
 *    forward them to the parent via `onFacePick`.
 *  - Compute a stable face UUID (lib/geomHash) before handing data off — the
 *    raw triangle indices the viewer emits are NOT stable across re-uploads.
 *  - Tear the viewer down cleanly on unmount.
 *
 * The viewer itself is dynamic-imported to keep its ~10MB bundle (Babylon +
 * opencascade.js WASM) out of the initial page load.
 */

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  facePickEmitter,
  type PickedFace,
} from '@/_viewer/components/Viewer3D/controllers/FacePickController'
import { stableFaceUuid } from '@/lib/geomHash'
import CommentLabels, { type LabeledMarker } from './CommentLabels'

export interface ViewerFace {
  /** Stable UUID derived from topology — safe to persist as an anchor key. */
  uuid: string
  /** Babylon mesh name the face belongs to. */
  meshName: string
  centroid: { x: number; y: number; z: number }
  normal: { x: number; y: number; z: number }
  area: number
  triangleCount: number
}

interface Props {
  onFacePick?: (face: ViewerFace) => void
  /** Absolute URL to a .glb / .gltf / .step file to render on mount. */
  partUrl?: string
  /** Extension matching partUrl. */
  partExt?: string
  /** CAD-style leader-line callouts for anchored comments. */
  labels?: LabeledMarker[]
  /** Optional click handler for a comment label (e.g. scroll to that card). */
  onLabelClick?: (faceUuid: string) => void
  /** Card click — fires step-2 (open thread drawer). */
  onCardClick?: (faceUuid: string) => void
  /** Smart-pin visibility — v2 commenting. */
  cardVisibility?: 'always' | 'selected-only'
  visibleCardFor?: string | null
}

// next/dynamic with ssr:false guarantees the viewer never renders on the server.
// We still gate on a small client-only fallback so the initial paint is fast.
const Viewer3DInner = dynamic(
  () =>
    import('@/_viewer/components/Viewer3D/Viewer3D').then((m) => ({
      default: m.default,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
        Loading 3D viewer…
      </div>
    ),
  },
)

export default function ViewerCanvas({
  onFacePick,
  partUrl,
  partExt,
  labels,
  onLabelClick,
  onCardClick,
  cardVisibility,
  visibleCardFor,
}: Props) {
  // Mirrors the viewer's local UI state — the viewer needs at least an empty
  // array so its sidebar/right-panel toggling logic doesn't crash.
  const [activePanels, setActivePanels] = useState<string[]>([])

  // Subscribe to face-pick events from the viewer.
  useEffect(() => {
    if (!onFacePick) return
    const off = facePickEmitter.on((picked: PickedFace) => {
      void (async () => {
        const uuid = await stableFaceUuid(picked.face, picked.meshName)
        onFacePick({
          uuid,
          meshName: picked.meshName,
          centroid: {
            x: picked.face.centroid.x,
            y: picked.face.centroid.y,
            z: picked.face.centroid.z,
          },
          normal: {
            x: picked.face.normal.x,
            y: picked.face.normal.y,
            z: picked.face.normal.z,
          },
          area: picked.face.area,
          triangleCount: picked.face.triangleIndices.length,
        })
      })()
    })
    return off
  }, [onFacePick])

  return (
    <div className="dv-viewer-shell">
      <Viewer3DInner
        activePanels={activePanels as never}
        onPanelToggle={(p: string) =>
          setActivePanels((prev) =>
            prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
          )
        }
        loadUrl={partUrl}
        loadExt={partExt}
      />
      {labels !== undefined && labels.length > 0 && (
        <CommentLabels
          labels={labels}
          onClick={onLabelClick}
          onCardClick={onCardClick}
          cardVisibility={cardVisibility}
          visibleCardFor={visibleCardFor}
        />
      )}
    </div>
  )
}
