'use client'

/**
 * ExportButton — opens the ExportDialog. Compact, fits in the panel header.
 */

import { Download } from 'lucide-react'
import { useCommentsStore } from '../store/commentsStore'

interface Props {
  totalCount: number
  visibleCount: number
}

export default function ExportButton({ totalCount, visibleCount }: Props): JSX.Element {
  const openExportDialog = useCommentsStore((s) => s.openExportDialog)
  const exportDialogOpen = useCommentsStore((s) => s.exportDialogOpen)

  return (
    <button
      type="button"
      onClick={() => openExportDialog()}
      disabled={totalCount === 0}
      title={`Export ${visibleCount} thread${visibleCount === 1 ? '' : 's'} to PDF`}
      className={[
        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10.5px] font-semibold transition',
        exportDialogOpen
          ? 'border-primary/40 bg-primary-50 text-primary'
          : 'border-slate-200 bg-white text-slate-700 hover:border-primary/40 hover:text-primary',
        totalCount === 0 ? 'cursor-not-allowed opacity-40' : '',
      ].join(' ')}
    >
      <Download className="h-3 w-3" />
      Export
    </button>
  )
}
