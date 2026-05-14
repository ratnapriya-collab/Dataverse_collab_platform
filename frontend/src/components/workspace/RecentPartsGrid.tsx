'use client'

import Link from 'next/link'
import { Box, MessageCircle } from 'lucide-react'
import { HexMark } from '@/components/ui/Logo'
import { formatTimeAgo, type MockRecentPart, type PartTone } from '@/lib/mockWorkspace'

interface Props {
  parts: MockRecentPart[]
}

// Per-tone gradient for the thumbnail. Picked to look CAD-y (slightly metallic).
const THUMB: Record<PartTone, string> = {
  cyan: 'from-cyan-400 via-cyan-500 to-sky-600',
  amber: 'from-amber-300 via-amber-500 to-orange-600',
  emerald: 'from-emerald-400 via-emerald-500 to-teal-600',
  rose: 'from-rose-400 via-rose-500 to-pink-600',
  violet: 'from-violet-400 via-violet-500 to-fuchsia-600',
  slate: 'from-slate-300 via-slate-400 to-slate-600',
}

export default function RecentPartsGrid({ parts }: Props) {
  return (
    <section>
      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Recent parts</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Latest geometry uploaded by your team
          </p>
        </div>
        <Link
          href="/home"
          className="text-xs font-medium text-primary hover:text-primary-700 hover:underline"
        >
          View all →
        </Link>
      </header>

      {parts.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <Box className="mx-auto h-7 w-7 text-slate-300" />
          <p className="mt-2 text-sm font-medium text-slate-700">No parts yet</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Drop a STEP / GLB file on the home page to get started.
          </p>
        </div>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {parts.map((p) => (
            <li key={p.id}>
              <Link
                href={`/parts/${p.id}`}
                className="group block overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div
                  className={`relative flex h-32 items-center justify-center bg-gradient-to-br ${THUMB[p.tone]}`}
                >
                  <HexMark className="h-12 w-12 text-white/80 drop-shadow-md transition group-hover:scale-105" />
                  {p.open_comments_count > 0 && (
                    <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-1.5 py-0.5 text-[10px] font-bold text-red-700 shadow-sm">
                      <MessageCircle className="h-2.5 w-2.5" />
                      {p.open_comments_count}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-primary">
                    {p.name}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500">
                    {p.file_name}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                    <span>by {p.uploaded_by_name}</span>
                    <span>{formatTimeAgo(p.last_activity_at)}</span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
