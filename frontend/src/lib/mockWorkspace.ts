/**
 * In-memory mock data for the /admin page.
 *
 * NO BACKEND — all data lives in React state. Refresh resets everything.
 * If you later want persistence across refreshes, hydrate from localStorage
 * in the page's mount effect.
 */

export type WorkspaceRole = 'ADMIN' | 'MEMBER' | 'VIEWER'

export interface MockMember {
  id: string
  name: string
  email: string
  role: WorkspaceRole
  joined_at: string // ISO
  last_active_at: string // ISO
  /** True for the row representing the currently signed-in user. */
  is_you?: boolean
  /** Mocked online indicator — drives the green dot in member rows. */
  online?: boolean
}

export interface MockInvite {
  id: string
  code: string
  role: WorkspaceRole
  invited_email: string | null
  invited_by_name: string
  expires_at: string // ISO
  used: boolean
  used_by_name: string | null
  created_at: string // ISO
}

export interface MockWorkspace {
  id: string
  name: string
  slug: string
  description: string
  created_at: string // ISO
}

// ── Helpers (declared first so seed data can call them at module-load) ──────

const URLSAFE_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/**
 * 24-char URL-safe random invite code. Uses Web Crypto under the hood —
 * never use Math.random() for security tokens.
 */
export function generateInviteCode(): string {
  const bytes = new Uint8Array(24)
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(bytes)
  } else if (typeof globalThis.crypto !== 'undefined') {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    // Deterministic fallback for SSR — never happens in practice since the
    // admin page is a Client Component.
    for (let i = 0; i < bytes.length; i++) bytes[i] = i
  }
  let code = ''
  for (let i = 0; i < bytes.length; i++) {
    code += URLSAFE_ALPHABET[(bytes[i] as number) % URLSAFE_ALPHABET.length]
  }
  return code
}

// ── Seed data ────────────────────────────────────────────────────────────────

const NOW = Date.now()
const DAYS = 86_400_000

export const SEED_WORKSPACE: MockWorkspace = {
  id: 'ws_demo',
  name: 'DataVerse Demo',
  slug: 'dataverse-demo',
  description:
    'A demo workspace for reviewing CAD parts and anchoring decisions. Replace with your real workspace.',
  created_at: new Date(NOW - 90 * DAYS).toISOString(),
}

/**
 * Build the seed members list. The first entry is reserved for the currently
 * signed-in user — call `withCurrentUser` to fill it in before rendering.
 */
export const SEED_MEMBERS: MockMember[] = [
  {
    id: 'you',
    name: 'You',
    email: 'you@example.com',
    role: 'ADMIN',
    joined_at: new Date(NOW - 90 * DAYS).toISOString(),
    last_active_at: new Date(NOW - 30_000).toISOString(),
    online: true,
    is_you: true,
  },
  {
    id: 'mem_sarah',
    name: 'Sarah Chen',
    email: 'sarah.chen@acme-supplier.com',
    role: 'MEMBER',
    joined_at: new Date(NOW - 32 * DAYS).toISOString(),
    last_active_at: new Date(NOW - 5 * 60_000).toISOString(),
    online: true,
  },
  {
    id: 'mem_john',
    name: 'John Williams',
    email: 'jwilliams@oem.industries',
    role: 'MEMBER',
    joined_at: new Date(NOW - 18 * DAYS).toISOString(),
    last_active_at: new Date(NOW - 4 * 3_600_000).toISOString(),
  },
  {
    id: 'mem_maria',
    name: 'Maria Garcia',
    email: 'maria.g@dataverse.io',
    role: 'VIEWER',
    joined_at: new Date(NOW - 9 * DAYS).toISOString(),
    last_active_at: new Date(NOW - 2 * DAYS).toISOString(),
  },
  {
    id: 'mem_david',
    name: 'David Kim',
    email: 'david.kim@acme-supplier.com',
    role: 'ADMIN',
    joined_at: new Date(NOW - 4 * DAYS).toISOString(),
    last_active_at: new Date(NOW - 25 * 60_000).toISOString(),
    online: true,
  },
]

