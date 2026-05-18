'use client'

/**
 * PartConversationHub — the right-rail panel on /parts/[id].
 *
 * "Stay in the viewer" pattern (CoLab-style):
 *   • Compact part header (4× denser than the previous KV block)
 *   • Optional partner-view layer (delegated to existing components)
 *   • Quick-nav icon row (What changed / Walkthrough / Concierge / Push)
 *   • Tab strip: Comments · Issues · Activity · Threads
 *   • Each tab's content lives inside this same column — no page hops
 *
 * Comments tab REUSES the existing DecisionsPanel verbatim so Accept /
 * Reject, hover-sync with 3D pins, and the partner-view filter all
 * keep working identically. Issues / Activity / Threads are pure
 * read-only views derived from seed data.
 */

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Box,
  Check,
  ClipboardList,
  History,
  Inbox,
  MessageSquare,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Workflow,
} from 'lucide-react'
import DecisionsPanel from '@/components/decisions/DecisionsPanel'
import RedactedDecisionCard from '@/components/redaction/RedactedDecisionCard'
import DatumRedactionExplainer from '@/components/redaction/DatumRedactionExplainer'
import IssueTagChip from '@/components/feedback/IssueTagChip'
import PriorityIndicator, {
  priorityBarClass,
} from '@/components/feedback/PriorityIndicator'
import Avatar from '@/components/workspace/Avatar'
import {
  SEED_ACTIVITY,
  SEED_FULL_DECISIONS,
  formatTimeAgo,
} from '@/lib/mockWorkspace'
import type { DecisionRead } from '@/types/api'

type HubTab = 'comments' | 'issues' | 'activity' | 'threads'

interface Props {
  // Part info
  partId: string
  partName: string
  partFileName: string
  partContentHash: string
  partCreatedAt: string

  // Decisions (real + partner-filtered)
  decisions: DecisionRead[]
  visibleDecisions: DecisionRead[]
  redactedDecisions: DecisionRead[]
  onDecisionChanged: (d: DecisionRead) => void
  highlightedFaceUuid: string | null
  onHoverDecision: (faceUuid: string | null) => void

  // Partner-view state (driven by parent)
  isPartner: boolean
  showWhatsHidden: boolean
  hiddenCommentsCount: number

  // Redaction reason resolver — owned by the page (same regex as Day 5)
  reasonFor: (d: DecisionRead) => 'internal-flag' | 'cost-keyword' | 'admin-only-thread' | null
}

