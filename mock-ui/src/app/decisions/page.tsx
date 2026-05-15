'use client'

/**
 * /decisions — Screen A.6: Decision feed (workspace-wide)
 */

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import AppShell from '@/components/shell/AppShell'
import PageContainer from '@/components/shell/PageContainer'
import Dropdown from '@/components/ui/Dropdown'
import Input from '@/components/ui/Input'
import DecisionRow from '@/components/decisions/DecisionRow'
import { mockDecisions, mockMembers, type DecisionState } from '@/lib/mock-data'

type StateFilter = 'ALL' | DecisionState
type AuthorFilter = 'ALL' | string
type DateFilter = 'ALL' | '7d' | '30d' | '90d'

const STATE_OPTIONS: ReadonlyArray<{ value: StateFilter; label: string }> = [
  { value: 'ALL', label: 'All states' },
  { value: 'PROPOSED', label: 'Proposed' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SUPERSEDED', label: 'Superseded' },
]

const DATE_OPTIONS: ReadonlyArray<{ value: DateFilter; label: string }> = [
  { value: 'ALL', label: 'All time' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
]

export default function DecisionsFeed() {
  const [state, setState] = useState<StateFilter>('ALL')
  const [author, setAuthor] = useState<AuthorFilter>('ALL')
  const [date, setDate] = useState<DateFilter>('ALL')
  const [search, setSearch] = useState('')

  const authorOptions = useMemo<ReadonlyArray<{ value: AuthorFilter; label: string }>>(
    () => [
      { value: 'ALL', label: 'All authors' },
      ...mockMembers.map((m) => ({ value: m.id, label: m.name })),
    ],
    [],
  )

  const now = new Date('2026-05-14T12:00:00Z').getTime()
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return mockDecisions.filter((d) => {
      if (state !== 'ALL' && d.state !== state) return false
      if (author !== 'ALL' && d.author.id !== author) return false
      if (date !== 'ALL') {
        const days = date === '7d' ? 7 : date === '30d' ? 30 : 90
        const age = (now - new Date(d.createdAt).getTime()) / 86_400_000
        if (age > days) return false
      }
      if (q.length > 0) {
        const blob = `${d.id} ${d.rationale} ${d.anchorId} ${d.partId}`.toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [state, author, date, search, now])

  return (
    <AppShell>
      <PageContainer>
        <header className="mb-6 animate-fade-up">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-ink">Decisions</h1>
              <p className="mt-1 text-sm text-ink-mute">
                {mockDecisions.length} decisions across {new Set(mockDecisions.map((d) => d.partId)).size} parts
              </p>
            </div>
          </div>
        </header>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-rule bg-white p-3 shadow-card">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-mute" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rationale, anchor, ID…"
              className="pl-7"
            />
          </div>
          <Dropdown value={state} onChange={(v) => setState(v as StateFilter)} options={STATE_OPTIONS} className="w-40" />
          <Dropdown value={author} onChange={(v) => setAuthor(v as AuthorFilter)} options={authorOptions} className="w-44" />
          <Dropdown value={date} onChange={(v) => setDate(v as DateFilter)} options={DATE_OPTIONS} className="w-36" />
          <span className="ml-auto text-xs text-ink-mute">
            <strong className="text-ink">{filtered.length}</strong> matching
          </span>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-lg border border-rule bg-white shadow-card">
          <table className="w-full">
            <thead className="bg-rule-soft/60">
              <tr className="text-left">
                <Th>State</Th>
                <Th>Rationale</Th>
                <Th>Part</Th>
                <Th>Author</Th>
                <Th>Created</Th>
                <Th align="right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <DecisionRow key={d.id} decision={d} />
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-ink-mute">
                    No decisions match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between text-xs text-ink-mute">
          <p>
            Showing <strong className="text-ink">1–{filtered.length}</strong> of {mockDecisions.length}
          </p>
          <div className="flex items-center gap-1">
            <button className="rounded border border-rule px-2.5 py-1 font-medium text-ink-soft hover:bg-rule-soft disabled:opacity-40" disabled>
              Previous
            </button>
            <button className="rounded border border-rule bg-accent px-2.5 py-1 font-medium text-white">1</button>
            <button className="rounded border border-rule px-2.5 py-1 font-medium text-ink-soft hover:bg-rule-soft">2</button>
            <button className="rounded border border-rule px-2.5 py-1 font-medium text-ink-soft hover:bg-rule-soft">Next</button>
          </div>
        </div>
      </PageContainer>
    </AppShell>
  )
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-ink-mute ${align === 'right' ? 'text-right' : ''}`}>
      {children}
    </th>
  )
}
