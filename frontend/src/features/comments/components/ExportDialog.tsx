'use client'

/**
 * ExportDialog — premium PDF export UI.
 *
 * Scope: all / selected / open-only · options: include resolved · include TOC.
 * Renders ThreadPDF via @react-pdf/renderer's pdf() helper, saves with
 * standard browser blob download. No server roundtrip for the common case
 * (under ~100 threads).
 */

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Download, FileText, Loader2, X } from 'lucide-react'
import { useCommentsStore } from '../store/commentsStore'
import type { Reply, Thread } from '../types/thread.types'
import ThreadPDF, { type ThreadPDFData } from '../pdf/ThreadPDF'

interface Props {
  partId: string
  partName: string
  threads: Thread[]
  rootRepliesByThread: Map<string, Reply>
  currentUserName: string
}

type Scope = 'all' | 'open-only' | 'selected'

export default function ExportDialog({
  partName,
  threads,
  currentUserName,
}: Props): JSX.Element | null {
  const closeExportDialog = useCommentsStore((s) => s.closeExportDialog)
  const selectedForExport = useCommentsStore((s) => s.selectedForExport)
  const [scope, setScope] = useState<Scope>('all')
  const [includeResolved, setIncludeResolved] = useState(true)
  const [includeTOC, setIncludeTOC] = useState(true)
  const [busy, setBusy] = useState(false)
  const [downloadedUrl, setDownloadedUrl] = useState<string | null>(null)

  // Threads to actually include in the export
  const scopedThreads = useMemo(() => {
    let base: Thread[]
    if (scope === 'selected') {
      base = threads.filter((t) => selectedForExport.has(t.id))
    } else if (scope === 'open-only') {
      base = threads.filter((t) => t.status === 'open')
    } else {
      base = threads
    }
    if (!includeResolved) base = base.filter((t) => t.status !== 'resolved')
    return base
  }, [threads, scope, selectedForExport, includeResolved])

  async function onExport(): Promise<void> {
    setBusy(true)
    setDownloadedUrl(null)
    try {
      // Gather replies for each thread from localStorage
      const enriched = scopedThreads.map((t) => {
        let replies: Reply[] = []
        try {
          const raw =
            typeof window !== 'undefined'
              ? window.localStorage.getItem(`dataverse.replies.${t.id}`)
              : null
          if (raw !== null) replies = JSON.parse(raw)
        } catch {
          // skip
        }
        return { ...t, replies, citations: undefined as string[] | undefined }
      })

      const data: ThreadPDFData = {
        partName,
        workspaceName: 'DataVerse Collab',
        exportedBy: currentUserName,
        exportedAt: new Date().toISOString(),
        threads: enriched,
        includeTOC,
      }

      // Dynamic import keeps @react-pdf/renderer out of the initial bundle.
      const { pdf } = await import('@react-pdf/renderer')
      const blob = await pdf(<ThreadPDF data={data} />).toBlob()
      const url = URL.createObjectURL(blob)
      setDownloadedUrl(url)
      // Auto-trigger download
      const a = document.createElement('a')
      a.href = url
      a.download = `${partName.replace(/\s+/g, '_')}-review-${Date.now()}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Export failed', err)
      window.alert('Export failed — see console for details.')
    } finally {
      setBusy(false)
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
        onClick={busy ? undefined : closeExportDialog}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Export comments to PDF"
        className="dv-anim-pop fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-slate-900">Export comments</h2>
          </div>
          <button
            type="button"
            onClick={busy ? undefined : closeExportDialog}
            disabled={busy}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-3.5 px-5 py-4 text-sm">
          {/* Scope */}
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              What to include
            </p>
            <div className="space-y-1">
              <RadioRow
                checked={scope === 'all'}
                onChange={() => setScope('all')}
                label="All threads"
                hint={`${threads.length} threads on this part`}
              />
              <RadioRow
                checked={scope === 'open-only'}
                onChange={() => setScope('open-only')}
                label="Open only"
                hint={`${threads.filter((t) => t.status === 'open').length} unresolved threads`}
              />
              <RadioRow
                checked={scope === 'selected'}
                onChange={() => setScope('selected')}
                label="Selected threads"
                hint={
                  selectedForExport.size > 0
                    ? `${selectedForExport.size} selected`
                    : 'Pick threads via the checkboxes that appear in the list'
                }
                disabled={selectedForExport.size === 0}
              />
            </div>
          </div>

          {/* Options */}
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Options
            </p>
            <div className="space-y-1">
              <CheckRow
                checked={includeResolved}
                onChange={setIncludeResolved}
                label="Include resolved threads"
              />
              <CheckRow
                checked={includeTOC}
                onChange={setIncludeTOC}
                label="Include table of contents (5+ threads)"
              />
            </div>
          </div>

          {/* Preview summary */}
          <div className="rounded-md border border-slate-200 bg-slate-50/60 px-3 py-2 text-[11px] text-slate-700">
            <p>
              <strong className="font-semibold">Exporting:</strong>{' '}
              {scopedThreads.length} thread{scopedThreads.length === 1 ? '' : 's'} ·
              {' '}
              {scopedThreads.reduce((s, t) => s + t.replyCount, 0)} total replies ·{' '}
              {Array.from(new Set(scopedThreads.flatMap((t) => t.participantIds))).length}{' '}
              participants
            </p>
            <p className="mt-1 text-[10px] text-slate-500">
              Client-side generation · downloads instantly · no upload.
            </p>
          </div>

          {downloadedUrl !== null && (
            <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
              <Check className="h-3.5 w-3.5" />
              PDF generated and downloaded. Did your browser block it? —{' '}
              <a
                href={downloadedUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold underline"
              >
                open manually
              </a>
              .
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/60 px-5 py-3">
          <button
            type="button"
            onClick={closeExportDialog}
            disabled={busy}
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:text-slate-900 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={busy || scopedThreads.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Rendering PDF…
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                Export {scopedThreads.length} thread{scopedThreads.length === 1 ? '' : 's'}
              </>
            )}
          </button>
        </footer>
      </div>
    </>,
    document.body,
  )
}

function RadioRow({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean
  onChange: () => void
  label: string
  hint: string
  disabled?: boolean
}): JSX.Element {
  return (
    <label
      className={[
        'flex items-start gap-2 rounded-md px-2 py-1.5 text-[12px] transition',
        disabled === true
          ? 'cursor-not-allowed opacity-50'
          : checked
            ? 'cursor-pointer bg-primary-50/60'
            : 'cursor-pointer hover:bg-slate-50',
      ].join(' ')}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="mt-0.5 h-3 w-3 accent-primary"
      />
      <div>
        <p className="font-semibold text-slate-900">{label}</p>
        <p className="text-[10.5px] text-slate-500">{hint}</p>
      </div>
    </label>
  )
}

function CheckRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}): JSX.Element {
  return (
    <label className="flex cursor-pointer items-center gap-2 px-2 py-1 text-[12px] text-slate-700 transition hover:text-slate-900">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3 w-3 accent-primary"
      />
      {label}
    </label>
  )
}
