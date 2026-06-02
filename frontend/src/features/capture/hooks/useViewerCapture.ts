'use client'

/**
 * useViewerCapture — orchestrates a single screenshot of the 3D viewer.
 *
 * Inputs (assumptions the caller must satisfy):
 *   · viewerContainerRef points at the DIV wrapping the WebGL canvas +
 *     DOM overlays. This is what html2canvas walks.
 *   · The Babylon scene was constructed with preserveDrawingBuffer: true
 *     (our engine already is — see _viewer/engine setup). Without it,
 *     toDataURL returns a blank canvas on Chrome.
 *
 * The hook reads the live scene from `useViewerStore.babylonScene` so
 * callers don't have to thread it. We FORCE A FRESH RENDER right before
 * snapshotting — Babylon's draw buffer is cleared every frame, so reading
 * the canvas a tick late returns black.
 *
 * Errors surface as Error objects via the returned `capture()` rejection.
 * The caller is responsible for showing a toast / status to the user.
 */

import { useCallback } from 'react'
import { api } from '@/lib/api'
import { useViewerStore } from '@/_viewer/store/viewerStore'
import { useCaptureStore } from '../store/captureStore'
import {
  captureCanvasOnly,
  captureComposite,
  hasDomOverlays,
} from '../utils/compositeOverlay'
import type {
  Capture,
  CaptureOptions,
  CameraState,
  ViewSettings,
} from '../types/capture.types'

interface UseViewerCaptureArgs {
  /** Ref to the DIV containing the canvas + DOM overlays. */
  viewerContainerRef: React.RefObject<HTMLElement>
  partId: string
  partName: string
  partVersion?: string
}

interface UseViewerCaptureApi {
  /** Take a screenshot. Resolves with the new Capture; pushes it to the store. */
  capture: (options?: CaptureOptions) => Promise<Capture>
  /** Whether the viewer is ready to capture (scene + canvas present). */
  isReady: boolean
}

/** Snapshot the non-camera display state (shading, grid, explode, etc.)
 * from the viewer store at capture time. These flow back through the
 * Restore View feature so the model looks the same as it did. */
function readViewSettings(): ViewSettings {
  const s = useViewerStore.getState()
  return {
    cameraMode: s.cameraMode,
    shadingMode: s.shadingMode,
    gridVisible: s.gridVisible,
    axesVisible: s.axesVisible,
    explodeFactor: s.explodeFactor,
    sectionPlane: s.sectionPlane,
    pmiVisible: s.pmiVisible,
  }
}

/** Babylon ArcRotateCamera reader — best-effort, returns nulls if any field
 * is missing. Other camera types fall through to null. */
function readCameraState(scene: unknown): CameraState {
  // We can't import @babylonjs/core here without bloating the bundle, so
  // we duck-type on the active camera fields we care about.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cam = (scene as any)?.activeCamera
  if (cam === null || cam === undefined) {
    return { alpha: null, beta: null, radius: null, target: null }
  }
  const alpha = typeof cam.alpha === 'number' ? (cam.alpha as number) : null
  const beta = typeof cam.beta === 'number' ? (cam.beta as number) : null
  const radius = typeof cam.radius === 'number' ? (cam.radius as number) : null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tgt = (cam.target ?? cam.lockedTarget) as any
  const target =
    tgt !== null && tgt !== undefined && typeof tgt.x === 'number'
      ? { x: tgt.x as number, y: tgt.y as number, z: tgt.z as number }
      : null
  return { alpha, beta, radius, target }
}

export function useViewerCapture({
  viewerContainerRef,
  partId,
  partName,
  partVersion,
}: UseViewerCaptureArgs): UseViewerCaptureApi {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scene = useViewerStore((s) => (s as any).babylonScene)
  const addPersisted = useCaptureStore((s) => s.addPersisted)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const engineCanvas: HTMLCanvasElement | null = (scene as any)?.getEngine?.()?.getRenderingCanvas?.() ?? null

  const isReady = scene !== null && scene !== undefined && engineCanvas !== null

  const capture = useCallback(
    async (options: CaptureOptions = {}): Promise<Capture> => {
      const container = viewerContainerRef.current
      if (container === null) throw new Error('Viewer container is not mounted')
      if (!isReady || engineCanvas === null) {
        throw new Error('3D viewer is still loading — try again in a moment')
      }

      // CRITICAL: force a fresh render. Without this, Chrome returns a black
      // canvas because the draw buffer was cleared by the previous swap.
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(scene as any).render?.()
      } catch (err) {
        // Some scene states (during teardown) throw; we still try the snapshot.
        // The toDataURL will fail loud if the buffer is truly unavailable.
        // eslint-disable-next-line no-console
        console.warn('scene.render() failed before capture; snapshot may be blank', err)
      }

      const mode = options.mode ?? 'auto'
      const useComposite =
        mode === 'composite' || (mode === 'auto' && hasDomOverlays(container))

      const result = useComposite
        ? await captureComposite({
            container,
            webglCanvas: engineCanvas,
            pixelRatio: options.pixelRatio,
            jpegQuality: options.jpegQuality,
          })
        : await captureCanvasOnly(
            engineCanvas,
            options.jpegQuality ?? 0.85,
            false,
          )

      // Round-trip through the backend FIRST. We don't push to the store
      // until the server has assigned an id and persisted the bytes — that
      // way the local model never diverges from Postgres. The user pays a
      // small latency hit (typically <300ms) and gets reliability for it.
      const cameraState = readCameraState(scene)
      const viewSettings = readViewSettings()
      // We pack camera + view into the same JSON column server-side. The
      // server treats `camera_state` as opaque JSON, so any shape goes.
      // On hydrate the captureStore unpacks them again.
      const server = await api.captures.create(partId, result.blob, {
        caption: '',
        width: result.width,
        height: result.height,
        cameraState: {
          alpha: cameraState.alpha,
          beta: cameraState.beta,
          radius: cameraState.radius,
          target: cameraState.target,
          view: viewSettings,
        },
      })

      const previewUrl = URL.createObjectURL(result.blob)
      const newCapture: Capture = {
        id: server.id,
        previewUrl,
        blob: result.blob,
        caption: server.caption,
        width: server.width,
        height: server.height,
        capturedAt: server.created_at,
        camera: cameraState,
        view: viewSettings,
        partId,
        partName,
        partVersion,
      }
      addPersisted(newCapture)
      return newCapture
    },
    [viewerContainerRef, isReady, engineCanvas, scene, addPersisted, partId, partName, partVersion],
  )

  return { capture, isReady }
}
