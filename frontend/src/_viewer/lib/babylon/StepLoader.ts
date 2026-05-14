/**
 * STEP loader — STUBBED OUT in the DataVerse Next.js build.
 *
 * The original viewer's STEP loader uses a Web Worker that imports
 * opencascade.js, which has a WASM entry incompatible with Next.js's webpack
 * (no default export). STEP support comes back on Day 3 when we wire up
 * file upload + server-side parsing.
 *
 * Sample geometry (box + sphere + cylinder) and GLB / GLTF drag-drop still
 * work — they don't go through this file.
 */

import type { Scene, AbstractMesh } from '@babylonjs/core'
import type { TreeNode, PMIAnnotation } from '../../types/viewer'

export type StepProgressCallback = (msg: string) => void

export interface StepLoadResult {
  meshes: AbstractMesh[]
  tree: TreeNode[]
  pmi: PMIAnnotation[]
}

export async function loadSTEP(
  _file: File,
  _scene: Scene,
  _onProgress: StepProgressCallback = () => {},
): Promise<StepLoadResult> {
  throw new Error(
    'STEP support is not enabled in this build. Drop a .glb / .gltf file, or upload via the parts API (Day 3).',
  )
}
