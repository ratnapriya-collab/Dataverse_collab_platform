/**
 * Capture types — "Capture View → Gallery → Export PDF" feature.
 *
 * Each capture is an in-memory PNG/JPEG blob, exposed via a stable object
 * URL for cheap <img src=…> preview rendering. The dataUrl is held in
 * memory ONLY at PDF-export time (re-derived from the blob).
 *
 * CameraState is captured at the moment of snapshot — opt-in surface for
 * future "jump to this view" functionality (the PDF doesn't render it
 * today, but the data model carries it so we don't have to migrate later).
 */

export interface CameraState {
  /** Polar/azimuthal/radius in Babylon's arc-rotate camera frame, or null
   * if the viewer didn't expose a camera handle at capture time. */
  alpha: number | null
  beta: number | null
  radius: number | null
  target: { x: number; y: number; z: number } | null
}

export interface Capture {
  /** Stable id — used as a React key and as the index for reorder ops. */
  id: string
  /** A blob URL for `<img>` preview. Revoke before dropping the Capture. */
  previewUrl: string
  /** The raw image bytes, kept so we can re-create the dataURL for PDF. */
  blob: Blob
  /** User-editable caption, default ''. Rendered under the image in PDF. */
  caption: string
  /** Pixel dimensions of the underlying image. */
  width: number
  height: number
  /** ISO timestamp at capture. */
  capturedAt: string
  /** Camera state at capture — opt-in, for future "open this view" feature. */
  camera: CameraState | null
  /** Part this capture was taken from — for the PDF cover page. */
  partId: string
  partName: string
  /** Optional model version. Empty in the demo; the data model supports it. */
  partVersion?: string
}

export interface CaptureOptions {
  /** 'auto' = composite if DOM overlays are present; 'canvas-only' = WebGL only;
   * 'composite' = force html2canvas walk. */
  mode?: 'auto' | 'canvas-only' | 'composite'
  /** JPEG quality 0-1. JPEG is used because PDFs of 20+ retina PNGs balloon
   * to 50MB+ memory; JPEG-85 keeps a typical capture at ~150KB. */
  jpegQuality?: number
  /** Multiplier applied to the canvas resolution. 1 = native, 2 = retina.
   * Higher = better PDF prints, more memory + slower capture. */
  pixelRatio?: number
}

export interface ExportOptions {
  documentTitle: string
  author?: string
  modelVersion?: string
  /** Add a TOC page when captures > 5. Visual only — not used today. */
  includeTOC?: boolean
}
