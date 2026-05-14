'use client'

import { type FormEvent, type ReactNode, useState } from 'react'
import { AlertTriangle, Archive, Info, Save, Trash2 } from 'lucide-react'
import { formatDate, type MockWorkspace } from '@/lib/mockWorkspace'
import ConfirmDialog from './ConfirmDialog'

interface Props {
  workspace: MockWorkspace
  memberCount: number
  onSave: (next: { name: string; description: string }) => void
  onInfo: (message: string) => void
}

export default function SettingsTab({ workspace, memberCount, onSave, onInfo }: Props) {
  const [name, setName] = useState(workspace.name)
  const [description, setDescription] = useState(workspace.description)
  const [pendingArchive, setPendingArchive] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(false)

  const dirty = name !== workspace.name || description !== workspace.description

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    onSave({ name: name.trim(), description: description.trim() })
  }

  return (
    <div className="space-y-6">
      {/* ── General ───────────────────────────────────────────────────── */}
      <Section
        title="General"
        description="Visible to everyone in this workspace."
      >
        <form onSubmit={handleSubmit}>
          <div className="grid gap-5 px-6 py-5">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Workspace name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                required
                className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-slate-700">Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={500}
                className="mt-1.5 w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="mt-1 block text-xs text-slate-400">
                {description.length} / 500 characters
              </span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
            <button
              type="button"
              onClick={() => {
                setName(workspace.name)
                setDescription(workspace.description)
              }}
              disabled={!dirty}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={!dirty}
              className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-primary to-primary-700 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" />
              Save changes
            </button>
          </div>
        </form>
      </Section>

      {/* ── Identity / read-only details ──────────────────────────────── */}
      <Section
        title="Identity"
        description="System details about this workspace. Read-only."
      >
        <dl className="divide-y divide-slate-100">
          <ReadOnlyRow label="Slug" value={workspace.slug} mono />
          <ReadOnlyRow label="Workspace ID" value={workspace.id} mono />
          <ReadOnlyRow label="Members" value={String(memberCount)} />
          <ReadOnlyRow label="Created" value={formatDate(workspace.created_at)} />
        </dl>
      </Section>

      {/* ── Danger zone ──────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-xl border-2 border-red-200 bg-white shadow-sm">
        <div className="border-b border-red-200 bg-red-50 px-6 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <h3 className="text-sm font-semibold text-red-900">Danger zone</h3>
          </div>
          <p className="mt-0.5 text-xs text-red-700/80">
            Destructive actions that cannot be undone — proceed with care.
          </p>
        </div>

        <DangerRow
          icon={<Archive className="h-4 w-4 text-amber-700" />}
          title="Archive workspace"
          description="Make this workspace read-only for all members. Parts and decisions are preserved, but no one can make changes."
          buttonLabel="Archive workspace"
          buttonTone="amber"
          onClick={() => setPendingArchive(true)}
        />

        <DangerRow
          icon={<Trash2 className="h-4 w-4 text-red-600" />}
          title="Delete workspace"
          description="Permanently remove this workspace and everything inside it — parts, decisions, audit history, members. This cannot be reversed."
          buttonLabel="Delete workspace"
          buttonTone="red"
          onClick={() => setPendingDelete(true)}
        />
      </section>

      {/* Disclaimer */}
      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
        <Info className="mr-1 inline h-3 w-3 -translate-y-px text-slate-400" />
        This is a demo workspace. Destructive actions show the confirm dialog but
        don't actually modify anything.
      </p>

      {pendingArchive && (
        <ConfirmDialog
          title="Archive this workspace?"
          description={
            <>
              All members will lose write access to{' '}
              <strong>{workspace.name}</strong>. Parts and decisions stay visible,
              but no one can edit, upload, or comment.
            </>
          }
          confirmLabel="Archive workspace"
          confirmTone="danger"
          onConfirm={() => {
            setPendingArchive(false)
            onInfo('Workspace archived (mock)')
          }}
          onCancel={() => setPendingArchive(false)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Permanently delete this workspace?"
          description={
            <>
              This will <strong>permanently</strong> remove{' '}
              <strong>{workspace.name}</strong> and every part, decision, anchor,
              and audit row it contains. Members keep their accounts but lose
              access to this data. This cannot be undone.
            </>
          }
          confirmLabel="Yes, delete forever"
          confirmTone="danger"
          onConfirm={() => {
            setPendingDelete(false)
            onInfo('Workspace deleted (mock)')
          }}
          onCancel={() => setPendingDelete(false)}
        />
      )}
    </div>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 px-6 py-4">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {description !== undefined && (
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        )}
      </header>
      {children}
    </section>
  )
}

function ReadOnlyRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-6 py-3 text-sm">
      <dt className="font-medium text-slate-700">{label}</dt>
      <dd
        className={`text-right text-slate-600 ${mono ? 'font-mono text-xs' : ''} break-all`}
      >
        {value}
      </dd>
    </div>
  )
}

function DangerRow({
  icon,
  title,
  description,
  buttonLabel,
  buttonTone,
  onClick,
}: {
  icon: ReactNode
  title: string
  description: string
  buttonLabel: string
  buttonTone: 'amber' | 'red'
  onClick: () => void
}) {
  const btnClass =
    buttonTone === 'red'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'bg-amber-500 hover:bg-amber-600 text-white'
  return (
    <div className="flex items-start justify-between gap-4 border-t border-red-100 px-6 py-4 first:border-t-0">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-red-50">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{description}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClick}
        className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold shadow-sm transition hover:shadow-md ${btnClass}`}
      >
        {buttonLabel}
      </button>
    </div>
  )
}