export const SEED_INVITES: MockInvite[] = [
  {
    id: 'inv_1',
    code: generateInviteCode(),
    role: 'MEMBER',
    invited_email: 'priya.s@oem.industries',
    invited_by_name: 'You',
    expires_at: new Date(NOW + 6 * DAYS).toISOString(),
    used: false,
    used_by_name: null,
    created_at: new Date(NOW - 1 * DAYS).toISOString(),
  },
  {
    id: 'inv_2',
    code: generateInviteCode(),
    role: 'VIEWER',
    invited_email: null,
    invited_by_name: 'David Kim',
    expires_at: new Date(NOW + 2 * DAYS).toISOString(),
    used: true,
    used_by_name: 'Maria Garcia',
    created_at: new Date(NOW - 12 * DAYS).toISOString(),
  },
]

// ── Projects ─────────────────────────────────────────────────────────────────

export type ProjectStatus = 'ACTIVE' | 'IN_REVIEW' | 'APPROVED' | 'ARCHIVED'
export type ProjectShape = 'gear' | 'bracket' | 'housing' | 'cylinder' | 'plate' | 'manifold'
export type ProjectTone = 'cyan' | 'amber' | 'emerald' | 'rose' | 'violet' | 'slate' | 'sky'

export interface MockProject {
  id: string
  name: string
  description: string
  status: ProjectStatus
  shape: ProjectShape
  tone: ProjectTone
  parts_count: number
  open_comments: number
  /** Names from SEED_MEMBERS — used to render an avatar stack. */
  member_names: string[]
  last_activity_at: string
}

export const SEED_PROJECTS: MockProject[] = [
  {
    id: 'proj_turbo',
    name: 'Turbo Housing v3',
    description:
      'Compressor housing redesign for the V8 turbo platform. Pending supplier sign-off.',
    status: 'IN_REVIEW',
    shape: 'housing',
    tone: 'cyan',
    parts_count: 12,
    open_comments: 3,
    member_names: ['You', 'Sarah Chen', 'David Kim'],
    last_activity_at: new Date(NOW - 25 * 60_000).toISOString(),
  },
  {
    id: 'proj_bracket',
    name: 'Mounting Bracket Assembly',
    description:
      'Lightweight aluminium bracket for the dashboard ECU module. Topology-optimised.',
    status: 'ACTIVE',
    shape: 'bracket',
    tone: 'amber',
    parts_count: 4,
    open_comments: 1,
    member_names: ['You', 'John Williams', 'Maria Garcia'],
    last_activity_at: new Date(NOW - 2 * 3_600_000).toISOString(),
  },
  {
    id: 'proj_gear',
    name: 'Planetary Gear Set',
    description:
      'Reduction gearbox internals. Tolerance stack reviewed by quality engineering.',
    status: 'APPROVED',
    shape: 'gear',
    tone: 'emerald',
    parts_count: 8,
    open_comments: 0,
    member_names: ['Sarah Chen', 'David Kim'],
    last_activity_at: new Date(NOW - 1 * DAYS).toISOString(),
  },
  {
    id: 'proj_intake',
    name: 'Intake Manifold',
    description:
      'CFD-tuned intake runner geometry. CFD report attached to the assembly root.',
    status: 'ACTIVE',
    shape: 'manifold',
    tone: 'violet',
    parts_count: 6,
    open_comments: 2,
    member_names: ['You', 'Sarah Chen', 'John Williams', 'Maria Garcia'],
    last_activity_at: new Date(NOW - 4 * 3_600_000).toISOString(),
  },
  {
    id: 'proj_plate',
    name: 'Engine Mount Plate',
    description:
      'Cast iron mount plate, 3 isolator points. Vibration analysis included.',
    status: 'IN_REVIEW',
    shape: 'plate',
    tone: 'rose',
    parts_count: 2,
    open_comments: 4,
    member_names: ['Maria Garcia', 'David Kim'],
    last_activity_at: new Date(NOW - 9 * 3_600_000).toISOString(),
  },
  {
    id: 'proj_cooling',
    name: 'Cooling System (legacy)',
    description:
      'Previous-gen cooling loop. Archived after switch to plate-fin design.',
    status: 'ARCHIVED',
    shape: 'cylinder',
    tone: 'slate',
    parts_count: 15,
    open_comments: 0,
    member_names: ['John Williams'],
    last_activity_at: new Date(NOW - 45 * DAYS).toISOString(),
  },
]

export function getProject(id: string): MockProject | undefined {
  return SEED_PROJECTS.find((p) => p.id === id)
}

// ── Activity feed ────────────────────────────────────────────────────────────

export type ActivityKind =
  | 'PART_UPLOADED'
  | 'COMMENT_CREATED'
  | 'COMMENT_ACCEPTED'
  | 'COMMENT_REJECTED'
  | 'MEMBER_JOINED'
  | 'INVITE_CREATED'

