'use client'

/**
 * ProjectPinsTab — surfaces every widget the user has Bookmarked on the
 * Project Overview dashboard. Each pinned widget shows its title, a tiny
 * data preview, and an unpin button. Empty state nudges the user toward
 * the Overview tab.
 */

import Link from 'next/link'
import { Pin, X } from 'lucide-react'
import { CARD_TITLES, type CardId } from '@/components/projects/ProjectOverviewTab'
import type { MockFullDecision, MockMember } from '@/lib/mockWorkspace'

interface Props {
  bookmarks: string[]
  decisions: MockFullDecision[]
  members: MockMember[]
  onUnpin: (id: string) => void
  onGoToOverview: () => void
}

const ONE_DAY_MS = 24 * 3_600_000

export default function ProjectPinsTab({
  bookmarks,
  decisions,
  members,
  onUnpin,
  onGoToOverview,
}: Props): JSX.Element {
  if (bookmarks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-500">
          <Pin className="h-6 w-6 -rotate-12" />
        </div>
        <p className="mt-3 text-sm font-bold text-slate-900">No Pins Added</p>
        <p className="mt-1 max-w-md text-[12px] leading-relaxed text-slate-500">
          Open the <strong className="font-semibold text-slate-700">Overviews</strong> tab,
          click the <strong className="font-semibold text-slate-700">⋯</strong> menu on any
          widget, and choose <strong className="font-semibold text-slate-700">Bookmark</strong>{' '}
          to pin it here.
        </p>
        <button
          type="button"
          onClick={onGoToOverview}
          className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-primary-700"
        >
          Open Overviews
        </button>
      </div>
    )
  }

  // Only render IDs we recognise; ignore stale entries that no longer match a card.
  const known = bookmarks.filter((b): b is CardId => b in CARD_TITLES)

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {known.map((id) => (
        <PinCard
          key={id}
          id={id}
          preview={pinPreview(id, decisions, members)}
          onUnpin={() => onUnpin(id)}
        />
      ))}
    </div>
  )
}

function PinCard({
  id,
  preview,
  onUnpin,
}: {
  id: CardId
  preview: string
  onUnpin: () => void
}): JSX.Element {
  return (
    <article className="dv-anim-fade-up flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-px hover:shadow-md">
      <header className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Pin className="h-3.5 w-3.5 -rotate-12 text-rose-500" />
          <h3 className="text-[12.5px] font-bold text-slate-900">{CARD_TITLES[id]}</h3>
        </div>
        <button
          type="button"
          aria-label="Unpin"
          onClick={onUnpin}
          className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>
      <div className="flex-1 px-4 py-5">
        <p className="text-[12px] leading-relaxed text-slate-600">{preview}</p>
      </div>
      <footer className="border-t border-slate-100 bg-slate-50/50 px-4 py-2 text-[10px] text-slate-500">
        Pinned from Overviews · click ⋯ → Remove bookmark to unpin
      </footer>
    </article>
  )
}

function pinPreview(
  id: CardId,
  decisions: MockFullDecision[],
  members: MockMember[],
): string {
  const now = Date.now()
  switch (id) {
    case 'overdue': {
      const n = decisions.filter(
        (d) => d.state === 'PROPOSED' && now - +new Date(d.created_at) > ONE_DAY_MS,
      ).length
      return n === 0 ? 'No decisions overdue.' : `${n} decision${n === 1 ? '' : 's'} overdue.`
    }
    case 'blocked': {
      const n = decisions.filter(
        (d) => d.priority === 'blocker' || (d.tags?.includes('Blocker') ?? false),
      ).length
      return n === 0 ? 'Nothing blocked.' : `${n} blocked.`
    }
    case 'in-progress': {
      const n = decisions.filter((d) => d.state === 'DRAFT').length
      return n === 0 ? 'No drafts in progress.' : `${n} in progress.`
    }
    case 'open': {
      const n = decisions.filter(
        (d) => d.state === 'DRAFT' || d.state === 'PROPOSED' || d.state === 'ACCEPTED',
      ).length
      return `${n} open decision${n === 1 ? '' : 's'} (Draft · Proposed · Accepted).`
    }
    case 'members':
      return `${members.length} collaborator${members.length === 1 ? '' : 's'} on this project.`
    case 'by-status':
      return `${decisions.length} decision${decisions.length === 1 ? '' : 's'} grouped across four states.`
    case 'pins':
      return 'Empty state for the Pins widget on the Overviews tab.'
  }
}
