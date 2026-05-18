'use client'

/**
 * /external/windchill/ecn/[ecnId] — fake "Windchill PLM" page.
 *
 * Deliberately chromed to look like a different product:
 *   • Slate-blue corporate palette (not DataVerse teal)
 *   • Serif heading on the brand mark, sans-serif everywhere else
 *   • Sticky top bar styled as an enterprise PLM
 *   • Sidebar of ECN metadata + tabs (Details / Attachments / Approvals /
 *     Audit Trail)
 *
 * The Audit Trail tab is the punchline — it shows the signed bundle from
 * DataVerse + a "verify" badge that ties this PLM record back to our
 * append-only event chain.
 */

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import {
  Check,
  Clock,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  GitBranch,
  Lock,
  Mail,
  Paperclip,
  Printer,
  Search,
  Shield,
  ShieldCheck,
  User,
} from 'lucide-react'

type Tab = 'details' | 'attachments' | 'approvals' | 'audit'

export default function ExternalWindchillEcnPage(): JSX.Element {
  const params = useParams<{ ecnId: string }>()
  const ecnId = params?.ecnId ?? 'ECN-2026-0418'
  const [tab, setTab] = useState<Tab>('details')

  return (
    <main className="min-h-screen bg-[#eef2f6]">
      <WindchillTopBar />

      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Crumbs */}
        <nav className="mb-3 flex items-center gap-2 text-[11px] text-slate-600">
          <Link href="/" className="hover:text-blue-700">Workspaces</Link>
          <span className="text-slate-300">/</span>
          <Link href="/" className="hover:text-blue-700">Acme Aerospace</Link>
          <span className="text-slate-300">/</span>
          <Link href="/" className="hover:text-blue-700">Engineering Change Notices</Link>
          <span className="text-slate-300">/</span>
          <span className="font-mono font-semibold text-slate-900">{ecnId}</span>
        </nav>

        {/* Header block */}
        <header className="overflow-hidden rounded border border-[#c5d1de] bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-b from-white to-slate-50 px-5 py-4">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-blue-800">
                <FileCheck2 className="h-3 w-3" />
                Engineering Change Notice
              </div>
              <h1 className="mt-1 font-serif text-2xl font-bold tracking-tight text-slate-900">
                {ecnId}
              </h1>
              <p className="mt-0.5 text-sm text-slate-600">
                Wing Spar Bracket Assembly · Rev B Engineering Changes
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <User className="h-3 w-3 text-slate-400" />
                  Submitted by <strong className="font-semibold text-slate-900">Ratnapriya Chamala</strong>
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3 text-slate-400" />
                  2026-05-12 14:33 UTC
                </span>
                <span className="inline-flex items-center gap-1">
                  <Shield className="h-3 w-3 text-slate-400" />
                  Workflow <strong className="font-mono text-slate-900">#4711</strong>
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800 ring-1 ring-amber-200">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                DRAFT
              </span>
              <div className="flex items-center gap-1">
                <button type="button" className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
                  <Printer className="h-3 w-3" />
                  Print
                </button>
                <button type="button" className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
                  <Mail className="h-3 w-3" />
                  Email
                </button>
                <button type="button" className="inline-flex items-center gap-1 rounded bg-blue-700 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm hover:bg-blue-800">
                  Approve →
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex items-center gap-0 border-t border-slate-200 bg-slate-50 px-3" role="tablist">
            <TabBtn id="details" current={tab} onSelect={setTab} label="Details" />
            <TabBtn id="attachments" current={tab} onSelect={setTab} label="Attachments" count={2} />
            <TabBtn id="approvals" current={tab} onSelect={setTab} label="Approvals" count={3} />
            <TabBtn
              id="audit"
              current={tab}
              onSelect={setTab}
              label={
                <span className="inline-flex items-center gap-1.5">
                  Audit Trail
                  <ShieldCheck className="h-3 w-3 text-emerald-600" />
                </span>
              }
            />
          </nav>
        </header>

        {/* Content layout — main + sidebar */}
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            {tab === 'details' && <DetailsTab ecnId={ecnId} />}
            {tab === 'attachments' && <AttachmentsTab />}
            {tab === 'approvals' && <ApprovalsTab />}
            {tab === 'audit' && <AuditTrailTab ecnId={ecnId} />}
          </div>

          <aside className="space-y-4">
            <SidebarBlock title="ECN Metadata">
              <dl className="space-y-1.5 text-[11px]">
                <Row label="ID"><code className="font-mono text-slate-900">{ecnId}</code></Row>
                <Row label="Status"><span className="font-semibold text-amber-700">DRAFT</span></Row>
                <Row label="Class">Class II — Functional</Row>
                <Row label="Originator">Ratnapriya Chamala</Row>
                <Row label="Department">Engineering · Airframe Structures</Row>
                <Row label="Created">2026-05-12 14:33 UTC</Row>
                <Row label="Workflow">#4711</Row>
              </dl>
            </SidebarBlock>

            <SidebarBlock title="Affected Items">
              <ul className="space-y-1 text-[11px]">
                <li className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-blue-100 text-blue-700">
                    <FileText className="h-3 w-3" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] font-semibold text-slate-900">BR-AERO-014</p>
                    <p className="text-[10px] text-slate-500">Rev A → Rev B</p>
                  </div>
                </li>
              </ul>
            </SidebarBlock>

            <SidebarBlock title="Cross-system Link">
              <p className="text-[11px] leading-relaxed text-slate-600">
                Originated in <strong className="font-semibold text-slate-900">DataVerse.Collab</strong> · workspace{' '}
                <span className="font-mono">f-bracket</span>
              </p>
              <Link
                href="/parts/demo_2"
                className="mt-2 inline-flex items-center gap-1 rounded border border-blue-300 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-800 hover:bg-blue-100"
              >
                Open in DataVerse
                <ExternalLink className="h-2.5 w-2.5" />
              </Link>
            </SidebarBlock>
          </aside>
        </div>

        <footer className="mt-6 border-t border-slate-200 pt-3 text-center text-[10px] text-slate-500">
          PTC Windchill 12.1 · acme-corp.windchill.com · © Acme Aerospace Corp
        </footer>
      </div>
    </main>
  )
}