export interface ActivityEntry {
  id: string
  kind: ActivityKind
  actor_name: string
  /** Optional — the thing the activity is about (a part name, member name, etc.). */
  target?: string
  /** Optional — short rationale snippet for comment events. */
  snippet?: string
  /** Optional — part id to link to. */
  part_id?: string
  created_at: string // ISO
}

export const SEED_ACTIVITY: ActivityEntry[] = [
  {
    id: 'act_1',
    kind: 'COMMENT_CREATED',
    actor_name: 'Sarah Chen',
    target: 'turbo_housing_v2.step',
    snippet: 'Wall thickness here is below the 2.0 mm minimum spec — needs reinforcement.',
    part_id: 'demo_1',
    created_at: new Date(NOW - 25 * 60_000).toISOString(),
  },
  {
    id: 'act_2',
    kind: 'PART_UPLOADED',
    actor_name: 'John Williams',
    target: 'bracket_rev3.step',
    part_id: 'demo_2',
    created_at: new Date(NOW - 2 * 3_600_000).toISOString(),
  },
  {
    id: 'act_3',
    kind: 'COMMENT_ACCEPTED',
    actor_name: 'You',
    target: 'gear_housing.step',
    snippet: 'Tolerance loosened to ±0.05 mm — confirmed with machining.',
    part_id: 'demo_3',
    created_at: new Date(NOW - 5 * 3_600_000).toISOString(),
  },
  {
    id: 'act_4',
    kind: 'MEMBER_JOINED',
    actor_name: 'David Kim',
    target: 'as ADMIN',
    created_at: new Date(NOW - 4 * DAYS).toISOString(),
  },
  {
    id: 'act_5',
    kind: 'COMMENT_CREATED',
    actor_name: 'Maria Garcia',
    target: 'turbo_housing_v2.step',
    snippet: 'Surface roughness on the inlet face is inconsistent with the Ra 1.6 µm spec.',
    part_id: 'demo_1',
    created_at: new Date(NOW - 5 * DAYS).toISOString(),
  },
  {
    id: 'act_6',
    kind: 'INVITE_CREATED',
    actor_name: 'David Kim',
    target: 'priya.s@oem.industries',
    created_at: new Date(NOW - 6 * DAYS).toISOString(),
  },
  {
    id: 'act_7',
    kind: 'PART_UPLOADED',
    actor_name: 'Sarah Chen',
    target: 'mounting_plate.glb',
    part_id: 'demo_4',
    created_at: new Date(NOW - 9 * DAYS).toISOString(),
  },
  {
    id: 'act_8',
    kind: 'COMMENT_REJECTED',
    actor_name: 'You',
    target: 'gear_housing.step',
    snippet: 'Out of scope for this revision — defer to v4.',
    part_id: 'demo_3',
    created_at: new Date(NOW - 12 * DAYS).toISOString(),
  },
]

// ── Recent parts ─────────────────────────────────────────────────────────────

export type PartTone = 'cyan' | 'amber' | 'emerald' | 'rose' | 'violet' | 'slate'

export interface MockRecentPart {
  id: string
  name: string
  file_name: string
  uploaded_by_name: string
  comments_count: number
  open_comments_count: number
  last_activity_at: string
  /** Hue used for the placeholder thumbnail gradient. */
  tone: PartTone
}

export const SEED_RECENT_PARTS: MockRecentPart[] = [
  {
    id: 'demo_1',
    name: 'Turbo Housing v2',
    file_name: 'turbo_housing_v2.step',
    uploaded_by_name: 'Sarah Chen',
    comments_count: 4,
    open_comments_count: 2,
    last_activity_at: new Date(NOW - 25 * 60_000).toISOString(),
    tone: 'cyan',
  },
  {
    id: 'demo_2',
    name: 'Mounting Bracket rev3',
    file_name: 'bracket_rev3.step',
    uploaded_by_name: 'John Williams',
    comments_count: 0,
    open_comments_count: 0,
    last_activity_at: new Date(NOW - 2 * 3_600_000).toISOString(),
    tone: 'amber',
  },
  {
    id: 'demo_3',
    name: 'Gear Housing',
    file_name: 'gear_housing.step',
    uploaded_by_name: 'You',
    comments_count: 6,
    open_comments_count: 1,
    last_activity_at: new Date(NOW - 5 * 3_600_000).toISOString(),
    tone: 'emerald',
  },
  {
    id: 'demo_4',
    name: 'Mounting Plate',
    file_name: 'mounting_plate.glb',
    uploaded_by_name: 'Sarah Chen',
    comments_count: 2,
    open_comments_count: 0,
    last_activity_at: new Date(NOW - 9 * DAYS).toISOString(),
    tone: 'violet',
  },
]

