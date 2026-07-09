/**
 * docTemplates — Quarter20-style multi-doc-type templates.
 *
 * Applied by clicking the Templates chip on the Doc canvas → picker →
 * confirm replace. The selected doc type also feeds a small label at the
 * top of the editor so a doc "knows what it is" (matches Quarter20's
 * "Work Instruction vs Maintenance vs Quality vs Field Ops" typing).
 *
 * Each template is plain HTML that round-trips through
 * `node.innerHTML = …` and is styled by the editor's existing typography
 * rules — no external CSS.
 */

export type DocTemplateId =
  | 'blank'
  | 'work-instructions'
  | 'design-review'
  | 'quality-check'
  | 'maintenance'
  | 'field-operations'

export interface DocTemplate {
  id: DocTemplateId
  label: string
  hint: string
  /** Two-letter chip abbreviation shown in the picker + the doc-type badge. */
  abbr: string
  /** Tailwind color name used for the type badge (primary / amber / rose / …) */
  tone: 'primary' | 'amber' | 'emerald' | 'sky' | 'violet' | 'slate'
  html: string
}

export const DOC_TEMPLATES: DocTemplate[] = [
  {
    id: 'blank',
    label: 'Blank document',
    hint: 'Start from an empty page',
    abbr: '—',
    tone: 'slate',
    html: '<p><br></p>',
  },

  {
    id: 'work-instructions',
    label: 'Work Instructions',
    hint: 'Step-by-step assembly / test / service procedure',
    abbr: 'WI',
    tone: 'primary',
    html: `
<h1>Work Instructions — [Part / Assembly Name]</h1>
<p><strong>Document ID:</strong> WI-000  ·  <strong>Rev:</strong> A  ·  <strong>Owner:</strong> [Name]  ·  <strong>Effective:</strong> [Date]</p>

<h2>Purpose</h2>
<p>Describe the procedure this document covers and the outcome the operator should achieve.</p>

<h2>Scope</h2>
<p>Which assemblies, lines, or product variants this WI applies to.</p>

<h2>Safety</h2>
<ul>
  <li>Required PPE: [safety glasses, gloves, hearing protection]</li>
  <li>Hazards: [pinch points, torque loads, chemicals]</li>
  <li>Lockout / tagout points: [energy sources to isolate]</li>
</ul>

<h2>Tools &amp; Materials</h2>
<ul>
  <li>[Tool 1] — [size / spec]</li>
  <li>[Tool 2] — [size / spec]</li>
  <li>[Part 1] — P/N [number], qty [n]</li>
  <li>[Consumable] — [thread-locker / grease / adhesive]</li>
</ul>

<h2>Procedure</h2>

<h3>Step 1 — [Short verb-first title]</h3>
<p>Detailed action. Reference specific torque values, orientations, and CAD callouts. Include a screenshot from the 3D viewer if it clarifies the geometry.</p>
<ul>
  <li>Torque: [N·m ± tolerance]</li>
  <li>Verify: [what "done" looks like]</li>
</ul>

<h3>Step 2 — [Next action]</h3>
<p>Action detail.</p>

<h3>Step 3 — [Next action]</h3>
<p>Action detail.</p>

<h2>Quality Checks</h2>
<ul class="checklist">
  <li>Fastener torque within spec</li>
  <li>No visible damage on mating surfaces</li>
  <li>Assembly matches CAD reference view</li>
</ul>

<h2>Sign-off</h2>
<p>Operator: _______________  Date: __________  ·  QA: _______________  Date: __________</p>
`,
  },

  {
    id: 'design-review',
    label: 'Design Review',
    hint: 'Agenda · participants · decisions · action items',
    abbr: 'DR',
    tone: 'sky',
    html: `
<h1>Design Review — [Assembly / Feature Name]</h1>
<p><strong>Meeting date:</strong> [Date]  ·  <strong>Facilitator:</strong> [Name]  ·  <strong>Stage:</strong> [Concept / Preliminary / Critical / Final]</p>

<h2>Participants</h2>
<ul>
  <li>[Name] — Design Lead</li>
  <li>[Name] — CAE / Analysis</li>
  <li>[Name] — Manufacturing</li>
  <li>[Name] — Quality</li>
  <li>[Name] — Supplier</li>
</ul>

<h2>Agenda</h2>
<ol>
  <li>Design intent recap (10 min)</li>
  <li>CAD walkthrough (15 min)</li>
  <li>Analysis results (10 min)</li>
  <li>DFM &amp; supply-chain feedback (15 min)</li>
  <li>Open issues &amp; decisions (10 min)</li>
</ol>

<h2>Design Intent</h2>
<p>Summarize the problem the design solves, key requirements, and constraints (weight, cost, cycle time, envelope, standards).</p>

<h2>CAD Walkthrough</h2>
<p>Insert screenshots from the 3D viewer for each major feature. Call out changes since the last review.</p>

<h2>Analysis Highlights</h2>
<ul>
  <li>FEA — max stress: [MPa] at [feature]</li>
  <li>Modal — first mode: [Hz]</li>
  <li>Thermal — steady-state ΔT: [K]</li>
  <li>Weight: [kg] vs target [kg]</li>
</ul>

<h2>DFM &amp; Supplier Feedback</h2>
<ul>
  <li>[Feature] — [manufacturability concern / suggestion]</li>
</ul>

<h2>Decisions</h2>
<ol>
  <li>[Decision + rationale + who approved]</li>
</ol>

<h2>Action Items</h2>
<ul class="checklist">
  <li>[Action] — Owner: [Name] — Due: [Date]</li>
  <li>[Action] — Owner: [Name] — Due: [Date]</li>
</ul>

<h2>Next Review</h2>
<p>[Date] — [Focus / gate criteria]</p>
`,
  },

  {
    id: 'quality-check',
    label: 'Quality Check',
    hint: 'Inspection points · tolerances · pass/fail',
    abbr: 'QC',
    tone: 'emerald',
    html: `
<h1>Quality Check — [Part / Assembly]</h1>
<p><strong>QC document:</strong> QC-000  ·  <strong>Rev:</strong> A  ·  <strong>P/N:</strong> [number]  ·  <strong>Applies to:</strong> [operation / gate]</p>

<h2>Inspection Method</h2>
<p>[Visual / dimensional (calipers, CMM) / functional test / go-no-go gauge]. Sample plan: [100% / AQL 1.0 / …].</p>

<h2>Reference Documents</h2>
<ul>
  <li>Drawing: [P/N] Rev [x]</li>
  <li>Standard: [ISO / ASME / AS9100 clause]</li>
  <li>Related WI: [WI-000]</li>
</ul>

<h2>Critical Characteristics</h2>
<ol>
  <li><strong>Dim A</strong> — nominal [x.xx mm], tolerance [±y.yy]  ·  method: [CMM]  ·  result: ☐ Pass ☐ Fail</li>
  <li><strong>Dim B</strong> — nominal [x.xx mm], tolerance [±y.yy]  ·  method: [caliper]  ·  result: ☐ Pass ☐ Fail</li>
  <li><strong>Surface finish</strong> — Ra ≤ [µm]  ·  method: [profilometer]  ·  result: ☐ Pass ☐ Fail</li>
  <li><strong>Torque check</strong> — [N·m ± tolerance]  ·  method: [torque wrench cal-ID]  ·  result: ☐ Pass ☐ Fail</li>
</ol>

<h2>Visual Checks</h2>
<ul class="checklist">
  <li>No cracks, burrs, or contamination on mating faces</li>
  <li>Part number legibly marked</li>
  <li>Correct plating / coating color and coverage</li>
  <li>Assembly complete per CAD reference</li>
</ul>

<h2>Non-Conformance Handling</h2>
<p>If any check fails: tag the part [Red], quarantine per procedure QP-000, and open an NCR referencing this QC.</p>

<h2>Inspector Sign-off</h2>
<p>Inspector: _______________  ·  Date: __________  ·  Serial / lot: __________</p>
`,
  },

  {
    id: 'maintenance',
    label: 'Maintenance Document',
    hint: 'Scheduled tasks · required tools · verification',
    abbr: 'MA',
    tone: 'amber',
    html: `
<h1>Maintenance Document — [Equipment / Assembly]</h1>
<p><strong>Interval:</strong> [Daily / Weekly / Monthly / 1000 hr]  ·  <strong>Estimated time:</strong> [min]  ·  <strong>Skill level:</strong> [1 / 2 / 3]</p>

<h2>Prerequisites</h2>
<ul>
  <li>Equipment powered down / LOTO applied</li>
  <li>Area cordoned off</li>
  <li>Prior work order closed</li>
</ul>

<h2>Tools &amp; Consumables</h2>
<ul>
  <li>[Tool] — [size]</li>
  <li>Lubricant: [spec, quantity]</li>
  <li>Wear part: P/N [x], qty [n]</li>
</ul>

<h2>Tasks</h2>

<h3>Task 1 — Inspect</h3>
<ul class="checklist">
  <li>Visual inspection of [component] for wear / damage</li>
  <li>Measure [dim / clearance] — expected [x ± y]</li>
</ul>

<h3>Task 2 — Service</h3>
<ol>
  <li>Remove [part] per WI-000</li>
  <li>Clean mating surfaces with [solvent]</li>
  <li>Apply [lubricant] to [surface]</li>
  <li>Reinstall to torque [N·m]</li>
</ol>

<h3>Task 3 — Test</h3>
<ul class="checklist">
  <li>Bring equipment online</li>
  <li>Verify [functional check] passes</li>
  <li>Log run-in period [minutes]</li>
</ul>

<h2>Sign-off &amp; Log</h2>
<p>Technician: _______________  ·  Date: __________  ·  Hours meter: __________  ·  Notes / anomalies: __________</p>

<h2>Next Due</h2>
<p>[Date] — schedule in CMMS as work order.</p>
`,
  },

  {
    id: 'field-operations',
    label: 'Field Operations',
    hint: 'Site info · safety · procedure · sign-off',
    abbr: 'FO',
    tone: 'violet',
    html: `
<h1>Field Operations Report — [Site / Job]</h1>
<p><strong>Site:</strong> [Address / customer]  ·  <strong>Date:</strong> [Date]  ·  <strong>Lead tech:</strong> [Name]  ·  <strong>Job #:</strong> [number]</p>

<h2>Site Details</h2>
<ul>
  <li>Access notes: [gate code / contact / hours]</li>
  <li>On-site contact: [Name, phone]</li>
  <li>Equipment / serial: [ID]</li>
</ul>

<h2>Safety Briefing</h2>
<ul class="checklist">
  <li>PPE confirmed on all crew members</li>
  <li>Site-specific hazards reviewed with customer</li>
  <li>Emergency contacts posted</li>
  <li>Escape route identified</li>
</ul>

<h2>Work Performed</h2>
<ol>
  <li>[Step] — result: [measurement / photo]</li>
  <li>[Step] — result: [measurement / photo]</li>
  <li>[Step] — result: [measurement / photo]</li>
</ol>

<h2>Findings / Issues</h2>
<ul>
  <li>[Observation + severity + recommended follow-up]</li>
</ul>

<h2>Parts Consumed</h2>
<ul>
  <li>P/N [x] — qty [n]</li>
</ul>

<h2>Customer Sign-off</h2>
<p>Customer representative: _______________  ·  Date: __________  ·  Signature: __________</p>
<p>Lead technician: _______________  ·  Date: __________  ·  Signature: __________</p>

<h2>Follow-up Actions</h2>
<ul class="checklist">
  <li>[Action, owner, due date]</li>
</ul>
`,
  },
]

export function findTemplate(id: string): DocTemplate | undefined {
  return DOC_TEMPLATES.find((t) => t.id === id)
}
