# DataVerse Collab — Frontend

> A CAD/engineering collaboration platform where **every decision is anchored to geometry**, moves through a state machine, and survives revisions. The 3D viewer is the centerpiece — everything else revolves around it.

Built with Next.js 14 (App Router) · TypeScript strict · TailwindCSS · Babylon.js for the real 3D viewer.

---

## Quick start

```bash
cd frontend
npm install
copy .env.local.example .env.local   # Windows
# or: cp .env.local.example .env.local
npm run dev                          # → http://localhost:3010
```

The frontend talks to a FastAPI backend on **port 4000**. Start that separately from the [`../backend`](../backend) folder:

```bash
cd ../backend
.venv\Scripts\activate               # Windows
# or: source .venv/bin/activate      # macOS / Linux
uvicorn app.main:app --host 127.0.0.1 --port 4000
```

Then open **http://localhost:3010** — auto-redirects to `/login`. Default dev credentials are stamped into the login card.

---

## The CoLab flow

```
Login  →  /workspace            (your workspace · 6 projects)
       →  /projects/proj_turbo  (collaboration hub — Parts · Decisions · Feedback · Activity · Members)
       →  /parts/demo_1         (centerpiece — 3D | 2D | BOM tabs · conversation hub anchored right)
```

Click any face on the 3D model → propose a decision → it's anchored to that exact piece of geometry by a SHA-256 topology hash. The pin survives revisions.

---

## Route map

### Workspace surface

| Route | What it is |
|---|---|
| `/login` · `/register` | Auth — credentials prefilled in dev |
| `/workspace` | Dashboard with your projects, activity feed, pending decisions |
| `/my-work` | Personal action items |
| `/projects/[id]` | **Project Hub** — 5-tab CoLab-style collaboration view |
| `/decisions` | Workspace-wide decision feed · Feed / Table view toggle |
| `/audit` | Vertical timeline of every event |
| `/admin` | Members · Invites · Settings |
| `/architecture` | **System overview** — clickable module map |

### Part viewer (the centerpiece)

| Route | What it is |
|---|---|
| `/parts/[id]` | 3D viewer · CommentLabels · CreateDecisionModal · **Conversation Hub** right rail |
| `/parts/[id]/drawing` | 2D engineering drawing · PMI callouts · GD&T sidebar |
| `/parts/[id]/bom` | Collapsible Bill of Materials tree |
| `/parts/[id]/what-changed` | Cross-rev resolver report · 5 buckets · Verify Anchor side-by-side |
| `/parts/[id]/walkthrough` | Full-screen decision walker · keyboard nav |
| `/parts/[id]/concierge` | Datum AI-led 7-step onboarding · typewriter |
| `/parts/[id]/plm-push` | Push to Windchill · 3-column wizard · signed ECN |
| `/parts/[id]?view=partner` | Partner-view redaction layer |

### Audit infrastructure

| Route | What it is |
|---|---|
| `/audit/chain/[workspaceId]` | Hash-chained event log · "Verify chain now" animation |
| `/audit/export` | DVEX bundle export · 3-phase signing modal · real JSON download |
| `/audit/replay-tool` | Stripe-style docs for the offline verifier |

### External (auditor) surface

| Route | What it is |
|---|---|
| `/external/windchill/ecn/[ecnId]` | Slate-blue PLM chrome · 4 tabs · signed-bundle verification |

---

## Architecture overview

Open **`/architecture`** for an interactive module map. Click any module → details drawer with deep-link to the mocked UI page.

```
USER SURFACE     M1 Auth   M6 Admin   M3 Projects   M2 Parts/Viewer
CORE LOGIC       M4 Decisions     M5 Resolver       M9 PLM Push
CROSS-CUTTING    M7 Audit Chain          M8 Datum (AI)
PLANNED          Notify Bus              Knowledge Graph
```

Status legend:

- ✓ **Live** — real backend, persisted in SQLite (M1, M2, M3, M4, M6)
- ◐ **Mocked** — clickable UI, no real persistence yet (M5, M7, M8, M9)
- ◯ **Planned** — on the spec board, no UI yet (Notify Bus, Knowledge Graph)

---

## Key features

### The "stay-in-viewer" pattern (CoLab-style)

When you open a part, **everything happens in one screen**:

- **Top tabs** — pivot between 3D Model · 2D Drawing · BOM
- **Right column conversation hub** — 4 sub-tabs (Comments · Issues · Activity · Threads), all scoped to this part
- **Floating annotation cards** — anchored to face pins with author photos, citation chips, tagged-people row, "1 reply" footer
- **Quick-nav icon row** — What changed · Walkthrough · Concierge · Push to PLM

You don't navigate away to read activity or feedback. The viewer is the desk.

### Decisions are first-class

Every decision is:

- **Anchored** to a specific topology-hashed face (SHA-256 of centroid + normal + area + triangle count, rounded to 1 µm)
- **Rationale-gated** — minimum 10 characters, server-enforced with a 4-layer defense
- **FSM-managed** — `DRAFT → PROPOSED → ACCEPTED / REJECTED / SUPERSEDED` with allowed-transition whitelist
- **Audit-logged** — every state change writes a row to the append-only hash chain

### Feedback issue tracker

On every Project Hub, the Feedback tab renders decisions as CoLab-style issues:

