# DataVerse Collab — Demo Script

**Audience:** Your team lead.
**Time:** ~7 minutes (8 minutes if you take questions).
**Goal:** Show that the platform's centrepiece — anchored decisions on a 3D part — is real, that the AI helper (Datum) is wired to the workflow at exactly the points the architecture spec calls out, and that every AI suggestion is auditable.

Before you start: clear `frontend/.next`, then `npm run dev` (frontend) and `uvicorn --reload` (backend) in two terminals. Open the browser to `http://localhost:3010` and hard-refresh (Ctrl+Shift+R). Log in as `demo-screenshot@example.com` / `demo123pass`. Land on `/workspace`.

---

## Beat 1 — Workspace (~30s)

**Where:** `localhost:3010/workspace`

**Say:**
> "This is the workspace. Six projects across aerospace, automotive, thermal. Everything you'd expect from a CAD collaboration hub — projects, activity, pending decisions. But the interesting part starts when you click into one."

**Show:**
- The 6 project cards.
- The activity feed on the right.
- Click into **Turbocharger Compressor Housing V3** (`proj_turbo`).

---

## Beat 2 — Project Hub Overview (~60s)

**Where:** `/projects/proj_turbo` (Overviews tab default)

**Say:**
> "The Project Hub is Slingshot-pattern. Eight tabs across the top — Overviews, Tasks, Discussions, Pins, Dashboards, Parts, Activity, Members. The Overviews tab is the default and reflects this project's real state: open decisions, who's responsible, where things are stuck."

**Show:**
- Tab strip across the top.
- The 7 dashboard widgets:
  - **Overdue Decisions · Blocked · In Progress** big-number cards
  - **Open Decisions** grouped list
  - **Member Tasks Summary**
  - **Decisions By Status** donut
  - **Pins** empty state

**Hover the "..." menu on one card and click "Bookmark".** A toast says "Pinned to this project". Click the **Pins tab** — your bookmark is there. Click the sidebar's **Bookmark icon** (top of Workspaces toggle) — same bookmark, surfaced globally, deep-links to the right project's Pins tab.

**Click the expand icon on the "Overdue Decisions" card.** It takes the full content area with a table view. Click expand again to collapse.

**Key sentence:** *"Bookmarks and expand state are wired to localStorage, so they survive reloads. Switch tab, switch project — they all stay in sync via a custom event."*

---

## Beat 3 — The Part Viewer (the centrepiece) (~90s)

**Where:** Click the **Parts tab**, then click the first part (Compressor Housing v2 / `demo_1`).

**Say:**
> "This is the centre of the product. The 3D viewer with a floating toolbar, comment cards anchored to faces, and a conversation hub on the right. The pattern is *stay in the viewer*: everything you need to review, decide, push to PLM — without leaving this screen."

**Show:**
- **3D viewer** with sample geometry (cylinder · sphere · cube — STEP rendering is stubbed in dev).
- **CommentLabels** anchored to faces (Maria Garcia, Sarah Chen) with state pills.
- **Right rail**: four tabs (Comments · Issues · Activity · Threads).
- **Top tabs**: 3D Model · 2D Drawing · BOM.

**Click the blue cube.** A modal opens: "New comment on this face · Anchored at -2.00, 0.00, 1.00".

**Key sentence:** *"Every decision is anchored to a SHA-256 topology hash of the face — centroid + normal + area + triangle count, rounded to 1 µm. The hash survives revisions, which we'll see in a minute."*

---

## Beat 4 — Datum Hook 1: Suggest Rationale (~30s)

**Still in the modal.**

**Click "Suggest rationale (Datum)".**

**What happens:**
- Textarea fills with a grounded sentence (e.g., *"Wall thickness at this face is below the 2.0 mm minimum spec…"*).
- An **82% confidence chip** appears beside the button.
- If the template references **AS9100 §6.4.3**, a violet **citation chip** shows below.

**Say:**
> "This is Hook 1 of the Datum AI module — 'Suggest rationale'. The chip you see is the confidence score Datum reports; every output carries one. Below it, the citations — Datum cites the source it grounded against. If Datum's confidence falls below 0.6 it declines instead of bluffing — that's the 'cite-or-decline' rule from our architecture spec."

**Click "Create comment".** Modal closes, decision count in the right rail bumps. **No network 404** — mock parts have a fast-path so the demo works without backend persistence.

---

## Beat 5 — Datum Hook 2: Summarize Thread (~30s)

