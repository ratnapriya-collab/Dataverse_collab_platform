'use client'

/**
 * /audit/replay-tool — Stripe-style docs page for the dvex-replay CLI.
 *
 * Read-only documentation page. Each code block has a Copy button. The
 * "View on GitHub" CTA opens a (fake) repo URL.
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileCode,
  Github,
  History,
  ShieldCheck,
} from 'lucide-react'
import NotificationsBell from '@/components/layout/NotificationsBell'
import WorkspaceSidebar from '@/components/layout/WorkspaceSidebar'
import Toast, { type ToastState } from '@/components/ui/Toast'
import { ApiError, api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import type { UserRead } from '@/types/api'

const INSTALL_CMD = `# requires Python 3.10+
pip install dvex-replay

# verify install
dvex-replay --version
# → dvex-replay 1.0.4`

const VERIFY_OUTPUT = `$ dvex-replay verify dvex-fbracket-2026-05-18.json dvex-fbracket-pubkey.pem

✓ Signature valid (Ed25519)
✓ Hash chain integrity verified (1,247 events from genesis)
✓ No tampered events detected

Bundle exported:  2026-05-18T11:00:00Z
Workspace:        F-Bracket Program (f-bracket)
Events:           1,247
Signed by:        7f3a:b2e1:c8d5:9e2d:0a4f:6b81:c2d3:e4f5

Verification took 0.34s on 1247 events.`

const ERROR_OUTPUT = `$ dvex-replay verify suspicious-bundle.json pubkey.pem

✓ Signature valid (Ed25519)
✗ Hash chain integrity FAILED

  Event #843 has unexpected curr_hash:
    expected:  a3f4b2e1c8d5...    (computed from prev_hash + payload)
    found:     91c2e3d456a7...    (in bundle)

  The chain breaks at event #843. Subsequent 404 events
  cannot be trusted. Bundle has been tampered with after signing,
  OR you have the wrong public key.

Exited with code 2.`

export default function ReplayToolDocsPage(): JSX.Element {
  const router = useRouter()
  const [user, setUser] = useState<UserRead | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.auth
      .me()
      .then((u) => {
        if (!cancelled) setUser(u)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          clearToken()
          router.replace('/login')
          return
        }
        setError(err instanceof Error ? err.message : 'Failed to load')
      })
    return () => {
      cancelled = true
    }
  }, [router])

  function handleSignOut(): void {
    clearToken()
    router.replace('/login')
  }

  function copy(key: string, text: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text)
    }
    setCopiedKey(key)
    setToast({ message: 'Copied to clipboard', tone: 'success' })
    window.setTimeout(() => setCopiedKey(null), 1200)
  }

  if (error !== null) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p role="alert" className="text-sm text-red-600">{error}</p>
      </main>
    )
  }
  if (user === null) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-500">
        <span className="text-sm">Loading…</span>
      </main>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <WorkspaceSidebar user={user} current="audit" onSignOut={handleSignOut} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Toast toast={toast} onClose={() => setToast(null)} />

        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/85 px-6 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <History className="h-3 w-3 text-primary" />
            <span className="font-semibold uppercase tracking-wider text-slate-400">Workspace</span>
            <span className="text-slate-300">/</span>
            <Link href="/audit" className="font-medium hover:text-primary">Audit</Link>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-900">Replay tool</span>
          </div>
          <NotificationsBell />
        </header>

        <section className="mx-auto w-full max-w-3xl px-6 py-10">
          {/* Title block */}
          <div className="dv-anim-fade-up">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-primary">
              <FileCode className="h-3 w-3" />
              dvex-replay · CLI · v1.0
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              Verify a DVEX bundle offline
            </h1>
            <p className="mt-3 text-base leading-relaxed text-slate-600">
              <strong className="font-semibold text-slate-900">dvex-replay</strong> is the open-source CLI
              auditors use to validate a signed audit bundle without ever talking to DataVerse.
              No network. No accounts. Just the bundle, the public key, and one command.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <a
                href="https://github.com/dataverse-ai/dvex-replay"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-700"
              >
                <Github className="h-3.5 w-3.5" />
                View on GitHub
                <ExternalLink className="h-3 w-3" />
              </a>
              <Link
                href="/audit/export"
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-primary hover:bg-primary-50 hover:text-primary"
              >
                Export a bundle to test
              </Link>
            </div>
          </div>

          {/* TOC */}
          <nav className="dv-anim-fade-up mt-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" style={{ animationDelay: '60ms' }}>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              On this page
            </p>
            <ul className="space-y-1 text-sm text-slate-600">
              <li><a href="#what" className="hover:text-primary hover:underline">1. What is this?</a></li>
              <li><a href="#install" className="hover:text-primary hover:underline">2. Install</a></li>
              <li><a href="#verify" className="hover:text-primary hover:underline">3. Verify a bundle</a></li>
              <li><a href="#fail" className="hover:text-primary hover:underline">4. What if verification fails?</a></li>
            </ul>
          </nav>

          {/* Section 1 — What is this? */}
          <Section anchor="what" number={1} title="What is this?">
            <p>
              Every DataVerse workspace is an <strong className="font-semibold text-slate-900">append-only hash chain</strong>.
              When you export a DVEX bundle (`/audit/export`), we serialise the entire chain
              to JSON and sign it with the workspace's Ed25519 private key.
            </p>
            <p>
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-slate-800">dvex-replay</code>
              {' '}is the verifier: re-compute every <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px]">curr_hash</code>
              {' '}from <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px]">(prev_hash + seq + type + actor + payload + timestamp)</code>,
              check the signature with the public key, and report any drift.
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <Bullet>
                <strong className="font-semibold text-slate-900">Offline.</strong> Runs against a local
                file. No DataVerse credentials needed.
              </Bullet>
              <Bullet>
                <strong className="font-semibold text-slate-900">Open source.</strong> MIT-licensed Python.
                Auditors can read the source.
              </Bullet>
              <Bullet>
                <strong className="font-semibold text-slate-900">Tamper-evident.</strong> Modify any byte
                in the bundle and the chain breaks at that event.
              </Bullet>
            </ul>
          </Section>

          {/* Section 2 — Install */}
          <Section anchor="install" number={2} title="Install">
            <p>Requires Python 3.10+. Install from PyPI:</p>
            <CodeBlock id="install" content={INSTALL_CMD} copiedKey={copiedKey} onCopy={copy} />
          </Section>

          {/* Section 3 — Verify */}
          <Section anchor="verify" number={3} title="Verify a bundle">
            <p>Run the verifier with the bundle JSON and the corresponding public key:</p>
            <CodeBlock id="verify" content={VERIFY_OUTPUT} copiedKey={copiedKey} onCopy={copy} />
            <p className="mt-3">
              On success, every line is prefixed with <span className="font-mono text-emerald-600">✓</span>.
              The exit code is <code className="rounded bg-slate-100 px-1 font-mono">0</code>, so CI pipelines
              can chain on it.
            </p>
            <div className="mt-4 rounded-md border-l-4 border-emerald-500 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              <strong className="font-semibold">Tip:</strong> store the bundle + .pem in your QMS alongside
              the ECN PDF. Re-verify on every audit cycle — it takes &lt; 1 s for 10,000 events.
            </div>
          </Section>

          {/* Section 4 — Fail */}
          <Section anchor="fail" number={4} title="What if verification fails?">
            <p>
              If the bundle has been tampered with after signing, or you've been given the wrong
              public key, <code className="rounded bg-slate-100 px-1 font-mono">dvex-replay</code> aborts
              with exit code <code className="rounded bg-slate-100 px-1 font-mono">2</code> and tells you
              exactly which event broke:
            </p>
            <CodeBlock id="fail" content={ERROR_OUTPUT} copiedKey={copiedKey} onCopy={copy} tone="error" />
            <div className="mt-3 rounded-md border-l-4 border-rose-500 bg-rose-50 px-3 py-2 text-xs text-rose-900">
              <strong className="font-semibold">What to do:</strong>
              <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                <li>Confirm the public key fingerprint matches what DataVerse displays in /audit.</li>
                <li>Re-export the bundle and compare file hashes.</li>
                <li>Escalate to security if both re-exports break at the same seq.</li>
              </ol>
            </div>
          </Section>

          {/* Why it matters callout */}
          <aside className="dv-anim-fade-up mt-10 rounded-2xl border border-slate-200 bg-gradient-to-br from-primary-50 via-white to-brand-50/30 p-5 shadow-sm" style={{ animationDelay: '300ms' }}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight text-slate-900">
                  Why we bother with cryptographic signatures
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-700">
                  AS9100, ISO 9001 and FDA 21 CFR Part 11 all require tamper-evident records.
                  DataVerse's hash chain + signed bundle means an auditor can confirm — without
                  trusting us — that the decision history they see is exactly what was made. If a
                  byte changes, verification fails loudly. That's the floor; everything else is
                  process.
                </p>
              </div>
            </div>
          </aside>

          <Link
            href="/audit"
            className="mt-8 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-primary"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to audit log
          </Link>
        </section>
      </div>
    </div>
  )
}