- 12-tone tag palette: DFM · Manufacturing · Machining · Tolerancing · Sourcing · Materials · Complexity (3 levels) · Blocker · Cost Reduction · VAVE
- Priority bar on the left of each row (blocker / high / medium / low)
- Saved views: All · Open blockers · My assigned · Resolved
- Filter chips · Search · Columns toggle · **CSV export** (real Blob download)

### Partner-view redaction (M8 Datum)

Switch the role dropdown at the top of any part viewer to **Supplier Reviewer** → page transforms:

- Internal-only decisions replaced with "🔒 [REDACTED]" cards
- Datum redaction explainer in the right rail
- "Show what's hidden" toggle reveals the underlying rationale with a red strike-through (admin debug)
- Decision pins for hidden items also disappear from the 3D model

### Cryptographic audit trail (M7)

- **Hash chain** — every event has `prev_hash → curr_hash` (SHA-256-shaped fake hashes in the mock)
- **DVEX bundle export** — real JSON download with Ed25519 signature metadata
- **Verify offline** — pretend CLI tool documented at `/audit/replay-tool` (Stripe-style docs)
- Bundle signature shown on the external Windchill page's Audit Trail tab

### Cross-rev resolver (M5 — the unfair advantage)

When a new revision is uploaded, the resolver re-anchors decisions in 3 layers:

1. **Layer 1** — exact `face_uuid` match → Auto-carried
2. **Layer 2** — topology-fingerprint match → "Requires confirmation" (verify with side-by-side modal)
3. **Layer 3** — proximity / partial → Resolved · Regressed · Orphaned

Try it at `/parts/demo_2/what-changed` — the regression banner is impossible to miss.

---

## Tech stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14.2 · App Router · React 18.3 · TypeScript strict |
| Styling | TailwindCSS 3.4 · custom design tokens · lucide-react icons |
| 3D viewer | Babylon.js 8.0 + opencascade.js (vendored) |
| State | React hooks · zustand for the viewer store |
| Build | Strict TypeScript · ESLint · `next build` |
| Tests | Vitest (geomHash.test.ts covers topology hashing) |

---

## Design tokens

| Token | Value | Used for |
|---|---|---|
| `primary` | `#15524a` | Brand accents · active nav · buttons |
| `brand` | `#06b6d4` | Hero gradient highlights · secondary accents |
| `accent-soft` | `#e9f1ef` | Background tints |
| `state-proposed` | `#d99543` | Decision · proposed (amber) |
| `state-accepted` | `#5ec087` | Decision · accepted (emerald) |
| `state-rejected` | `#d56363` | Decision · rejected (rose) |
| `state-superseded` | `#a8b0bb` | Decision · superseded (slate) |

---

## Component map

```
src/components/
├── architecture/      ArchitectureDiagram · ModuleStatusDrawer
├── audit/             ChainVerifyBadge · HashChainEventRow · DVEXExportModal
├── bom/               BOMTree · BOMTreeNode
├── decisions/         DecisionCard · DecisionRow · DecisionsPanel · CreateDecisionModal
├── drawing/           DrawingCanvas · PMICallout · PMISidebar
├── feedback/          FeedbackPanel · IssueTagChip · PriorityIndicator
├── layout/            WorkspaceSidebar · NotificationsBell · CommandPalette
├── parts/             PartViewTabs · PartConversationHub
├── plm/               ECNPreviewCard · SyncStatusCard · PushToPLMModal
├── projects/          ProjectHubHero · ProjectHubTabs
├── redaction/         RoleSwitcher · PartnerViewBanner · RedactedDecisionCard · DatumRedactionExplainer
├── resolver/          ConfidencePill · VerifyAnchorModal
├── ui/                Logo · UserBadge · Toast
├── viewer/            ViewerCanvas · CommentLabels (anchored annotation system)
└── workspace/         ProjectsGrid · ProjectCard · ActivityFeed · StatCard · TeamCard · PipelineStrip · TeamBadge · Avatar
```

---

## Mock data

All UI data lives in **`src/lib/mockWorkspace.ts`** — single source of truth. Refresh resets in-memory mutations.

Key seeds:

- `SEED_PROJECTS` — 6 projects covering aerospace / automotive / thermal
- `SEED_FULL_DECISIONS` — 12 decisions with realistic rationales (AS9100 §6.4.3, ISO 1101, etc.)
- `SEED_MEMBERS` — 5 collaborators across DESIGN · CAE · SUPPLIER · REVIEWER · MANUFACTURING teams
- `SEED_HASH_CHAIN` — 25 deterministically-hashed events
- `SEED_PMI_CALLOUTS` — 6 GD&T annotations on the 2D drawing
- `SEED_BOM` — 10-line assembly tree
- `SEED_MODULES` — 11 architecture modules with status + edges

---

## Notes

- **STEP rendering is stubbed** in this build. Real STEP files are stored and downloadable, but the viewer shows sample geometry (a cylinder · sphere · cube) so face-picking can be tested without an opencascade.js WASM compile.
- **Mock part IDs** (`demo_1`, `demo_2`, …) work seamlessly. The viewer detects them and synthesises a `PartDetail` + decision list from `SEED_FULL_DECISIONS`.
- **Real uploaded parts** (UUIDs) hit the FastAPI backend normally.

---

## License

Private. Internal use only.
