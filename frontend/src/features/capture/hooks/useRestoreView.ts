'use client'

/**
 * useRestoreView — given a Capture, fly the live Babylon viewer back to
 * the exact view state that was active when the screenshot was taken.
 *
 * What gets restored:
 *   · ArcRotateCamera alpha / beta / radius / target — animated smoothly
 *     (cubic ease-in-out, ~600ms). Alpha picks the shorter arc so the
 *     camera doesn't spin the long way around when the saved angle is
 *     across the seam.
 *   · cameraMode (perspective ↔ orthographic) — snapped before animation
 *   · shadingMode, gridVisible, axesVisible, explodeFactor, sectionPlane,
 *     pmiVisible — snapped immediately
 *
 * What's deliberately NOT restored:
 *   · Selection / isolation / measurement tool — these are user-intent
 *     state, not "what the model looked like", and yanking them around
 *     would feel intrusive
 *   · Per-mesh tree visibility — same reason, plus the modelTree may
 *     have different node IDs across loads
 *
 * The hook reads the scene + camera + view-setter handles from the
 * existing useViewerStore so callers don't have to plumb them. We use
 * duck typing on the Babylon Scene + ArcRotateCamera to avoid pulling
 * the full @babylonjs/core types into the capture feature.
 */

import { useCallback, useState } from 'react'
import { useViewerStore } from '@/_viewer/store/viewerStore'
import type { Capture } from '../types/capture.types'

interface UseRestoreViewApi {
  /** Apply a capture's saved view state. Resolves when the animation completes. */
  restoreView: (capture: Capture) => Promise<void>
  /** True while an animation is in flight. */
  restoring: boolean
}

const ANIM_DURATION_MS = 600
const ANIM_FRAMES = 36 // 60fps * 0.6s

/** Pick the shorter angular distance for alpha so we don't lap around. */
function shortestAngle(from: number, to: number): number {
  let delta = to - from
  while (delta > Math.PI) delta -= 2 * Math.PI
  while (delta < -Math.PI) delta += 2 * Math.PI
  return from + delta
}

export function useRestoreView(): UseRestoreViewApi {
  const [restoring, setRestoring] = useState(false)

  const restoreView = useCallback(async (capture: Capture): Promise<void> => {
    const state = useViewerStore.getState()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scene = state.babylonScene as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const camera = (state.cameraRef ?? scene?.activeCamera) as any

    if (scene === null || scene === undefined) {
      throw new Error('3D viewer is still loading — open the part first')
    }
    if (camera === null || camera === undefined) {
      throw new Error('Camera not attached')
    }

    setRestoring(true)
    try {
      // ── 1. Snap non-camera display settings first ───────────────────────
      // These are cheap state writes — no animation needed; the user
      // perceives them as "the view changed" not as moving parts.
      const view = capture.view
      if (view !== undefined) {
        if (view.cameraMode !== undefined && view.cameraMode !== state.cameraMode) {
          state.setCameraMode(view.cameraMode)
        }
        if (view.shadingMode !== undefined && view.shadingMode !== state.shadingMode) {
          state.setShadingMode(view.shadingMode)
        }
        if (view.gridVisible !== undefined && view.gridVisible !== state.gridVisible) {
          state.toggleGrid()
        }
        if (view.axesVisible !== undefined && view.axesVisible !== state.axesVisible) {
          state.toggleAxes()
        }
        if (
          view.explodeFactor !== undefined &&
          Math.abs(view.explodeFactor - state.explodeFactor) > 0.001
        ) {
          state.setExplodeFactor(view.explodeFactor)
        }
        if (view.sectionPlane !== undefined) {
          // setSectionPlane handles both `null` and a value cleanly.
          state.setSectionPlane(view.sectionPlane)
        }
        if (view.pmiVisible !== undefined && view.pmiVisible !== state.pmiVisible) {
          state.togglePmi()
        }
      }

      // ── 2. Animate the camera to the saved pose ─────────────────────────
      const cam = capture.camera
      if (cam === null) return

      // We tween scalar fields imperatively across a fixed number of
      // frames. Direct mutation works well for ArcRotateCamera because
      // its internal matrix recomputes on each property write, so the
      // scene re-renders naturally.
      const fromAlpha = typeof camera.alpha === 'number' ? (camera.alpha as number) : 0
      const fromBeta = typeof camera.beta === 'number' ? (camera.beta as number) : 1.0
      const fromRadius = typeof camera.radius === 'number' ? (camera.radius as number) : 10
      const fromTarget = camera.target?.clone?.() ?? {
        x: 0,
        y: 0,
        z: 0,
        clone() {
          return { ...this }
        },
      }

      const targetAlpha =
        cam.alpha !== null ? shortestAngle(fromAlpha, cam.alpha) : fromAlpha
      const targetBeta = cam.beta !== null ? cam.beta : fromBeta
      const targetRadius = cam.radius !== null ? cam.radius : fromRadius
      const tgt = cam.target

      // cubic ease-in-out
      const ease = (t: number): number =>
        t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

      const startTs =
        typeof performance !== 'undefined' && typeof performance.now === 'function'
          ? performance.now()
          : 0

      await new Promise<void>((resolve) => {
        let cancelled = false
        const step = (now: number): void => {
          if (cancelled) return
          const elapsed = now - startTs
          const t = Math.min(1, elapsed / ANIM_DURATION_MS)
          const k = ease(t)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(camera as any).alpha = fromAlpha + (targetAlpha - fromAlpha) * k
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(camera as any).beta = fromBeta + (targetBeta - fromBeta) * k
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(camera as any).radius = fromRadius + (targetRadius - fromRadius) * k
          if (tgt !== null && camera.target !== undefined) {
            // ArcRotateCamera.target is a Vector3 — mutate component-wise
            // so we don't drop any reference behaviour the camera relies on.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(camera.target as any).x = fromTarget.x + (tgt.x - fromTarget.x) * k
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(camera.target as any).y = fromTarget.y + (tgt.y - fromTarget.y) * k
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(camera.target as any).z = fromTarget.z + (tgt.z - fromTarget.z) * k
          }
          if (t < 1) {
            window.requestAnimationFrame(step)
          } else {
            resolve()
          }
        }
        // Guard against the page being torn down mid-animation.
        window.requestAnimationFrame(step)
        // Safety: bail out if rAF stops firing for any reason.
        window.setTimeout(() => {
          if (!cancelled) {
            cancelled = true
            resolve()
          }
        }, ANIM_DURATION_MS + 500)
      })

      // Force a final render to make sure the last frame is on screen.
      try {
        scene.render?.()
      } catch {
        /* scene may have been torn down — ignore */
      }
      // Used parameter for future use in safety-cancel path.
      void ANIM_FRAMES
    } finally {
      setRestoring(false)
    }
  }, [])

  return { restoreView, restoring }
}
