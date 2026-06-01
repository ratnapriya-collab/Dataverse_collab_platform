'use client'

/**
 * ExportPdfButton — opens the export options dialog, kicks off the render.
 *
 * Reads captures from the store via the hook; disables itself when empty
 * (the gallery doesn't render this button in the empty state anyway, but
 * defensive coding for any future caller that always shows it).
 */

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, FileText, Loader2, X } from 'lucide-react'
import { useCaptureStore } from '../store/captureStore'
// .tsx since it contains JSX; Next resolves extension-less imports.
import { useExportPdf } from '../hooks/useExportPdf'

interface Props {
  partName: string
}

export default function ExportPdfButton({ partName }: Props): JSX.Element {
  const captures = useCaptureStore((s) => s.captures)
  const { exportPdf, exporting, error } = useExportPdf()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [title, setTitle] = useState(`${partName} — Captured views`)
  const [author, setAuthor] = useState('')
  const [includeTOC, setIncludeTOC] = useState(captures.length > 5)
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null)

  // Wait for DOM before portal-ing — Next.js SSR doesn't have document.body.
  useEffect(() => {
    if (typeof document !== 'undefined') setPortalNode(document.body)
  }, [])

  // Keep title in sync when caller's partName changes (rare but cheap).
  useEffect(() => {
    setTitle((prev) => (prev === '' ? `${partName} — Captured views` : prev))
  }, [partName])

  const handleExport = async (): Promise<void> => {
    await exportPdf({
      documentTitle: title.trim() === '' ? `${partName} — Captured views` : title.trim(),
      author: author.trim() === '' ? undefined : author.trim(),
      includeTOC,
    })
    if (error === null) setDialogOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        disabled={captures.length === 0}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[11.5px] font-bold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Download className="h-3.5 w-3.5" />
        Export PDF
      </button>

      {dialogOpen && portalNode !== null &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
              onClick={exporting ? undefined : () => setDialogOpen(false)}
              aria-hidden="true"
            />
            <div
              className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4"
              aria-hidden="true"
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Export captures to PDF"
                className="dv-anim-pop pointer-events-auto flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
              >
                <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <h2 className="text-[13px] font-bold text-slate-900">Export PDF</h2>
                  </div>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={() => setDialogOpen(false)}
                    disabled={exporting}
                    className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </header>

                <div className="dv-thin-scroll flex-1 space-y-3.5 overflow-y-auto px-5 py-4 text-sm">
                  <div>
                    <label htmlFor="pdf-title" className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                      Document title
                    </label>
                    <input
                      id="pdf-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={`${partName} — Captured views`}
                      className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[12px] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <label htmlFor="pdf-author" className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                      Author (optional)
                    </label>
                    <input
                      id="pdf-author"
                      type="text"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      placeholder="Your name"
                      className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[12px] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                    />
                  </div>

                  <label className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2 text-[11.5px]">
                    <input
                      type="checkbox"
                      checked={includeTOC}
                      onChange={(e) => setIncludeTOC(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-semibold text-slate-900">Include table of contents</span>
                      <span className="block text-[10.5px] text-slate-500">
                        Recommended when you have more than 5 captures.
                      </span>
                    </span>
                  </label>

                  <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">
                    <p className="font-semibold text-slate-800">Summary</p>
                    <p className="mt-0.5">
                      <strong className="font-bold tabular-nums">{captures.length}</strong>{' '}
                      capture{captures.length === 1 ? '' : 's'} · cover page ·{' '}
                      {includeTOC ? 'TOC · ' : ''}
                      one image per page · A4 portrait · captions + page numbers.
                    </p>
                  </div>

                  {error !== null && (
                    <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700">
                      {error}
                    </p>
                  )}
                </div>

                <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/60 px-5 py-3">
                  <button
                    type="button"
                    onClick={() => setDialogOpen(false)}
                    disabled={exporting}
                    className="rounded-md px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:text-slate-900 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={exporting || captures.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-bold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {exporting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Rendering…
                      </>
                    ) : (
                      <>
                        <Download className="h-3.5 w-3.5" />
                        Export {captures.length} view{captures.length === 1 ? '' : 's'}
                      </>
                    )}
                  </button>
                </footer>
              </div>
            </div>
          </>,
          portalNode,
        )}
    </>
  )
}
