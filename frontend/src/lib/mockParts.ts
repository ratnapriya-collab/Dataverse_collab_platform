/**
 * Mock-part fast path helpers.
 *
 * SEED part IDs surfaced by the Workspace → Project Hub flow look like
 * `demo_1`, `demo_2`, … They are NOT persisted in the backend, so any
 * write (anchor.create, decision.create) would 404. These helpers let the
 * write path build synthetic responses that match the real API shapes —
 * the rest of the app can't tell the difference.
 *
 * Refresh wipes mock decisions (in-memory only). That's fine for the demo.
 */

import type { AnchorRead, Centroid, DecisionRead, UserRead } from '@/types/api'

const MOCK_PART_ID_RE = /^demo_[A-Za-z0-9_-]+$/

export function isMockPartId(partId: string | undefined | null): boolean {
  if (partId === undefined || partId === null) return false
  return MOCK_PART_ID_RE.test(partId)
}

/** Stable-ish 24-hex ID generator for mocked DB rows. */
function mockId(prefix: string): string {
  const hex = (Math.random().toString(16).slice(2) + Date.now().toString(16)).slice(0, 24)
  return `${prefix}_${hex}`
}

export function buildMockAnchor(args: {
  partId: string
  faceUuid: string
  centroid: Centroid
  user: UserRead
}): AnchorRead {
  return {
    id: mockId('anc'),
    part_id: args.partId,
    face_uuid: args.faceUuid,
    kind: 'FACE',
    centroid: args.centroid,
    created_by: args.user.id,
    created_at: new Date().toISOString(),
  }
}

export function buildMockDecision(args: {
  partId: string
  anchor: AnchorRead
  rationale: string
  user: UserRead
}): DecisionRead {
  const now = new Date().toISOString()
  return {
    id: mockId('dec'),
    part_id: args.partId,
    anchor_id: args.anchor.id,
    author_id: args.user.id,
    state: 'PROPOSED',
    rationale: args.rationale,
    accepted_at: null,
    accepted_by_id: null,
    created_at: now,
    updated_at: now,
    author: {
      id: args.user.id,
      name: args.user.name,
      email: args.user.email,
    },
    anchor: {
      id: args.anchor.id,
      face_uuid: args.anchor.face_uuid,
      centroid: args.anchor.centroid,
    },
  }
}
