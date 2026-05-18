/**
 * In-memory mock data for the /admin page.
 *
 * NO BACKEND — all data lives in React state. Refresh resets everything.
 * If you later want persistence across refreshes, hydrate from localStorage
 * in the page's mount effect.
 */

export type WorkspaceRole = 'ADMIN' | 'MEMBER' | 'VIEWER'

/**
 * The engineering function this person fills inside the org. Distinct from
 * `WorkspaceRole` (admin/member/viewer) which is permissions only — `team`
 * tells the UI what colour / icon / context to use when displaying them.
 *
 * Design        — owns the geometry, creates and revises parts
 * CAE           — runs FEA/CFD/tolerance analysis, validates
 * Supplier      — external party manufacturing the part
 * Reviewer      — QA, OEM sign-off, regulatory
 * Manufacturing — internal production engineering
 */
export type EngineeringTeam =
  | 'DESIGN'
  | 'CAE'
  | 'SUPPLIER'
  | 'REVIEWER'
  | 'MANUFACTURING'

export interface TeamMeta {
  label: string
  abbr: string
  /** Tailwind text colour class (used inline). */
  text: string
  /** Tailwind background colour class for pills (50-tier). */
  bg: string
  /** Border colour for the pill (200-tier). */
  border: string
  /** Hex for SVG fill (used by PipelineStrip). */
  hex: string
}

export const TEAM_META: Record<EngineeringTeam, TeamMeta> = {
  DESIGN: {
    label: 'Design',
    abbr: 'DES',
    text: 'text-violet-700',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    hex: '#7c3aed',
  },
  CAE: {
    label: 'CAE',
    abbr: 'CAE',
    text: 'text-sky-700',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    hex: '#0284c7',
  },
  SUPPLIER: {
    label: 'Supplier',
    abbr: 'SUP',
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    hex: '#d97706',
  },
  REVIEWER: {
    label: 'Reviewer',
    abbr: 'REV',
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    hex: '#059669',
  },
  MANUFACTURING: {
    label: 'Mfg',
    abbr: 'MFG',
    text: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    hex: '#e11d48',
  },
}

/** Order used by PipelineStrip and team-filter pickers — left to right is
 *  the natural lifecycle of a part. */
export const TEAM_ORDER: EngineeringTeam[] = [
  'DESIGN',
  'CAE',
  'REVIEWER',
  'SUPPLIER',
  'MANUFACTURING',
]

export interface MockMember {
  id: string
  name: string
  email: string
  role: WorkspaceRole
  /** Their engineering function. Drives team badges across the UI. */
  team: EngineeringTeam
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
    team: 'DESIGN',
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
    team: 'CAE',
    joined_at: new Date(NOW - 32 * DAYS).toISOString(),
    last_active_at: new Date(NOW - 5 * 60_000).toISOString(),
    online: true,
  },
  {
    id: 'mem_john',
    name: 'John Williams',
    email: 'jwilliams@oem.industries',
    role: 'MEMBER',
    team: 'SUPPLIER',
    joined_at: new Date(NOW - 18 * DAYS).toISOString(),
    last_active_at: new Date(NOW - 4 * 3_600_000).toISOString(),
  },
  {
    id: 'mem_maria',
    name: 'Maria Garcia',
    email: 'maria.g@dataverse.io',
    role: 'VIEWER',
    team: 'REVIEWER',
    joined_at: new Date(NOW - 9 * DAYS).toISOString(),
    last_active_at: new Date(NOW - 2 * DAYS).toISOString(),
  },
  {
    id: 'mem_david',
    name: 'David Kim',
    email: 'david.kim@acme-supplier.com',
    role: 'ADMIN',
    team: 'MANUFACTURING',
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

// ── Notifications ────────────────────────────────────────────────────────────

export type NotificationKind =
  | 'mention'
  | 'comment'
  | 'invite'
  | 'decision_accepted'
  | 'decision_rejected'
  | 'member_joined'
  | 'part_uploaded'

export interface MockNotification {
  id: string
  kind: NotificationKind
  actor_name: string
  /** Verb phrase like "commented on" or "accepted your decision on". */
  message: string
  target_label?: string
  target_href?: string
  created_at: string
  unread: boolean
}

export const SEED_NOTIFICATIONS: MockNotification[] = [
  {
    id: 'n1',
    kind: 'comment',
    actor_name: 'Sarah Chen',
    message: 'commented on',
    target_label: 'Turbocharger Compressor Housing V3',
    target_href: '/projects/proj_turbo',
    created_at: new Date(NOW - 5 * 60_000).toISOString(),
    unread: true,
  },
  {
    id: 'n2',
    kind: 'decision_accepted',
    actor_name: 'David Kim',
    message: 'accepted your decision on',
    target_label: 'HP Turbine Blade Disk',
    target_href: '/projects/proj_gear',
    created_at: new Date(NOW - 45 * 60_000).toISOString(),
    unread: true,
  },
  {
    id: 'n3',
    kind: 'mention',
    actor_name: 'John Williams',
    message: 'mentioned you on',
    target_label: 'Heat Exchanger Core',
    target_href: '/projects/proj_intake',
    created_at: new Date(NOW - 2 * 3_600_000).toISOString(),
    unread: true,
  },
  {
    id: 'n4',
    kind: 'invite',
    actor_name: 'David Kim',
    message: 'invited',
    target_label: 'priya.s@oem.industries',
    created_at: new Date(NOW - 6 * 3_600_000).toISOString(),
    unread: false,
  },
  {
    id: 'n5',
    kind: 'part_uploaded',
    actor_name: 'Sarah Chen',
    message: 'uploaded a new part to',
    target_label: 'Wing Spar Bracket Assembly',
    target_href: '/projects/proj_bracket',
    created_at: new Date(NOW - 1 * DAYS).toISOString(),
    unread: false,
  },
  {
    id: 'n6',
    kind: 'member_joined',
    actor_name: 'Maria Garcia',
    message: 'joined the workspace',
    created_at: new Date(NOW - 2 * DAYS).toISOString(),
    unread: false,
  },
  {
    id: 'n7',
    kind: 'decision_rejected',
    actor_name: 'David Kim',
    message: 'rejected a decision on',
    target_label: 'Liquid Cooling Loop (legacy)',
    target_href: '/projects/proj_cooling',
    created_at: new Date(NOW - 4 * DAYS).toISOString(),
    unread: false,
  },
]

// ── Projects ─────────────────────────────────────────────────────────────────

export type ProjectStatus = 'ACTIVE' | 'IN_REVIEW' | 'APPROVED' | 'ARCHIVED'

/** Per-team handoff state. */
export type PipelineStage = 'DONE' | 'IN_PROGRESS' | 'PENDING' | 'BLOCKED'

export type ProjectPipeline = Record<EngineeringTeam, PipelineStage>
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
  /** Per-team handoff status — drives the PipelineStrip on project cards. */
  pipeline: ProjectPipeline
}

