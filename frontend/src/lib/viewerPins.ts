/**
 * Anchor projection — converts a 3D centroid into screen-space CSS pixels.
 *
 * No more 3D pin meshes. Comments are rendered purely as CAD-style 2D
 * callouts (SVG leader line + HTML box overlay), so we only need a way
 * to figure out where the centroid sits on the screen each frame. The
 * SVG arrowhead at the anchor end acts as the visual marker.
 */

import type { Scene } from '@babylonjs/core'
import { Matrix, Vector3 } from '@babylonjs/core'

export interface Centroid3D {
  x: number
  y: number
  z: number
}

/**
 * Project a 3D point onto the viewer's canvas in CSS pixel coordinates.
 * Returns null if no active camera. `behind = true` when the point is
 * behind the camera — caller should hide the label in that case.
 */
export function projectAnchor(
  scene: Scene,
  centroid: Centroid3D,
): { x: number; y: number; behind: boolean } | null {
  const engine = scene.getEngine()
  const camera = scene.activeCamera
  if (!camera) return null

  // Use the canvas's CSS dimensions (not device pixels) so screen coords
  // match the HTML overlay's coordinate space on high-DPI displays.
  const canvas = engine.getRenderingCanvas()
  const cssWidth = canvas?.clientWidth ?? engine.getRenderWidth()
  const cssHeight = canvas?.clientHeight ?? engine.getRenderHeight()

  const worldPos = new Vector3(centroid.x, centroid.y, centroid.z)
  const viewport = camera.viewport.toGlobal(cssWidth, cssHeight)
  const screen = Vector3.Project(
    worldPos,
    Matrix.Identity(),
    scene.getTransformMatrix(),
    viewport,
  )
  return { x: screen.x, y: screen.y, behind: screen.z > 1 }
}
