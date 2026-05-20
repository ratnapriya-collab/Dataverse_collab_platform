/** Types mirroring the FastAPI Pydantic response schemas. */

export type UserRole = 'REVIEWER' | 'ENGINEER' | 'ADMIN'

export interface UserRead {
  id: string
  email: string
  name: string
  role: UserRole
  created_at: string
}

export interface TokenResponse {
  access_token: string
  token_type: 'bearer'
  user: UserRead
}

export interface HealthResponse {
  status: 'ok'
  db_connected: boolean
}

/** Error envelope the backend uses inside FastAPI's `detail` field. */
export interface ApiErrorBody {
  error: string
  message: string
}

// ── Parts ───────────────────────────────────────────────────────────────────

export interface PartRead {
  id: string
  name: string
  file_name: string
  content_hash: string
  face_count: number
  edge_count: number
  owner_id: string
  created_at: string
}

export interface PartDetail extends PartRead {
  /** Relative path with embedded short-lived token, e.g. `/api/parts/<id>/file?token=...` */
  file_url: string
  file_url_expires_in: number
}

// ── Anchors ─────────────────────────────────────────────────────────────────

export type AnchorKind = 'FACE' | 'EDGE' | 'VERTEX'

export interface Centroid {
  x: number
  y: number
  z: number
}

export interface AnchorRead {
  id: string
  part_id: string
  face_uuid: string
  kind: AnchorKind
  centroid: Centroid
  created_by: string
  created_at: string
}

export interface AnchorCreate {
  part_id: string
  face_uuid: string
  kind?: AnchorKind
  centroid: Centroid
}

// ── Decisions ───────────────────────────────────────────────────────────────

export type DecisionState =
  | 'DRAFT'
  | 'PROPOSED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'SUPERSEDED'

export interface DecisionAuthor {
  id: string
  name: string
  email: string
}

export interface DecisionAnchor {
  id: string
  face_uuid: string
  centroid: Centroid
}

export interface DecisionRead {
  id: string
  part_id: string
  anchor_id: string
  author_id: string
  state: DecisionState
  rationale: string
  accepted_at: string | null
  accepted_by_id: string | null
  created_at: string
  updated_at: string
  author: DecisionAuthor | null
  anchor: DecisionAnchor | null
}

export interface DecisionCreate {
  part_id: string
  anchor_id: string
  rationale: string
}

export interface RationaleSuggestion {
  suggestion: string
}

// ── Datum AI · Hook 2 · Summarize Thread ─────────────────────────────────
// Contracts match backend Pydantic schemas (app/schemas/decision.py).

export interface SummarizeThreadRequest {
  thread_id: string
  part_name?: string
  decision_ids?: string[]
}

export interface SummarizeThreadResponse {
  summary: string
  key_concerns: string[]
  recommended_action: string
  confidence: number
  citations: string[]
  source: 'llm' | 'mocked-fallback'
  declined: boolean
  declined_reason?: string | null
}