export const SEED_PROJECTS: MockProject[] = [
  {
    id: 'proj_turbo',
    name: 'Turbocharger Compressor Housing V3',
    description:
      'Compressor housing redesign for the 2.0L turbocharged automotive platform. Pending supplier sign-off.',
    status: 'IN_REVIEW',
    shape: 'housing',
    tone: 'cyan',
    parts_count: 12,
    open_comments: 3,
    member_names: ['You', 'Sarah Chen', 'David Kim'],
    last_activity_at: new Date(NOW - 25 * 60_000).toISOString(),
    pipeline: {
      DESIGN: 'DONE',
      CAE: 'DONE',
      REVIEWER: 'IN_PROGRESS',
      SUPPLIER: 'PENDING',
      MANUFACTURING: 'PENDING',
    },
  },
  {
    id: 'proj_bracket',
    name: 'Wing Spar Bracket Assembly',
    description:
      'Lightweight Ti-6Al-4V bracket for the wing avionics enclosure. Topology-optimised.',
    status: 'ACTIVE',
    shape: 'bracket',
    tone: 'amber',
    parts_count: 4,
    open_comments: 1,
    member_names: ['You', 'John Williams', 'Maria Garcia'],
    last_activity_at: new Date(NOW - 2 * 3_600_000).toISOString(),
    pipeline: {
      DESIGN: 'DONE',
      CAE: 'IN_PROGRESS',
      REVIEWER: 'PENDING',
      SUPPLIER: 'PENDING',
      MANUFACTURING: 'PENDING',
    },
  },
  {
    id: 'proj_gear',
    name: 'HP Turbine Blade Disk',
    description:
      'High-pressure turbine stage, single-crystal Inconel 718. Tolerance stack reviewed by metallurgy.',
    status: 'APPROVED',
    shape: 'gear',
    tone: 'emerald',
    parts_count: 8,
    open_comments: 0,
    member_names: ['Sarah Chen', 'David Kim'],
    last_activity_at: new Date(NOW - 1 * DAYS).toISOString(),
    pipeline: {
      DESIGN: 'DONE',
      CAE: 'DONE',
      REVIEWER: 'DONE',
      SUPPLIER: 'IN_PROGRESS',
      MANUFACTURING: 'PENDING',
    },
  },
  {
    id: 'proj_intake',
    name: 'Heat Exchanger Core',
    description:
      'CFD-tuned plate-fin core for the avionics cabinet cooling loop. CFD report attached to the assembly root.',
    status: 'ACTIVE',
    shape: 'manifold',
    tone: 'violet',
    parts_count: 6,
    open_comments: 2,
    member_names: ['You', 'Sarah Chen', 'John Williams', 'Maria Garcia'],
    last_activity_at: new Date(NOW - 4 * 3_600_000).toISOString(),
    pipeline: {
      DESIGN: 'DONE',
      CAE: 'IN_PROGRESS',
      REVIEWER: 'PENDING',
      SUPPLIER: 'BLOCKED',
      MANUFACTURING: 'PENDING',
    },
  },
  {
    id: 'proj_plate',
    name: 'EV Battery Cooling Plate',
    description:
      'Liquid-cooled cold plate for the EV battery pack, 3 isolator points. Thermal + vibration analysis included.',
    status: 'IN_REVIEW',
    shape: 'plate',
    tone: 'rose',
    parts_count: 2,
    open_comments: 4,
    member_names: ['Maria Garcia', 'David Kim'],
    last_activity_at: new Date(NOW - 9 * 3_600_000).toISOString(),
    pipeline: {
      DESIGN: 'DONE',
      CAE: 'DONE',
      REVIEWER: 'IN_PROGRESS',
      SUPPLIER: 'PENDING',
      MANUFACTURING: 'PENDING',
    },
  },
  {
    id: 'proj_cooling',
    name: 'Liquid Cooling Loop (legacy)',
    description:
      'Previous-gen cooling loop. Archived after switch to plate-fin heat exchanger design.',
    status: 'ARCHIVED',
    shape: 'cylinder',
    tone: 'slate',
    parts_count: 15,
    open_comments: 0,
    member_names: ['John Williams'],
    last_activity_at: new Date(NOW - 45 * DAYS).toISOString(),
    pipeline: {
      DESIGN: 'DONE',
      CAE: 'DONE',
      REVIEWER: 'DONE',
      SUPPLIER: 'DONE',
      MANUFACTURING: 'DONE',
    },
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
    target: 'compressor_housing_v2.step',
    snippet: 'Wall thickness here is below the 2.0 mm minimum spec — needs reinforcement.',
    part_id: 'demo_1',
    created_at: new Date(NOW - 25 * 60_000).toISOString(),
  },
  {
    id: 'act_2',
    kind: 'PART_UPLOADED',
    actor_name: 'John Williams',
    target: 'wing_spar_rev3.step',
    part_id: 'demo_2',
    created_at: new Date(NOW - 2 * 3_600_000).toISOString(),
  },
  {
    id: 'act_3',
    kind: 'COMMENT_ACCEPTED',
    actor_name: 'You',
    target: 'turbine_disk_hub.step',
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
    target: 'compressor_housing_v2.step',
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
    target: 'battery_cold_plate.glb',
    part_id: 'demo_4',
    created_at: new Date(NOW - 9 * DAYS).toISOString(),
  },
  {
    id: 'act_8',
    kind: 'COMMENT_REJECTED',
    actor_name: 'You',
    target: 'turbine_disk_hub.step',
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
    name: 'Compressor Housing v2',
    file_name: 'compressor_housing_v2.step',
    uploaded_by_name: 'Sarah Chen',
    comments_count: 4,
    open_comments_count: 2,
    last_activity_at: new Date(NOW - 25 * 60_000).toISOString(),
    tone: 'cyan',
  },
  {
    id: 'demo_2',
    name: 'Wing Spar Bracket rev3',
    file_name: 'wing_spar_rev3.step',
    uploaded_by_name: 'John Williams',
    comments_count: 0,
    open_comments_count: 0,
    last_activity_at: new Date(NOW - 2 * 3_600_000).toISOString(),
    tone: 'amber',
  },
  {
    id: 'demo_3',
    name: 'Turbine Disk Hub',
    file_name: 'turbine_disk_hub.step',
    uploaded_by_name: 'You',
    comments_count: 6,
    open_comments_count: 1,
    last_activity_at: new Date(NOW - 5 * 3_600_000).toISOString(),
    tone: 'emerald',
  },
  {
    id: 'demo_4',
    name: 'Battery Cold Plate',
    file_name: 'battery_cold_plate.glb',
    uploaded_by_name: 'Sarah Chen',
    comments_count: 2,
    open_comments_count: 0,
    last_activity_at: new Date(NOW - 9 * DAYS).toISOString(),
    tone: 'violet',
  },
]

// ── My Work items ────────────────────────────────────────────────────────────

export type WorkItemKind =
  | 'REVIEW_ASSIGNED'
  | 'COMMENT_REPLY'
  | 'DECISION_OWNED'
  | 'PART_ASSIGNED'
  | 'MENTION'

export type WorkItemTab = 'assigned' | 'owned' | 'following'

export type WorkItemPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'INFO' | 'RESPONDED'

export type AttachmentType = 'step' | 'stp' | 'glb' | 'gltf' | 'pdf' | 'stl' | 'iges'

export interface WorkItemAttachment {
  name: string
  type: AttachmentType
  version: string // e.g. "V3"
}

export interface MockWorkItem {
  id: string
  kind: WorkItemKind
  tab: WorkItemTab
  project_id: string
  project_name: string
  /** One-line title. */
  title: string
  /** Optional snippet (rationale, comment text). */
  snippet?: string
  /** Who created the work item — the requester from your POV. */
  requester_name: string
  requester_team: EngineeringTeam
  /** Status — done is hidden by default; UI filters on this. */
  status: 'OPEN' | 'RESPONDED' | 'DONE'
  /** Drives the left-edge colour bar on each card. */
  priority: WorkItemPriority
  created_at: string // ISO
  /** Optional due date for time-pressure. */
  due_at?: string
  /** Optional file the item is anchored to. */
  attachment?: WorkItemAttachment
  /** How many of the assigned reviewers have responded so far. */
  reviewer_progress?: { responded: number; total: number }
  /** Comment count for the chat-bubble chip. */
  comment_count?: number
}

