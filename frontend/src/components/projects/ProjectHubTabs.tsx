'use client'

/**
 * ProjectHubTabs — Parts · Decisions · Activity · Members.
 *
 * Reusable tab strip for the project collaboration hub. Each tab carries
 * an optional count badge. The active tab is the primary teal pill; the
 * rest are subtle.
 */

import { ClipboardList, FileBox, History, MessageSquare, Users } from 'lucide-react'

export type ProjectHubTab = 'parts' | 'decisions' | 'feedback' | 'activity' | 'members'

interface Props {
  active: ProjectHubTab
  onChange: (tab: ProjectHubTab) => void
  counts: Record<ProjectHubTab, number>
}

interface TabSpec {
  id: ProjectHubTab
  label: string
  icon: typeof FileBox
}

const TABS: TabSpec[] = [
  { id: 'parts', label: 'Parts', icon: FileBox },
  { id: 'decisions', label: 'Decisions', icon: MessageSquare },
  { id: 'feedback', label: 'Feedback', icon: ClipboardList },
  { id: 'activity', label: 'Activity', icon: History },
  { id: 'members', label: 'Members', icon: Users },
]

export default function ProjectHubTabs({ active, onChange, counts }: Props): JSX.Element {
  return (
    <nav
      aria-label="Project sections"
      className="sticky top-12 z-20 flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white/95 px-2 py-1.5 shadow-sm backdrop-blur-md"
    >
      {TABS.map((t) => {
        const Icon = t.icon
        const isActive = active === t.id
        const count = counts[t.id]
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-current={isActive ? 'page' : undefined}
            className={[
              'relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition',
              isActive
                ? 'bg-primary text-white shadow-sm'
                : 'text-slate-600 hover:bg-primary-50 hover:text-primary',
            ].join(' ')}
          >
            <Icon className="h-3.5 w-3.5" />
            {t.label}
            <span
              className={[
                'rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600',
              ].join(' ')}
            >
              {count}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
