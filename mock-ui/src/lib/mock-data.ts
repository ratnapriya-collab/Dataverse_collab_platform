/**
 * mock-data.ts — single source of truth for the DataVerse Collab demo.
 *
 * Everything in the mock UI reads from here. No fetch, no API, no localStorage.
 * Content is intentionally realistic engineering language — avoid lorem ipsum.
 */

// ─── Types ────────────────────────────────────────────────────────────────

export type Role = 'ADMIN' | 'MEMBER' | 'VIEWER'

export type DecisionState = 'PROPOSED' | 'ACCEPTED' | 'REJECTED' | 'SUPERSEDED'

export interface MockUser {
  id: string
  name: string
  email: string
  role: Role
  initials: string
  workspace: { id: string; name: string; slug: string }
}

export interface Member {
  id: string
  name: string
  email: string
  role: Role
  initials: string
  joined: string // ISO
  online: boolean
}

export interface Invite {
  id: string
  code: string
  email: string
  role: Role
  expiresAt: string // ISO
  createdBy: string
}

export interface Part {
  id: string
  name: string
  rev: string
  format: 'STEP' | 'IGES' | 'STL' | 'JT'
  decisionsCount: number
  unresolvedCount: number
  lastEdited: string // ISO
  thumbHue: number // 0..360 for thumbnail gradient
  status: 'NEW' | 'ACTIVE' | 'REVIEW'
  /** Pin positions are in %, relative to the viewer canvas — used by MockViewer. */
  pins: Array<{ id: string; xPct: number; yPct: number; decisionId: string }>
}

export interface Decision {
  id: string
  partId: string
  anchorId: string
  state: DecisionState
  rationale: string
  author: { id: string; name: string; initials: string }
  citations: string[]
  createdAt: string // ISO
  signoffs?: Array<{ name: string; initials: string; state: 'PENDING' | 'SIGNED' }>
}

export interface AuditEvent {
  id: string
  type:
    | 'DECISION_PROPOSED'
    | 'DECISION_ACCEPTED'
    | 'DECISION_REJECTED'
    | 'DECISION_SUPERSEDED'
    | 'MEMBER_INVITED'
    | 'MEMBER_JOINED'
    | 'PART_UPLOADED'
    | 'REV_UPLOADED'
    | 'RESOLVER_COMPLETED'
    | 'PLM_PUSHED'
  actor: { name: string; initials: string }
  target: string
  at: string // ISO
  payload: Record<string, unknown>
}

export interface InboxCard {
  id: string
  actor: { name: string; initials: string }
  verb: string
  partId: string
  partLabel: string
  rationalePreview: string
  at: string // ISO
}

// ─── Current user ─────────────────────────────────────────────────────────

export const mockUser: MockUser = {
  id: 'u-1',
  name: 'Ratnapriya',
  email: 'demo@dataverse.io',
  role: 'ADMIN',
  initials: 'RA',
  workspace: { id: 'w-1', name: 'F-Bracket Program', slug: 'f-bracket' },
}

// ─── Members ──────────────────────────────────────────────────────────────

export const mockMembers: Member[] = [
  {
    id: 'u-1',
    name: 'Ratnapriya Chamala',
    email: 'demo@dataverse.io',
    role: 'ADMIN',
    initials: 'RA',
    joined: '2026-02-04T10:00:00Z',
    online: true,
  },
  {
    id: 'u-2',
    name: 'Sarah Chen',
    email: 'sarah.chen@oem-aero.com',
    role: 'MEMBER',
    initials: 'SC',
    joined: '2026-02-12T14:22:00Z',
    online: true,
  },
  {
    id: 'u-3',
    name: 'John Williams',
    email: 'j.williams@precision-supply.io',
    role: 'MEMBER',
    initials: 'JW',
    joined: '2026-02-18T09:11:00Z',
    online: false,
  },
  {
    id: 'u-4',
    name: 'Maria Garcia',
    email: 'maria.g@stress-review.io',
    role: 'MEMBER',
    initials: 'MG',
    joined: '2026-03-02T11:34:00Z',
    online: true,
  },
  {
    id: 'u-5',
    name: 'David Kim',
    email: 'd.kim@oem-aero.com',
    role: 'ADMIN',
    initials: 'DK',
    joined: '2026-01-22T16:00:00Z',
    online: false,
  },
  {
    id: 'u-6',
    name: 'Priya Sharma',
    email: 'priya.s@manufacturing-co.com',
    role: 'VIEWER',
    initials: 'PS',
    joined: '2026-04-09T08:45:00Z',
    online: false,
  },
]