export const SEED_WORK_ITEMS: MockWorkItem[] = [
  // ── Assigned to me ────────────────────────────────────────────────────────
  {
    id: 'w1',
    kind: 'REVIEW_ASSIGNED',
    tab: 'assigned',
    project_id: 'proj_turbo',
    project_name: 'Turbocharger Compressor Housing V3',
    title: 'CAE review of revised inlet flange',
    snippet:
      'Sarah asked you to confirm the inlet flange revision before she runs final FEA.',
    requester_name: 'Sarah Chen',
    requester_team: 'CAE',
    status: 'OPEN',
    priority: 'CRITICAL',
    created_at: new Date(NOW - 35 * 60_000).toISOString(),
    due_at: new Date(NOW + 11 * 3_600_000).toISOString(),
    attachment: { name: 'compressor_housing_v3.step', type: 'step', version: 'V3' },
    reviewer_progress: { responded: 4, total: 6 },
    comment_count: 8,
  },
  {
    id: 'w2',
    kind: 'COMMENT_REPLY',
    tab: 'assigned',
    project_id: 'proj_intake',
    project_name: 'Heat Exchanger Core',
    title: 'Re: hole pattern alignment',
    snippet:
      'John is waiting on your reply about whether the bosses can shift 0.3 mm.',
    requester_name: 'John Williams',
    requester_team: 'SUPPLIER',
    status: 'OPEN',
    priority: 'HIGH',
    created_at: new Date(NOW - 4 * 3_600_000).toISOString(),
    due_at: new Date(NOW + 22 * 3_600_000).toISOString(),
    attachment: { name: 'heat_exchanger_v2.iges', type: 'iges', version: 'V2' },
    reviewer_progress: { responded: 2, total: 5 },
    comment_count: 11,
  },
  {
    id: 'w3',
    kind: 'PART_ASSIGNED',
    tab: 'assigned',
    project_id: 'proj_bracket',
    project_name: 'Wing Spar Bracket Assembly',
    title: 'Sign off draft 2 of the wing spar bracket',
    snippet:
      'Maria is awaiting your sign-off so this can move into supplier feasibility.',
    requester_name: 'Maria Garcia',
    requester_team: 'REVIEWER',
    status: 'OPEN',
    priority: 'MEDIUM',
    created_at: new Date(NOW - 1 * DAYS).toISOString(),
    due_at: new Date(NOW + 2 * DAYS).toISOString(),
    attachment: { name: 'wing_spar_d2.glb', type: 'glb', version: 'V2' },
    reviewer_progress: { responded: 1, total: 4 },
    comment_count: 3,
  },

  // ── Owned by me ───────────────────────────────────────────────────────────
  {
    id: 'w4',
    kind: 'DECISION_OWNED',
    tab: 'owned',
    project_id: 'proj_gear',
    project_name: 'HP Turbine Blade Disk',
    title: 'Tighten tolerance on blade root attachment',
    snippet:
      'You proposed ±0.02 mm. Awaiting CAE confirmation on tolerance stack feasibility.',
    requester_name: 'You',
    requester_team: 'DESIGN',
    status: 'OPEN',
    priority: 'MEDIUM',
    created_at: new Date(NOW - 2 * 3_600_000).toISOString(),
    attachment: { name: 'turbine_blade_v1.step', type: 'step', version: 'V1' },
    reviewer_progress: { responded: 1, total: 3 },
    comment_count: 4,
  },
  {
    id: 'w5',
    kind: 'DECISION_OWNED',
    tab: 'owned',
    project_id: 'proj_turbo',
    project_name: 'Turbocharger Compressor Housing V3',
    title: 'Switch material to A356-T6 cast aluminium',
    snippet:
      'You suggested swapping from A356-T5 for better fatigue life. Waiting on supplier feedback.',
    requester_name: 'You',
    requester_team: 'DESIGN',
    status: 'RESPONDED',
    priority: 'RESPONDED',
    created_at: new Date(NOW - 1 * DAYS).toISOString(),
    attachment: { name: 'material_change.pdf', type: 'pdf', version: 'V1' },
    reviewer_progress: { responded: 5, total: 6 },
    comment_count: 14,
  },

  // ── Following ─────────────────────────────────────────────────────────────
  {
    id: 'w6',
    kind: 'MENTION',
    tab: 'following',
    project_id: 'proj_intake',
    project_name: 'Heat Exchanger Core',
    title: 'CFD report v2 attached',
    snippet:
      'Sarah uploaded a revised CFD report with updated plate-fin geometry. No action needed; FYI.',
    requester_name: 'Sarah Chen',
    requester_team: 'CAE',
    status: 'OPEN',
    priority: 'INFO',
    created_at: new Date(NOW - 6 * 3_600_000).toISOString(),
    attachment: { name: 'cfd_report_v2.pdf', type: 'pdf', version: 'V2' },
    comment_count: 2,
  },
  {
    id: 'w7',
    kind: 'MENTION',
    tab: 'following',
    project_id: 'proj_plate',
    project_name: 'EV Battery Cooling Plate',
    title: 'Vibration test results',
    snippet:
      'David shared bench-test data — all 3 isolators pass spec at the high end of operating temp.',
    requester_name: 'David Kim',
    requester_team: 'MANUFACTURING',
    status: 'OPEN',
    priority: 'INFO',
    created_at: new Date(NOW - 9 * 3_600_000).toISOString(),
    attachment: { name: 'vibration_test_v1.pdf', type: 'pdf', version: 'V1' },
    comment_count: 5,
  },
  {
    id: 'w8',
    kind: 'MENTION',
    tab: 'following',
    project_id: 'proj_gear',
    project_name: 'HP Turbine Blade Disk',
    title: 'Approved by QA',
    snippet:
      'Maria signed off — ready for supplier feasibility quotes.',
    requester_name: 'Maria Garcia',
    requester_team: 'REVIEWER',
    status: 'OPEN',
    priority: 'INFO',
    created_at: new Date(NOW - 1 * DAYS).toISOString(),
    attachment: { name: 'turbine_disk_assembly.stl', type: 'stl', version: 'V4' },
    comment_count: 1,
  },
  {
    id: 'w9',
    kind: 'MENTION',
    tab: 'following',
    project_id: 'proj_bracket',
    project_name: 'Wing Spar Bracket Assembly',
    title: 'Topology optimisation v2',
    snippet:
      'Sarah pushed an updated topology optimisation result with -22% mass and equivalent stiffness.',
    requester_name: 'Sarah Chen',
    requester_team: 'CAE',
    status: 'OPEN',
    priority: 'INFO',
    created_at: new Date(NOW - 2 * DAYS).toISOString(),
    attachment: { name: 'topology_opt_v2.step', type: 'step', version: 'V2' },
    comment_count: 0,
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
    part_name: 'Compressor Housing v2',
    rationale:
      'Wall thickness here is below the 2.0 mm minimum spec — needs reinforcement.',
    author_name: 'Sarah Chen',
    created_at: new Date(NOW - 25 * 60_000).toISOString(),
  },
  {
    id: 'dec_2',
    part_id: 'demo_1',
    part_name: 'Compressor Housing v2',
    rationale:
      'Surface roughness on the inlet face is inconsistent with the Ra 1.6 µm spec.',
    author_name: 'Maria Garcia',
    created_at: new Date(NOW - 5 * DAYS).toISOString(),
  },
  {
    id: 'dec_3',
    part_id: 'demo_3',
    part_name: 'Turbine Disk Hub',
    rationale: 'Hole pattern offset by 0.3 mm vs. drawing — confirm intentional.',
    author_name: 'John Williams',
    created_at: new Date(NOW - 6 * 3_600_000).toISOString(),
  },
]

// ── Decisions feed (workspace-wide, richer than SEED_PENDING_DECISIONS) ──────

export type FullDecisionState =
  | 'DRAFT'
  | 'PROPOSED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'SUPERSEDED'

/** Priority bucket on the Feedback issue tracker. */
export type IssuePriority = 'low' | 'medium' | 'high' | 'blocker'

