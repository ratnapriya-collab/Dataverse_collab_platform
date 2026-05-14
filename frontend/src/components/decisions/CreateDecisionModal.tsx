'use client'

import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { ApiError, api } from '@/lib/api'
import type { AnchorRead, Centroid, DecisionRead } from '@/types/api'

const MIN_RATIONALE = 10
const MAX_RATIONALE = 4000

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
          <textarea
            id="rationale"
            ref={textareaRef}
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={5}
            maxLength={MAX_RATIONALE}
            placeholder="e.g. Wall thickness 1.6 mm at Z3 is below 2.0 mm minimum per spec"
            className="mt-2 w-full resize-none rounded-md border border-slate-300 px-3 py-2.5 text-sm shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />

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
