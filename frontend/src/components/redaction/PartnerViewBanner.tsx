'use client'

/**
 * PartnerViewBanner — sits below the part-viewer header when the admin is
 * previewing the page as a supplier. Shows what's hidden + a toggle to
 * reveal the redacted items with a red strikethrough overlay (admin debug
 * mode — partners never see the toggle).
 */

import Link from 'next/link'
import { Eye, EyeOff, Info, ShieldOff, X } from 'lucide-react'

interface Props {
  partnerName: string
  partnerOrg: string
  hiddenDecisions: number
  hiddenComments: number
  showWhatsHidden: boolean
  onToggleShow: () => void
  partPath: string
}

export default function PartnerViewBanner({
  partnerName,
  partnerOrg,
  hiddenDecisions,
  hiddenComments,
  showWhatsHidden,
  onToggleShow,
  partPath,
}: Props): JSX.Element {
  return (
    <div className="relative border-b border-amber-200 bg-gradient-to-r from-amber-50 via-amber-50 to-white px-6 py-2.5">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 ring-1 ring-amber-200">
          <ShieldOff className="h-2.5 w-2.5" />
          Partner view
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-amber-900">
            You&rsquo;re seeing this part as{' '}
            <strong className="font-bold">{partnerName}</strong>
            <span className="text-amber-700"> · {partnerOrg}</span>.
            {hiddenDecisions > 0 || hiddenComments > 0 ? (
              <>
                {' '}
                <strong className="font-semibold">{hiddenDecisions}</strong> internal{' '}
                {hiddenDecisions === 1 ? 'decision' : 'decisions'} and{' '}
                <strong className="font-semibold">{hiddenComments}</strong>{' '}
                {hiddenComments === 1 ? 'comment' : 'comments'} are hidden.
              </>
            ) : (
              <span> No internal content on this part — partner sees everything.</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleShow}
          aria-pressed={showWhatsHidden}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold shadow-sm transition ${
            showWhatsHidden
              ? 'border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100'
              : 'border-amber-300 bg-white text-amber-800 hover:bg-amber-50'
          }`}
        >
          {showWhatsHidden ? (
            <>
              <EyeOff className="h-3 w-3" />
              Hide redactions
            </>
          ) : (
            <>
              <Eye className="h-3 w-3" />
              Show what&rsquo;s hidden
            </>
          )}
        </button>
        <Link
          href={partPath}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100"
          title="Exit partner view"
        >
          <X className="h-3 w-3" />
          Exit
        </Link>
      </div>
      {/* Admin-only debug helper */}
      <p className="mx-auto mt-1 max-w-7xl text-[10px] text-amber-700/70">
        <Info className="-mt-0.5 mr-1 inline h-2.5 w-2.5" />
        Admin-only preview — partners never see this banner or the &ldquo;show hidden&rdquo; toggle.
      </p>
    </div>
  )
}