/** Preset issue tags — CoLab-style colored labels on the feedback table. */
export type IssueTag =
  | 'DFM'
  | 'Manufacturing'
  | 'Machining'
  | 'Tolerancing'
  | 'Sourcing'
  | 'Materials'
  | 'Complexity: High'
  | 'Complexity: Medium'
  | 'Complexity: Low'
  | 'Blocker'
  | 'Cost Reduction'
  | 'VAVE'

export interface MockFullDecision {
  id: string
  project_id: string
  project_name: string
  part_id: string
  part_name: string
  anchor_id: string
  state: FullDecisionState
  rationale: string
  author_name: string
  author_team: EngineeringTeam
  citations: string[]
  created_at: string
  signoff_progress?: { responded: number; total: number }
  // ── Feedback / issue-tracker fields (CoLab-style) ────────────────
  /** Short headline used by the issue table — derives from rationale if absent. */
  title?: string
  /** Multi-select labels grouped on the feedback table. */
  tags?: IssueTag[]
  /** Triage priority; absence means unset (rendered as "—"). */
  priority?: IssuePriority
  /** Person responsible for resolving it (separate from the author). */
  assignee_name?: string
}

export const SEED_FULL_DECISIONS: MockFullDecision[] = [
  {
    id: 'DEC-TURBO-V3-11',
    project_id: 'proj_turbo',
    project_name: 'Turbocharger Compressor Housing V3',
    part_id: 'demo_1',
    part_name: 'Compressor Housing v2',
    anchor_id: 'face-boss-7',
    state: 'PROPOSED',
    rationale:
      'Wall thickness 1.6 mm at Z3 is below the 2.0 mm minimum spec. Acceptable only with documented FEA justification per AS9100 §6.4.3.',
    author_name: 'Sarah Chen',
    author_team: 'CAE',
    citations: ['AS9100 §6.4.3', 'DEC-TURBO-V3-08'],
    created_at: new Date(NOW - 25 * 60_000).toISOString(),
    signoff_progress: { responded: 1, total: 3 },
    title: 'Wall thickness 1.6 mm at Z3 below 2.0 mm minimum',
    tags: ['DFM', 'Complexity: High'],
    priority: 'high',
    assignee_name: 'Naga Reddy',
  },
  {
    id: 'DEC-BRACKET-09',
    project_id: 'proj_bracket',
    project_name: 'Wing Spar Bracket Assembly',
    part_id: 'demo_2',
    part_name: 'Wing Spar Bracket rev3',
    anchor_id: 'hole-bolt-3',
    state: 'PROPOSED',
    rationale:
      'Bolt hole pattern offset by 0.3 mm vs. drawing. Confirm whether intentional for tolerance stack on the mating boss; otherwise revert to nominal.',
    author_name: 'John Williams',
    author_team: 'SUPPLIER',
    citations: ['ASME Y14.5 §1.4', 'DRW-BRACKET-B'],
    created_at: new Date(NOW - 2 * 3_600_000).toISOString(),
    signoff_progress: { responded: 0, total: 4 },
    title: 'Bolt hole pattern offset by 0.3 mm',
    tags: ['Tolerancing', 'Blocker'],
    priority: 'blocker',
    assignee_name: 'David Kim',
  },
  {
    id: 'DEC-TURBO-V3-08',
    project_id: 'proj_turbo',
    project_name: 'Turbocharger Compressor Housing V3',
    part_id: 'demo_1',
    part_name: 'Compressor Housing v2',
    anchor_id: 'face-flange-1',
    state: 'ACCEPTED',
    rationale:
      'Surface roughness on the inlet flange tightened from Ra 3.2 µm → Ra 1.6 µm to meet sealing requirements per the gasket vendor datasheet.',
    author_name: 'Maria Garcia',
    author_team: 'REVIEWER',
    citations: ['ISO 1101', 'GASKET-DS-9911'],
    created_at: new Date(NOW - 1 * DAYS).toISOString(),
    signoff_progress: { responded: 3, total: 3 },
    title: 'Inlet flange surface tightened to Ra 1.6 µm',
    tags: ['Manufacturing', 'Materials'],
    priority: 'medium',
  },
  {
    id: 'DEC-BRACKET-07',
    project_id: 'proj_bracket',
    project_name: 'Wing Spar Bracket Assembly',
    part_id: 'demo_2',
    part_name: 'Wing Spar Bracket rev3',
    anchor_id: 'edge-fillet-2',
    state: 'ACCEPTED',
    rationale:
      'Fillet radius increased from R1.5 to R2.5 on the load-bearing edge to mitigate fatigue stress concentration identified in the CAE report.',
    author_name: 'Sarah Chen',
    author_team: 'CAE',
    citations: ['CAE-RUN-2026-04-11', 'MIL-STD-1916'],
    created_at: new Date(NOW - 2 * DAYS).toISOString(),
    signoff_progress: { responded: 4, total: 4 },
    title: 'Fillet radius R1.5 → R2.5 on load edge',
    tags: ['Materials', 'Complexity: Medium'],
    priority: 'medium',
  },
  {
    id: 'DEC-GEAR-12',
    project_id: 'proj_gear',
    project_name: 'HP Turbine Blade Disk',
    part_id: 'demo_3',
    part_name: 'Turbine Disk Hub',
    anchor_id: 'face-spline-1',
    state: 'ACCEPTED',
    rationale:
      'Spline tolerance class upgraded from 7e to 6f per the gearbox interface ICD. CMM data attached.',
    author_name: 'Sarah Chen',
    author_team: 'CAE',
    citations: ['ICD-GEARBOX-V3', 'CMM-2026-05-04'],
    created_at: new Date(NOW - 3 * DAYS).toISOString(),
    signoff_progress: { responded: 3, total: 3 },
    title: 'Spline tolerance class 7e → 6f',
    tags: ['Tolerancing', 'Machining'],
    priority: 'medium',
  },
  {
    id: 'DEC-BRACKET-05',
    project_id: 'proj_bracket',
    project_name: 'Wing Spar Bracket Assembly',
    part_id: 'demo_2',
    part_name: 'Wing Spar Bracket rev3',
    anchor_id: 'face-rib-4',
    state: 'REJECTED',
    rationale:
      'Proposed rib relocation to reduce mass by 7% was rejected — the new position interferes with the harness routing defined in the wiring drawing.',
    author_name: 'John Williams',
    author_team: 'SUPPLIER',
    citations: ['HARNESS-DRW-2208'],
    created_at: new Date(NOW - 5 * DAYS).toISOString(),
    title: 'Rib relocation rejected (harness clash)',
    tags: ['DFM'],
    priority: 'low',
  },
  {
    id: 'DEC-PLATE-04',
    project_id: 'proj_plate',
    project_name: 'EV Battery Cooling Plate',
    part_id: 'demo_4',
    part_name: 'Battery Cold Plate',
    anchor_id: 'edge-perimeter',
    state: 'PROPOSED',
    rationale:
      'Plate edges deburred to 0.2 mm × 45° chamfer to meet operator-safety requirement for downstream assembly.',
    author_name: 'Maria Garcia',
    author_team: 'REVIEWER',
    citations: ['OSHA-1910.23'],
    created_at: new Date(NOW - 9 * 3_600_000).toISOString(),
    signoff_progress: { responded: 1, total: 2 },
    title: 'Deburr plate edges 0.2 × 45° (operator safety)',
    tags: ['Manufacturing'],
    priority: 'low',
    assignee_name: 'David Kim',
  },
  {
    id: 'DEC-PLATE-02',
    project_id: 'proj_plate',
    project_name: 'EV Battery Cooling Plate',
    part_id: 'demo_4',
    part_name: 'Battery Cold Plate',
    anchor_id: 'hole-pattern-A',
    state: 'PROPOSED',
    rationale:
      'Centre-to-centre tolerance loosened from ±0.05 mm to ±0.10 mm — confirmed acceptable by stress review and brings the part into the standard machining tolerance band.',
    author_name: 'You',
    author_team: 'DESIGN',
    citations: ['ASME Y14.5 §1.4', 'CAE-RUN-2026-05-08'],
    created_at: new Date(NOW - 4 * 3_600_000).toISOString(),
    signoff_progress: { responded: 1, total: 3 },
    title: 'Centre-to-centre tolerance ±0.05 → ±0.10 mm',
    tags: ['Tolerancing', 'Sourcing', 'Cost Reduction'],
    priority: 'medium',
    assignee_name: 'Maria Garcia',
  },
  {
    id: 'DEC-INTAKE-01',
    project_id: 'proj_intake',
    project_name: 'Heat Exchanger Core',
    part_id: 'demo_intake_1',
    part_name: 'Heat Exchanger Core v1',
    anchor_id: 'face-fin-A',
    state: 'PROPOSED',
    rationale:
      'CFD analysis suggests fin spacing reduction from 4.0 mm to 3.2 mm yields a 12% thermal-transfer improvement at the operating Reynolds number.',
    author_name: 'Sarah Chen',
    author_team: 'CAE',
    citations: ['CFD-RUN-2026-05-10', 'ASHRAE-HX-V3'],
    created_at: new Date(NOW - 6 * 3_600_000).toISOString(),
    signoff_progress: { responded: 0, total: 3 },
    title: 'Fin spacing 4.0 → 3.2 mm for +12 % thermal transfer',
    tags: ['Complexity: High', 'Manufacturing'],
    priority: 'high',
    assignee_name: 'Sarah Chen',
  },
  {
    id: 'DEC-TURBO-V3-04',
    project_id: 'proj_turbo',
    project_name: 'Turbocharger Compressor Housing V3',
    part_id: 'demo_1',
    part_name: 'Compressor Housing v2',
    anchor_id: 'face-boss-7',
    state: 'SUPERSEDED',
    rationale:
      'Initial proposal to chamfer the boss edge — superseded by DEC-TURBO-V3-08 which addresses both the chamfer and the surface finish in a single change.',
    author_name: 'Maria Garcia',
    author_team: 'REVIEWER',
    citations: [],
    created_at: new Date(NOW - 9 * DAYS).toISOString(),
    title: 'Boss chamfer (superseded by DEC-TURBO-V3-08)',
    tags: ['Manufacturing'],
    priority: 'low',
  },
  {
    id: 'DEC-GEAR-08',
    project_id: 'proj_gear',
    project_name: 'HP Turbine Blade Disk',
    part_id: 'demo_3',
    part_name: 'Turbine Disk Hub',
    anchor_id: 'face-keyway-1',
    state: 'ACCEPTED',
    rationale:
      'Keyway dimensions confirmed to DIN 6885 (8×7×40) per the motor-side coupling spec.',
    author_name: 'Maria Garcia',
    author_team: 'REVIEWER',
    citations: ['DIN 6885', 'COUPLING-MOTOR-SIDE-V2'],
    created_at: new Date(NOW - 8 * DAYS).toISOString(),
    signoff_progress: { responded: 3, total: 3 },
    title: 'Keyway dimensions confirmed to DIN 6885',
    tags: ['Machining', 'Tolerancing'],
    priority: 'medium',
  },
  {
    id: 'DEC-COOLING-01',
    project_id: 'proj_cooling',
    project_name: 'Liquid Cooling Loop (legacy)',
    part_id: 'demo_cooling_1',
    part_name: 'Cooling Loop Manifold',
    anchor_id: 'face-port-A',
    state: 'ACCEPTED',
    rationale:
      'Port diameter standardized to G1/2" BSPP across both manifold variants to share inventory with the new plate-fin design.',
    author_name: 'David Kim',
    author_team: 'MANUFACTURING',
    citations: ['ISO 228-1'],
    created_at: new Date(NOW - 35 * DAYS).toISOString(),
    signoff_progress: { responded: 2, total: 2 },
    title: 'Port diameter standardised to G1/2" BSPP',
    tags: ['Sourcing', 'Manufacturing', 'VAVE'],
    priority: 'low',
  },
]

