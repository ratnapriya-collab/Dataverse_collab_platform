'use client'

/**
 * /parts/[partId] — Screen A.4 (Part viewer + Decisions panel) + Screen A.5 (Create Decision modal).
 *
 * Layout: mock viewer (left/center, dark surface) + 360px decisions panel on the right.
 */

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { notFound } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, GitBranch, MessageSquare, Plus, Send } from 'lucide-react'
import AppShell from '@/components/shell/AppShell'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import MockViewer from '@/components/viewer/MockViewer'
import DecisionCard from '@/components/decisions/DecisionCard'
import CreateDecisionModal from '@/components/decisions/CreateDecisionModal'
import StatePill from '@/components/decisions/StatePill'
import {
  formatRelative,
  getDecisionsForPart,
  getPart,
  mockUser,
  type Decision,
} from '@/lib/mock-data'

type Tab = 'decisions' | 'threads' | 'activity'

export default function PartPage({ params }: { params: { partId: string } }) {
  const part = getPart(params.partId)
  if (part === undefined) notFound()

  const search = useSearchParams()
  const focusFromUrl = search?.get('focus') ?? null
  const { toast } = useToast()

  const [decisions, setDecisions] = useState<Decision[]>(() => getDecisionsForPart(part.id))
  const [activeId, setActiveId] = useState<string | null>(focusFromUrl)
  const [createOpen, setCreateOpen] = useState(false)
  const [createAnchor, setCreateAnchor] = useState<string>('face-boss-7')
  const [tab, setTab] = useState<Tab>('decisions')

  useEffect(() => {
    if (focusFromUrl !== null) setActiveId(focusFromUrl)
  }, [focusFromUrl])

  // Scroll active decision into view in the side panel when it changes
  useEffect(() => {
    if (activeId === null) return
    const el = document.querySelector(`[data-decision-id="${activeId}"]`)
    if (el !== null) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeId])

  const grouped = useMemo(() => {
    const proposed = decisions.filter((d) => d.state === 'PROPOSED')
    const accepted = decisions.filter((d) => d.state === 'ACCEPTED')
    const rejected = decisions.filter((d) => d.state === 'REJECTED')
    const superseded = decisions.filter((d) => d.state === 'SUPERSEDED')
    return { proposed, accepted, rejected, superseded }
  }, [decisions])

  function handlePinClick(decisionId: string) {
    setActiveId(decisionId)
  }
  function handleFacePick() {
    // Simulate clicking on a face — opens the create modal with a fresh anchor id
    setCreateAnchor(`face-pick-${Math.floor(Math.random() * 90 + 10)}`)
    setCreateOpen(true)
  }
  function handleAccept(id: string) {
    setDecisions((prev) => prev.map((d) => (d.id === id ? { ...d, state: 'ACCEPTED' } : d)))
    toast('Decision accepted', { tone: 'success', description: id })
  }
  function handleReject(id: string) {
    setDecisions((prev) => prev.map((d) => (d.id === id ? { ...d, state: 'REJECTED' } : d)))
    toast('Decision rejected', { tone: 'error', description: id })
  }
  function handleCreate(newDec: Decision) {
    setDecisions((prev) => [newDec, ...prev])
    setCreateOpen(false)
    setActiveId(newDec.id)
    toast('Decision proposed', { tone: 'success', description: `${newDec.id} · awaiting signoff` })
  }

  return (
    <AppShell bare>
      <div className="flex h-[calc(100vh-3.5rem)] flex-col">
        {/* Sub-header (breadcrumb + action row) */}
        <div className="flex items-center justify-between gap-4 border-b border-rule bg-white px-6 py-2.5">
          <div className="flex items-center gap-3 text-xs">
            <Link
              href={`/projects/${mockUser.workspace.slug}`}
              className="inline-flex items-center gap-1 rounded px-2 py-1 font-medium text-ink-mute hover:bg-rule-soft hover:text-ink focus-ring"
            >
              <ChevronLeft className="h-3 w-3" />
              {mockUser.workspace.name}
            </Link>
            <span className="text-ink-mute">/</span>
            <span className="font-mono font-semibold text-ink">{part.name}</span>
            <span className="rounded bg-rule-soft px-1.5 py-0.5 font-mono text-[10px] text-ink-soft">{part.rev}</span>
            <span className="rounded bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] text-accent">{part.format}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/parts/${part.id}/what-changed`}
              className="inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-rule-soft hover:text-ink focus-ring"
            >
              <GitBranch className="h-3 w-3" />
              What changed
            </Link>
            <Link
              href={`/parts/${part.id}/plm-push`}
              className="inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-rule-soft hover:text-ink focus-ring"
            >
              <Send className="h-3 w-3" />
              Push to PLM
            </Link>
          </div>
        </div>

        {/* Two-panel layout */}
        <div className="grid flex-1 grid-cols-[1fr_360px] overflow-hidden">
          {/* Viewer */}
          <section className="relative overflow-hidden border-r border-rule bg-p-bg">
            <MockViewer
              part={part}
              decisions={decisions}
              activeDecisionId={activeId}
              onPinClick={handlePinClick}
              onFacePick={handleFacePick}
            />
          </section>

          {/* Decisions panel */}
          <aside className="flex h-full flex-col overflow-hidden bg-white">
            {/* Tabs */}
            <nav className="flex shrink-0 border-b border-rule bg-rule-soft/30">
              <TabBtn active={tab === 'decisions'} onClick={() => setTab('decisions')}>
                Decisions
                <span className="ml-1.5 rounded-full bg-accent-soft px-1.5 py-0.5 text-[9px] font-bold text-accent">
                  {decisions.length}
                </span>
              </TabBtn>
              <TabBtn active={tab === 'threads'} onClick={() => setTab('threads')}>Threads</TabBtn>
              <TabBtn active={tab === 'activity'} onClick={() => setTab('activity')}>Activity</TabBtn>
            </nav>

            {/* Toolbar */}
            <div className="flex shrink-0 items-center justify-between border-b border-rule px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-mute">
                {tab === 'decisions'
                  ? `${grouped.proposed.length} awaiting · ${grouped.accepted.length} accepted`
                  : tab === 'threads'
                  ? '0 open threads'
                  : `${decisions.length} events`}
              </p>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-3 w-3" />
                New Decision
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto thin-scroll bg-rule-soft/30">
              {tab === 'decisions' && (
                <div className="space-y-2 p-3">
                  {grouped.proposed.length > 0 && (
                    <SectionLabel>Proposed</SectionLabel>
                  )}
                  {grouped.proposed.map((d) => (
                    <DecisionCard
                      key={d.id}
                      decision={d}
                      active={activeId === d.id}
                      onClick={() => setActiveId(d.id)}
                      onAccept={() => handleAccept(d.id)}
                      onReject={() => handleReject(d.id)}
                    />
                  ))}
                  {grouped.accepted.length > 0 && <SectionLabel>Accepted</SectionLabel>}
                  {grouped.accepted.map((d) => (
                    <DecisionCard
                      key={d.id}
                      decision={d}
                      active={activeId === d.id}
                      onClick={() => setActiveId(d.id)}
                    />
                  ))}
                  {grouped.rejected.length > 0 && <SectionLabel>Rejected</SectionLabel>}
                  {grouped.rejected.map((d) => (
                    <DecisionCard
                      key={d.id}
                      decision={d}
                      active={activeId === d.id}
                      onClick={() => setActiveId(d.id)}
                    />
                  ))}
                  {grouped.superseded.length > 0 && <SectionLabel>Superseded</SectionLabel>}
                  {grouped.superseded.map((d) => (
                    <DecisionCard
                      key={d.id}
                      decision={d}
                      active={activeId === d.id}
                      onClick={() => setActiveId(d.id)}
                    />
                  ))}
                  {decisions.length === 0 && (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-rule bg-white py-10 text-center">
                      <p className="text-sm font-medium text-ink">No decisions yet</p>
                      <p className="mt-1 max-w-[16rem] text-xs text-ink-mute">
                        Click any face on the viewer to anchor a decision.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {tab === 'threads' && (
                <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-ink">No threads open</p>
                  <p className="mt-1 max-w-[18rem] text-xs text-ink-mute">
                    Threads spawn from comments on a decision. Open a decision and start a discussion.
                  </p>
                </div>
              )}

              {tab === 'activity' && (
                <ul className="space-y-3 p-3">
                  {decisions
                    .slice()
                    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
                    .map((d) => (
                      <li key={`act-${d.id}`} className="flex items-start gap-2.5 rounded-lg border border-rule bg-white p-3">
                        <Avatar name={d.author.name} initials={d.author.initials} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs">
                            <span className="font-semibold text-ink">{d.author.name}</span>{' '}
                            <span className="text-ink-mute">proposed</span>{' '}
                            <span className="font-mono text-[11px] font-semibold text-ink">{d.id}</span>
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-mute">{d.rationale}</p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <StatePill state={d.state} />
                            <span className="text-[10px] text-ink-mute">· {formatRelative(d.createdAt)}</span>
                          </div>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Create Decision modal */}
      <CreateDecisionModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        partId={part.id}
        partName={part.name}
        anchorId={createAnchor}
        onSubmit={handleCreate}
      />
    </AppShell>
  )
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-1 px-4 py-2.5 text-xs font-semibold transition-colors focus-ring ${
        active ? 'text-accent' : 'text-ink-mute hover:bg-rule-soft hover:text-ink'
      }`}
    >
      {children}
      {active && (
        <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" aria-hidden="true" />
      )}
    </button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 mt-3 flex items-center gap-2 px-1 first:mt-0">
      <span className="text-[10px] font-bold uppercase tracking-wide text-ink-mute">{children}</span>
      <span className="h-px flex-1 bg-rule" />
    </div>
  )
}
