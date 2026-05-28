'use client'

/**
 * Typed event bus for the v2 comment system.
 *
 * Used for transient signals where Zustand would create churn:
 *   · viewer:pin-clicked  — a 3D pin was clicked (fires from CommentLabels)
 *   · panel:thread-clicked — a thread row was clicked (fires from CommentsPanel)
 *   · keyboard:next / previous — j / k pressed (fires from useKeyboardShortcuts)
 *
 * Subscribers read selectedThreadId from commentsStore for the actual state.
 */

type EventMap = {
  'viewer:pin-clicked': { threadId: string }
  'panel:thread-clicked': { threadId: string }
  'keyboard:next': Record<string, never>
  'keyboard:previous': Record<string, never>
  'keyboard:reply': Record<string, never>
  'keyboard:resolve': Record<string, never>
}

type Listener<K extends keyof EventMap> = (payload: EventMap[K]) => void

class TypedEventBus {
  private listeners = new Map<keyof EventMap, Set<Listener<keyof EventMap>>>()

  on<K extends keyof EventMap>(event: K, fn: Listener<K>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    const set = this.listeners.get(event) as Set<Listener<K>>
    set.add(fn)
    return () => set.delete(fn)
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const set = this.listeners.get(event) as Set<Listener<K>> | undefined
    set?.forEach((fn) => fn(payload))
  }
}

export const eventBus = new TypedEventBus()