// ── Pending decisions awaiting review ────────────────────────────────────────

export interface MockPendingDecision {
  id: string
  part_id: string
  part_name: string
  rationale: string
  author_name: string
  created_at: string
}

export const SEED_PENDING_DECISIONS: MockPendingDecision[] = [
  {
    id: 'dec_1',
    part_id: 'demo_1',
    part_name: 'Turbo Housing v2',
    rationale:
      'Wall thickness here is below the 2.0 mm minimum spec — needs reinforcement.',
    author_name: 'Sarah Chen',
    created_at: new Date(NOW - 25 * 60_000).toISOString(),
  },
  {
    id: 'dec_2',
    part_id: 'demo_1',
    part_name: 'Turbo Housing v2',
    rationale:
      'Surface roughness on the inlet face is inconsistent with the Ra 1.6 µm spec.',
    author_name: 'Maria Garcia',
    created_at: new Date(NOW - 5 * DAYS).toISOString(),
  },
  {
    id: 'dec_3',
    part_id: 'demo_3',
    part_name: 'Gear Housing',
    rationale: 'Hole pattern offset by 0.3 mm vs. drawing — confirm intentional.',
    author_name: 'John Williams',
    created_at: new Date(NOW - 6 * 3_600_000).toISOString(),
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Replace the placeholder "You" member with the signed-in user's real info. */
export function withCurrentUser(
  members: MockMember[],
  name: string,
  email: string,
): MockMember[] {
  return members.map((m) =>
    m.is_you ? { ...m, name: name || m.name, email: email || m.email } : m,
  )
}

/**
 * Format a date as "3 days ago" / "in 5 days" / "today". Returns a stable
 * string that doesn't depend on the user's locale formatting quirks.
 */
export function formatRelative(iso: string): string {
  const target = new Date(iso).getTime()
  const diffMs = target - Date.now()
  const abs = Math.abs(diffMs)
  const days = Math.round(abs / DAYS)
  if (abs < DAYS) return 'today'
  if (diffMs < 0) return `${days} day${days === 1 ? '' : 's'} ago`
  return `in ${days} day${days === 1 ? '' : 's'}`
}

/**
 * Format an ISO date as compact relative time: "just now" / "2h ago" / "3d ago".
 * Used by the activity feed where space is tight.
 */
export function formatTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  if (diffMs < 60_000) return 'just now'
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(diffMs / 3_600_000)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(diffMs / DAYS)
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

/** Compute uppercase initials for a name. Falls back to first char. */
export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]?.charAt(0) ?? ''}${parts[parts.length - 1]?.charAt(0) ?? ''}`.toUpperCase()
  }
  return (parts[0] ?? '?').slice(0, 2).toUpperCase()
}

/** Format an ISO date as "Mar 14, 2026". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Validation rule: can we change this member's role to `to`? */
export function canChangeRoleTo(
  members: MockMember[],
  memberId: string,
  to: WorkspaceRole,
): { ok: true } | { ok: false; reason: string } {
  const target = members.find((m) => m.id === memberId)
  if (!target) return { ok: false, reason: 'Member not found' }
  if (target.role === to) return { ok: false, reason: 'Already in that role' }
  if (target.role === 'ADMIN' && to !== 'ADMIN') {
    const adminCount = members.filter((m) => m.role === 'ADMIN').length
    if (adminCount <= 1) {
      return {
        ok: false,
        reason: "Can't demote the last admin — promote someone else to ADMIN first.",
      }
    }
  }
  return { ok: true }
}

/** Validation rule: can we remove this member? */
export function canRemove(
  members: MockMember[],
  memberId: string,
): { ok: true } | { ok: false; reason: string } {
  const target = members.find((m) => m.id === memberId)
  if (!target) return { ok: false, reason: 'Member not found' }
  if (target.is_you) {
    return { ok: false, reason: "You can't remove yourself. Ask another admin to do it." }
  }
  if (target.role === 'ADMIN') {
    const adminCount = members.filter((m) => m.role === 'ADMIN').length
    if (adminCount <= 1) {
      return {
        ok: false,
        reason: "Can't remove the last admin — promote someone else to ADMIN first.",
      }
    }
  }
  return { ok: true }
}