// ── Cross-rev resolver mock (used by /parts/[id]/what-changed) ───────────────

export interface MockResolverBucket {
  id: string
  decision_id: string
  title: string
  anchor_id?: string
  confidence: number // 0..1
}

export interface MockResolverResult {
  part_id: string
  from_rev: string
  to_rev: string
  /** Mean confidence across every decision the resolver placed. */
  average_confidence: number
  /** "3-layer resolver complete" badge text. */
  layers_run: number
  auto_carried: MockResolverBucket[]
  requires_confirmation: MockResolverBucket[]
  resolved: MockResolverBucket[]
  regressed: MockResolverBucket[]
  orphaned: MockResolverBucket[]
}

export const SEED_RESOLVER_RESULT: MockResolverResult = {
  part_id: 'demo_2',
  from_rev: 'Rev A',
  to_rev: 'Rev B',
  average_confidence: 0.87,
  layers_run: 3,
  auto_carried: [
    { id: 'r-1', decision_id: 'DEC-BRACKET-01', title: 'Initial bolt hole pattern', confidence: 1.0 },
    { id: 'r-2', decision_id: 'DEC-BRACKET-02', title: 'Material grade Ti-6Al-4V', confidence: 1.0 },
    { id: 'r-3', decision_id: 'DEC-BRACKET-03', title: 'Mounting boss diameter', confidence: 1.0 },
    { id: 'r-4', decision_id: 'DEC-BRACKET-06', title: 'Heat treatment 482 °C / 8 h', confidence: 0.99 },
    { id: 'r-5', decision_id: 'DEC-BRACKET-07', title: 'Fillet radius R2.5 on load edge', confidence: 0.99 },
    { id: 'r-6', decision_id: 'DEC-BRACKET-08', title: 'Surface finish Ra 1.6 µm on flange', confidence: 0.98 },
    { id: 'r-7', decision_id: 'DEC-BRACKET-10', title: 'Coating thickness 25–35 µm', confidence: 0.98 },
    { id: 'r-8', decision_id: 'DEC-BRACKET-12', title: 'Edge break 0.2 mm × 45°', confidence: 0.97 },
    { id: 'r-9', decision_id: 'DEC-BRACKET-13', title: 'Bolt torque spec 8 N·m', confidence: 0.97 },
    { id: 'r-10', decision_id: 'DEC-BRACKET-16', title: 'Inspection NDT class B', confidence: 0.96 },
    { id: 'r-11', decision_id: 'DEC-BRACKET-18', title: 'Marking method laser-etch', confidence: 0.96 },
    { id: 'r-12', decision_id: 'DEC-BRACKET-19', title: 'Packaging spec ESD-safe foam', confidence: 0.95 },
  ],
  requires_confirmation: [
    {
      id: 'r-9',
      decision_id: 'DEC-BRACKET-04',
      title: 'Boss chamfer 1.0 × 45°',
      anchor_id: 'face-boss-7',
      confidence: 0.71,
    },
    {
      id: 'r-10',
      decision_id: 'DEC-BRACKET-09',
      title: 'Bolt hole offset 0.3 mm',
      anchor_id: 'hole-bolt-3',
      confidence: 0.66,
    },
    {
      id: 'r-11',
      decision_id: 'DEC-BRACKET-11',
      title: 'Wall thickness 1.6 mm at Z3',
      anchor_id: 'face-boss-7',
      confidence: 0.61,
    },
  ],
  resolved: [
    { id: 'r-12', decision_id: 'DEC-BRACKET-13', title: 'Pocket draft angle (added in Rev B)', confidence: 1 },
    { id: 'r-13', decision_id: 'DEC-BRACKET-14', title: 'Rib reinforcement (added in Rev B)', confidence: 1 },
    { id: 'r-14', decision_id: 'DEC-BRACKET-15', title: 'Lightening hole pattern (added in Rev B)', confidence: 1 },
  ],
  regressed: [
    {
      id: 'r-15',
      decision_id: 'DEC-BRACKET-05',
      title: 'Rib relocation rejected',
      anchor_id: 'face-rib-4',
      confidence: 0.42,
    },
  ],
  orphaned: [],
}