// ─── Invites ──────────────────────────────────────────────────────────────

export const mockInvites: Invite[] = [
  {
    id: 'inv-1',
    code: 'DV-7HQ2-XK9P',
    email: 'lead.engineer@new-supplier.io',
    role: 'MEMBER',
    expiresAt: '2026-05-22T00:00:00Z',
    createdBy: 'Ratnapriya Chamala',
  },
  {
    id: 'inv-2',
    code: 'DV-4PL8-MN3R',
    email: 'qa@certification-body.org',
    role: 'VIEWER',
    expiresAt: '2026-05-19T00:00:00Z',
    createdBy: 'David Kim',
  },
  {
    id: 'inv-3',
    code: 'DV-9XT1-AB7K',
    email: 'cae.team@stress-review.io',
    role: 'MEMBER',
    expiresAt: '2026-06-01T00:00:00Z',
    createdBy: 'Ratnapriya Chamala',
  },
]

// ─── Parts ────────────────────────────────────────────────────────────────

export const mockParts: Part[] = [
  {
    id: 'bracket-aero-014',
    name: 'Bracket-AERO-014',
    rev: 'Rev B',
    format: 'STEP',
    decisionsCount: 24,
    unresolvedCount: 3,
    lastEdited: '2026-05-13T15:22:00Z',
    thumbHue: 168,
    status: 'ACTIVE',
    pins: [
      { id: 'p1', xPct: 38, yPct: 36, decisionId: 'DEC-AERO-014-11' },
      { id: 'p2', xPct: 56, yPct: 48, decisionId: 'DEC-AERO-014-09' },
      { id: 'p3', xPct: 72, yPct: 33, decisionId: 'DEC-AERO-014-08' },
      { id: 'p4', xPct: 30, yPct: 64, decisionId: 'DEC-AERO-014-07' },
      { id: 'p5', xPct: 64, yPct: 70, decisionId: 'DEC-AERO-014-05' },
    ],
  },
  {
    id: 'housing-br-202',
    name: 'Housing-BR-202',
    rev: 'Rev A',
    format: 'STEP',
    decisionsCount: 8,
    unresolvedCount: 1,
    lastEdited: '2026-05-12T11:05:00Z',
    thumbHue: 198,
    status: 'REVIEW',
    pins: [],
  },
  {
    id: 'shaft-dr-099',
    name: 'Shaft-DR-099',
    rev: 'Rev C',
    format: 'IGES',
    decisionsCount: 45,
    unresolvedCount: 0,
    lastEdited: '2026-05-09T08:33:00Z',
    thumbHue: 142,
    status: 'ACTIVE',
    pins: [],
  },
  {
    id: 'plate-mnt-301',
    name: 'Plate-MNT-301',
    rev: 'Rev B',
    format: 'STEP',
    decisionsCount: 12,
    unresolvedCount: 2,
    lastEdited: '2026-05-13T09:14:00Z',
    thumbHue: 24,
    status: 'ACTIVE',
    pins: [],
  },
  {
    id: 'cover-ind-077',
    name: 'Cover-IND-077',
    rev: 'Rev A',
    format: 'STEP',
    decisionsCount: 3,
    unresolvedCount: 1,
    lastEdited: '2026-05-08T13:42:00Z',
    thumbHue: 282,
    status: 'REVIEW',
    pins: [],
  },
  {
    id: 'flange-xr-014',
    name: 'Flange-XR-014',
    rev: 'Rev A',
    format: 'STEP',
    decisionsCount: 0,
    unresolvedCount: 0,
    lastEdited: '2026-05-14T08:00:00Z',
    thumbHue: 4,
    status: 'NEW',
    pins: [],
  },
]

// ─── Decisions ────────────────────────────────────────────────────────────

