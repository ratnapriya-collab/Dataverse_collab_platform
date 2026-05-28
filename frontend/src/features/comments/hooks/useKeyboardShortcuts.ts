'use client'

/**
 * useKeyboardShortcuts — j/k/r/e/Esc + ? for the v2 comment system.
 *
 * Skips when focus is in a text input / textarea / contenteditable so users
 * can still type freely. Subscribes to the document at body level.
 */

import { useEffect } from 'react'
import { useCommentsStore } from '../store/commentsStore'
import { eventBus } from '../eventBus'

interface Options {
  threadIdsInOrder: string[]
  onShowHelp?: () => void
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (el.isContentEditable) return true
  return false
}

export function useCommentKeyboardShortcuts({ threadIdsInOrder, onShowHelp }: Options): void {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return

      const state = useCommentsStore.getState()
      const currentIdx = state.selectedThreadId
        ? threadIdsInOrder.indexOf(state.selectedThreadId)
        : -1

      switch (e.key) {
        case 'j': {
          e.preventDefault()
          const next = threadIdsInOrder[currentIdx + 1]
          if (next !== undefined) state.selectThread(next, 'shortcut')
          eventBus.emit('keyboard:next', {})
          break
        }
        case 'k': {
          e.preventDefault()
          const prev = threadIdsInOrder[currentIdx - 1]
          if (prev !== undefined && currentIdx > 0) state.selectThread(prev, 'shortcut')
          eventBus.emit('keyboard:previous', {})
          break
        }
        case 'Escape': {
          if (state.selectedThreadId !== null) {
            e.preventDefault()
            state.closeDrawer()
          }
          break
        }
        case 'r': {
          if (state.selectedThreadId !== null) {
            e.preventDefault()
            eventBus.emit('keyboard:reply', {})
          }
          break
        }
        case 'e': {
          if (state.selectedThreadId !== null) {
            e.preventDefault()
            eventBus.emit('keyboard:resolve', {})
          }
          break
        }
        case '?': {
          if (e.shiftKey) {
            e.preventDefault()
            onShowHelp?.()
          }
          break
        }
        case '/': {
          e.preventDefault()
          const input = document.querySelector<HTMLInputElement>('[data-comments-search]')
          input?.focus()
          break
        }
      }
    }

    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [threadIdsInOrder, onShowHelp])
}
