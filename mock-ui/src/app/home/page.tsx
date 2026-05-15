'use client'

/**
 * /home — Screen A.2: Inbox / Landing
 *
 * Welcome row + Inbox cards + Recently viewed parts grid.
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, FileBox, Inbox as InboxIcon, MessageCircle, Sparkles } from 'lucide-react'
import AppShell from '@/components/shell/AppShell'
import PageContainer from '@/components/shell/PageContainer'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import {
  formatRelative,
  mockInbox,
  mockParts,
  mockUser,
} from '@/lib/mock-data'

export default function HomePage() {
  const router = useRouter()
  const awaitingSignoff = 3
  const mentions = 7
  const activeDecisions = 12

  return (
    <AppShell>
      <PageContainer>
        {/* Hero */}
        <header className="mb-8 animate-fade-up">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Your queue</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">
            Welcome back, {mockUser.name.split(' ')[0]}.
          </h1>
          <p className="mt-1.5 text-sm text-ink-mute">
            Here&rsquo;s what&rsquo;s waiting for you across <strong className="font-semibold text-ink-soft">{mockUser.workspace.name}</strong>.
          </p>

          {/* Stat strip */}
          <div className="mt-5 grid grid-cols-3 gap-3 sm:max-w-2xl">
            <StatCard label="Awaiting your signoff" value={awaitingSignoff} icon={<InboxIcon className="h-4 w-4" />} tone="accent" />
            <StatCard label="Mentions" value={mentions} icon={<MessageCircle className="h-4 w-4" />} tone="warning" />
            <StatCard label="Active decisions" value={activeDecisions} icon={<Sparkles className="h-4 w-4" />} tone="neutral" />
          </div>
        </header>

        {/* Two-column: inbox + recent parts */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Inbox cards */}
          <section className="animate-fade-up" style={{ animationDelay: '60ms', animationFillMode: 'backwards' }}>
            <header className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-bold tracking-tight text-ink">Inbox</h2>
              <Link href="/decisions" className="text-xs font-medium text-accent hover:underline">
                See all decisions →
              </Link>
            </header>
            <ul className="space-y-2">
              {mockInbox.map((card) => (
                <li key={card.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/parts/${card.partId}`)}
                    className="group flex w-full items-start gap-3 rounded-lg border border-rule bg-white p-4 text-left shadow-card transition-all hover:border-ink-mute/30 hover:shadow-card-hover focus-ring"
                  >
                    <Avatar name={card.actor.name} initials={card.actor.initials} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">
                        <span className="font-semibold">{card.actor.name}</span>{' '}
                        <span className="text-ink-mute">{card.verb}</span>{' '}
                        <span className="font-mono text-[12px] font-semibold text-ink">{card.partLabel}</span>
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-mute">
                        {card.rationalePreview}
                      </p>
                      <p className="mt-1.5 text-[10px] text-ink-mute">{formatRelative(card.at)}</p>
                    </div>
                    <span className="invisible mt-0.5 inline-flex items-center gap-1 self-center rounded px-2 py-1 text-[11px] font-medium text-accent group-hover:visible">
                      View <ArrowRight className="h-3 w-3" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* Recently viewed parts */}
          <section className="animate-fade-up" style={{ animationDelay: '120ms', animationFillMode: 'backwards' }}>
            <header className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-bold tracking-tight text-ink">Recently viewed parts</h2>
              <Link
                href={`/projects/${mockUser.workspace.slug}`}
                className="text-xs font-medium text-accent hover:underline"
              >
                Workspace →
              </Link>
            </header>
            <div className="grid grid-cols-2 gap-3">
              {mockParts.slice(0, 6).map((p) => (
                <Link
                  key={p.id}
                  href={`/parts/${p.id}`}
                  className="group block overflow-hidden rounded-lg border border-rule bg-white shadow-card transition-all hover:border-ink-mute/30 hover:shadow-card-hover focus-ring"
                >
                  <div
                    className="relative h-20 w-full"
                    style={{
                      background: `linear-gradient(135deg, hsl(${p.thumbHue}, 35%, 26%) 0%, hsl(${(p.thumbHue + 40) % 360}, 35%, 14%) 100%)`,
                    }}
                  >
                    <div className="absolute inset-0 cad-grid opacity-60" />
                    <div className="relative flex h-full items-center justify-center">
                      <FileBox className="h-7 w-7 text-white/70 transition-transform group-hover:scale-110" />
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="truncate font-mono text-[11px] font-semibold text-ink">{p.name}</p>
                    <p className="text-[10px] text-ink-mute">
                      {p.rev} · {p.decisionsCount} decisions
                    </p>
                  </div>
                </Link>
              ))}
            </div>
            <Button
              variant="secondary"
              className="mt-3 w-full"
              onClick={() => router.push(`/projects/${mockUser.workspace.slug}`)}
            >
              Open project workspace
            </Button>
          </section>
        </div>
      </PageContainer>
    </AppShell>
  )
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: number
  icon: React.ReactNode
  tone: 'accent' | 'warning' | 'neutral'
}) {
  const T = {
    accent: 'bg-accent-soft text-accent border-accent/20',
    warning: 'bg-state-proposed/10 text-state-proposed border-state-proposed/30',
    neutral: 'bg-rule-soft text-ink-soft border-rule',
  }[tone]
  return (
    <div className="rounded-lg border border-rule bg-white p-3 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-mute">{label}</span>
        <span className={`flex h-6 w-6 items-center justify-center rounded border ${T}`}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-ink">{value}</p>
    </div>
  )
}
