'use client'

/**
 * Render a body string with @Name mentions highlighted as teal pills.
 * Used by ReplyItem · CommentRow row preview · PDF export.
 */

import type { Mention } from '../types/thread.types'

interface Props {
  body: string
  mentions?: Mention[]
}

export default function MentionAwareText({ body, mentions = [] }: Props): JSX.Element {
  if (mentions.length === 0) return <span>{body}</span>
  const sorted = [...mentions].sort((a, b) => a.start - b.start)
  const parts: React.ReactNode[] = []
  let cursor = 0
  for (const m of sorted) {
    if (m.start > cursor) parts.push(body.slice(cursor, m.start))
    parts.push(
      <span
        key={`${m.start}-${m.userId}`}
        className="rounded bg-primary-50 px-1 font-semibold text-primary-700"
      >
        {body.slice(m.start, m.end)}
      </span>,
    )
    cursor = m.end
  }
  if (cursor < body.length) parts.push(body.slice(cursor))
  return <span>{parts}</span>
}
