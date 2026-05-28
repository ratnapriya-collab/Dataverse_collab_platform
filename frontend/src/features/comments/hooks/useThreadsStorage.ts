'use client'

/**
 * useThreadsStorage / useRepliesStorage — Phase 1 mock backend.
 *
 * Threads and replies persist in localStorage; same eventing pattern as
 * useBookmarks so cross-tab and same-tab listeners stay in sync.
 *
 * When the real backend arrives, swap these for React Query hooks against
 * /api/threads and /api/replies. The components above don't need to change.
 */

import { useCallback, useEffect, useState } from 'react'
import type { Reply, Thread, ThreadStatus } from '../types/thread.types'

const THREADS_KEY = (partId: string) => `dataverse.threads.${partId}`
const REPLIES_KEY = (threadId: string) => `dataverse.replies.${threadId}`
const CHANGE_EVENT = 'dataverse:threads-changed'

function safeReadArray<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function safeWriteArray<T>(key: string, items: T[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(items))
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { key } }))
  } catch {
    // silent fail
  }
}

function mockId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}

// ── Threads ─────────────────────────────────────────────────────────────

export function useThreads(partId: string): {
  threads: Thread[]
  upsertThread: (thread: Thread) => void
  patchThread: (id: string, patch: Partial<Thread>) => void
  deleteThread: (id: string) => void
} {
  const [threads, setThreads] = useState<Thread[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const load = () => setThreads(safeReadArray<Thread>(THREADS_KEY(partId)))
    load()
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { key: string } | undefined
      if (detail?.key === THREADS_KEY(partId)) load()
    }
    window.addEventListener(CHANGE_EVENT, handler)
    window.addEventListener('storage', load)
    return () => {
      window.removeEventListener(CHANGE_EVENT, handler)
      window.removeEventListener('storage', load)
    }
  }, [partId])

  const upsertThread = useCallback(
    (thread: Thread) => {
      const current = safeReadArray<Thread>(THREADS_KEY(partId))
      const idx = current.findIndex((t) => t.id === thread.id)
      const next = idx >= 0 ? current.map((t, i) => (i === idx ? thread : t)) : [...current, thread]
      safeWriteArray(THREADS_KEY(partId), next)
    },
    [partId],
  )

  const patchThread = useCallback(
    (id: string, patch: Partial<Thread>) => {
      const current = safeReadArray<Thread>(THREADS_KEY(partId))
      const next = current.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t))
      safeWriteArray(THREADS_KEY(partId), next)
    },
    [partId],
  )

  const deleteThread = useCallback(
    (id: string) => {
      const current = safeReadArray<Thread>(THREADS_KEY(partId))
      safeWriteArray(
        THREADS_KEY(partId),
        current.filter((t) => t.id !== id),
      )
    },
    [partId],
  )

  return { threads, upsertThread, patchThread, deleteThread }
}

// ── Replies ─────────────────────────────────────────────────────────────