// ── Top bar (looks like a different product) ────────────────────────────────

function WindchillTopBar(): JSX.Element {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-300 bg-gradient-to-b from-[#1e3a5f] to-[#243f66] text-white shadow-sm">
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-4 px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-white text-[11px] font-extrabold text-[#1e3a5f] shadow-sm">
            W
          </span>
          <span className="font-serif text-base font-bold tracking-tight">Windchill</span>
          <span className="ml-1 rounded bg-white/10 px-1 py-0.5 font-mono text-[9px] text-slate-200">
            12.1
          </span>
        </Link>
        <nav className="hidden items-center gap-1 text-[12px] font-medium md:flex">
          <span className="cursor-default rounded px-2.5 py-1 text-white/70 hover:bg-white/10 hover:text-white">
            Workspace
          </span>
          <span className="cursor-default rounded px-2.5 py-1 text-white/70 hover:bg-white/10 hover:text-white">
            Parts
          </span>
          <span className="cursor-default rounded bg-white/15 px-2.5 py-1 text-white ring-1 ring-white/20">
            Change Mgmt
          </span>
          <span className="cursor-default rounded px-2.5 py-1 text-white/70 hover:bg-white/10 hover:text-white">
            Reports
          </span>
        </nav>
        <div className="relative ml-auto hidden md:block">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-white/50" />
          <input
            type="text"
            placeholder="Search ECN / Part / Document…"
            aria-label="Search (decorative)"
            className="h-7 w-72 rounded border border-white/10 bg-white/10 pl-7 pr-3 text-[11px] text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="rounded-full bg-white/10 px-2 py-0.5 ring-1 ring-white/20">acme-corp</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white font-bold text-[#1e3a5f]">
            J
          </span>
        </div>
      </div>
    </header>
  )
}

// ── Tabs ────────────────────────────────────────────────────────────────────

function TabBtn({
  id,
  current,
  onSelect,
  label,
  count,
}: {
  id: Tab
  current: Tab
  onSelect: (t: Tab) => void
  label: React.ReactNode
  count?: number
}): JSX.Element {
  const active = id === current
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onSelect(id)}
      className={`relative inline-flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold transition ${
        active ? 'text-blue-800' : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {label}
      {count !== undefined && (
        <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-slate-700">
          {count}
        </span>
      )}
      {active && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-blue-700" />}
    </button>
  )
}

// ── Tab content ─────────────────────────────────────────────────────────────

function DetailsTab({ ecnId }: { ecnId: string }): JSX.Element {
  return (
    <section className="overflow-hidden rounded border border-[#c5d1de] bg-white p-5 shadow-sm">
      <h2 className="font-serif text-lg font-bold text-slate-900">Change description</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-slate-700">
        Rev B of the Wing Spar Bracket Assembly introduces three engineering changes recorded under{' '}
        <span className="font-mono font-semibold">{ecnId}</span>. All changes were proposed,
        debated, and accepted inside the DataVerse.Collab workspace and are anchored to specific
        geometric faces; a cryptographic audit bundle is attached as evidence.
      </p>
      <ul className="mt-4 space-y-2.5 text-[12px]">
        {[
          { id: 'DEC-TURBO-V3-08', text: 'Surface roughness on the inlet flange tightened from Ra 3.2 µm → Ra 1.6 µm per gasket vendor datasheet (sealing reliability).' },
          { id: 'DEC-BRACKET-07', text: 'Fillet radius on the load-bearing edge increased from R1.5 → R2.5 to mitigate fatigue stress concentration (CAE run 2026-04-11).' },
          { id: 'DEC-GEAR-12', text: 'Spline tolerance class upgraded from 7e to 6f per the gearbox interface ICD. CMM data attached.' },
        ].map((row) => (
          <li
            key={row.id}
            className="flex items-start gap-3 rounded border-l-4 border-blue-300 bg-blue-50/40 px-3 py-2"
          >
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
            <div>
              <p className="text-slate-800">{row.text}</p>
              <p className="mt-0.5 font-mono text-[10px] text-slate-500">{row.id}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-[11px]">
        <p className="text-slate-500">
          <strong className="font-semibold text-slate-700">Justification:</strong> All three changes
          improve reliability without affecting form-fit-function. Class II per ECP-001 §4.2.
        </p>
      </div>
    </section>
  )
}

function AttachmentsTab(): JSX.Element {
  const files = [
    { name: 'ECN-2026-0418.pdf', size: '1.20 MB', type: 'PDF' },
    { name: 'audit-bundle.dvex.json', size: '847 KB', type: 'JSON', signed: true },
  ]
  return (
    <section className="overflow-hidden rounded border border-[#c5d1de] bg-white shadow-sm">
      <header className="border-b border-slate-200 bg-slate-50 px-5 py-3">
        <h2 className="font-serif text-base font-bold text-slate-900">Attachments</h2>
      </header>
      <ul className="divide-y divide-slate-100">
        {files.map((f) => (
          <li key={f.name} className="flex items-center gap-3 px-5 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-blue-50 text-blue-700">
              <Paperclip className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[12px] font-semibold text-slate-900">{f.name}</p>
              <p className="text-[10px] text-slate-500">{f.type} · {f.size}</p>
            </div>
            {f.signed === true && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-200">
                <ShieldCheck className="h-3 w-3" />
                Signed
              </span>
            )}
            <button type="button" className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
              <Download className="h-3 w-3" />
              Download
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ApprovalsTab(): JSX.Element {
  const approvers = [
    { name: 'David Kim', role: 'Engineering Manager', state: 'pending' },
    { name: 'Maria Garcia', role: 'Stress Reviewer', state: 'pending' },
    { name: 'Naga Reddy', role: 'Design Lead', state: 'pending' },
  ]
  return (
    <section className="overflow-hidden rounded border border-[#c5d1de] bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
        <h2 className="font-serif text-base font-bold text-slate-900">Approvals</h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 ring-1 ring-amber-200">
          <Clock className="h-3 w-3" />
          0 / 3 signed
        </span>
      </header>
      <ul className="divide-y divide-slate-100">
        {approvers.map((a) => (
          <li key={a.name} className="flex items-center gap-3 px-5 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-800">
              {a.name.split(' ').map((s) => s[0]).join('')}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-slate-900">{a.name}</p>
              <p className="text-[10px] text-slate-500">{a.role}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
              Pending
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function AuditTrailTab({ ecnId }: { ecnId: string }): JSX.Element {
  const events = [
    { seq: 1247, at: '2026-05-12 14:33:14', actor: 'Ratnapriya Chamala', type: 'PLM_PUSHED', tone: 'amber' as const },
    { seq: 1246, at: '2026-05-12 14:33:12', actor: 'system', type: 'BUNDLE_SIGNED', tone: 'emerald' as const },
    { seq: 1245, at: '2026-05-12 14:33:11', actor: 'system', type: 'RESOLVER_COMPLETED', tone: 'slate' as const },
    { seq: 1242, at: '2026-05-11 09:20:00', actor: 'David Kim', type: 'DECISION_ACCEPTED', tone: 'emerald' as const },
    { seq: 1235, at: '2026-05-10 16:04:00', actor: 'Sarah Chen', type: 'DECISION_PROPOSED', tone: 'amber' as const },
  ]
  return (
    <section className="overflow-hidden rounded border border-[#c5d1de] bg-white shadow-sm">
      {/* Verification banner */}
      <div className="border-b border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-serif text-sm font-bold text-emerald-900">
              ✓ Bundle signature verified
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-emerald-800/85">
              Tamper-evident audit trail anchored back to DataVerse. Signed{' '}
              <span className="font-mono font-semibold">Ed25519 · 7f3a:b2e1:c8d5:…</span> · chain
              from event #1 to #1247 verified offline by{' '}
              <code className="rounded bg-emerald-100 px-1 font-mono">dvex-replay</code>.
            </p>
          </div>
          <div className="hidden flex-col items-end gap-0.5 text-right text-[10px] text-emerald-700 md:flex">
            <span className="inline-flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Append-only
            </span>
            <span>1,247 events</span>
          </div>
        </div>
      </div>

      <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-2.5">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
          Event chain leading to {ecnId}
        </h3>
        <span className="text-[10px] text-slate-500">most recent first</span>
      </header>

      <ol className="relative space-y-3 px-5 py-5">
        <span className="absolute left-9 top-2 bottom-4 w-px bg-slate-200" aria-hidden="true" />
        {events.map((e) => (
          <li key={e.seq} className="relative flex items-start gap-3 pl-6">
            <span
              className={`absolute left-[10px] top-1 z-10 flex h-3 w-3 items-center justify-center rounded-full ring-4 ring-white ${
                e.tone === 'emerald'
                  ? 'bg-emerald-500'
                  : e.tone === 'amber'
                  ? 'bg-amber-500'
                  : 'bg-slate-500'
              }`}
              aria-hidden="true"
            />
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[10px] font-bold text-slate-400">#{e.seq}</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                  {e.type}
                </span>
                <span className="text-[10px] text-slate-500">by {e.actor}</span>
              </div>
              <p className="mt-0.5 font-mono text-[10px] text-slate-500">{e.at} UTC</p>
            </div>
          </li>
        ))}
      </ol>

      <footer className="border-t border-slate-200 bg-slate-50 px-5 py-2.5 text-center">
        <Link
          href="/audit"
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-700 hover:underline"
        >
          <GitBranch className="h-3 w-3" />
          View full chain in DataVerse
          <ExternalLink className="h-3 w-3" />
        </Link>
      </footer>
    </section>
  )
}

// ── Sidebar bits ────────────────────────────────────────────────────────────

function SidebarBlock({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="overflow-hidden rounded border border-[#c5d1de] bg-white shadow-sm">
      <header className="border-b border-slate-200 bg-slate-50 px-3 py-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">{title}</p>
      </header>
      <div className="px-3 py-2.5">{children}</div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-900">{children}</dd>
    </div>
  )
}
