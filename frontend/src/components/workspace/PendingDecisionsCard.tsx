'use client'

import Link from 'next/link'
import { ArrowRight, Inbox, MessageSquare } from 'lucide-react'
import Avatar from './Avatar'
import { formatTimeAgo, type MockPendingDecision } from '@/lib/mockWorkspace'

interface Props {
  decisions: MockPendingDecision[]
}

export default function PendingDecisionsCard({ decisions }: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-red-600" />
          <h3 className="text-sm font-semibold text-slate-900">Awaiting your review</h3>
        </div>
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
          {decisions.length}
        </span>
      </header>

      {decisions.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <MessageSquare className="mx-auto h-7 w-7 text-slate-300" />
          <p className="mt-2 text-xs font-medium text-slate-700">All caught up</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            No comments are waiting for your decision.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {decisions.map((d) => (
            <li key={d.id} className="px-5 py-3 hover:bg-slate-50/60">
              <div className="flex items-start gap-2.5">
                <Avatar name={d.author_name} size="sm" />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/parts/${d.part_id}`}
                    className="block truncate text-xs font-semibold text-slate-900 hover:text-primary hover:underline"
                  >
                    {d.part_name}
                  </Link>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-600">
                    {d.rationale}
                  </p>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-500">
                    <span>
                      by <span className="font-semibold text-slate-700">{d.author_name}</span>
                    </span>
                    <span>{formatTimeAgo(d.created_at)}</span>
                  </div>
                </div>
                <Link
                  href={`/parts/${d.part_id}`}
                  aria-label="Open part"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-primary-50 hover:text-primary"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