export function useReplies(threadId: string | null): {
  replies: Reply[]
  addReply: (input: {
    body: string
    authorId: string
    authorName: string
  }) => Reply
  patchReply: (id: string, patch: Partial<Reply>) => void
  deleteReply: (id: string) => void
  toggleReaction: (replyId: string, emoji: string, userId: string) => void
} {
  const [replies, setReplies] = useState<Reply[]>([])

  useEffect(() => {
    if (threadId === null || typeof window === 'undefined') {
      setReplies([])
      return
    }
    const load = () => setReplies(safeReadArray<Reply>(REPLIES_KEY(threadId)))
    load()
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { key: string } | undefined
      if (detail?.key === REPLIES_KEY(threadId)) load()
    }
    window.addEventListener(CHANGE_EVENT, handler)
    window.addEventListener('storage', load)
    return () => {
      window.removeEventListener(CHANGE_EVENT, handler)
      window.removeEventListener('storage', load)
    }
  }, [threadId])

  const addReply = useCallback(
    (input: { body: string; authorId: string; authorName: string }): Reply => {
      if (threadId === null) throw new Error('no thread')
      const now = new Date().toISOString()
      const reply: Reply = {
        id: mockId('rep'),
        threadId,
        authorId: input.authorId,
        authorName: input.authorName,
        body: input.body,
        mentions: parseMentions(input.body),
        reactions: [],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }
      const current = safeReadArray<Reply>(REPLIES_KEY(threadId))
      safeWriteArray(REPLIES_KEY(threadId), [...current, reply])
      return reply
    },
    [threadId],
  )

  const patchReply = useCallback(
    (id: string, patch: Partial<Reply>) => {
      if (threadId === null) return
      const current = safeReadArray<Reply>(REPLIES_KEY(threadId))
      const next = current.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r))
      safeWriteArray(REPLIES_KEY(threadId), next)
    },
    [threadId],
  )

  const deleteReply = useCallback(
    (id: string) => {
      if (threadId === null) return
      const now = new Date().toISOString()
      const current = safeReadArray<Reply>(REPLIES_KEY(threadId))
      safeWriteArray(
        REPLIES_KEY(threadId),
        current.map((r) => (r.id === id ? { ...r, deletedAt: now, body: '' } : r)),
      )
    },
    [threadId],
  )

  const toggleReaction = useCallback(
    (replyId: string, emoji: string, userId: string) => {
      if (threadId === null) return
      const current = safeReadArray<Reply>(REPLIES_KEY(threadId))
      const next = current.map((r) => {
        if (r.id !== replyId) return r
        const existing = r.reactions.find((x) => x.emoji === emoji)
        let reactions: typeof r.reactions
        if (existing === undefined) {
          reactions = [...r.reactions, { emoji, userIds: [userId] }]
        } else if (existing.userIds.includes(userId)) {
          const stripped = existing.userIds.filter((u) => u !== userId)
          reactions =
            stripped.length === 0
              ? r.reactions.filter((x) => x.emoji !== emoji)
              : r.reactions.map((x) => (x.emoji === emoji ? { ...x, userIds: stripped } : x))
        } else {
          reactions = r.reactions.map((x) =>
            x.emoji === emoji ? { ...x, userIds: [...x.userIds, userId] } : x,
          )
        }
        return { ...r, reactions }
      })
      safeWriteArray(REPLIES_KEY(threadId), next)
    },
    [threadId],
  )

  return { replies, addReply, patchReply, deleteReply, toggleReaction }
}

// ── Helpers ─────────────────────────────────────────────────────────────

/** Quick mention parser — finds @Name patterns and returns offsets. */
export function parseMentions(body: string): { userId: string; start: number; end: number }[] {
  const matches: { userId: string; start: number; end: number }[] = []
  const re = /@([A-Z][a-z]+(?: [A-Z][a-z]+)?)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    matches.push({ userId: m[1], start: m.index, end: m.index + m[0].length })
  }
  return matches
}

/** Convenience: how many replies are unread for the current user. */
export function unreadReplyCount(replies: Reply[], lastReadAtIso: string | null): number {
  if (lastReadAtIso === null) return replies.length
  const last = +new Date(lastReadAtIso)
  return replies.filter((r) => +new Date(r.createdAt) > last && r.deletedAt === null).length
}

/** Convert a Thread + its replies + member list into a CreateThreadInput. */
export function buildThread(input: {
  partId: string
  faceUuid: string
  centroid: { x: number; y: number; z: number }
  authorId: string
  authorName: string
  title: string
  rootBody: string
}): { thread: Thread; rootReply: Reply } {
  const threadId = mockId('thr')
  const replyId = mockId('rep')
  const now = new Date().toISOString()
  const thread: Thread = {
    id: threadId,
    partId: input.partId,
    anchor: { partId: input.partId, faceUuid: input.faceUuid, centroid: input.centroid },
    rootReplyId: replyId,
    authorId: input.authorId,
    authorName: input.authorName,
    title: input.title,
    status: 'open' satisfies ThreadStatus,
    priority: null,
    assigneeId: null,
    assigneeName: null,
    tags: [],
    replyCount: 1,
    lastReplyAt: now,
    participantIds: [input.authorName],
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    resolvedById: null,
  }
  const rootReply: Reply = {
    id: replyId,
    threadId,
    authorId: input.authorId,
    authorName: input.authorName,
    body: input.rootBody,
    mentions: parseMentions(input.rootBody),
    reactions: [],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }
  return { thread, rootReply }
}
