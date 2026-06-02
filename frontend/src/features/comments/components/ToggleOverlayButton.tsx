'use client'

/**
 * ToggleOverlayButton — shows/hides every "+" pin and floating comment
 * card on the 3D viewer in one click.
 *
 * Lives next to <ExportButton/> in the CommentsPanel header. Drives the
 * `commentsOverlayVisible` flag in useViewerStore; CommentLabels reads
 * that flag and short-circuits its render when it's off — so both the
 * SVG pin layer AND the DOM card layer disappear together.
 *
 * Why a single switch and not two: the user mental model is "show me
 * the geometry vs show me the conversation". Splitting pins and cards
 * would force them to make two clicks for what is conceptually one
 * intent — and inevitably someone would hide cards but leave pins,
 * cluttering the view in a half-hidden state.
 *
 * Sized + styled to mirror ExportButton so the header reads as a pair.
 */

import { Eye, EyeOff } from 'lucide-react'
import { useViewerStore } from '@/_viewer/store/viewerStore'

interface Props {
  /** Total threads — drives the disabled state (no point hiding nothing). */
  totalCount: number
}

export default function ToggleOverlayButton({ totalCount }: Props): JSX.Element {
  const visible = useViewerStore((s) => s.commentsOverlayVisible)
  const toggle = useViewerStore((s) => s.toggleCommentsOverlay)
  const Icon = visible ? Eye : EyeOff
  const disabled = totalCount === 0

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-pressed={!visible}
      title={
        disabled
          ? 'No comments to hide'
          : visible
            ? 'Hide all pins + comment cards on the 3D viewer'
            : 'Show pins + comment cards on the 3D viewer'
      }
      className={[
        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10.5px] font-semibold transition',
        // Active = "annotations are HIDDEN" — surface as the noticeable state
        // so a quick glance tells you the viewer isn't showing comments.
        !visible
          ? 'border-amber-400/60 bg-amber-50 text-amber-700 hover:bg-amber-100'
          : 'border-slate-200 bg-white text-slate-700 hover:border-primary/40 hover:text-primary',
        disabled ? 'cursor-not-allowed opacity-40' : '',
      ].join(' ')}
    >
      <Icon className="h-3 w-3" />
      {visible ? 'Hide on viewer' : 'Show on viewer'}
    </button>
  )
}
