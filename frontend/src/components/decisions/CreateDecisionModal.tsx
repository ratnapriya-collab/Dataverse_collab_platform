'use client'

import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AtSign, Sparkles, X } from 'lucide-react'
import { ApiError, api } from '@/lib/api'
import type { AnchorRead, Centroid, DecisionRead } from '@/types/api'

const MIN_RATIONALE = 10
const MAX_RATIONALE = 4000

// ── @mention support ────────────────────────────────────────────────────────

interface MentionPerson {
  name: string
  role: string
  email: string
}

/** Five teammates you can tag from inside the comment box. */
const MENTIONABLE_PEOPLE: MentionPerson[] = [
  { name: 'Naga Reddy', role: 'Design Lead', email: 'naga.reddy@oem-aero.com' },
  { name: 'Sarah Chen', role: 'CAE Engineer', email: 'sarah.chen@oem-aero.com' },
  { name: 'John Williams', role: 'Supplier Lead', email: 'j.williams@precision-supply.io' },
  { name: 'Maria Garcia', role: 'Stress Reviewer', email: 'maria.g@stress-review.io' },
  { name: 'David Kim', role: 'Engineering Manager', email: 'd.kim@oem-aero.com' },
]

/** Matches `@nagareddy`, `@naga`, `@Naga`, etc. against "Naga Reddy". */
function matchesPerson(p: MentionPerson, query: string): boolean {
  if (query.length === 0) return true
  const q = query.toLowerCase()
  const nameLower = p.name.toLowerCase()
  return (
    nameLower.includes(q) ||
    nameLower.replace(/\s+/g, '').includes(q) ||
    p.email.toLowerCase().includes(q)
  )
}

/**
 * Walk backwards from the cursor looking for an `@` that's at a word boundary
 * (start of string or after whitespace). Returns the query slice between
 * `@` and the cursor, or { open: false } if there's no active mention.
 */
function detectMention(
  value: string,
  cursor: number,
): { open: boolean; query: string; startIdx: number } {
  for (let i = cursor - 1; i >= 0; i--) {
    const ch = value[i]
    if (ch === '@') {
      const isWordBoundary = i === 0 || /\s/.test(value[i - 1] ?? '')
      if (isWordBoundary) {
        const query = value.slice(i + 1, cursor)
        if (!/\s/.test(query)) return { open: true, query, startIdx: i }
      }
      return { open: false, query: '', startIdx: -1 }
    }
    if (ch === undefined || /\s/.test(ch)) return { open: false, query: '', startIdx: -1 }
  }
  return { open: false, query: '', startIdx: -1 }
}

interface Props {
  partId: string
  partName: string
  /** The face the user clicked. The anchor is created lazily on submit. */
  face: { uuid: string; centroid: Centroid }
  onClose: () => void
  /** Called with both the new (or upserted) anchor and the new decision. */
  onCreated: (anchor: AnchorRead, decision: DecisionRead) => void
}

