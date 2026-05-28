'use client'

/**
 * useSeedThreads — one-shot migration that hydrates the Phase-1 mock backend
 * from the existing SEED_FULL_DECISIONS so the redesigned UI has realistic
 * data on first load.
 *
 * Runs once per (partId) when localStorage has no threads yet — flips a
 * sentinel key so we don't double-seed on subsequent reloads.
 */

import { useEffect } from 'react'
import { SEED_FULL_DECISIONS, type MockFullDecision } from '@/lib/mockWorkspace'
import type { Reply, Thread, ThreadPriority, ThreadStatus } from '../types/thread.types'

const THREADS_KEY = (partId: string) => `dataverse.threads.${partId}`
const REPLIES_KEY = (threadId: string) => `dataverse.replies.${threadId}`
const SEEDED_FLAG = (partId: string) => `dataverse.threads-seeded.${partId}`
const CHANGE_EVENT = 'dataverse:threads-changed'

function mapDecisionState(state: MockFullDecision['state']): ThreadStatus {
  if (state === 'ACCEPTED') return 'resolved'
  if (state === 'REJECTED') return 'archived'
  return 'open' // DRAFT, PROPOSED, SUPERSEDED all map to open
}

function mapPriority(p: MockFullDecision['priority']): ThreadPriority {
  if (p === 'blocker' || p === 'high' || p === 'medium' || p === 'low') return p
  return null
}

export function useSeedThreads(partId: string | undefined | null): void {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (partId === undefined || partId === null || partId === '') return
    const flag = window.localStorage.getItem(SEEDED_FLAG(partId))
    if (flag === '1') return

    const decisions = SEED_FULL_DECISIONS.filter((d) => d.part_id === partId)
    if (decisions.length === 0) {
      window.localStorage.setItem(SEEDED_FLAG(partId), '1')
      return
    }

    const threads: Thread[] = []
    for (const d of decisions) {
      const threadId = `thr_seed_${d.id}`
      const rootReplyId = `rep_seed_${d.id}_root`
      const now = new Date(d.created_at).toISOString()

      threads.push({
        id: threadId,
        partId,
        anchor: {
          partId,
          faceUuid: d.anchor_id,
          centroid: { x: 0, y: 0, z: 0 }, // viewer pin is driven separately
        },
        rootReplyId,
        authorId: d.author_name,
        authorName: d.author_name,
        title: d.title ?? d.rationale.split('.')[0],
        status: mapDecisionState(d.state),
        priority: mapPriority(d.priority),
        assigneeId: d.assignee_name ?? null,
        assigneeName: d.assignee_name ?? null,
        tags: d.tags ?? [],
        replyCount: 1 + (d.signoff_progress?.responded ?? 0),
        lastReplyAt: now,
        participantIds: [d.author_name, ...(d.assignee_name ? [d.assignee_name] : [])],
        createdAt: now,
        updatedAt: now,
        resolvedAt: d.state === 'ACCEPTED' ? now : null,
        resolvedById: d.state === 'ACCEPTED' ? d.author_name : null,
      })

      // Root reply
      const rootReply: Reply = {
        id: rootReplyId,
        threadId,
        authorId: d.author_name,
        authorName: d.author_name,
        body: d.rationale,
        mentions: [],
        reactions:
          d.priority === 'blocker' || d.priority === 'high'
            ? [{ emoji: '👀', userIds: ['Sarah Chen', 'Maria Garcia'] }]
            : [],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }

      // Synthesize a few follow-up replies so the drawer has content
      const followUps: Reply[] = []
      if (d.signoff_progress !== undefined && d.signoff_progress.responded > 0) {
        const responders = ['Maria Garcia', 'John Williams', 'David Kim']
        for (let i = 0; i < d.signoff_progress.responded; i++) {
          const responder = responders[i % responders.length]
          const ts = new Date(+new Date(d.created_at) + (i + 1) * 30 * 60_000).toISOString()
          followUps.push({
            id: `rep_seed_${d.id}_${i + 1}`,
            threadId,
            authorId: responder,
            authorName: responder,
            body:
              i === 0
                ? `Reviewed. Citations align with ${d.citations[0] ?? 'spec'}.`
                : `Confirmed — ready to sign off. @${d.author_name} please proceed.`,
            mentions:
              i === 1
                ? [{ userId: d.author_name, start: 36, end: 36 + d.author_name.length + 1 }]
                : [],
            reactions: i === 0 ? [{ emoji: '✅', userIds: [d.author_name] }] : [],
            createdAt: ts,
            updatedAt: ts,
            deletedAt: null,
          })
        }
      }

      window.localStorage.setItem(
        REPLIES_KEY(threadId),
        JSON.stringify([rootReply, ...followUps]),
      )
    }

    window.localStorage.setItem(THREADS_KEY(partId), JSON.stringify(threads))
    window.localStorage.setItem(SEEDED_FLAG(partId), '1')
    window.dispatchEvent(
      new CustomEvent(CHANGE_EVENT, { detail: { key: THREADS_KEY(partId) } }),
    )
  }, [partId])
}
