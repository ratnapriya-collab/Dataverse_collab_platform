'use client'

/**
 * compositeOverlay — the WebGL + DOM-overlay capture trick.
 *
 * Problem: html2canvas can't read a WebGL canvas's contents (cross-origin
 * GPU protection — even with preserveDrawingBuffer, it just sees a black
 * box). But we DO want to capture the geometry under our DOM overlays
 * (pins, comment cards, leader lines).
 *
 * Solution (industry standard for WebGL screenshotting tools):
 *   1. Render the scene fresh, then snapshot the WebGL canvas to a dataURL
 *      via canvas.toDataURL('image/png').
 *   2. Call html2canvas on the VIEWER CONTAINER (the wrapper div holding
 *      the canvas + overlay layer).
 *   3. Pass an onclone() callback. html2canvas hands us the cloned DOM
 *      subtree about to be rasterised — we walk the clone, find the
 *      original WebGL canvas, and REPLACE it with an <img src={dataUrl}>.
 *   4. html2canvas rasterises the clone — the img provides the geometry,
 *      the surviving DOM nodes (pins, cards) render on top.
 *
 * The trick is the swap is done on the CLONE, never the live DOM — the
 * user never sees a flicker, the live canvas never stops.
 */

import html2canvas from 'html2canvas'

interface CompositeArgs {
  /** The container div wrapping the WebGL canvas + DOM overlays. */
  container: HTMLElement
  /** The live WebGL canvas inside `container`. We need both: the canvas
   * for the toDataURL snapshot, the container for html2canvas to walk. */
  webglCanvas: HTMLCanvasElement
  /** 1 = native resolution, 2 = retina. Capped to 4 to keep memory sane. */
  pixelRatio?: number
  /** JPEG output quality 0..1 — see captureStore for the reasoning. */
  jpegQuality?: number
  /** When true, returns a PNG instead of JPEG. PNG is lossless but ~4× heavier. */
  preferPng?: boolean
}

export interface CompositeResult {
  blob: Blob
  width: number
  height: number
  mimeType: string
}

/**
 * Capture the WebGL canvas alone, no DOM overlays. Fast path used when
 * the caller opts into 'canvas-only' mode, or when no overlays are present.
 */
export async function captureCanvasOnly(
  webglCanvas: HTMLCanvasElement,
  jpegQuality = 0.85,
  preferPng = false,
): Promise<CompositeResult> {
  const mimeType = preferPng ? 'image/png' : 'image/jpeg'
  return new Promise<CompositeResult>((resolve, reject) => {
    webglCanvas.toBlob(
      (blob) => {
        if (blob === null) {
          reject(new Error('toBlob returned null — canvas may be tainted'))
          return
        }
        resolve({
          blob,
          width: webglCanvas.width,
          height: webglCanvas.height,
          mimeType,
        })
      },
      mimeType,
      preferPng ? undefined : jpegQuality,
    )
  })
}

/**
 * Composite capture — WebGL canvas + DOM overlays in one image.
 *
 * Steps in detail:
 *   a) Snapshot the live WebGL canvas → dataURL. Must happen BEFORE the
 *      next frame clears its drawing buffer, so the caller is responsible
 *      for calling scene.render() immediately before this.
 *   b) Walk the cloned DOM (in onclone) and swap the canvas element for
 *      an <img>. Preserve width/height/className so layout is identical.
 *   c) Let html2canvas paint the clone, then convert to a blob.
 */
export async function captureComposite({
  container,
  webglCanvas,
  pixelRatio = Math.min(window.devicePixelRatio ?? 1, 2),
  jpegQuality = 0.85,
  preferPng = false,
}: CompositeArgs): Promise<CompositeResult> {
  // Step (a): freeze the current WebGL frame as a dataURL. PNG here because
  // the html2canvas pipeline re-encodes anyway; JPEG twice = quality loss.
  const webglDataUrl = webglCanvas.toDataURL('image/png')

  // Step (b) + (c): let html2canvas render the container, but in the clone
  // we replace the canvas with an img bearing our snapshot. This is the
  // ONLY reliable cross-browser approach for WebGL + DOM overlay capture.
  const renderedCanvas = await html2canvas(container, {
    backgroundColor: '#e9e9ee', // match the viewer's --bg-viewport
    scale: Math.max(1, Math.min(4, pixelRatio)),
    useCORS: true,
    allowTaint: false,
    logging: false,
    // CRITICAL: do not let html2canvas itself touch the WebGL canvas.
    // The element is filtered out of the clone entirely and replaced
    // with a static img bearing our pre-captured dataURL.
    ignoreElements: (el) =>
      el.tagName === 'CANVAS' && el !== webglCanvas
        ? // ignore any OTHER canvases (CommentLabels uses <svg>, but better safe)
          true
        : false,
    onclone: (clonedDoc, clonedContainer) => {
      // Find the cloned WebGL canvas — it sits at the same position in
      // the subtree as in the live DOM.
      const clonedCanvas = clonedContainer.querySelector('canvas')
      if (clonedCanvas === null) return
      // Build a replacement <img>. We sit it at the exact same position and
      // size so the overlay coordinates still line up over it.
      const img = clonedDoc.createElement('img')
      img.src = webglDataUrl
      img.width = clonedCanvas.clientWidth
      img.height = clonedCanvas.clientHeight
      img.style.width = clonedCanvas.style.width || `${clonedCanvas.clientWidth}px`
      img.style.height = clonedCanvas.style.height || `${clonedCanvas.clientHeight}px`
      img.style.display = 'block'
      // Preserve absolute positioning if any
      const computed = clonedDoc.defaultView?.getComputedStyle(clonedCanvas)
      if (computed?.position === 'absolute') {
        img.style.position = 'absolute'
        img.style.left = computed.left
        img.style.top = computed.top
      }
      clonedCanvas.parentNode?.replaceChild(img, clonedCanvas)
    },
  })

  const mimeType = preferPng ? 'image/png' : 'image/jpeg'
  return new Promise<CompositeResult>((resolve, reject) => {
    renderedCanvas.toBlob(
      (blob) => {
        if (blob === null) {
          reject(new Error('html2canvas output blob was null'))
          return
        }
        resolve({
          blob,
          width: renderedCanvas.width,
          height: renderedCanvas.height,
          mimeType,
        })
      },
      mimeType,
      preferPng ? undefined : jpegQuality,
    )
  })
}

/**
 * Heuristic: does the viewer container hold any DOM overlays that the user
 * would expect to see in their screenshot? If yes, we go through the
 * compositing path. If no, fast-path the canvas alone.
 */
export function hasDomOverlays(container: HTMLElement): boolean {
  // CommentLabels marks its cards with data-comment-card; pins are <g>
  // elements with data-pin. Either presence triggers compositing.
  return (
    container.querySelector('[data-comment-card]') !== null ||
    container.querySelector('[data-pin]') !== null ||
    // Catch-all: any non-canvas absolutely-positioned child.
    Array.from(container.children).some(
      (c) => c.tagName !== 'CANVAS' && c instanceof HTMLElement,
    )
  )
}