export default function CreateDecisionModal({
  partId,
  partName,
  face,
  onClose,
  onCreated,
}: Props) {
  const [rationale, setRationale] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  // @mention dropdown state
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStart, setMentionStart] = useState(-1)
  const [mentionActiveIdx, setMentionActiveIdx] = useState(0)

  // Names currently tagged in the rationale — drives the "Will notify" chips.
  const detectedMentions = useMemo(
    () => MENTIONABLE_PEOPLE.filter((p) => rationale.includes(`@${p.name}`)),
    [rationale],
  )

  // Live-filtered candidate list, only when the dropdown is open.
  const filteredPeople = useMemo<MentionPerson[]>(() => {
    if (!mentionOpen) return []
    return MENTIONABLE_PEOPLE.filter((p) => matchesPerson(p, mentionQuery))
  }, [mentionOpen, mentionQuery])

  function handleRationaleChange(e: ChangeEvent<HTMLTextAreaElement>): void {
    const value = e.target.value
    const cursor = e.target.selectionStart
    setRationale(value)
    const d = detectMention(value, cursor)
    setMentionOpen(d.open)
    setMentionQuery(d.query)
    setMentionStart(d.startIdx)
    setMentionActiveIdx(0)
  }

  function insertMention(person: MentionPerson): void {
    if (mentionStart < 0) return
    const cursor = textareaRef.current?.selectionStart ?? mentionStart + 1
    const before = rationale.slice(0, mentionStart)
    const after = rationale.slice(cursor)
    const mention = `@${person.name} `
    const newValue = before + mention + after
    setRationale(newValue)
    setMentionOpen(false)
    setMentionQuery('')
    setMentionStart(-1)
    const newCursor = before.length + mention.length
    requestAnimationFrame(() => {
      if (textareaRef.current !== null) {
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newCursor, newCursor)
      }
    })
  }

  function handleTextareaKeyDown(e: ReactKeyboardEvent<HTMLTextAreaElement>): void {
    if (!mentionOpen || filteredPeople.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setMentionActiveIdx((i) => Math.min(i + 1, filteredPeople.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setMentionActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const sel = filteredPeople[mentionActiveIdx]
      if (sel !== undefined) insertMention(sel)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setMentionOpen(false)
    }
  }

  // Close on ESC + focus management.
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null
    textareaRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previouslyFocused.current?.focus?.()
    }
  }, [onClose])

  const handleSuggest = useCallback(async () => {
    setError(null)
    setSuggesting(true)
    try {
      const { suggestion } = await api.datum.suggestRationale(partName)
      setRationale(suggestion)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to fetch suggestion')
    } finally {
      setSuggesting(false)
    }
  }, [partName])

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      // Step 1: upsert the anchor for this face. Idempotent — same face on
      // a re-submit returns the existing anchor.
      const anchor = await api.anchors.create({
        part_id: partId,
        face_uuid: face.uuid,
        kind: 'FACE',
        centroid: face.centroid,
      })
      // Step 2: create the decision attached to that anchor.
      const decision = await api.decisions.create({
        part_id: partId,
        anchor_id: anchor.id,
        rationale: rationale.trim(),
      })
      onCreated(anchor, decision)
    } catch (err) {
      // Server's rationale gate runs even though the UI blocks it — defense
      // in depth. If it 400s for any reason, surface the exact message.
      setError(err instanceof ApiError ? err.message : 'Failed to create comment')
    } finally {
      setSubmitting(false)
    }
  }

  const trimmedLen = rationale.trim().length
  const canSubmit = trimmedLen >= MIN_RATIONALE && !submitting

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-decision-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Card */}
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="create-decision-title" className="text-base font-semibold text-slate-900">
              New comment on this face
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Anchored at{' '}
              <span className="font-mono">
                {face.centroid.x.toFixed(2)}, {face.centroid.y.toFixed(2)},{' '}
                {face.centroid.z.toFixed(2)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="px-6 py-5">
          <label htmlFor="rationale" className="block text-sm font-medium text-slate-700">
            What's the comment?
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Minimum 10 characters. This becomes the decision's rationale — make it specific.
          </p>
          <div className="relative mt-2">
            <textarea
              id="rationale"
              ref={textareaRef}
              value={rationale}
              onChange={handleRationaleChange}
              onKeyDown={handleTextareaKeyDown}
              rows={5}
              maxLength={MAX_RATIONALE}
              placeholder="e.g. Wall thickness 1.6 mm at Z3 is below 2.0 mm minimum — type @ to tag a teammate"
              className="w-full resize-none rounded-md border border-slate-300 px-3 py-2.5 text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />

            {/* @mention dropdown — anchored under the textarea */}
            {mentionOpen && filteredPeople.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-3 py-1.5">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    <AtSign className="h-3 w-3" />
                    {mentionQuery.length > 0
                      ? `People matching "${mentionQuery}"`
                      : 'Tag someone'}
                  </span>
                  <span className="text-[10px] tabular-nums text-slate-400">
                    {filteredPeople.length} of {MENTIONABLE_PEOPLE.length}
                  </span>
                </div>
                <ul
                  role="listbox"
                  aria-label="Mention suggestions"
                  className="max-h-64 overflow-y-auto"
                >
                  {filteredPeople.map((p, i) => {
                    const active = i === mentionActiveIdx
                    return (
                      <li key={p.email}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={active}
                          onMouseDown={(e) => {
                            e.preventDefault() // keep textarea focused
                            insertMention(p)
                          }}
                          onMouseEnter={() => setMentionActiveIdx(i)}
                          className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition ${
                            active ? 'bg-primary-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <img
                            src={`https://i.pravatar.cc/56?u=${encodeURIComponent(p.name)}`}
                            alt=""
                            width={28}
                            height={28}
                            loading="lazy"
                            className="h-7 w-7 shrink-0 rounded-full bg-slate-200 object-cover ring-2 ring-white"
                          />
                          <div className="min-w-0 flex-1">
                            <p
                              className={`truncate text-sm font-semibold ${
                                active ? 'text-primary-900' : 'text-slate-900'
                              }`}
                            >
                              {p.name}
                            </p>
                            <p className="truncate text-[10px] text-slate-500">
                              {p.role} · {p.email}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-600">
                            @{(p.name.split(' ')[0] ?? '').toLowerCase()}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
                <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-3 py-1.5 text-[10px] text-slate-500">
                  <kbd className="rounded border border-slate-200 bg-white px-1 font-mono">↑↓</kbd>
                  navigate
                  <kbd className="ml-0.5 rounded border border-slate-200 bg-white px-1 font-mono">
                    Enter
                  </kbd>
                  select
                  <kbd className="ml-0.5 rounded border border-slate-200 bg-white px-1 font-mono">
                    Esc
                  </kbd>
                  cancel
                </div>
              </div>
            )}
          </div>

          {/* "Will notify" chip row — visible only when mentions are present */}
          {detectedMentions.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Will notify:
              </span>
              {detectedMentions.map((p) => (
                <span
                  key={p.email}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-primary-700 ring-1 ring-primary-100"
                >
                  <img
                    src={`https://i.pravatar.cc/24?u=${encodeURIComponent(p.name)}`}
                    alt=""
                    width={12}
                    height={12}
                    loading="lazy"
                    className="h-3 w-3 rounded-full bg-slate-200 object-cover"
                  />
                  @{p.name}
                </span>
              ))}
            </div>
          )}

          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={handleSuggest}
              disabled={suggesting || submitting}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 transition hover:border-brand hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {suggesting ? 'Suggesting…' : 'Suggest rationale (Datum)'}
            </button>
            <span
              className={[
                'text-xs',
                trimmedLen < MIN_RATIONALE ? 'text-slate-400' : 'text-emerald-600',
              ].join(' ')}
            >
              {trimmedLen} / {MIN_RATIONALE} min
            </span>
          </div>

          {error !== null && (
            <p
              role="alert"
              className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              {error}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-md bg-gradient-to-r from-primary to-primary-700 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Creating…' : 'Create comment'}
          </button>
        </footer>
      </form>
    </div>
  )
}