// ── helpers ─────────────────────────────────────────────────────────────────

function Section({
  anchor,
  number,
  title,
  children,
}: {
  anchor: string
  number: number
  title: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <section id={anchor} className="dv-anim-fade-up mt-10 scroll-mt-24" style={{ animationDelay: '120ms' }}>
      <div className="mb-3 flex items-baseline gap-2">
        <span className="font-mono text-[11px] font-bold text-primary">{number}.</span>
        <h2 className="font-serif text-xl font-bold tracking-tight text-slate-900">{title}</h2>
      </div>
      <div className="space-y-2 text-[14px] leading-relaxed text-slate-700">{children}</div>
    </section>
  )
}

function Bullet({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
      <span>{children}</span>
    </li>
  )
}

function CodeBlock({
  id,
  content,
  copiedKey,
  onCopy,
  tone,
}: {
  id: string
  content: string
  copiedKey: string | null
  onCopy: (id: string, text: string) => void
  tone?: 'error'
}): JSX.Element {
  return (
    <div className="relative mt-3">
      <button
        type="button"
        onClick={() => onCopy(id, content)}
        aria-label="Copy"
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-200 transition hover:bg-slate-700"
      >
        {copiedKey === id ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
        {copiedKey === id ? 'Copied' : 'Copy'}
      </button>
      <pre
        className={`overflow-x-auto rounded-lg border p-4 font-mono text-[12px] leading-relaxed ${
          tone === 'error'
            ? 'border-rose-300 bg-rose-950 text-rose-100'
            : 'border-slate-800 bg-slate-900 text-slate-100'
        }`}
      >
        {content}
      </pre>
    </div>
  )
}

