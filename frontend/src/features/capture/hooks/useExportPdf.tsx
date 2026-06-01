'use client'

/**
 * useExportPdf — convert captures[] into a downloadable PDF.
 *
 * Lifecycle:
 *   1. Read the current ordered captures from the store.
 *   2. Convert each blob → dataURL (FileReader). dataURL is preferred over
 *      blob URLs because @react-pdf/renderer's headless render sometimes
 *      races blob: URL availability.
 *   3. Mount CapturePdfDocument with all inputs.
 *   4. pdf(<Doc/>).toBlob() — returns the final PDF blob.
 *   5. Trigger download via the utility, no extra deps.
 *
 * Returns:
 *   exporting   — true while the render is in flight
 *   error       — last error message, if any
 *   exportPdf() — kicks off the pipeline
 */

import { useCallback, useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { useCaptureStore } from '../store/captureStore'
import CapturePdfDocument, { type PdfCaptureInput } from '../pdf/CapturePdfDocument'
import { downloadBlob, safeFilename } from '../utils/download'
import type { ExportOptions } from '../types/capture.types'

interface UseExportPdfApi {
  exporting: boolean
  error: string | null
  /** Renders + downloads. No-op if there are no captures. */
  exportPdf: (options: ExportOptions) => Promise<void>
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('FileReader returned non-string result'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'))
    reader.readAsDataURL(blob)
  })
}

export function useExportPdf(): UseExportPdfApi {
  const captures = useCaptureStore((s) => s.captures)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const exportPdf = useCallback(
    async (options: ExportOptions) => {
      if (captures.length === 0) {
        setError('Nothing to export — capture at least one view first.')
        return
      }
      setExporting(true)
      setError(null)
      try {
        // (1) Convert blobs → dataURLs in parallel. Large captures take ~30ms
        // each; doing them sequentially would block the UI noticeably at
        // 20+ captures.
        const inputs: PdfCaptureInput[] = await Promise.all(
          captures.map(async (c, i) => ({
            dataUrl: await blobToDataUrl(c.blob),
            caption: c.caption,
            width: c.width,
            height: c.height,
            capturedAt: c.capturedAt,
            index: i,
          })),
        )

        // (2) Pull the parent's part info from the first capture — every
        // capture in the store shares the same part (the store is reset on
        // part change), so the first is canonical.
        const first = captures[0]!

        // (3) Render to blob.
        const doc = (
          <CapturePdfDocument
            documentTitle={options.documentTitle}
            partName={first.partName}
            partVersion={options.modelVersion ?? first.partVersion}
            author={options.author}
            generatedAt={new Date().toISOString()}
            captures={inputs}
            includeTOC={options.includeTOC}
          />
        )
        const blob = await pdf(doc).toBlob()

        // (4) Download.
        const filename = safeFilename(
          [first.partName, 'captured-views', new Date().toISOString().slice(0, 10)],
          'pdf',
        )
        downloadBlob(blob, filename)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'PDF export failed')
      } finally {
        setExporting(false)
      }
    },
    [captures],
  )

  return { exporting, error, exportPdf }
}