export const mockDecisions: Decision[] = [
  {
    id: 'DEC-AERO-014-11',
    partId: 'bracket-aero-014',
    anchorId: 'face-boss-7',
    state: 'PROPOSED',
    rationale:
      'Wall thickness 1.6 mm at Z3 is below the 2.0 mm standard minimum. Acceptable only with documented FEA justification per AS9100 §6.4.3.',
    author: { id: 'u-2', name: 'Sarah Chen', initials: 'SC' },
    citations: ['AS9100 §6.4.3', 'DEC-AERO-014-08'],
    createdAt: '2026-05-14T09:32:00Z',
    signoffs: [
      { name: 'Ratnapriya Chamala', initials: 'RA', state: 'PENDING' },
      { name: 'David Kim', initials: 'DK', state: 'PENDING' },
    ],
  },
  {
    id: 'DEC-AERO-014-09',
    partId: 'bracket-aero-014',
    anchorId: 'hole-bolt-3',
    state: 'PROPOSED',
    rationale:
      'Bolt hole pattern offset by 0.3 mm vs. drawing. Confirm whether intentional for tolerance stack on the mating boss; otherwise revert to nominal.',
    author: { id: 'u-3', name: 'John Williams', initials: 'JW' },
    citations: ['ASME Y14.5 §1.4', 'DRW-AERO-014-B'],
    createdAt: '2026-05-13T14:18:00Z',
    signoffs: [
      { name: 'Sarah Chen', initials: 'SC', state: 'PENDING' },
      { name: 'David Kim', initials: 'DK', state: 'PENDING' },
    ],
  },
  {
    id: 'DEC-AERO-014-08',
    partId: 'bracket-aero-014',
    anchorId: 'face-flange-1',
    state: 'ACCEPTED',
    rationale:
      'Surface roughness on the inlet flange tightened from Ra 3.2 µm → Ra 1.6 µm to meet sealing requirements per the gasket vendor datasheet.',
    author: { id: 'u-4', name: 'Maria Garcia', initials: 'MG' },
    citations: ['ISO 1101', 'GASKET-DS-9911'],
    createdAt: '2026-05-12T10:50:00Z',
    signoffs: [
      { name: 'Sarah Chen', initials: 'SC', state: 'SIGNED' },
      { name: 'David Kim', initials: 'DK', state: 'SIGNED' },
    ],
  },
  {
    id: 'DEC-AERO-014-07',
    partId: 'bracket-aero-014',
    anchorId: 'edge-fillet-2',
    state: 'ACCEPTED',
    rationale:
      'Fillet radius increased from R1.5 to R2.5 on the load-bearing edge to mitigate fatigue stress concentration identified in the CAE report.',
    author: { id: 'u-2', name: 'Sarah Chen', initials: 'SC' },
    citations: ['CAE-RUN-2026-04-11', 'MIL-STD-1916'],
    createdAt: '2026-05-10T16:04:00Z',
    signoffs: [
      { name: 'Maria Garcia', initials: 'MG', state: 'SIGNED' },
      { name: 'David Kim', initials: 'DK', state: 'SIGNED' },
    ],
  },
  {
    id: 'DEC-AERO-014-05',
    partId: 'bracket-aero-014',
    anchorId: 'face-rib-4',
    state: 'REJECTED',
    rationale:
      'Proposed rib relocation to reduce mass by 7% was rejected — the new position interferes with the harness routing defined in the wiring drawing.',
    author: { id: 'u-3', name: 'John Williams', initials: 'JW' },
    citations: ['HARNESS-DRW-2208'],
    createdAt: '2026-05-08T11:27:00Z',
    signoffs: [
      { name: 'Sarah Chen', initials: 'SC', state: 'SIGNED' },
    ],
  },
  {
    id: 'DEC-AERO-014-04',
    partId: 'bracket-aero-014',
    anchorId: 'face-boss-7',
    state: 'SUPERSEDED',
    rationale:
      'Initial proposal to chamfer the boss edge — superseded by DEC-AERO-014-08 which addresses both the chamfer and the surface finish in a single change.',
    author: { id: 'u-4', name: 'Maria Garcia', initials: 'MG' },
    citations: [],
    createdAt: '2026-05-05T09:00:00Z',
  },
  // Other parts
  {
    id: 'DEC-BR-202-03',
    partId: 'housing-br-202',
    anchorId: 'face-mount-2',
    state: 'PROPOSED',
    rationale:
      'Tap depth on the M6 mounting holes is 8 mm — recommend 10 mm to meet the supplier\'s minimum thread engagement per their machining capability matrix.',
    author: { id: 'u-3', name: 'John Williams', initials: 'JW' },
    citations: ['SUPPLIER-CAP-MATRIX-V4'],
    createdAt: '2026-05-13T10:12:00Z',
  },
  {
    id: 'DEC-DR-099-12',
    partId: 'shaft-dr-099',
    anchorId: 'face-spline-1',
    state: 'ACCEPTED',
    rationale:
      'Spline tolerance class upgraded from 7e to 6f per the gearbox interface ICD. CMM data attached.',
    author: { id: 'u-2', name: 'Sarah Chen', initials: 'SC' },
    citations: ['ICD-GEARBOX-V3', 'CMM-2026-05-04'],
    createdAt: '2026-05-09T08:00:00Z',
  },
  {
    id: 'DEC-MNT-301-04',
    partId: 'plate-mnt-301',
    anchorId: 'edge-perimeter',
    state: 'PROPOSED',
    rationale:
      'Plate edges deburred to 0.2 mm × 45° chamfer to meet operator-safety requirement for downstream assembly.',
    author: { id: 'u-4', name: 'Maria Garcia', initials: 'MG' },
    citations: ['OSHA-1910.23'],
    createdAt: '2026-05-13T07:40:00Z',
  },
  {
    id: 'DEC-MNT-301-02',
    partId: 'plate-mnt-301',
    anchorId: 'hole-pattern-A',
    state: 'PROPOSED',
    rationale:
      'Centre-to-centre tolerance loosened from ±0.05 mm to ±0.10 mm — confirmed acceptable by stress review and brings the part into the standard machining tolerance band.',
    author: { id: 'u-1', name: 'Ratnapriya Chamala', initials: 'RA' },
    citations: ['ASME Y14.5 §1.4', 'CAE-RUN-2026-05-08'],
    createdAt: '2026-05-12T15:55:00Z',
  },
  {
    id: 'DEC-IND-077-01',
    partId: 'cover-ind-077',
    anchorId: 'face-front-1',
    state: 'PROPOSED',
    rationale:
      'Material substitution from PA66-GF30 to PPS-GF40 to meet the elevated thermal spec (150 °C continuous) requested for engine-bay variant.',
    author: { id: 'u-2', name: 'Sarah Chen', initials: 'SC' },
    citations: ['THERMAL-SPEC-EB-V2'],
    createdAt: '2026-05-08T13:00:00Z',
  },
  {
    id: 'DEC-DR-099-08',
    partId: 'shaft-dr-099',
    anchorId: 'face-keyway-1',
    state: 'ACCEPTED',
    rationale:
      'Keyway dimensions confirmed to DIN 6885 (8×7×40) per the motor-side coupling spec.',
    author: { id: 'u-4', name: 'Maria Garcia', initials: 'MG' },
    citations: ['DIN 6885', 'COUPLING-MOTOR-SIDE-V2'],
    createdAt: '2026-05-06T11:22:00Z',
  },
]

