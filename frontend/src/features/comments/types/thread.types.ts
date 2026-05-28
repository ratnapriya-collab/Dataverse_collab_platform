/**
 * Thread + Reply types — the v2 comment system.
 *
 * A Thread = anchor + meta (status, priority, assignee, tags).
 * Replies are stored separately so the root message is just another reply.
 * Pattern from GitHub Issues / Linear — lets you edit the root without
 * coupling to thread-level fields.
 *
 * Persistence (Phase 1, mocked): localStorage under
 *   `dataverse.threads.<partId>` → array of Thread
 *   `dataverse.replies.<threadId>` → array of Reply
 * Real backend swap is a one-day job — schemas are stable.
 */

export type ThreadStatus = 'open' | 'resolved' | 'archived'
export type ThreadPriority = 'blocker' | 'high' | 'medium' | 'low' | null

export interface Anchor3D {
  partId: string
  faceUuid: string
  centroid: { x: number; y: number; z: number }
}

export interface Mention {
  userId: string
  start: number
  end: number
}

export interface Reaction {
  emoji: string
  userIds: string[]
}

export interface Reply {
  id: string
  threadId: string
  authorId: string
  authorName: string
  body: string
  mentions: Mention[]
  reactions: Reaction[]
  createdAt: string
  updatedAt: string
  /** Soft-delete tombstone — null = live, ISO date = deleted at. */
  deletedAt: string | null
  /** Optimistic-update flag — true while the server hasn't confirmed. */
  pending?: boolean
}

export interface Thread {
  id: string
  partId: string
  anchor: Anchor3D
  /** Root reply ID — the first message in the thread. */
  rootReplyId: string
  authorId: string
  authorName: string
  title: string
  status: ThreadStatus
  priority: ThreadPriority
  assigneeId: string | null
  assigneeName: string | null
  tags: string[]
  replyCount: number
  lastReplyAt: string
  participantIds: string[]
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  resolvedById: string | null
}

export interface ThreadFilters {
  status: ThreadStatus[]
  priority: ThreadPriority[]
  assignedToMe: boolean
  mentionsMe: boolean
  searchQuery: string
}

export type PinDensityMode = 'hidden' | 'open-only' | 'all' | 'clustered'

export type SelectionSource = 'sidebar' | 'pin' | 'search' | 'shortcut' | null