export default function PartConversationHub({
  partId,
  partName,
  partFileName,
  partContentHash,
  partCreatedAt,
  decisions,
  visibleDecisions,
  redactedDecisions,
  onDecisionChanged,
  highlightedFaceUuid,
  onHoverDecision,
  isPartner,
  showWhatsHidden,
  hiddenCommentsCount,
  reasonFor,
}: Props): JSX.Element {
  const [tab, setTab] = useState<HubTab>('comments')

  // ── Derived counts for tab badges ─────────────────────────────────
  const openCount = useMemo(
    () => decisions.filter((d) => d.state === 'PROPOSED' || d.state === 'DRAFT').length,
    [decisions],
  )

  // Issue rows: SEED_FULL_DECISIONS for this part (demo parts have these;
  // real backend parts will return an empty list — handled by EmptyState).
  const issueRows = useMemo(
    () => SEED_FULL_DECISIONS.filter((d) => d.part_id === partId),
    [partId],
  )

  // Part-scoped activity (heuristic on target). Matches demo + real parts
  // by part name fragment OR partId substring.
  const activityRows = useMemo(() => {
    const namePiece = partName.toLowerCase().split(' ')[0] ?? ''
    return SEED_ACTIVITY.filter((a) => {
      const target = (a.target ?? '').toLowerCase()
      return (
        target.includes(partId.toLowerCase()) ||
        (namePiece.length > 2 && target.includes(namePiece))
      )
    }).slice(0, 12)
  }, [partId, partName])

  // Tab counts shown as small chips
  const counts: Record<HubTab, number> = {
    comments: decisions.length,
    issues: issueRows.length,
    activity: activityRows.length,
    threads: decisions.filter((d) => d.state !== 'DRAFT').length,
  }

  // Used by partner-view dimming (refers existing redaction reason resolver)
  const visibleForComments = isPartner ? visibleDecisions : decisions

  return (
    <aside className="dv-thin-scroll flex h-full flex-col overflow-y-auto border-l border-slate-200 bg-white">
      {/* ── Compact part header ─────────────────────────────────────── */}
      <header className="border-b border-slate-100 bg-slate-50/60 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <Box className="h-3 w-3 shrink-0 text-slate-400" />
          <p className="truncate text-[12px] font-bold text-slate-900">{partName}</p>
        </div>
        <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500">
          {partFileName} · {partContentHash.slice(0, 12)}…
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]">
          <span className="font-semibold text-slate-900">{openCount}</span>
          <span className="text-slate-500">open</span>
          <span className="text-slate-300">·</span>
          <span className="font-semibold text-slate-900">{decisions.length}</span>
          <span className="text-slate-500">decisions</span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-500">added {formatTimeAgo(partCreatedAt)}</span>
        </div>
      </header>

      {/* ── Partner-view block (Day 5) ───────────────────────────────── */}
      {isPartner && (
        <div className="space-y-2 border-b border-slate-100 px-3 py-2.5">
          <DatumRedactionExplainer
            hiddenDecisions={redactedDecisions.length}
            hiddenComments={hiddenCommentsCount}
          />
          {redactedDecisions.length > 0 && (
            <>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                Hidden by Datum ({redactedDecisions.length})
              </p>
              <div className="space-y-1.5">
                {redactedDecisions.map((d) => (
                  <RedactedDecisionCard
                    key={d.id}
                    decisionId={d.id}
                    reason={reasonFor(d) ?? 'internal-flag'}
                    showWhatsHidden={showWhatsHidden}
                    hiddenRationale={d.rationale}
                    hiddenAuthorName={d.author?.name}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Quick-nav icon row ───────────────────────────────────────── */}
      <nav
        aria-label="Part companion views"
        className="grid grid-cols-4 gap-1 border-b border-slate-100 px-2 py-1.5"
      >
        <QuickNav href={`/parts/${partId}/what-changed`} icon={RotateCcw} label="What changed" />
        <QuickNav href={`/parts/${partId}/walkthrough`} icon={Workflow} label="Walkthrough" />
        <QuickNav href={`/parts/${partId}/concierge`} icon={Sparkles} label="Concierge" tone="purple" />
        <QuickNav href={`/parts/${partId}/plm-push`} icon={Send} label="Push to PLM" />
      </nav>

      {/* ── Tab strip ────────────────────────────────────────────────── */}
      <nav
        aria-label="Conversation tabs"
        className="sticky top-0 z-10 flex shrink-0 items-stretch border-b border-slate-200 bg-white"
      >
        <TabBtn id="comments" active={tab} onClick={setTab} icon={MessageSquare} count={counts.comments}>
          Comments
        </TabBtn>
        <TabBtn id="issues" active={tab} onClick={setTab} icon={ClipboardList} count={counts.issues}>
          Issues
        </TabBtn>
        <TabBtn id="activity" active={tab} onClick={setTab} icon={History} count={counts.activity}>
          Activity
        </TabBtn>
        <TabBtn id="threads" active={tab} onClick={setTab} icon={MessageSquare} count={counts.threads}>
          Threads
        </TabBtn>
      </nav>

      {/* ── Tab content (no page hop, just swap body) ────────────────── */}
      <div className="flex-1 px-2 py-2">
        {tab === 'comments' && (
          <DecisionsPanel
            decisions={visibleForComments}
            onChanged={onDecisionChanged}
            highlightedFaceUuid={highlightedFaceUuid}
            onHoverDecision={onHoverDecision}
          />
        )}
        {tab === 'issues' && <IssuesTabBody partId={partId} rows={issueRows} />}
        {tab === 'activity' && <ActivityTabBody rows={activityRows} />}
        {tab === 'threads' && <ThreadsTabBody decisions={visibleForComments} />}
      </div>
    </aside>
  )
}

// ── Tab button ──────────────────────────────────────────────────────────────

function TabBtn({
  id,
  active,
  onClick,
  icon: Icon,
  count,
  children,
}: {
  id: HubTab
  active: HubTab
  onClick: (t: HubTab) => void
  icon: typeof MessageSquare
  count: number
  children: React.ReactNode
}): JSX.Element {
  const isActive = id === active
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => onClick(id)}
      className={`relative inline-flex flex-1 items-center justify-center gap-1 px-2 py-2 text-[11px] font-semibold transition ${
        isActive ? 'text-primary' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
      }`}
    >
      <Icon className="h-3 w-3" />
      <span className="hidden lg:inline">{children}</span>
      <span
        className={`rounded-full px-1 text-[9px] font-bold tabular-nums ${
          isActive ? 'bg-primary-50 text-primary-700' : 'bg-slate-100 text-slate-600'
        }`}
      >
        {count}
      </span>
      {isActive && <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-primary" />}
    </button>
  )
}

// ── Quick nav icon ──────────────────────────────────────────────────────────

function QuickNav({
  href,
  icon: Icon,
  label,
  tone,
}: {
  href: string
  icon: typeof RotateCcw
  label: string
  tone?: 'purple'
}): JSX.Element {
  const ring =
    tone === 'purple'
      ? 'hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700'
      : 'hover:border-primary hover:bg-primary-50 hover:text-primary'
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className={`flex items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px] font-medium text-slate-700 transition ${ring}`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      <span className="hidden truncate xl:inline">{label}</span>
    </Link>
  )
}

// ── Issues tab body ─────────────────────────────────────────────────────────

function IssuesTabBody({
  partId,
  rows,
}: {
  partId: string
  rows: typeof SEED_FULL_DECISIONS
}): JSX.Element {
  if (rows.length === 0) {
    return (
      <EmptyTab
        icon={Inbox}
        title="No issues raised on this part"
        body="Comments with tags + priority will appear here. Click any face on the model to start one."
      />
    )
  }
  return (
    <ul className="space-y-1.5">
      {rows.map((d) => (
        <li key={d.id}>
          <Link
            href={`/parts/${partId}?focus=${d.id}`}
            className="group flex items-stretch gap-1 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <span
              className={`w-0.5 shrink-0 ${priorityBarClass(d.priority)}`}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1 px-2 py-1.5">
              <div className="flex items-baseline gap-1.5">
                <PriorityIndicator priority={d.priority} />
                <span className="ml-auto whitespace-nowrap text-[10px] text-slate-400">
                  {formatTimeAgo(d.created_at)}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-[11px] font-semibold text-slate-900">
                {d.title ?? d.rationale.split('.')[0]}
              </p>
              {(d.tags ?? []).length > 0 && (
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {(d.tags ?? []).slice(0, 3).map((t) => (
                    <IssueTagChip key={t} tag={t} />
                  ))}
                </div>
              )}
              <div className="mt-1.5 flex items-center gap-1.5 text-[10px]">
                <Avatar name={d.author_name} size="sm" />
                <span className="truncate font-medium text-slate-700">{d.author_name}</span>
                {d.assignee_name !== undefined && (
                  <>
                    <span className="text-slate-300">→</span>
                    <span className="truncate text-slate-700">{d.assignee_name}</span>
                  </>
                )}
                <ArrowUpRight className="ml-auto h-2.5 w-2.5 text-slate-400 opacity-0 transition group-hover:opacity-100" />
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

// ── Activity tab body ───────────────────────────────────────────────────────

const ACTIVITY_TONE: Record<string, string> = {
  COMMENT_CREATED: 'bg-amber-500',
  COMMENT_ACCEPTED: 'bg-emerald-500',
  COMMENT_REJECTED: 'bg-rose-500',
  PART_UPLOADED: 'bg-violet-500',
  REV_UPLOADED: 'bg-violet-600',
  MEMBER_JOINED: 'bg-primary',
  INVITE_CREATED: 'bg-brand-600',
}

function ActivityTabBody({
  rows,
}: {
  rows: typeof SEED_ACTIVITY
}): JSX.Element {
  if (rows.length === 0) {
    return (
      <EmptyTab
        icon={History}
        title="No recent activity"
        body="Uploads, decision events, and signoffs scoped to this part will land here."
      />
    )
  }
  return (
    <ol className="relative space-y-1.5 pl-5">
      <span aria-hidden="true" className="absolute left-2 top-2 bottom-2 w-px bg-slate-200" />
      {rows.map((a) => {
        const dot = ACTIVITY_TONE[a.kind] ?? 'bg-slate-400'
        return (
          <li key={a.id} className="relative">
            <span
              aria-hidden="true"
              className={`absolute left-[-14px] top-1.5 z-10 flex h-2 w-2 items-center justify-center rounded-full ring-2 ring-white ${dot}`}
            >
              {a.kind === 'COMMENT_ACCEPTED' && (
                <Check className="h-1.5 w-1.5 text-white" strokeWidth={4} />
              )}
            </span>
            <p className="text-[11px] leading-snug">
              <span className="font-semibold text-slate-900">{a.actor_name}</span>{' '}
              <span className="text-slate-500">{a.kind.replace(/_/g, ' ').toLowerCase()}</span>
              {a.target !== undefined && (
                <span className="ml-1 font-mono text-[10px] text-slate-700">{a.target}</span>
              )}
            </p>
            {a.snippet !== undefined && (
              <p className="mt-0.5 line-clamp-1 text-[10px] italic text-slate-500">{a.snippet}</p>
            )}
            <p className="mt-0.5 text-[9px] text-slate-400">{formatTimeAgo(a.created_at)}</p>
          </li>
        )
      })}
    </ol>
  )
}

// ── Threads tab body ────────────────────────────────────────────────────────

function ThreadsTabBody({
  decisions,
}: {
  decisions: DecisionRead[]
}): JSX.Element {
  if (decisions.length === 0) {
    return (
      <EmptyTab
        icon={MessageSquare}
        title="No threads yet"
        body="Replies to anchored decisions will collect here as the conversation grows."
      />
    )
  }
  // Render each decision as a thread root. Replies are not in our schema yet
  // — surface a single "Reply" affordance per thread so the pattern is clear.
  return (
    <ul className="space-y-2">
      {decisions.map((d) => (
        <li key={d.id} className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="flex items-start gap-2 px-2 py-1.5">
            <Avatar name={d.author?.name ?? 'You'} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <p className="truncate text-[11px] font-semibold text-slate-900">
                  {d.author?.name ?? 'You'}
                </p>
                <span className="text-[9px] text-slate-400">{formatTimeAgo(d.created_at)}</span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-700">
                {d.rationale}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="flex w-full items-center gap-1 border-t border-slate-100 bg-slate-50/60 px-2 py-1 text-[10px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-primary"
          >
            <Plus className="h-2.5 w-2.5" />
            Reply
          </button>
        </li>
      ))}
    </ul>
  )
}

// ── Empty state ─────────────────────────────────────────────────────────────

function EmptyTab({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof MessageSquare
  title: string
  body: string
}): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50/40 px-3 py-6 text-center">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-50 text-primary">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <p className="mt-2 text-[11px] font-semibold text-slate-900">{title}</p>
      <p className="mt-0.5 max-w-[14rem] text-[10px] leading-snug text-slate-500">{body}</p>
    </div>
  )
}
