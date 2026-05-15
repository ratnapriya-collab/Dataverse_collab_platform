'use client'

/**
 * /audit — Audit log feed with filters + expandable JSON payload per row.
 */

import { Fragment, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, FileText } from 'lucide-react'
import AppShell from '@/components/shell/AppShell'
import PageContainer from '@/components/shell/PageContainer'
import Dropdown from '@/components/ui/Dropdown'
import Avatar from '@/components/ui/Avatar'
import {
  formatRelative,
  mockEvents,
  mockMembers,
  type AuditEvent,
} from '@/lib/mock-data'

type EventTypeFilter = 'ALL' | AuditEvent['type']
type ActorFilter = 'ALL' | string
type DateFilter = 'ALL' | '7d' | '30d' | '90d'

const EVENT_TYPE_OPTIONS: ReadonlyArray<{ value: EventTypeFilter; label: string }> = [
  { value: 'ALL', label: 'All events' },
  { value: 'DECISION_PROPOSED', label: 'Decision proposed' },
  { value: 'DECISION_ACCEPTED', label: 'Decision accepted' },
  { value: 'DECISION_REJECTED', label: 'Decision rejected' },
  { value: 'DECISION_SUPERSEDED', label: 'Decision superseded' },
  { value: 'MEMBER_INVITED', label: 'Member invited' },
  { value: 'MEMBER_JOINED', label: 'Member joined' },
  { value: 'PART_UPLOADED', label: 'Part uploaded' },
  { value: 'REV_UPLOADED', label: 'Rev uploaded' },
  { value: 'RESOLVER_COMPLETED', label: 'Resolver completed' },
  { value: 'PLM_PUSHED', label: 'PLM pushed' },
]

const DATE_OPTIONS: ReadonlyArray<{ value: DateFilter; label: string }> = [
  { value: 'ALL', label: 'All time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
]

const EVENT_TONE: Record<AuditEvent['type'], string> = {
  DECISION_PROPOSED: 'bg-state-proposed/10 text-state-proposed',
  DECISION_ACCEPTED: 'bg-state-accepted/10 text-state-accepted',
  DECISION_REJECTED: 'bg-state-rejected/10 text-state-rejected',
  DECISION_SUPERSEDED: 'bg-state-superseded/15 text-state-superseded',
  MEMBER_INVITED: 'bg-blue-50 text-blue-700',
  MEMBER_JOINED: 'bg-accent-soft text-accent',
  PART_UPLOADED: 'bg-violet-50 text-violet-700',
  REV_UPLOADED: 'bg-violet-50 text-violet-700',
  RESOLVER_COMPLETED: 'bg-rule-soft text-ink-soft',
  PLM_PUSHED: 'bg-amber-50 text-amber-700',
}

export default function AuditPage() {
  const [type, setType] = useState<EventTypeFilter>('ALL')
  const [actor, setActor] = useState<ActorFilter>('ALL')
  const [date, setDate] = useState<DateFilter>('ALL')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const actorOptions = useMemo<ReadonlyArray<{ value: ActorFilter; label: string }>>(
    () => [
      { value: 'ALL', label: 'All actors' },
      { value: 'system', label: 'system' },
      ...mockMembers.map((m) => ({ value: m.name, label: m.name })),
    ],
    [],
  )

  const now = new Date('2026-05-14T12:00:00Z').getTime()
  const filtered = useMemo(() => {
    return mockEvents
      .filter((ev) => {
        if (type !== 'ALL' && ev.type !== type) return false
        if (actor !== 'ALL' && ev.actor.name !== actor) return false
        if (date !== 'ALL') {
          const days = date === '7d' ? 7 : date === '30d' ? 30 : 90
          const age = (now - new Date(ev.at).getTime()) / 86_400_000
          if (age > days) return false
        }
        return true
      })
      .sort((a, b) => +new Date(b.at) - +new Date(a.at))
  }, [type, actor, date, now])

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <AppShell>
      <PageContainer>
        <header className="mb-6 flex items-end justify-between gap-3 animate-fade-up">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Audit log</h1>
            <p className="mt-1 text-sm text-ink-mute">
              Every change is permanently logged · immutable record · exportable
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded border border-rule bg-white px-3 py-1.5 text-xs font-medium text-ink-soft shadow-sm transition-colors hover:bg-rule-soft hover:text-ink focus-ring"
          >
            <FileText className="h-3 w-3" />
            Export as CSV
          </button>
        </header>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-rule bg-white p-3 shadow-card">
          <Dropdown value={type} onChange={(v) => setType(v as EventTypeFilter)} options={EVENT_TYPE_OPTIONS} className="w-52" />
          <Dropdown value={actor} onChange={(v) => setActor(v as ActorFilter)} options={actorOptions} className="w-44" />
          <Dropdown value={date} onChange={(v) => setDate(v as DateFilter)} options={DATE_OPTIONS} className="w-36" />
          <span className="ml-auto text-xs text-ink-mute">
            <strong className="text-ink">{filtered.length}</strong> events
          </span>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-lg border border-rule bg-white shadow-card">
          <table className="w-full">
            <thead className="bg-rule-soft/60">
              <tr className="text-left">
                <Th>&nbsp;</Th>
                <Th>Time</Th>
                <Th>Type</Th>
                <Th>Actor</Th>
                <Th>Target</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ev) => {
                const open = expanded.has(ev.id)
                return (
                  <Fragment key={ev.id}>
                    <tr
                      onClick={() => toggle(ev.id)}
                      className="cursor-pointer border-b border-rule transition-colors hover:bg-rule-soft/50"
                    >
                      <td className="px-3 py-3">
                        <span className="inline-flex h-5 w-5 items-center justify-center text-ink-mute">
                          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs">
                        <p className="font-mono text-ink">{new Date(ev.at).toISOString().slice(0, 16).replace('T', ' ')}</p>
                        <p className="text-[10px] text-ink-mute">{formatRelative(ev.at)}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${EVENT_TONE[ev.type]}`}>
                          {ev.type}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={ev.actor.name} initials={ev.actor.initials} size="xs" />
                          <span className="text-xs text-ink-soft">{ev.actor.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-mono text-xs text-ink">{ev.target}</span>
                      </td>
                    </tr>
                    {open && (
                      <tr className="border-b border-rule bg-rule-soft/30">
                        <td colSpan={5} className="px-12 py-3">
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-mute">Payload</p>
                          <pre className="overflow-x-auto rounded border border-rule bg-p-bg p-3 font-mono text-[11px] leading-relaxed text-p-text">
{JSON.stringify({ id: ev.id, type: ev.type, actor: ev.actor.name, target: ev.target, at: ev.at, ...ev.payload }, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </PageContainer>
    </AppShell>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-ink-mute">{children}</th>
  )
}
