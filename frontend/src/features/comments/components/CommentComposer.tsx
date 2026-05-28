'use client'

/**
 * CommentComposer — textarea + @mention autocomplete + ⌘+Enter submit.
 *
 * Used in two contexts:
 *   · mode="reply" inside ThreadDrawer
 *   · mode="new-thread" inside CommentsPanel for new top-level threads
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { AtSign, Send, Smile } from 'lucide-react'
import { useCommentsStore } from '../store/commentsStore'

const PRESET_EMOJIS = ['👍', '✅', '🎯', '🤔', '👀', '🚀', '🔥', '❤️']
// Static list of teammates — same names used elsewhere in the demo.
const TEAMMATES: { id: string; name: string; role: string }[] = [
  { id: 'sarah', name: 'Sarah Chen', role: 'CAE' },
  { id: 'maria', name: 'Maria Garcia', role: 'REV' },
  { id: 'john', name: 'John Williams', role: 'SUP' },
  { id: 'david', name: 'David Kim', role: 'MFG' },
  { id: 'aarav', name: 'Aarav Patel', role: 'DES' },
]

interface Props {
  threadId?: string
  mode: 'reply' | 'new-thread'
  placeholder?: string
  onSubmit: (body: string) => void
  busy?: boolean
}

export default function CommentComposer({
  threadId,
  mode,
  placeholder,
  onSubmit,
  busy = false,
}: Props): JSX.Element {
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const draft = useCommentsStore((s) =>
    mode === 'reply' && threadId !== undefined ? (s.drafts[threadId] ?? '') : s.rootDraft,
  )
  const setDraft = useCommentsStore((s) => s.setDraft)
  const setRootDraft = useCommentsStore((s) => s.setRootDraft)
  const clearDraft = useCommentsStore((s) => s.clearDraft)

  const [mentionState, setMentionState] = useState<{ start: number; query: string } | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const updateBody = useCallback(
    (value: string) => {
      if (mode === 'reply' && threadId !== undefined) setDraft(threadId, value)
      else setRootDraft(value)
    },
    [mode, threadId, setDraft, setRootDraft],
  )

  /** Detect when caret is inside a `@…` token so we can show suggestions. */
  const onSelectionChange = useCallback(() => {
    const ta = taRef.current
    if (ta === null) return
    const cursor = ta.selectionStart
    // Look backward for `@` not preceded by a word char.
    for (let i = cursor - 1; i >= 0; i--) {
      const ch = ta.value[i]
      if (ch === '@') {
        const before = ta.value[i - 1]
        const wordBoundary = i === 0 || /\s/.test(before ?? '')
        if (wordBoundary) {
          setMentionState({ start: i, query: ta.value.slice(i + 1, cursor) })
        }
        return
      }
      if (ch === undefined || /\s/.test(ch)) {
        setMentionState(null)
        return
      }
    }
    setMentionState(null)
  }, [])

  const pickMention = useCallback(
    (name: string) => {
      const ta = taRef.current
      if (ta === null || mentionState === null) return
      const before = draft.slice(0, mentionState.start)
      const after = draft.slice(ta.selectionStart)
      const next = `${before}@${name} ${after}`
      updateBody(next)
      setMentionState(null)
      // Restore caret right after the mention.
      requestAnimationFrame(() => {
        ta.focus()
        const caret = before.length + name.length + 2
        ta.setSelectionRange(caret, caret)
      })
    },
    [draft, mentionState, updateBody],
  )

  const submit = useCallback(() => {
    const body = draft.trim()
    if (body === '' || busy) return
    onSubmit(body)
    if (mode === 'reply' && threadId !== undefined) clearDraft(threadId)
    else setRootDraft('')
    setMentionState(null)
  }, [draft, busy, onSubmit, mode, threadId, clearDraft, setRootDraft])

  /** ⌘+Enter / Ctrl+Enter submit. */
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submit()
    }
    if (e.key === 'Escape' && mentionState !== null) {
      e.preventDefault()
      setMentionState(null)
    }
  }

  const suggestions =
    mentionState === null
      ? []
      : TEAMMATES.filter((t) =>
          t.name.toLowerCase().startsWith(mentionState.query.toLowerCase()),
        ).slice(0, 5)

  useEffect(() => {
    if (taRef.current !== null) {
      const ta = taRef.current
      ta.style.height = 'auto'
      ta.style.height = `${Math.min(180, ta.scrollHeight)}px`
    }
  }, [draft])

  return (
    <div className="relative border-t border-slate-100 bg-white px-3 py-2">
      <textarea
        ref={taRef}
        value={draft}
        onChange={(e) => updateBody(e.target.value)}
        onKeyDown={onKeyDown}
        onKeyUp={onSelectionChange}
        onClick={onSelectionChange}
        rows={mode === 'reply' ? 2 : 3}
        placeholder={placeholder ?? (mode === 'reply' ? 'Reply… (⌘+Enter to send)' : 'Comment on this part… (⌘+Enter to send)')}
        className="block w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-[12px] leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-primary focus:outline-none"
      />

      {/* @ mention popover */}
      {suggestions.length > 0 && (
        <div
          role="listbox"
          className="dv-anim-pop absolute bottom-full left-3 z-30 mb-1 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
        >
          {suggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              role="option"
              onClick={() => pickMention(s.name)}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] text-slate-700 transition hover:bg-slate-50"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">
                {s.name
                  .split(' ')
                  .map((p) => p.charAt(0))
                  .join('')}
              </span>
              <span className="flex-1 truncate">{s.name}</span>
              <span className="text-[9.5px] text-slate-400">{s.role}</span>
            </button>
          ))}
        </div>
      )}

      {/* Emoji picker */}
      {pickerOpen && (
        <div
          role="menu"
          className="dv-anim-pop absolute bottom-full left-3 z-30 mb-1 inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white px-1 py-1 shadow-xl"
        >
          {PRESET_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                updateBody(draft + e)
                setPickerOpen(false)
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded text-base transition hover:bg-slate-100"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <div className="mt-1.5 flex items-center justify-between">
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Insert mention"
            onClick={() => {
              const ta = taRef.current
              if (ta === null) return
              const cursor = ta.selectionStart
              const next = `${draft.slice(0, cursor)}@${draft.slice(cursor)}`
              updateBody(next)
              requestAnimationFrame(() => {
                ta.focus()
                ta.setSelectionRange(cursor + 1, cursor + 1)
                onSelectionChange()
              })
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <AtSign className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Insert emoji"
            onClick={() => setPickerOpen((o) => !o)}
            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <Smile className="h-3.5 w-3.5" />
          </button>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={draft.trim() === '' || busy}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            'Sending…'
          ) : (
            <>
              <Send className="h-3 w-3" /> Send
            </>
          )}
        </button>
      </div>
    </div>
  )
}