// ─── Inbox cards ──────────────────────────────────────────────────────────

export const mockInbox: InboxCard[] = [
  {
    id: 'inb-1',
    actor: { name: 'Sarah Chen', initials: 'SC' },
    verb: 'proposed a decision on',
    partId: 'bracket-aero-014',
    partLabel: 'Bracket-AERO-014',
    rationalePreview:
      'Wall thickness 1.6 mm at Z3 is below the 2.0 mm standard minimum. Acceptable only with documented FEA justification per AS9100 §6.4.3.',
    at: '2026-05-14T09:32:00Z',
  },
  {
    id: 'inb-2',
    actor: { name: 'John Williams', initials: 'JW' },
    verb: 'mentioned you on',
    partId: 'bracket-aero-014',
    partLabel: 'Bracket-AERO-014',
    rationalePreview:
      '@ratnapriya can you confirm whether the 0.3 mm hole pattern offset is intentional for the stack-up on the mating boss?',
    at: '2026-05-14T08:11:00Z',
  },
  {
    id: 'inb-3',
    actor: { name: 'Maria Garcia', initials: 'MG' },
    verb: 'accepted your decision on',
    partId: 'plate-mnt-301',
    partLabel: 'Plate-MNT-301',
    rationalePreview:
      'Centre-to-centre tolerance loosened from ±0.05 mm to ±0.10 mm — accepted; brings part into standard machining band.',
    at: '2026-05-13T17:45:00Z',
  },
  {
    id: 'inb-4',
    actor: { name: 'David Kim', initials: 'DK' },
    verb: 'requested signoff on',
    partId: 'housing-br-202',
    partLabel: 'Housing-BR-202',
    rationalePreview:
      'Tap depth on M6 mounting holes 8 → 10 mm to meet supplier minimum thread engagement.',
    at: '2026-05-13T14:00:00Z',
  },
  {
    id: 'inb-5',
    actor: { name: 'Sarah Chen', initials: 'SC' },
    verb: 'uploaded Rev B of',
    partId: 'bracket-aero-014',
    partLabel: 'Bracket-AERO-014',
    rationalePreview:
      'Resolver completed: 8 decisions auto-carried · 3 require confirmation · 1 regressed.',
    at: '2026-05-12T09:00:00Z',
  },
]