**Where:** Right rail of the part viewer → **Threads** tab.

**Say:**
> "Hook 2 is 'Summarize thread'. When a decision has lots of replies, a reviewer can ask Datum to produce an exec summary. Same contract — confidence + key concerns + recommended action + citations."

**Click the violet "Summarise" bar at the top.**

**What appears:**
- Violet card with **Datum avatar** + **84% confidence**.
- Multi-line summary about wall-thickness and surface roughness.
- **Key concerns** bullet list (amber triangles).
- **Recommended action** emerald callout.
- **Citation chips** with the real decision IDs (e.g., `DEC-TURBO-V3-11`).
- Footer: *"Datum drafted this — human always has the final word."*

**Key sentence:** *"That footer matters — Datum proposes, never decides. Rule #5 in our architecture spec."*

---

## Beat 6 — Datum Hook 4: Flag Regressions (~90s)

**Where:** `/parts/demo_2/what-changed`

**Say:**
> "This is the cross-rev resolver — what happens when a new revision lands. Decisions from Rev A get re-anchored onto Rev B through three layers: exact face_uuid match, topology-fingerprint match, proximity match. Layer 3 produces three outcomes: resolved, regressed, orphaned."

**Show:**
- The **dark hero** with `Rev A → Rev B`.
- The **5 stat cards**: Auto-carried · Needs confirmation · Resolved by change · **Regressed** · Orphaned.
- The **rose regression banner** with impact line: *"2 mating parts · CAE re-approval required · ~$1.4k rework · Datum scan below cross-references this"*.

**Scroll down a touch to the violet Datum panel.** Click **Run scan**.

**What appears:**
- Header: *"Scanned 12 decisions · 3 flagged · Xms · mocked-fallback"*
- Three flagged cards:
  - `DEC-BRACKET-09` · **91% likelihood** (rose) · **Urgent review** · *"Bolt hole pattern offset 0.3 mm…"*
  - `DEC-BRACKET-12` · 74% (amber) · **Verify anchor** · *"Fillet radius reduced from 2.5 mm to 1.8 mm…"*
  - `DEC-BRACKET-15` · 63% (amber) · **Verify anchor** · *"Surface-finish callout dropped…"*

**Say:**
> "Hook 4 — 'Flag regressions'. Datum reads the resolver output, scans the diff, and tells you which decisions to look at first. Each flag has a likelihood score, a suggested action (urgent review · verify anchor · no action), and reasoning grounded in real anchor data."

**Click on a "Needs confirmation" bucket → expand a row → click "Verify anchor".** The side-by-side Rev A vs Rev B modal opens. Press **A** on your keyboard — anchor accepted. Confidence bumps emerald.

**Key sentence:** *"Keyboard shortcuts. A reviewer goes through forty of these in a sprint — A and R make it three seconds each."*

---

## Beat 7 — Datum Hook 3: Screen Boundary (Partner View) (~45s)

**Where:** Back to `/parts/demo_1`. Click the **"View as: Admin"** dropdown in the top-right → select **"Supplier Reviewer (Partner)"**.

**What happens:**
- Page reloads with `?view=partner`.
- The right rail gains a **purple Datum redaction explainer** at the top with a **"Live screen 78%"** emerald badge in the header.
- Below the rules: *"Datum's safe summary — N comments hidden from partner view by Datum…"*.
- A subset of decisions appear as **🔒 [REDACTED]** cards with the reason ("internal-flag", "cost-keyword", etc.).
- A small admin banner appears: *"Showing partner view · N hidden"* with a "Show what's hidden" toggle.

**Click "Show what's hidden".** The redacted cards reveal the underlying rationale with a red strikethrough — admin debug only.

**Say:**
> "Hook 3 — 'Screen at boundary'. Every partner read of a thread, Datum decides which comments cross the line. Internal-only notes, cost language, admin-only threads — Datum classifies each and returns the redaction set with reasons. The 'Live screen' badge confirms Datum scanned this thread. The 'show what's hidden' toggle is admin debug — partners obviously don't see that. AS9100 and ITAR compliance is why this layer exists."

---

## Beat 8 — Rule #6 · Every Datum call is auditable (~30s)

**Where:** `/audit`

**Say:**
> "Architecture rule #6: every Datum invocation writes an audit event. If a decision was ever influenced by an AI suggestion, you can trace it."

