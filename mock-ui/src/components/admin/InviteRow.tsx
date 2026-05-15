'use client'

import { useState } from 'react'
import { Check, Copy, X } from 'lucide-react'
import type { Invite } from '@/lib/mock-data'
import { formatRelative } from '@/lib/mock-data'

interface Props {
  invite: Invite
  onCopy: () => void
  onRevoke: () => void
}

export default function InviteRow({ invite, onCopy, onRevoke }: Props) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(invite.code)
    }
    setCopied(true)
    onCopy()
    window.setTimeout(() => setCopied(false), 1200)
  }
  return (
    <tr className="border-b border-rule transition-colors hover:bg-rule-soft/50">
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-ink">{invite.email}</p>
        <p className="text-[10px] text-ink-mute">invited by {invite.createdBy}</p>
      </td>
      <td className="px-4 py-3">
        <span className="rounded-full bg-rule-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
          {invite.role}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <code className="rounded border border-rule bg-rule-soft px-2 py-1 font-mono text-[11px] text-ink">
            {invite.code}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy code"
            className="inline-flex h-7 w-7 items-center justify-center rounded text-ink-mute transition-colors hover:bg-rule-soft hover:text-ink focus-ring"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-state-accepted" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-mute">expires {formatRelative(invite.expiresAt)}</td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={onRevoke}
          aria-label={`Revoke invite for ${invite.email}`}
          className="inline-flex h-7 items-center gap-1 rounded px-2 text-xs font-medium text-ink-mute transition-colors hover:bg-state-rejected/10 hover:text-state-rejected focus-ring"
        >
          <X className="h-3 w-3" />
          Revoke
        </button>
      </td>
    </tr>
  )
}