// ─── Resolver / What-changed buckets (used by /parts/[id]/what-changed) ────

export const mockResolverResults = {
  fromRev: 'Rev A',
  toRev: 'Rev B',
  buckets: {
    autoCarried: [
      { id: 'DEC-AERO-014-01', title: 'Initial bolt hole pattern', confidence: 0.99 },
      { id: 'DEC-AERO-014-02', title: 'Material grade Al 7075-T6', confidence: 0.99 },
      { id: 'DEC-AERO-014-03', title: 'Mounting boss diameter', confidence: 0.96 },
      { id: 'DEC-AERO-014-06', title: 'Heat treatment specification', confidence: 0.94 },
      { id: 'DEC-AERO-014-07', title: 'Fillet radius R2.5 on load edge', confidence: 0.92 },
      { id: 'DEC-AERO-014-08', title: 'Inlet flange Ra 1.6 µm finish', confidence: 0.91 },
      { id: 'DEC-AERO-014-10', title: 'Coating thickness 25–35 µm', confidence: 0.88 },
      { id: 'DEC-AERO-014-12', title: 'Edge break 0.2 mm × 45°', confidence: 0.87 },
    ],
    requiresConfirmation: [
      { id: 'DEC-AERO-014-04', title: 'Boss chamfer 1.0 × 45°', confidence: 0.71, anchor: 'face-boss-7' },
      { id: 'DEC-AERO-014-09', title: 'Bolt hole offset 0.3 mm', confidence: 0.66, anchor: 'hole-bolt-3' },
      { id: 'DEC-AERO-014-11', title: 'Wall thickness 1.6 mm at Z3', confidence: 0.61, anchor: 'face-boss-7' },
    ],
    resolved: [
      { id: 'DEC-AERO-014-13', title: 'Pocket draft angle (added in Rev B)', confidence: 1 },
      { id: 'DEC-AERO-014-14', title: 'Rib reinforcement (added in Rev B)', confidence: 1 },
      { id: 'DEC-AERO-014-15', title: 'Lightening hole pattern (added in Rev B)', confidence: 1 },
    ],
    regressed: [
      { id: 'DEC-AERO-014-05', title: 'Rib relocation rejected', confidence: 0.42, anchor: 'face-rib-4' },
    ],
    orphaned: [],
  },
}

// ─── Audit events ─────────────────────────────────────────────────────────