**Show:**
- The **4 SVG analytics charts** at the top: Decisions over time · Decisions by state · Decisions by team · Top contributors.
- The **filter dropdown** at top of the timeline below.
- Change filter to **"Datum called"**.

**What appears:** Four violet timeline rows (one per Datum hook you triggered). Each has the Sparkles icon, the actor (Demo Screenshot), timestamp, and a chevron.

**Click the chevron on one row.** Full JSON payload expands: `{ hook, input, output, confidence, latency_ms, source, declined }` — exactly what spec §6 demands.

**Key sentence:** *"That's the auditable trail. Every suggestion Datum made, with its inputs and outputs, frozen forever."*

---

## Beat 9 — Closing (~15s)

**Where:** Click **"/architecture"** in your mental map — wait, we removed that. Go to GitHub instead: `https://github.com/ratnapriya-collab/Dataverse_collab_platform/blob/main/dataverse-collab/datum-ai-module-architecture.html` (open this on a second monitor before the demo).

**Say:**
> "Everything I just showed is contract-frozen to the spec. The five Datum hooks — draft rationale, summarise thread, screen boundary, flag regressions, digest — are wired to the workflow at exactly the spots the architecture doc identifies. Hook 5, the daily digest, runs in cron and isn't user-facing yet. The other four are live, mocked-fallback, with full audit. When we plug Ollama in, only the handler internals change — schemas, audit events, UI behaviour all stay."

---

## Backup answers (in case they ask)

**Q: "Where's the real LLM?"**
> Phase 2. The mocked-fallback responses respect the same Pydantic schema the Ollama-backed handlers will. Real LLM is post-demo because (a) deterministic systems ship first and (b) prompt engineering needs eval coverage we don't have yet.

**Q: "Why local Ollama and not OpenAI API?"**
> Customer engineering data — drawings, decisions, rationales — can't leave the customer's deployment boundary. AS9100, ITAR, IP. Ollama runs on customer hardware. Llama 3.1 8B fits on a $300 RTX 4060.

**Q: "What happens when Datum gets it wrong?"**
> Three safeguards. (1) Confidence on every output — low-confidence is visibly flagged. (2) Cite-or-decline — if Datum can't ground the answer, it returns the fallback and a "declined" reason. (3) Every output goes through a human who edits or accepts. Datum proposes, the user decides.

**Q: "How big is the codebase?"**
> Frontend ~14k lines TypeScript strict, ~80 components. Backend ~3k lines FastAPI + SQLModel. All in [github.com/ratnapriya-collab/Dataverse_collab_platform](https://github.com/ratnapriya-collab/Dataverse_collab_platform).

**Q: "Mock parts vs real parts?"**
> Anything with a `demo_` prefix is seeded for the demo and lives in client-side state (refresh wipes new ones). Anything with a UUID is real — uploads persist to SQLite, decisions persist, audit events persist. The fast-path in `lib/mockParts.ts` is what makes the demo seamless without backend setup.

**Q: "What's next after this demo?"**
> Three tracks: (1) Phase 2 Datum — Ollama + Knowledge Graph + eval harness. (2) Hook 5 — daily digest cron. (3) Real STEP rendering via opencascade.js WASM (currently stubbed for click-testing).

---

## Pre-demo checklist

- [ ] `git pull` on main (everything's already on `origin/main`)
- [ ] Clear `frontend/.next` (cache corrupts after many edits — wipe to be safe)
- [ ] Frontend running: `cd frontend && npm run dev` → Ready in ~3s on `:3010`
- [ ] Backend running: `cd backend && .venv\Scripts\python -m uvicorn app.main:app --port 4000 --reload` → "Application startup complete"
- [ ] Open `http://localhost:3010` in Chrome, hard-refresh, log in
- [ ] Pre-visit each route in order so Next.js compiles each page (otherwise first hit is slow):
  - [ ] `/workspace`
  - [ ] `/projects/proj_turbo`
  - [ ] `/parts/demo_1`
  - [ ] `/parts/demo_2/what-changed`
  - [ ] `/audit`
- [ ] Open the architecture HTML in a second tab as a fallback reference
- [ ] Close any other heavy browser tabs (Babylon needs the GPU)

If anything 404s or hangs, the cure is always:

```powershell
Get-Process -Name python | Stop-Process -Force
Get-Process -Name node | Stop-Process -Force
Remove-Item -Recurse -Force frontend\.next
# then restart both servers
```

Total runtime ~7 minutes. Practice the click sequence twice. Good luck.