// ── 2D drawing PMI callouts (used by /parts/[id]/drawing) ────────────────────

export type PMISymbol = 'diameter' | 'flatness' | 'concentricity' | 'position' | 'parallelism' | 'perpendicularity' | 'surface'

export interface MockPMICallout {
  id: string
  /** Glyph + value as engineers read it, e.g. "⌀10 ±0.05". */
  label: string
  symbol: PMISymbol
  /** Position on the drawing canvas in % (0..100). */
  xPct: number
  yPct: number
  /** Datum it references, e.g. "A" or "A-B". Optional. */
  datum?: string
  /** Linked decision id (deep-link target). Optional. */
  linked_decision_id?: string
  /** One-line plain-English explanation shown in the sidebar tooltip. */
  note: string
}

export const SEED_PMI_CALLOUTS: MockPMICallout[] = [
  {
    id: 'pmi-1',
    label: '⌀10 ±0.05',
    symbol: 'diameter',
    xPct: 26,
    yPct: 33,
    note: 'Bolt hole diameter · class 7 fit · 4 places',
    linked_decision_id: 'DEC-BRACKET-09',
  },
  {
    id: 'pmi-2',
    label: '⊥ 0.05 | A',
    symbol: 'perpendicularity',
    xPct: 60,
    yPct: 24,
    datum: 'A',
    note: 'Perpendicularity of mounting boss to datum A · 0.05 mm',
  },
  {
    id: 'pmi-3',
    label: '◎ 0.02 | A-B',
    symbol: 'concentricity',
    xPct: 44,
    yPct: 50,
    datum: 'A-B',
    note: 'Concentricity of inlet flange to datums A-B · 0.02 mm',
    linked_decision_id: 'DEC-TURBO-V3-08',
  },
  {
    id: 'pmi-4',
    label: '▱ 0.02',
    symbol: 'flatness',
    xPct: 30,
    yPct: 72,
    note: 'Flatness of seating surface · 0.02 mm over 50 × 80 mm',
  },
  {
    id: 'pmi-5',
    label: 'Ra 1.6 µm',
    symbol: 'surface',
    xPct: 76,
    yPct: 55,
    note: 'Surface finish on the inlet flange · sealing requirement',
    linked_decision_id: 'DEC-TURBO-V3-08',
  },
  {
    id: 'pmi-6',
    label: '∥ 0.10 | A',
    symbol: 'parallelism',
    xPct: 70,
    yPct: 78,
    datum: 'A',
    note: 'Parallelism of opposing bolt face to datum A · 0.10 mm',
  },
]

// ── BOM (Bill of Materials) mock (used by /parts/[id]/bom) ───────────────────

export interface MockBomNode {
  id: string
  /** Part number / catalog id. */
  part_number: string
  name: string
  quantity: number
  /** Optional supplier reference, e.g. "McMaster 91290A150". */
  supplier_ref?: string
  /** Material flavour shown as a chip. */
  material?: string
  /** Decisions logged against this row. */
  decisions_count: number
  /** Optional deep-link to a real part viewer. */
  part_id?: string
  children?: MockBomNode[]
}

export const SEED_BOM: MockBomNode = {
  id: 'bom-root',
  part_number: 'BR-AERO-014',
  name: 'Wing Spar Bracket Assembly',
  quantity: 1,
  material: 'mixed',
  decisions_count: 12,
  part_id: 'demo_2',
  children: [
    {
      id: 'bom-mount-sub',
      part_number: 'MNT-SUB-022',
      name: 'Mount Subassembly',
      quantity: 1,
      decisions_count: 4,
      children: [
        {
          id: 'bom-plate',
          part_number: 'Plate-MNT-301',
          name: 'Mount Plate',
          quantity: 1,
          material: 'Ti-6Al-4V',
          decisions_count: 3,
          part_id: 'demo_4',
        },
        {
          id: 'bom-washer',
          part_number: 'Washer-R-10',
          name: 'Rubber Washer',
          quantity: 2,
          material: 'EPDM 70',
          decisions_count: 1,
        },
      ],
    },
    {
      id: 'bom-bolt',
      part_number: 'Bolt-M6-30',
      name: 'M6 × 30 Hex Bolt',
      quantity: 4,
      supplier_ref: 'McMaster 91290A150',
      material: 'A2-70 stainless',
      decisions_count: 1,
    },
    {
      id: 'bom-spacer',
      part_number: 'Spacer-AL-12',
      name: 'Aluminium Spacer',
      quantity: 2,
      material: 'AL 6061-T6',
      decisions_count: 0,
    },
    {
      id: 'bom-nut',
      part_number: 'Nut-LCK-M6',
      name: 'M6 Locking Nut',
      quantity: 4,
      supplier_ref: 'McMaster 90631A005',
      material: 'A2-70 stainless',
      decisions_count: 0,
    },
    {
      id: 'bom-fastener-sub',
      part_number: 'FAST-SUB-007',
      name: 'Fastener Kit',
      quantity: 1,
      decisions_count: 0,
      children: [
        {
          id: 'bom-washer-flat',
          part_number: 'Washer-F-6',
          name: 'M6 Flat Washer',
          quantity: 4,
          material: 'A2-70 stainless',
          decisions_count: 0,
        },
        {
          id: 'bom-washer-spring',
          part_number: 'Washer-S-6',
          name: 'M6 Spring Washer',
          quantity: 4,
          material: 'A2-70 stainless',
          decisions_count: 0,
        },
      ],
    },
  ],
}

// ── Knowledge Graph mocks (used by /knowledge-graph) ────────────────────────

export type KGNodeKind = 'standard' | 'decision' | 'part'
export type KGDecisionState = 'PROPOSED' | 'ACCEPTED' | 'REJECTED' | 'SUPERSEDED'

export interface KGNode {
  id: string
  label: string
  kind: KGNodeKind
  /** Layout x/y inside the 1000x600 viewBox. Hand-placed for premium feel. */
  x: number
  y: number
  /** Optional metadata shown in the side drawer. */
  meta?: string
  state?: KGDecisionState
  part_id?: string
}

export type KGEdgeKind = 'cites' | 'supersedes' | 'applies-to'

export interface KGEdge {
  id: string
  from: string
  to: string
  kind: KGEdgeKind
}

/**
 * Three vertical bands:
 *   x ~ 130  → Standards (cited references)
 *   x ~ 500  → Decisions (the active objects)
 *   x ~ 870  → Parts (geometry the decisions apply to)
 */