export const mockEvents: AuditEvent[] = [
  {
    id: 'ev-1',
    type: 'DECISION_PROPOSED',
    actor: { name: 'Sarah Chen', initials: 'SC' },
    target: 'DEC-AERO-014-11 on Bracket-AERO-014',
    at: '2026-05-14T09:32:00Z',
    payload: { partId: 'bracket-aero-014', anchorId: 'face-boss-7', citations: 2 },
  },
  {
    id: 'ev-2',
    type: 'MEMBER_JOINED',
    actor: { name: 'Priya Sharma', initials: 'PS' },
    target: 'workspace f-bracket',
    at: '2026-05-14T08:45:00Z',
    payload: { role: 'VIEWER', invitedBy: 'Ratnapriya Chamala' },
  },
  {
    id: 'ev-3',
    type: 'DECISION_ACCEPTED',
    actor: { name: 'David Kim', initials: 'DK' },
    target: 'DEC-AERO-014-08 on Bracket-AERO-014',
    at: '2026-05-13T17:45:00Z',
    payload: { signedBy: ['David Kim', 'Sarah Chen'], partId: 'bracket-aero-014' },
  },
  {
    id: 'ev-4',
    type: 'REV_UPLOADED',
    actor: { name: 'Sarah Chen', initials: 'SC' },
    target: 'Bracket-AERO-014 Rev B',
    at: '2026-05-12T09:00:00Z',
    payload: { previousRev: 'Rev A', format: 'STEP', fileSize: '4.2 MB' },
  },
  {
    id: 'ev-5',
    type: 'RESOLVER_COMPLETED',
    actor: { name: 'system', initials: 'SY' },
    target: 'Bracket-AERO-014 Rev A → Rev B',
    at: '2026-05-12T09:02:00Z',
    payload: { autoCarried: 8, requiresConfirmation: 3, resolved: 3, regressed: 1, orphaned: 0 },
  },
  {
    id: 'ev-6',
    type: 'DECISION_REJECTED',
    actor: { name: 'David Kim', initials: 'DK' },
    target: 'DEC-AERO-014-05 on Bracket-AERO-014',
    at: '2026-05-08T11:27:00Z',
    payload: { reason: 'Interferes with harness routing per HARNESS-DRW-2208' },
  },
  {
    id: 'ev-7',
    type: 'MEMBER_INVITED',
    actor: { name: 'Ratnapriya Chamala', initials: 'RA' },
    target: 'lead.engineer@new-supplier.io',
    at: '2026-05-07T16:00:00Z',
    payload: { code: 'DV-7HQ2-XK9P', role: 'MEMBER', expiresAt: '2026-05-22T00:00:00Z' },
  },
  {
    id: 'ev-8',
    type: 'PART_UPLOADED',
    actor: { name: 'John Williams', initials: 'JW' },
    target: 'Flange-XR-014 Rev A',
    at: '2026-05-14T08:00:00Z',
    payload: { format: 'STEP', fileSize: '2.1 MB' },
  },
  {
    id: 'ev-9',
    type: 'PLM_PUSHED',
    actor: { name: 'Ratnapriya Chamala', initials: 'RA' },
    target: 'ECN-2026-0412 → Windchill',
    at: '2026-05-04T15:18:00Z',
    payload: { ecn: 'ECN-2026-0412', decisions: ['DEC-DR-099-08', 'DEC-DR-099-12'] },
  },
  {
    id: 'ev-10',
    type: 'DECISION_SUPERSEDED',
    actor: { name: 'Maria Garcia', initials: 'MG' },
    target: 'DEC-AERO-014-04',
    at: '2026-05-05T09:00:00Z',
    payload: { supersededBy: 'DEC-AERO-014-08' },
  },
  {
    id: 'ev-11',
    type: 'DECISION_PROPOSED',
    actor: { name: 'John Williams', initials: 'JW' },
    target: 'DEC-AERO-014-09 on Bracket-AERO-014',
    at: '2026-05-13T14:18:00Z',
    payload: { partId: 'bracket-aero-014', anchorId: 'hole-bolt-3', citations: 2 },
  },
  {
    id: 'ev-12',
    type: 'DECISION_PROPOSED',
    actor: { name: 'Ratnapriya Chamala', initials: 'RA' },
    target: 'DEC-MNT-301-02 on Plate-MNT-301',
    at: '2026-05-12T15:55:00Z',
    payload: { partId: 'plate-mnt-301', anchorId: 'hole-pattern-A', citations: 2 },
  },
  {
    id: 'ev-13',
    type: 'DECISION_ACCEPTED',
    actor: { name: 'Maria Garcia', initials: 'MG' },
    target: 'DEC-MNT-301-02 on Plate-MNT-301',
    at: '2026-05-13T17:45:00Z',
    payload: { partId: 'plate-mnt-301', signedBy: ['Maria Garcia'] },
  },
  {
    id: 'ev-14',
    type: 'PART_UPLOADED',
    actor: { name: 'Sarah Chen', initials: 'SC' },
    target: 'Housing-BR-202 Rev A',
    at: '2026-05-11T13:33:00Z',
    payload: { format: 'STEP', fileSize: '3.4 MB' },
  },
  {
    id: 'ev-15',
    type: 'MEMBER_INVITED',
    actor: { name: 'David Kim', initials: 'DK' },
    target: 'qa@certification-body.org',
    at: '2026-05-10T11:00:00Z',
    payload: { code: 'DV-4PL8-MN3R', role: 'VIEWER' },
  },
  {
    id: 'ev-16',
    type: 'DECISION_PROPOSED',
    actor: { name: 'Maria Garcia', initials: 'MG' },
    target: 'DEC-MNT-301-04 on Plate-MNT-301',
    at: '2026-05-13T07:40:00Z',
    payload: { partId: 'plate-mnt-301', anchorId: 'edge-perimeter' },
  },
  {
    id: 'ev-17',
    type: 'DECISION_ACCEPTED',
    actor: { name: 'Sarah Chen', initials: 'SC' },
    target: 'DEC-DR-099-08 on Shaft-DR-099',
    at: '2026-05-07T10:11:00Z',
    payload: { partId: 'shaft-dr-099' },
  },
  {
    id: 'ev-18',
    type: 'PART_UPLOADED',
    actor: { name: 'Maria Garcia', initials: 'MG' },
    target: 'Plate-MNT-301 Rev B',
    at: '2026-05-10T09:14:00Z',
    payload: { format: 'STEP', fileSize: '1.8 MB' },
  },
  {
    id: 'ev-19',
    type: 'DECISION_PROPOSED',
    actor: { name: 'Sarah Chen', initials: 'SC' },
    target: 'DEC-IND-077-01 on Cover-IND-077',
    at: '2026-05-08T13:00:00Z',
    payload: { partId: 'cover-ind-077' },
  },
  {
    id: 'ev-20',
    type: 'MEMBER_JOINED',
    actor: { name: 'Maria Garcia', initials: 'MG' },
    target: 'workspace f-bracket',
    at: '2026-03-02T11:34:00Z',
    payload: { role: 'MEMBER', invitedBy: 'David Kim' },
  },
  {
    id: 'ev-21',
    type: 'DECISION_PROPOSED',
    actor: { name: 'Sarah Chen', initials: 'SC' },
    target: 'DEC-AERO-014-07 on Bracket-AERO-014',
    at: '2026-05-10T16:04:00Z',
    payload: { partId: 'bracket-aero-014', anchorId: 'edge-fillet-2' },
  },
  {
    id: 'ev-22',
    type: 'DECISION_ACCEPTED',
    actor: { name: 'David Kim', initials: 'DK' },
    target: 'DEC-AERO-014-07 on Bracket-AERO-014',
    at: '2026-05-11T09:20:00Z',
    payload: { partId: 'bracket-aero-014' },
  },
  {
    id: 'ev-23',
    type: 'PLM_PUSHED',
    actor: { name: 'David Kim', initials: 'DK' },
    target: 'ECN-2026-0398 → Windchill',
    at: '2026-04-28T14:00:00Z',
    payload: { ecn: 'ECN-2026-0398', decisions: ['DEC-AERO-014-07'] },
  },
  {
    id: 'ev-24',
    type: 'RESOLVER_COMPLETED',
    actor: { name: 'system', initials: 'SY' },
    target: 'Plate-MNT-301 Rev A → Rev B',
    at: '2026-05-10T09:16:00Z',
    payload: { autoCarried: 9, requiresConfirmation: 2, resolved: 1, regressed: 0 },
  },
  {
    id: 'ev-25',
    type: 'MEMBER_JOINED',
    actor: { name: 'John Williams', initials: 'JW' },
    target: 'workspace f-bracket',
    at: '2026-02-18T09:11:00Z',
    payload: { role: 'MEMBER', invitedBy: 'Ratnapriya Chamala' },
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────

export function formatRelative(iso: string, now: Date = new Date('2026-05-14T12:00:00Z')): string {
  const t = new Date(iso).getTime()
  const delta = now.getTime() - t
  const min = Math.round(delta / 60_000)
  const hr = Math.round(delta / 3_600_000)
  const day = Math.round(delta / 86_400_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  if (hr < 24) return `${hr}h ago`
  if (day < 30) return `${day}d ago`
  const mo = Math.round(day / 30)
  return `${mo}mo ago`
}

export function getPart(id: string): Part | undefined {
  return mockParts.find((p) => p.id === id)
}

export function getDecisionsForPart(partId: string): Decision[] {
  return mockDecisions.filter((d) => d.partId === partId)
}

export function getDecisionById(id: string): Decision | undefined {
  return mockDecisions.find((d) => d.id === id)
}

export const STATE_LABEL: Record<DecisionState, string> = {
  PROPOSED: 'Proposed',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  SUPERSEDED: 'Superseded',
}
