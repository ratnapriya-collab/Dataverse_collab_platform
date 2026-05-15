'use client'

/**
 * /projects/[projectId] — Screen A.3: Project workspace
 *
 * Project header + 3-column grid of part cards. Click a card → /parts/[id].
 */

import Link from 'next/link'
import { FileBox, FilePlus, Upload, UserPlus } from 'lucide-react'
import AppShell from '@/components/shell/AppShell'
import PageContainer from '@/components/shell/PageContainer'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { formatRelative, mockMembers, mockParts, mockUser } from '@/lib/mock-data'

export default function ProjectPage() {
  const { toast } = useToast()

  return (
    <AppShell>
      <PageContainer>
        {/* Header */}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 animate-fade-up">
          <div>
            <div className="flex items-center gap-2 text-xs">
              <Link href="/home" className="font-medium text-ink-mute hover:text-accent">
                Home
              </Link>
              <span className="text-ink-mute">/</span>
              <span className="font-semibold text-ink">{mockUser.workspace.name}</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
              {mockUser.workspace.name}
            </h1>
            <p className="mt-1 text-sm text-ink-mute">
              {mockParts.length} parts · {mockMembers.length} members · revisions tracked
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Members stack */}
            <div className="flex items-center -space-x-2">
              {mockMembers.slice(0, 5).map((m) => (
                <Avatar key={m.id} name={m.name} initials={m.initials} size="sm" />
              ))}
              {mockMembers.length > 5 && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-rule text-[9px] font-bold text-ink-soft">
                  +{mockMembers.length - 5}
                </span>
              )}
            </div>
            <Button
              variant="secondary"
              onClick={() => toast('Invite member', { tone: 'info', description: 'Open Admin → Invites to generate a code.' })}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Invite
            </Button>
            <Button
              variant="primary"
              onClick={() => toast('Demo mode — pretend you uploaded a STEP', { tone: 'info' })}
            >
              <Upload className="h-3.5 w-3.5" />
              Upload part
            </Button>
          </div>
        </header>

        {/* Parts grid */}
        <section className="animate-fade-up" style={{ animationDelay: '60ms', animationFillMode: 'backwards' }}>
          <header className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-bold tracking-tight text-ink">Parts</h2>
            <p className="text-xs text-ink-mute">
              Sorted by last activity · click any card to open the viewer
            </p>
          </header>

          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {mockParts.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/parts/${p.id}`}
                  className="group block overflow-hidden rounded-lg border border-rule bg-white shadow-card transition-all hover:-translate-y-0.5 hover:border-ink-mute/30 hover:shadow-card-hover focus-ring"
                >
                  {/* Thumbnail */}
                  <div
                    className="relative h-32 w-full overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, hsl(${p.thumbHue}, 38%, 26%) 0%, hsl(${(p.thumbHue + 40) % 360}, 38%, 14%) 100%)`,
                    }}
                  >
                    <div className="absolute inset-0 cad-grid opacity-60" />
                    <div className="absolute right-3 top-3">
                      {p.status === 'NEW' && <Badge tone="info">New</Badge>}
                      {p.status === 'REVIEW' && <Badge tone="warning">In review</Badge>}
                      {p.status === 'ACTIVE' && <Badge tone="success">Active</Badge>}
                    </div>
                    <div className="relative flex h-full items-center justify-center">
                      <FileBox className="h-14 w-14 text-white/80 transition-transform group-hover:scale-110" />
                    </div>
                  </div>
                  {/* Body */}
                  <div className="p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate font-mono text-sm font-semibold text-ink">{p.name}</p>
                      <span className="shrink-0 rounded bg-rule-soft px-1.5 py-0.5 font-mono text-[10px] font-medium text-ink-soft">
                        {p.rev}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="text-ink-mute">
                        <strong className="font-semibold tabular-nums text-ink">{p.decisionsCount}</strong> decisions
                      </span>
                      {p.unresolvedCount > 0 ? (
                        <span className="rounded-full bg-state-proposed/15 px-2 py-0.5 font-semibold text-state-proposed">
                          {p.unresolvedCount} unresolved
                        </span>
                      ) : (
                        <span className="text-ink-mute">All resolved</span>
                      )}
                    </div>
                    <p className="mt-2 text-[10px] text-ink-mute">edited {formatRelative(p.lastEdited)}</p>
                  </div>
                </Link>
              </li>
            ))}

            {/* "Upload a new part" tile */}
            <li>
              <button
                type="button"
                onClick={() => toast('Demo mode — pretend you uploaded a STEP', { tone: 'info' })}
                className="flex h-full min-h-[260px] w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-rule bg-white text-center transition-all hover:border-accent hover:bg-accent-soft/50 focus-ring"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <FilePlus className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm font-semibold text-ink">Upload a new part</p>
                <p className="mt-1 text-xs text-ink-mute">STEP, IGES, STL, JT</p>
              </button>
            </li>
          </ul>
        </section>
      </PageContainer>
    </AppShell>
  )
}
