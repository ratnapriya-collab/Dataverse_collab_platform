'use client'

import { useEffect, useRef, useState } from 'react'
import { Hash, Sparkles } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Textarea from '@/components/ui/Textarea'
import { mockUser, type Decision } from '@/lib/mock-data'

interface Props {
  open: boolean
  onClose: () => void
  partId: string
  partName: string
  /** Default anchor (e.g. `face-boss-7`) shown in subtitle. */
  anchorId: string
  onSubmit: (decision: Decision) => void
}

const SUGGESTED_RATIONALE =
  'Wall thickness 1.6 mm at Z3 is below standard 2.0 mm minimum. Acceptable only with documented FEA justification per AS9100 §6.4.3.'

const SUGGESTED_CITATIONS = ['AS9100 §6.4.3', 'DEC-AERO-014-08']

const CITATION_OPTIONS = [
  { id: 'AS9100 §6.4.3', label: 'AS9100 §6.4.3', meta: 'Quality mgmt — aerospace' },
  { id: 'DEC-AERO-014-08', label: 'DEC-AERO-014-08', meta: 'Prior decision · inlet flange finish' },
  { id: 'ASME Y14.5 §1.4', label: 'ASME Y14.5 §1.4', meta: 'Dimensioning & tolerancing' },
  { id: 'ISO 1101', label: 'ISO 1101', meta: 'Geometrical tolerances' },
  { id: 'MIL-STD-1916', label: 'MIL-STD-1916', meta: 'Sampling procedures' },
]

const MIN_LEN = 10

export default function CreateDecisionModal({
  open,
  onClose,
  partId,
  partName,
  anchorId,
  onSubmit,
}: Props) {
  const [rationale, setRationale] = useState('')
  const [citations, setCitations] = useState<string[]>([])
  const [suggesting, setSuggesting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Reset on open
  useEffect(() => {
    if (open) {
      setRationale('')
      setCitations([])
      setSuggesting(false)
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }, [open])

  const len = rationale.trim().length
  const valid = len >= MIN_LEN

  function handleSuggest() {
    setSuggesting(true)
    window.setTimeout(() => {
      setRationale(SUGGESTED_RATIONALE)
      setCitations(SUGGESTED_CITATIONS)
      setSuggesting(false)
      requestAnimationFrame(() => textareaRef.current?.focus())
    }, 600)
  }

  function toggleCitation(id: string) {
    setCitations((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  function handleSubmit() {
    if (!valid) return
    const newDec: Decision = {
      id: `DEC-NEW-${Date.now().toString().slice(-4)}`,
      partId,
      anchorId,
      state: 'PROPOSED',
      rationale: rationale.trim(),
      author: { id: mockUser.id, name: mockUser.name, initials: mockUser.initials },
      citations,
      createdAt: new Date().toISOString(),
      signoffs: [],
    }
    onSubmit(newDec)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Decision"
      subtitle={`Anchored to ${anchorId} on ${partName}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!valid} onClick={handleSubmit}>
            Create Decision
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded border border-rule bg-rule-soft/50 px-3 py-2 text-xs">
          <div className="flex items-center gap-2 font-mono text-ink-soft">
            <Hash className="h-3 w-3 text-ink-mute" />
            <span>{anchorId}</span>
            <span className="text-ink-mute">·</span>
            <span>{partId}</span>
          </div>
          <p className="mt-1 text-[11px] text-ink-mute">
            A topology-hash UUID for this face will be persisted with the decision.
          </p>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="rationale" className="text-xs font-semibold text-ink">
              Rationale <span className="text-state-rejected">*</span>
            </label>
            <span className={`text-[10px] ${valid ? 'text-state-accepted' : 'text-ink-mute'}`}>
              {len} / {MIN_LEN} min
            </span>
          </div>
          <Textarea
            ref={textareaRef}
            id="rationale"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="Why this decision? Cite standards, prior decisions, or analysis…"
            rows={5}
            className="mt-1"
            invalid={!valid && len > 0}
          />
          <div className="mt-1.5 flex items-center justify-between">
            <p className="text-[10px] text-ink-mute">
              Rationale becomes part of the permanent audit log.
            </p>
            <button
              type="button"
              onClick={handleSuggest}
              disabled={suggesting}
              className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-[11px] font-semibold text-purple-600 transition-colors hover:bg-purple-50 disabled:opacity-50 focus-ring"
            >
              <Sparkles className={`h-3 w-3 ${suggesting ? 'animate-pulse' : ''}`} />
              {suggesting ? 'Datum is thinking…' : 'Suggest rationale (Datum)'}
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-ink">Citations <span className="text-ink-mute font-normal">(optional)</span></p>
          <div className="mt-2 space-y-1">
            {CITATION_OPTIONS.map((c) => {
              const active = citations.includes(c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCitation(c.id)}
                  className={`flex w-full items-center justify-between gap-3 rounded border px-3 py-2 text-left transition-colors focus-ring ${
                    active
                      ? 'border-accent bg-accent-soft'
                      : 'border-rule bg-white hover:border-ink-mute/40 hover:bg-rule-soft/50'
                  }`}
                >
                  <div className="min-w-0">
                    <p className={`font-mono text-xs ${active ? 'text-accent font-semibold' : 'text-ink'}`}>
                      {c.label}
                    </p>
                    <p className="text-[10px] text-ink-mute">{c.meta}</p>
                  </div>
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-[1.5px] ${
                      active ? 'border-accent bg-accent text-white' : 'border-rule bg-white'
                    }`}
                  >
                    {active && <span className="h-1.5 w-1.5 rounded-[1px] bg-white" />}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}