export const SEED_KG_NODES: KGNode[] = [
  // ── Standards (violet) ─────────────────────────────────────────────────
  { id: 'std-as9100', label: 'AS9100 §6.4.3', kind: 'standard', x: 130, y: 90, meta: 'Quality mgmt — aerospace' },
  { id: 'std-iso1101', label: 'ISO 1101', kind: 'standard', x: 130, y: 190, meta: 'Geometrical tolerances' },
  { id: 'std-asme', label: 'ASME Y14.5 §1.4', kind: 'standard', x: 130, y: 290, meta: 'Dimensioning & tolerancing' },
  { id: 'std-mil', label: 'MIL-STD-1916', kind: 'standard', x: 130, y: 390, meta: 'Sampling procedures' },
  { id: 'std-din', label: 'DIN 6885', kind: 'standard', x: 130, y: 490, meta: 'Keyway dimensions' },

  // ── Decisions (amber/emerald/rose by state) ───────────────────────────
  { id: 'dec-turbo-04', label: 'DEC-TURBO-V3-04', kind: 'decision', state: 'SUPERSEDED', part_id: 'demo_1', x: 500, y: 70, meta: 'Boss chamfer (superseded)' },
  { id: 'dec-turbo-08', label: 'DEC-TURBO-V3-08', kind: 'decision', state: 'ACCEPTED', part_id: 'demo_1', x: 500, y: 170, meta: 'Inlet flange Ra 1.6 µm' },
  { id: 'dec-turbo-11', label: 'DEC-TURBO-V3-11', kind: 'decision', state: 'PROPOSED', part_id: 'demo_1', x: 500, y: 270, meta: 'Wall thickness 1.6 mm at Z3' },
  { id: 'dec-bracket-07', label: 'DEC-BRACKET-07', kind: 'decision', state: 'ACCEPTED', part_id: 'demo_2', x: 500, y: 370, meta: 'Fillet radius R2.5 on load edge' },
  { id: 'dec-bracket-09', label: 'DEC-BRACKET-09', kind: 'decision', state: 'PROPOSED', part_id: 'demo_2', x: 500, y: 470, meta: 'Bolt hole offset 0.3 mm' },
  { id: 'dec-gear-12', label: 'DEC-GEAR-12', kind: 'decision', state: 'ACCEPTED', part_id: 'demo_3', x: 500, y: 540, meta: 'Spline tolerance 6f' },

  // ── Parts (primary teal) ───────────────────────────────────────────────
  { id: 'part-compressor', label: 'Compressor Housing v2', kind: 'part', part_id: 'demo_1', x: 870, y: 160, meta: 'demo_1 · Rev B · 3 decisions' },
  { id: 'part-bracket', label: 'Wing Spar Bracket', kind: 'part', part_id: 'demo_2', x: 870, y: 380, meta: 'demo_2 · Rev B · 12 decisions' },
  { id: 'part-turbine', label: 'Turbine Disk Hub', kind: 'part', part_id: 'demo_3', x: 870, y: 540, meta: 'demo_3 · Rev C · 5 decisions' },
]

export const SEED_KG_EDGES: KGEdge[] = [
  // Standards cited by decisions
  { id: 'e1', from: 'dec-turbo-11', to: 'std-as9100', kind: 'cites' },
  { id: 'e2', from: 'dec-turbo-08', to: 'std-iso1101', kind: 'cites' },
  { id: 'e3', from: 'dec-bracket-07', to: 'std-mil', kind: 'cites' },
  { id: 'e4', from: 'dec-bracket-09', to: 'std-asme', kind: 'cites' },
  { id: 'e5', from: 'dec-gear-12', to: 'std-iso1101', kind: 'cites' },
  { id: 'e6', from: 'dec-gear-12', to: 'std-din', kind: 'cites' },
  { id: 'e7', from: 'dec-turbo-11', to: 'std-asme', kind: 'cites' },

  // Supersession (rare but important)
  { id: 'e10', from: 'dec-turbo-08', to: 'dec-turbo-04', kind: 'supersedes' },

  // Decisions → parts
  { id: 'e20', from: 'dec-turbo-04', to: 'part-compressor', kind: 'applies-to' },
  { id: 'e21', from: 'dec-turbo-08', to: 'part-compressor', kind: 'applies-to' },
  { id: 'e22', from: 'dec-turbo-11', to: 'part-compressor', kind: 'applies-to' },
  { id: 'e23', from: 'dec-bracket-07', to: 'part-bracket', kind: 'applies-to' },
  { id: 'e24', from: 'dec-bracket-09', to: 'part-bracket', kind: 'applies-to' },
  { id: 'e25', from: 'dec-gear-12', to: 'part-turbine', kind: 'applies-to' },
]

// ── Hash chain mocks (used by /audit/chain/[workspaceId] + /audit/export) ────

export type HashChainEventKind =
  | 'WORKSPACE_GENESIS'
  | 'MEMBER_JOINED'
  | 'INVITE_CREATED'
  | 'PART_UPLOADED'
  | 'REV_UPLOADED'
  | 'DECISION_PROPOSED'
  | 'DECISION_ACCEPTED'
  | 'DECISION_REJECTED'
  | 'DECISION_SUPERSEDED'
  | 'RESOLVER_COMPLETED'
  | 'BUNDLE_SIGNED'
  | 'PLM_PUSHED'

export interface HashChainEvent {
  seq: number
  kind: HashChainEventKind
  actor: string
  /** 64-char hex string — SHA-256-shaped. */
  prev_hash: string
  curr_hash: string
  created_at: string
  payload: Record<string, unknown>
}

/**
 * Deterministic 64-hex "hash" from an arbitrary seed. NOT cryptographically
 * sound — just shaped like SHA-256 so the UI demo looks real.
 */
function fakeHash(seed: string): string {
  let h1 = 5381
  let h2 = 5381
  let h3 = 5381
  let h4 = 5381
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i)
    h1 = ((h1 << 5) + h1 + c) >>> 0
    h2 = ((h2 << 7) + h2 + seed.charCodeAt((i * 2) % seed.length)) >>> 0
    h3 = ((h3 << 3) + h3 + seed.charCodeAt((i * 3) % seed.length)) >>> 0
    h4 = ((h4 << 11) + h4 + seed.charCodeAt((i * 5) % seed.length)) >>> 0
  }
  const blocks = [
    h1,
    h2,
    h3,
    h4,
    (h1 ^ h2) >>> 0,
    (h3 ^ h4) >>> 0,
    (h1 + h3) >>> 0,
    (h2 + h4) >>> 0,
  ]
  return blocks.map((n) => (n >>> 0).toString(16).padStart(8, '0')).join('')
}

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000'
const GENESIS_AT = new Date(NOW - 60 * DAYS).toISOString()

