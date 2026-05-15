'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import StatePill from './StatePill'
import Avatar from '@/components/ui/Avatar'
import type { Decision } from '@/lib/mock-data'
import { formatRelative, mockParts } from '@/lib/mock-data'

interface Props {
  decision: Decision
}

export default function DecisionRow({ decision }: Props) {
  const d = decision
  const part = mockParts.find((p) => p.id === d.partId)
  return (
    <tr className="group border-b border-rule transition-colors hover:bg-rule-soft/50">
      <td className="px-4 py-3 align-top">
        <StatePill state={d.state} />
      </td>
      <td className="max-w-md px-4 py-3 align-top">
        <p className="line-clamp-2 text-sm text-ink">{d.rationale}</p>
        <p className="mt-1 font-mono text-[10px] text-ink-mute">
          {d.id} · {d.anchorId}
        </p>
      </td>
      <td className="px-4 py-3 align-top">
        <Link
          href={`/parts/${d.partId}?focus=${d.id}`}
          className="text-sm font-medium text-ink hover:text-accent hover:underline"
        >
          {part?.name ?? d.partId}
        </Link>
        <p className="text-[10px] text-ink-mute">{part?.rev}</p>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-2">
          <Avatar name={d.author.name} initials={d.author.initials} size="xs" />
          <span className="text-xs text-ink-soft">{d.author.name}</span>
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-ink-mute">
        {formatRelative(d.createdAt)}
      </td>
      <td className="px-4 py-3 align-top text-right">
        <Link
          href={`/parts/${d.partId}?focus=${d.id}`}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft focus-ring"
        >
          View
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </td>
    </tr>
  )
}