/** Build the 25-event chain at module load. Each event chains to the previous. */
function buildHashChain(): HashChainEvent[] {
  const raw: Array<Omit<HashChainEvent, 'prev_hash' | 'curr_hash' | 'seq'>> = [
    { kind: 'WORKSPACE_GENESIS', actor: 'system', created_at: GENESIS_AT, payload: { workspace: 'f-bracket' } },
    { kind: 'MEMBER_JOINED', actor: 'Ratnapriya Chamala', created_at: new Date(NOW - 58 * DAYS).toISOString(), payload: { role: 'ADMIN' } },
    { kind: 'MEMBER_JOINED', actor: 'David Kim', created_at: new Date(NOW - 57 * DAYS).toISOString(), payload: { role: 'ADMIN' } },
    { kind: 'INVITE_CREATED', actor: 'Ratnapriya Chamala', created_at: new Date(NOW - 56 * DAYS).toISOString(), payload: { email: 'sarah.chen@oem-aero.com', role: 'MEMBER' } },
    { kind: 'MEMBER_JOINED', actor: 'Sarah Chen', created_at: new Date(NOW - 55 * DAYS).toISOString(), payload: { role: 'MEMBER', team: 'CAE' } },
    { kind: 'PART_UPLOADED', actor: 'Sarah Chen', created_at: new Date(NOW - 30 * DAYS).toISOString(), payload: { part_id: 'demo_1', name: 'Compressor Housing v2', rev: 'Rev A', size_bytes: 4_192_000 } },
    { kind: 'DECISION_PROPOSED', actor: 'Sarah Chen', created_at: new Date(NOW - 28 * DAYS).toISOString(), payload: { decision_id: 'DEC-TURBO-V3-04', anchor_id: 'face-boss-7' } },
    { kind: 'DECISION_ACCEPTED', actor: 'David Kim', created_at: new Date(NOW - 27 * DAYS).toISOString(), payload: { decision_id: 'DEC-TURBO-V3-04', signed_by: ['David Kim'] } },
    { kind: 'PART_UPLOADED', actor: 'John Williams', created_at: new Date(NOW - 25 * DAYS).toISOString(), payload: { part_id: 'demo_2', name: 'Wing Spar Bracket', rev: 'Rev A' } },
    { kind: 'DECISION_PROPOSED', actor: 'Sarah Chen', created_at: new Date(NOW - 22 * DAYS).toISOString(), payload: { decision_id: 'DEC-BRACKET-05', anchor_id: 'face-rib-4' } },
    { kind: 'DECISION_REJECTED', actor: 'David Kim', created_at: new Date(NOW - 21 * DAYS).toISOString(), payload: { decision_id: 'DEC-BRACKET-05', reason: 'harness routing interference' } },
    { kind: 'DECISION_PROPOSED', actor: 'Maria Garcia', created_at: new Date(NOW - 18 * DAYS).toISOString(), payload: { decision_id: 'DEC-TURBO-V3-08', anchor_id: 'face-flange-1' } },
    { kind: 'DECISION_SUPERSEDED', actor: 'Maria Garcia', created_at: new Date(NOW - 17 * DAYS).toISOString(), payload: { decision_id: 'DEC-TURBO-V3-04', superseded_by: 'DEC-TURBO-V3-08' } },
    { kind: 'DECISION_ACCEPTED', actor: 'David Kim', created_at: new Date(NOW - 16 * DAYS).toISOString(), payload: { decision_id: 'DEC-TURBO-V3-08', signed_by: ['Sarah Chen', 'David Kim'] } },
    { kind: 'REV_UPLOADED', actor: 'Sarah Chen', created_at: new Date(NOW - 12 * DAYS).toISOString(), payload: { part_id: 'demo_2', from_rev: 'Rev A', to_rev: 'Rev B' } },
    { kind: 'RESOLVER_COMPLETED', actor: 'system', created_at: new Date(NOW - 12 * DAYS + 60_000).toISOString(), payload: { part_id: 'demo_2', auto_carried: 12, requires_confirmation: 3, regressed: 1 } },
    { kind: 'DECISION_PROPOSED', actor: 'John Williams', created_at: new Date(NOW - 10 * DAYS).toISOString(), payload: { decision_id: 'DEC-BRACKET-09', anchor_id: 'hole-bolt-3' } },
    { kind: 'DECISION_PROPOSED', actor: 'Sarah Chen', created_at: new Date(NOW - 8 * DAYS).toISOString(), payload: { decision_id: 'DEC-BRACKET-07', anchor_id: 'edge-fillet-2' } },
    { kind: 'DECISION_ACCEPTED', actor: 'David Kim', created_at: new Date(NOW - 7 * DAYS).toISOString(), payload: { decision_id: 'DEC-BRACKET-07' } },
    { kind: 'DECISION_PROPOSED', actor: 'Maria Garcia', created_at: new Date(NOW - 5 * DAYS).toISOString(), payload: { decision_id: 'DEC-PLATE-04' } },
    { kind: 'DECISION_PROPOSED', actor: 'Ratnapriya Chamala', created_at: new Date(NOW - 4 * 3_600_000).toISOString(), payload: { decision_id: 'DEC-PLATE-02' } },
    { kind: 'DECISION_PROPOSED', actor: 'Sarah Chen', created_at: new Date(NOW - 30 * 60_000).toISOString(), payload: { decision_id: 'DEC-TURBO-V3-11', anchor_id: 'face-boss-7' } },
    { kind: 'DECISION_PROPOSED', actor: 'John Williams', created_at: new Date(NOW - 2 * 3_600_000).toISOString(), payload: { decision_id: 'DEC-BRACKET-09' } },
    { kind: 'BUNDLE_SIGNED', actor: 'system', created_at: new Date(NOW - 1 * 3_600_000).toISOString(), payload: { bundle: 'dvex-fbracket-2026-05-18.json', algo: 'Ed25519', fingerprint: '7f3a:b2e1:c8d5:9e2d' } },
    { kind: 'PLM_PUSHED', actor: 'Ratnapriya Chamala', created_at: new Date(NOW - 30 * 60_000).toISOString(), payload: { ecn: 'ECN-2026-0412', target: 'Windchill 12.1' } },
  ]

  let prev = GENESIS_HASH
  return raw.map((ev, idx) => {
    const seq = idx + 1
    const seed = `${prev}|${seq}|${ev.kind}|${ev.actor}|${JSON.stringify(ev.payload)}|${ev.created_at}`
    const curr = fakeHash(seed)
    const built: HashChainEvent = {
      seq,
      kind: ev.kind,
      actor: ev.actor,
      created_at: ev.created_at,
      payload: ev.payload,
      prev_hash: prev,
      curr_hash: curr,
    }
    prev = curr
    return built
  })
}

export const SEED_HASH_CHAIN: HashChainEvent[] = buildHashChain()

// DVEX bundle metadata (used by /audit/export + the verified-bundle banner).
export interface MockDvexBundle {
  schema: 'dvex/v1.0'
  workspace_slug: string
  workspace_name: string
  events_count: number
  exported_at: string
  /** First event's curr_hash so external verifiers can chain from genesis. */
  genesis_hash: string
  /** Most recent event's curr_hash — chain tip. */
  tip_hash: string
  signature: {
    algo: 'Ed25519'
    fingerprint: string
    pubkey_pem_filename: string
  }
  filename: string
  size_bytes: number
}

export const SEED_DVEX_BUNDLE: MockDvexBundle = {
  schema: 'dvex/v1.0',
  workspace_slug: 'f-bracket',
  workspace_name: 'F-Bracket Program',
  events_count: SEED_HASH_CHAIN.length,
  exported_at: new Date(NOW - 1 * 3_600_000).toISOString(),
  genesis_hash: SEED_HASH_CHAIN[0]?.curr_hash ?? '',
  tip_hash: SEED_HASH_CHAIN[SEED_HASH_CHAIN.length - 1]?.curr_hash ?? '',
  signature: {
    algo: 'Ed25519',
    fingerprint: '7f3a:b2e1:c8d5:9e2d:0a4f:6b81:c2d3:e4f5',
    pubkey_pem_filename: 'dvex-fbracket-pubkey.pem',
  },
  filename: 'dvex-fbracket-2026-05-18.json',
  size_bytes: 847_360,
}

// ── PLM connection + ECN mocks (used by /parts/[id]/plm-push) ────────────────

export type PlmConnectionStatus = 'connected' | 'syncing' | 'error' | 'disconnected'

export interface MockPlmConnection {
  vendor: 'Windchill' | 'Teamcenter' | 'Aras'
  version: string
  host: string
  status: PlmConnectionStatus
  /** ISO timestamps — null means never. */
  last_pulled_at: string | null
  last_pushed_at: string | null
}

export const SEED_PLM_CONNECTION: MockPlmConnection = {
  vendor: 'Windchill',
  version: '12.1',
  host: 'acme-corp.windchill.com',
  status: 'connected',
  last_pulled_at: new Date(NOW - 2 * 3_600_000).toISOString(),
  last_pushed_at: null,
}

export interface MockEcnAttachment {
  name: string
  size_bytes: number
  signed?: boolean
}

export interface MockEcnTemplate {
  /** Draft ID — PLM assigns a real ID after submission. */
  draft_id: string
  title: string
  classification: 'Class I' | 'Class II' | 'Class III'
  affected_part: string
  attachments: MockEcnAttachment[]
}

export const SEED_ECN_TEMPLATE: MockEcnTemplate = {
  draft_id: 'ECN-2026-DRAFT-0418',
  title: 'Wing Spar Bracket Assembly · Rev B Engineering Changes',
  classification: 'Class II',
  affected_part: 'Wing Spar Bracket Assembly · Rev B',
  attachments: [
    { name: 'ecn-2026-0418.pdf', size_bytes: 1_258_291 },
    { name: 'audit-bundle.dvex.json', size_bytes: 847_360, signed: true },
  ],
}

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
