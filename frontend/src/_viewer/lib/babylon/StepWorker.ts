/**
 * Web Worker — runs OpenCASCADE WASM off the main thread.
 * Returns geometry parts (flat array) + assembly tree structure.
 *
 * Name/hierarchy reading strategy (tried in order):
 *   1. STEPCAFControl_Reader + XCAF tree walk
 *      — getLabelName uses TDF_AttributeIterator (avoids emscripten
 *        output-ref bug where FindAttribute doesn't propagate handle back)
 *   2. Text extraction from raw STEP bytes
 *      — parses PRODUCT_DEFINITION_FORMATION → PRODUCT chain
 *      — builds hierarchy from NEXT_ASSEMBLY_USAGE_OCCURRENCE
 *   3. "Part N" fallback
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let oc: any = null

async function initOC() {
  if (oc) return oc
  const mod = await import('opencascade.js')
  const initOpenCascade = mod.default
  if (typeof initOpenCascade !== 'function') throw new Error('opencascade.js default export is not a function')
  oc = await initOpenCascade()
  return oc
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface StepPart {
  positions:       Float32Array
  normals:         Float32Array
  indices:         Uint32Array
  name:            string
  color:           string | null   // hex color from STEP file, null if not present
  instanceId:      string          // 'xcaf_N' for XCAF strategy; '' for others
  edgePositions:   Float32Array    // BREP edge polyline vertices (x,y,z per node)
  edgeIndices:     Uint32Array     // Line segment index pairs (i0,i1, i2,i3, …)
  edgeGroupStarts: Uint32Array     // Index into edgeIndices (in pairs) where each BREP edge starts
}

/** Node in the assembly tree. Leaf nodes have partIndex ≥ 0 (index into parts[]). */
export interface StepTreeNode {
  name:       string
  partIndex:  number          // ≥0 = index into flat parts[]; -1 = assembly-only
  instanceId: string          // same as StepPart.instanceId for leaves; '' for assemblies
  children:   StepTreeNode[]
}

export interface ExtractionStats {
  strategy:       'xcaf' | 'text+geometry' | 'geometry-only'
  partCount:      number
  namedCount:     number        // parts with non-generic names (not "Part N")
  coloredCount:   number        // parts with file-sourced colors
  totalTriangles: number
  bbox:           { w: number; d: number; h: number }   // raw STEP units (mm)
  parseTimeMs:    number
}

export interface PMIAnnotation {
  id:       string
  type:     'dimension' | 'tolerance' | 'datum'
  symbol:   string
  value:    string
  datums:   string[]
  meshName: string | null
  visible:  boolean
}

export interface StepResult {
  parts: StepPart[]
  tree:  StepTreeNode[]       // top-level nodes (usually one root assembly)
  stats: ExtractionStats
  pmi:   PMIAnnotation[]
}

// ── BREP edge extraction ──────────────────────────────────────────────────────

/**
 * Extract BREP topology edges from face triangulations.
 *
 * BRepMesh_IncrementalMesh stores edge data as Poly_PolygonOnTriangulation
 * (per-face), NOT as Poly_Polygon3D. So BRep_Tool.Polygon3D always returns
 * a null handle after meshing — that approach doesn't work.
 *
 * Instead: for each face triangulation, find mesh edges used by exactly one
 * triangle (boundary edges of the face mesh). These are exactly the BREP edge
 * discretizations. Only uses BRep_Tool.Triangulation + Poly_Triangulation APIs
 * that are confirmed working in opencascade.js.
 *
 * Duplicate edges (each BREP edge borders two faces) are harmless — they render
 * on top of each other at identical positions.
 */
// Snap a float to a grid for deduplication keys (1e-4 world units ≈ 0.1mm)
const DEDUP_EPS = 1e-4
function snapKey(x: number, y: number, z: number): string {
  return `${(x / DEDUP_EPS) | 0},${(y / DEDUP_EPS) | 0},${(z / DEDUP_EPS) | 0}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractEdges(occ: any, shape: any): { positions: Float32Array; indices: Uint32Array; groupStarts: Uint32Array } {
  // Step 1: collect all per-face chains (each chain = one BREP edge on that face).
  // Each BREP edge borders two faces → appears as two nearly-identical chains.
  // Step 2: deduplicate by (endpoint_A_key, endpoint_B_key) — keep the chain
  // with more nodes (better resolution). Result = one group per real CAD edge.

  interface Chain { nodes: [number, number, number][] }  // world-space xyz per node

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allChains: Chain[] = []

  const faceExp = new occ.TopExp_Explorer_2(
    shape, occ.TopAbs_ShapeEnum.TopAbs_FACE, occ.TopAbs_ShapeEnum.TopAbs_SHAPE
  )
  while (faceExp.More()) {
    try {
      const face   = occ.TopoDS.Face_1(faceExp.Current())
      const loc    = new occ.TopLoc_Location_1()
      const triHnd = occ.BRep_Tool.Triangulation(face, loc, 0)

      if (!triHnd.IsNull()) {
        const tri  = triHnd.get()
        const trsf = loc.Transformation()
        const nbT  = tri.NbTriangles()

        // Find boundary mesh edges (used by exactly 1 triangle)
        const edgeUse = new Map<string, number>()
        for (let i = 1; i <= nbT; i++) {
          const t = tri.Triangle(i)
          const n = [t.Value(1), t.Value(2), t.Value(3)]
          t.delete()
          for (let j = 0; j < 3; j++) {
            const a = n[j], b = n[(j + 1) % 3]
            const key = a < b ? `${a}:${b}` : `${b}:${a}`
            edgeUse.set(key, (edgeUse.get(key) ?? 0) + 1)
          }
        }

        // Build adjacency from boundary segments
        const adj = new Map<number, number[]>()
        for (const [key, count] of edgeUse) {
          if (count !== 1) continue
          const sep = key.indexOf(':')
          const a = +key.slice(0, sep), b = +key.slice(sep + 1)
          if (!adj.has(a)) adj.set(a, [])
          if (!adj.has(b)) adj.set(b, [])
          adj.get(a)!.push(b)
          adj.get(b)!.push(a)
        }

        // Trace connected chains within this face
        const visited = new Set<number>()
        for (const [startNode] of adj) {
          if (visited.has(startNode)) continue

          // BFS to find all nodes in this component
          const component: number[] = []
          const queue = [startNode]
          visited.add(startNode)
          while (queue.length > 0) {
            const cur = queue.shift()!
            component.push(cur)
            for (const nb of adj.get(cur) ?? []) {
              if (!visited.has(nb)) { visited.add(nb); queue.push(nb) }
            }
          }
          if (component.length < 2) continue

          // Trace in order starting from a degree-1 node (end of chain)
          const degree = (n: number) => adj.get(n)?.length ?? 0
          const endNode = component.find(n => degree(n) === 1) ?? component[0]
          const ordered: number[] = [endNode]
          const cv = new Set<number>([endNode])
          let cur = endNode
          while (true) {
            const next = adj.get(cur)?.find(n => !cv.has(n))
            if (next === undefined) break
            ordered.push(next); cv.add(next); cur = next
          }
          if (ordered.length < 2) continue

          // Convert to world-space xyz
          const nodes: [number, number, number][] = ordered.map(ni => {
            const pt = tri.Node(ni)
            const t  = pt.Transformed(trsf)
            const xyz: [number, number, number] = [t.X(), t.Y(), t.Z()]
            t.delete(); pt.delete()
            return xyz
          })
          allChains.push({ nodes })
        }
      }
      loc.delete()
    } catch (_) { /* skip degenerate faces */ }
    faceExp.Next()
  }
  faceExp.delete()

  // Step 2: deduplicate chains by endpoint signature.
  // Two chains with the same (snapped start, snapped end) = same BREP edge.
  // Keep the one with more nodes (finer discretization).
  const bestByKey = new Map<string, Chain>()
  for (const chain of allChains) {
    const first = chain.nodes[0], last = chain.nodes[chain.nodes.length - 1]
    const kA = snapKey(...first), kB = snapKey(...last)
    const sig = kA < kB ? `${kA}|${kB}` : `${kB}|${kA}`
    const existing = bestByKey.get(sig)
    if (!existing || chain.nodes.length > existing.nodes.length) {
      bestByKey.set(sig, chain)
    }
  }

  // Step 3: flatten deduplicated chains into positions/indices/groupStarts
  const allPos:      number[] = []
  const allIdx:      number[] = []
  const groupStarts: number[] = []

  for (const chain of bestByKey.values()) {
    groupStarts.push(allIdx.length / 2)
    const base = allPos.length / 3
    for (const [x, y, z] of chain.nodes) allPos.push(x, y, z)
    for (let i = 0; i < chain.nodes.length - 1; i++) allIdx.push(base + i, base + i + 1)
  }

  return {
    positions:   new Float32Array(allPos),
    indices:     new Uint32Array(allIdx),
    groupStarts: new Uint32Array(groupStarts),
  }
}

// ── Triangulation ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTriangulation(occ: any, shape: any): { positions: number[]; normals: number[]; indices: number[] } {
  const allPositions: number[] = []
  const allNormals:   number[] = []
  const allIndices:   number[] = []
  let indexOffset = 0

  const faceExplorer = new occ.TopExp_Explorer_2(shape, occ.TopAbs_ShapeEnum.TopAbs_FACE, occ.TopAbs_ShapeEnum.TopAbs_SHAPE)
  while (faceExplorer.More()) {
    const face     = occ.TopoDS.Face_1(faceExplorer.Current())
    const location = new occ.TopLoc_Location_1()
    try {
      const triHandle = occ.BRep_Tool.Triangulation(face, location, 0)
      if (!triHandle.IsNull()) {
        const tri        = triHandle.get()
        const nbNodes    = tri.NbNodes()
        const nbTris     = tri.NbTriangles()
        const trsf       = location.Transformation()
        const isReversed = face.Orientation_1() === occ.TopAbs_Orientation.TopAbs_REVERSED

        for (let i = 1; i <= nbNodes; i++) {
          const node = tri.Node(i)
          const t    = node.Transformed(trsf)
          allPositions.push(t.X(), t.Y(), t.Z())
          allNormals.push(0, 0, 0)
          t.delete(); node.delete()
        }

        for (let i = 1; i <= nbTris; i++) {
          const triangle = tri.Triangle(i)
          let n1 = triangle.Value(1) - 1 + indexOffset
          let n2 = triangle.Value(2) - 1 + indexOffset
          let n3 = triangle.Value(3) - 1 + indexOffset
          triangle.delete()
          if (isReversed) { const tmp = n2; n2 = n3; n3 = tmp }
          allIndices.push(n1, n2, n3)

          const p1x = allPositions[n1*3], p1y = allPositions[n1*3+1], p1z = allPositions[n1*3+2]
          const p2x = allPositions[n2*3], p2y = allPositions[n2*3+1], p2z = allPositions[n2*3+2]
          const p3x = allPositions[n3*3], p3y = allPositions[n3*3+1], p3z = allPositions[n3*3+2]
          const ux = p2x-p1x, uy = p2y-p1y, uz = p2z-p1z
          const vx = p3x-p1x, vy = p3y-p1y, vz = p3z-p1z
          let nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx
          const len = Math.sqrt(nx*nx + ny*ny + nz*nz)
          if (len > 0) { nx /= len; ny /= len; nz /= len }
          if (isReversed) { nx = -nx; ny = -ny; nz = -nz }
          for (const idx of [n1, n2, n3]) {
            allNormals[idx*3] += nx; allNormals[idx*3+1] += ny; allNormals[idx*3+2] += nz
          }
        }
        indexOffset += nbNodes
      }
    } catch (_) { /* skip degenerate faces */ }
    location.delete()
    faceExplorer.Next()
  }
  faceExplorer.delete()

  for (let i = 0; i < allNormals.length; i += 3) {
    const len = Math.sqrt(allNormals[i]**2 + allNormals[i+1]**2 + allNormals[i+2]**2)
    if (len > 0) { allNormals[i] /= len; allNormals[i+1] /= len; allNormals[i+2] /= len }
  }
  return { positions: allPositions, normals: allNormals, indices: allIndices }
}

// ── XCAF label entry helper ───────────────────────────────────────────────────

/**
 * Return a stable unique string for a TDF_Label — the colon-separated tag path
 * from the document root, e.g. "0:1:1:3:2".
 *
 * Each component (instance) label in an XCAF assembly has a distinct entry path,
 * even when multiple instances share the same definition label (same geometry/name).
 * This makes it a reliable key for mesh ↔ tree-node mapping.
 *
 * Strategy A: TDF_Tool.Entry (output-ref parameter — may be no-op in emscripten).
 * Strategy B: Tag()/Father() walk — always available, no output-ref dependency.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getLabelEntry(occ: any, label: any): string {
  // Strategy A: TDF_Tool.Entry → TCollection_AsciiString output param
  try {
    const entry = new occ.TCollection_AsciiString_1()
    occ.TDF_Tool.Entry(label, entry)
    const s = (entry.ToCString() ?? '').trim()
    entry.delete()
    if (s) return s
  } catch (_) {}

  // Strategy B: walk Tag()/Father() up to the root label
  const tags: number[] = []
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cur: any = label
    for (let depth = 0; depth < 100; depth++) {
      tags.unshift(cur.Tag())
      if (cur.IsRoot()) break
      cur = cur.Father()
    }
  } catch (_) {}
  return tags.join(':')
}

// ── XCAF name helpers ─────────────────────────────────────────────────────────

/**
 * Read TDataStd_Name from a TDF_Label via TDF_AttributeIterator.
 *
 * We iterate attributes directly instead of using FindAttribute because
 * emscripten output-reference parameters for Handle types don't reliably
 * propagate writes back to JS — the handle comes back empty even when the
 * attribute exists.  TDF_AttributeIterator gives us direct attribute objects.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getLabelName(occ: any, label: any): string {
  // Strategy 1: TDF_AttributeIterator (allLevels=false → this label only)
  try {
    const iter = new occ.TDF_AttributeIterator_2(label, false)
    while (iter.More()) {
      const attr = iter.Value()
      if (attr) {
        try {
          // TDataStd_Name.Get() returns TCollection_ExtendedString which has ToCString()
          // Other attribute types either lack Get() or return non-string types.
          if (typeof attr.Get === 'function') {
            const val = attr.Get()
            if (val && typeof val.ToCString === 'function') {
              const s = (val.ToCString() ?? '').trim()
              if (s) { try { iter.delete() } catch (_) {}; return s }
            }
          }
        } catch (_) { /* not a string attribute */ }
      }
      iter.Next()
    }
    try { iter.delete() } catch (_) {}
  } catch (_) { /* TDF_AttributeIterator_2 may not exist in this OC.js build */ }

  // Strategy 2: FindAttribute with base Handle type (original approach)
  try {
    const h = new occ.Handle_TDF_Attribute_1()
    if (label.FindAttribute_1(occ.TDataStd_Name.GetID(), h) && !h.IsNull()) {
      const a = h.get()
      if (a && typeof a.Get === 'function') {
        return (a.Get().ToCString() ?? '').trim()
      }
    }
  } catch (_) {}

  return ''
}

/** Get name from label, falling back to the referred shape's label (for component instances). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveName(occ: any, label: any): string {
  let name = getLabelName(occ, label)
  if (!name) {
    try {
      const ref = new occ.TDF_Label()
      if (occ.XCAFDoc_ShapeTool.GetReferredShape(label, ref)) {
        name = getLabelName(occ, ref)
      }
      ref.delete()
    } catch (_) {}
  }
  return name
}

// ── XCAF color helpers ────────────────────────────────────────────────────────

/**
 * Query XCAFDoc_ColorTool for a label's surface/generic/curve color.
 * Returns a CSS hex string or null if no color is found.
 * Also checks the referred (definition) label for instanced components.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getLabelColor(occ: any, colorTool: any, label: any): string | null {
  const COLOR_TYPES = (() => {
    try {
      return [
        occ.XCAFDoc_ColorType.XCAFDoc_ColorSurf,
        occ.XCAFDoc_ColorType.XCAFDoc_ColorGen,
        occ.XCAFDoc_ColorType.XCAFDoc_ColorCurv,
      ]
    } catch (_) { return [] }
  })()

  const tryLabel = (lbl: any): string | null => {
    for (const ct of COLOR_TYPES) {
      try {
        const col = new occ.Quantity_ColorRGBA_1()
        const found = colorTool.get().GetColor_5(lbl, ct, col)
        if (found) {
          const rgb = col.GetRGB()
          const r = Math.round(Math.min(1, rgb.Red())   * 255).toString(16).padStart(2, '0')
          const g = Math.round(Math.min(1, rgb.Green()) * 255).toString(16).padStart(2, '0')
          const b = Math.round(Math.min(1, rgb.Blue())  * 255).toString(16).padStart(2, '0')
          col.delete()
          return `#${r}${g}${b}`
        }
        col.delete()
      } catch (_) {}
    }
    return null
  }

  // 1. Try the label itself
  const direct = tryLabel(label)
  if (direct) return direct

  // 2. Try the referred (definition) label — handles instanced components
  try {
    const ref = new occ.TDF_Label()
    if (occ.XCAFDoc_ShapeTool.GetReferredShape(label, ref)) {
      const refColor = tryLabel(ref)
      ref.delete()
      if (refColor) return refColor
    } else {
      ref.delete()
    }
  } catch (_) {}

  return null
}

// ── XCAF tree walker ──────────────────────────────────────────────────────────

/**
 * Recursively walk an XCAF label and build a StepTreeNode.
 * Geometry is collected into `allParts` (passed by reference).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildXCAFNode(occ: any, colorTool: any, label: any, allParts: StepPart[], fallbackIdx: { n: number }): StepTreeNode {
  const name = resolveName(occ, label)

  const isAssembly = (() => { try { return occ.XCAFDoc_ShapeTool.IsAssembly(label) } catch (_) { return false } })()

  if (isAssembly) {
    const compSeq = new occ.TDF_LabelSequence_1()
    occ.XCAFDoc_ShapeTool.GetComponents(label, compSeq, false)
    const children: StepTreeNode[] = []
    for (let i = 1; i <= compSeq.Length(); i++) {
      children.push(buildXCAFNode(occ, colorTool, compSeq.Value(i), allParts, fallbackIdx))
    }
    compSeq.delete()
    return { name: name || 'Assembly', partIndex: -1, instanceId: '', children }
  }

  // Leaf — extract geometry
  const color      = getLabelColor(occ, colorTool, label)
  const instanceId = `xcaf_${allParts.length}`
  const shape      = occ.XCAFDoc_ShapeTool.GetShape_2(label)
  new occ.BRepMesh_IncrementalMesh_2(shape, 0.1, false, 0.2, false)
  const { positions, normals, indices }                                          = extractTriangulation(occ, shape)
  const { positions: edgePositions, indices: edgeIndices, groupStarts: edgeGroupStarts } = extractEdges(occ, shape)
  shape.delete()

  if (positions.length === 0) {
    return { name: name || `Part ${++fallbackIdx.n}`, partIndex: -1, instanceId: '', children: [] }
  }

  const partIndex    = allParts.length
  const resolvedName = name || `Part ${++fallbackIdx.n}`
  allParts.push({
    name:          resolvedName,
    color,
    instanceId,
    positions:     new Float32Array(positions),
    normals:       new Float32Array(normals),
    indices:       new Uint32Array(indices),
    edgePositions,
    edgeIndices,
    edgeGroupStarts,
  })
  return { name: resolvedName, partIndex, instanceId, children: [] }
}

// ── XCAF reader ───────────────────────────────────────────────────────────────

type RawResult = { parts: StepPart[]; tree: StepTreeNode[] }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readWithXCAF(occ: any, fileName: string): RawResult {
  // GetApplication() registers XCAF attribute factories (TDataStd_Name etc.)
  try { occ.XCAFApp_Application.GetApplication() } catch (_) {}

  const docPtr    = new occ.TDocStd_Document(new occ.TCollection_ExtendedString_2('MDTV-CAF', false))
  const docHandle = new occ.Handle_TDocStd_Document_2(docPtr)

  const reader = new occ.STEPCAFControl_Reader_1()
  reader.SetNameMode(true)
  reader.SetColorMode(true)
  const status = reader.ReadFile(fileName)
  if (status !== occ.IFSelect_ReturnStatus.IFSelect_RetDone) {
    reader.delete(); docPtr.delete()
    throw new Error(`STEPCAFControl_Reader failed: ${status}`)
  }
  reader.Transfer_1(docHandle, new occ.Message_ProgressRange_1())
  reader.delete()

  const main      = docHandle.get().Main()
  const shapeTool = occ.XCAFDoc_DocumentTool.ShapeTool(main)
  const colorTool = occ.XCAFDoc_DocumentTool.ColorTool(main)
  const freeSeq   = new occ.TDF_LabelSequence_1()
  shapeTool.get().GetFreeShapes(freeSeq)

  const allParts: StepPart[]      = []
  const tree:     StepTreeNode[]  = []
  const fallbackIdx = { n: 0 }

  for (let i = 1; i <= freeSeq.Length(); i++) {
    tree.push(buildXCAFNode(occ, colorTool, freeSeq.Value(i), allParts, fallbackIdx))
  }
  freeSeq.delete()
  docPtr.delete()

  return { parts: allParts, tree }
}

// ── Text-based extraction (fallback) ─────────────────────────────────────────

interface TextTree {
  pdId:     number
  name:     string
  children: TextTree[]
}

interface NauoEntry {
  instanceName: string   // NAUO 'name' field — the instance label
  parent:       number   // relating PRODUCT_DEFINITION id
  child:        number   // related  PRODUCT_DEFINITION id
}

/**
 * Parse STEP bytes and return a full assembly tree with instance names.
 *
 * Instance names come from NAUO's own 'name' field (2nd argument) — this is
 * the actual instance label used by CAD tools, e.g. "B10X120 <1>". For files
 * where the same child PRODUCT_DEFINITION appears under multiple NAUO entries
 * (part reuse), each NAUO entry becomes its own tree node.
 *
 * Encoding: tries strict UTF-8 first, falls back to ISO-8859-1 so characters
 * like Ø (0xD8) are decoded correctly from Latin-1 STEP files.
 */
function extractTextTree(bytes: Uint8Array): TextTree[] | null {
  // Decode: strict UTF-8 first, ISO-8859-1 fallback (covers Latin-1 STEP files)
  let raw: string
  try { raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  catch (_) { raw = new TextDecoder('iso-8859-1').decode(bytes) }
  // Collapse continued lines (STEP entities can span multiple lines)
  const text = raw.replace(/\r?\n(?!\s*#)/g, ' ')
  let m: RegExpExecArray | null

  // ── Build PRODUCT name lookup first so we can resolve blank NAUO labels ──────
  //
  // Chain: PRODUCT_DEFINITION → PRODUCT_DEFINITION_FORMATION[*] → PRODUCT
  //
  // Variants handled:
  //   • PRODUCT_DEFINITION                            (AP203 / AP214 base)
  //   • PRODUCT_DEFINITION_WITH_ASSOCIATED_DOCUMENT   (AP242 — PD subtype)
  //   • PRODUCT_DEFINITION_FORMATION_WITH_SPECIFIED_SOURCE (SolidWorks AP203)
  //   • PRODUCT_DEFINITION_FORMATION                  (plain formation)
  //
  // PRODUCT args: ('name', 'id', description, contexts)
  //   Some exporters leave name='' and put the real label in 'id' (2nd arg).
  //   We prefer name; fall back to id if name is blank.

  // All PRODUCT_DEFINITION_FORMATION subtypes → PRODUCT id
  const pdfToProduct = new Map<number, number>()
  const pdfRx = /#(\d+)\s*=\s*PRODUCT_DEFINITION_FORMATION[^(]*\(\s*'[^']*'\s*,\s*'[^']*'\s*,\s*#(\d+)/gi
  while ((m = pdfRx.exec(text)) !== null) pdfToProduct.set(+m[1], +m[2])

  // PRODUCT_DEFINITION and its subtypes (WITH_ASSOCIATED_DOCUMENT etc.) → PDF id
  // Matches any entity starting with PRODUCT_DEFINITION followed by ( or a word
  // char then eventually ( — the 3rd argument is always the formation ref.
  const pdToPdf = new Map<number, number>()
  const pdRx = /#(\d+)\s*=\s*PRODUCT_DEFINITION\w*\s*\(\s*'[^']*'\s*,\s*'[^']*'\s*,\s*#(\d+)/gi
  while ((m = pdRx.exec(text)) !== null) pdToPdf.set(+m[1], +m[2])

  // PRODUCT ('name', 'id', ...) — use name; fall back to id if name blank
  const productName = new Map<number, string>()
  const productRx = /#(\d+)\s*=\s*PRODUCT\s*\(\s*'([^']*)'\s*,\s*'([^']*)'/gi
  while ((m = productRx.exec(text)) !== null) {
    const name = m[2].trim() || m[3].trim()
    if (name) productName.set(+m[1], name)
  }

  const nameForPD = (pdId: number): string => {
    const pdfId  = pdToPdf.get(pdId);       if (!pdfId)   return ''
    const prodId = pdfToProduct.get(pdfId);  if (!prodId)  return ''
    return productName.get(prodId) ?? ''
  }

  // NAUO: ('id', 'instanceName', 'desc', #parentPD, #childPD, ...)
  // Prefer the 2nd field (instance label) when non-blank; otherwise fall back
  // to the child PD's PRODUCT name. Many SolidWorks AP203 files leave the
  // instance label blank (' ') and rely on the PRODUCT name for display.
  const nauoEntries: NauoEntry[] = []
  const nauoRx = /NEXT_ASSEMBLY_USAGE_OCCURRENCE\s*\(\s*'[^']*'\s*,\s*'([^']*)'\s*,[^,]*,\s*#(\d+)\s*,\s*#(\d+)/gi
  while ((m = nauoRx.exec(text)) !== null) {
    const instanceLabel = m[1].trim()
    const childPD       = +m[3]
    const instanceName  = instanceLabel || nameForPD(childPD)
    nauoEntries.push({ instanceName, parent: +m[2], child: childPD })
  }
  if (nauoEntries.length === 0) return null

  // Group NAUO entries by parent PD
  const childrenByParent = new Map<number, NauoEntry[]>()
  const childPDs         = new Set<number>()
  for (const e of nauoEntries) {
    childPDs.add(e.child)
    if (!childrenByParent.has(e.parent)) childrenByParent.set(e.parent, [])
    childrenByParent.get(e.parent)!.push(e)
  }

  // Build tree: one node per NAUO entry so each instance is its own node.
  // Add <N> suffix only when the same resolved name appears multiple times
  // under one parent (i.e. genuine repeated instances like bolts).
  const buildNode = (pdId: number, displayName: string): TextTree => {
    const entries = childrenByParent.get(pdId) ?? []
    if (entries.length === 0) return { pdId, name: displayName, children: [] }

    // Count occurrences of each resolved name among direct children
    const freq = new Map<string, number>()
    for (const e of entries) freq.set(e.instanceName, (freq.get(e.instanceName) ?? 0) + 1)

    const counter = new Map<string, number>()
    const children = entries.map(e => {
      const cnt   = freq.get(e.instanceName) ?? 1
      const idx   = (counter.get(e.instanceName) ?? 0) + 1
      counter.set(e.instanceName, idx)
      const name  = cnt > 1 ? `${e.instanceName} <${idx}>` : e.instanceName
      return buildNode(e.child, name)
    })
    return { pdId, name: displayName, children }
  }

  // Root PDs = appear as parent in NAUO but never as a child
  const rootPDs = [...childrenByParent.keys()].filter(id => !childPDs.has(id))
  if (rootPDs.length === 0) return null

  return rootPDs.map(id => buildNode(id, nameForPD(id) || 'Assembly'))
}

// ── Text tree → StepResult ────────────────────────────────────────────────────

/**
 * Convert a TextTree (names + hierarchy, no geometry) and a flat geometry list
 * into a StepResult by matching leaf nodes to geometry parts in DFS order.
 */
function assignGeometryToTextTree(
  textNodes: TextTree[],
  geomParts: StepPart[],
  idx: { n: number },
): StepTreeNode[] {
  return textNodes.map(node => {
    if (node.children.length > 0) {
      return {
        name:       node.name,
        partIndex:  -1,
        instanceId: '',
        children:   assignGeometryToTextTree(node.children, geomParts, idx),
      }
    }
    // Leaf — assign next geometry slot; inherit instanceId from the geometry part
    const partIndex = idx.n < geomParts.length ? idx.n++ : -1
    if (partIndex >= 0) geomParts[partIndex] = { ...geomParts[partIndex], name: node.name }
    return {
      name:       node.name,
      partIndex,
      instanceId: partIndex >= 0 ? geomParts[partIndex].instanceId : '',
      children:   [],
    }
  })
}

// ── Geometry-only reader ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readGeometryOnly(occ: any, fileName: string): StepPart[] {
  const reader = new occ.STEPControl_Reader_1()
  const status = reader.ReadFile(fileName)
  if (status !== occ.IFSelect_ReturnStatus.IFSelect_RetDone) {
    reader.delete()
    throw new Error(`STEPControl_Reader failed: ${status}`)
  }
  reader.TransferRoots(new occ.Message_ProgressRange_1())
  const shape = reader.OneShape()
  reader.delete()

  new occ.BRepMesh_IncrementalMesh_2(shape, 0.1, false, 0.2, false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const solids: any[] = []
  const exp = new occ.TopExp_Explorer_2(shape, occ.TopAbs_ShapeEnum.TopAbs_SOLID, occ.TopAbs_ShapeEnum.TopAbs_SHAPE)
  while (exp.More()) { solids.push(exp.Current()); exp.Next() }
  exp.delete()

  const parts = solids.length > 0 ? solids : [shape]
  const result: StepPart[] = []

  parts.forEach((partShape: any, idx: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const { positions, normals, indices }                                                   = extractTriangulation(occ, partShape)
    if (positions.length === 0) return
    const { positions: edgePositions, indices: edgeIndices, groupStarts: edgeGroupStarts } = extractEdges(occ, partShape)
    result.push({
      name:          `Part ${idx + 1}`,
      color:         null,
      instanceId:    '',
      positions:     new Float32Array(positions),
      normals:       new Float32Array(normals),
      indices:       new Uint32Array(indices),
      edgePositions,
      edgeIndices,
      edgeGroupStarts,
    })
  })

  shape.delete()
  return result
}

/** True if every part has a generic "Part N" name. */
function allGenericNames(parts: StepPart[]): boolean {
  return parts.every(p => /^Part \d+$/.test(p.name))
}

// ── PMI / GD&T text extraction ────────────────────────────────────────────────

const TOLERANCE_SYMBOLS: Record<string, string> = {
  'flatness':              '⏥',
  'straightness':          '⏤',
  'circularity':           '○',
  'cylindricity':          '⌀',
  'perpendicularity':      '⊥',
  'angularity':            '∠',
  'parallelism':           '∥',
  'position':              '⊕',
  'concentricity':         '◎',
  'coaxiality':            '◎',
  'symmetry':              '⌯',
  'circular runout':       '↗',
  'total runout':          '⇗',
  'profile of a line':     '⌓',
  'profile of a surface':  '△',
}

const DIMENSION_SYMBOLS: Record<string, string> = {
  'diameter':              '⌀',
  'radius':                'R',
  'thickness':             '◁',
  'angular':               '∠',
  'linear distance':       '↔',
  'curve length':          '⌒',
}

let _pmiCounter = 0

/**
 * Extract PMI annotations from raw STEP bytes via text parsing.
 *
 * Targets STEP AP242 / AP203 PMI entities:
 *  - DIMENSIONAL_SIZE / DIMENSIONAL_LOCATION → dimension annotations
 *  - GEOMETRIC_TOLERANCE → GD&T tolerance frames
 *  - DATUM / DATUM_FEATURE → datum identifiers
 *
 * Part association: SHAPE_ASPECT → PRODUCT_DEFINITION_SHAPE → PRODUCT_DEFINITION
 * maps each annotation to a part index (used to look up meshName later).
 */
function extractPMI(bytes: Uint8Array, parts: StepPart[]): PMIAnnotation[] {
  let raw: string
  try { raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  catch (_) { raw = new TextDecoder('iso-8859-1').decode(bytes) }
  const text = raw.replace(/\r?\n(?!\s*#)/g, ' ')

  const pmi: PMIAnnotation[] = []
  let m: RegExpExecArray | null

  // ── Global measure value map: #id → numeric value ───────────────────────────
  // Handles complex entities: #id=(...MEASURE_WITH_UNIT(SOME_MEASURE(val),...))
  // and simple entities referencing a measure value.
  const measureMap = new Map<number, number>()
  const measureRx = /#(\d+)\s*=[^;]*?(?:LENGTH|PLANE_ANGLE)_MEASURE\s*\(\s*([-\d.eE+]+)\s*\)/gi
  while ((m = measureRx.exec(text)) !== null) {
    const val = parseFloat(m[2])
    if (!isNaN(val)) measureMap.set(+m[1], val)
  }

  // ── DIMENSIONAL_CHARACTERISTIC_REPRESENTATION: dimId → reprId ───────────────
  // Links DIMENSIONAL_SIZE/LOCATION entity id to the entity holding the measure
  const dcrMap = new Map<number, number>()
  const dcrRx = /DIMENSIONAL_CHARACTERISTIC_REPRESENTATION\s*\(\s*#(\d+)\s*,\s*#(\d+)/gi
  while ((m = dcrRx.exec(text)) !== null) dcrMap.set(+m[1], +m[2])

  // ── SHAPE_DIMENSION_REPRESENTATION: sdrId → first inner entity ref ───────────
  // The DCR reprId often points to a SHAPE_DIMENSION_REPRESENTATION, which in turn
  // references the actual measure entity in its items list: ('', (#measureId), #context)
  const sdrMap = new Map<number, number>()
  const sdrRx = /#(\d+)\s*=\s*SHAPE_DIMENSION_REPRESENTATION\s*\([^(]+\(\s*#(\d+)/gi
  while ((m = sdrRx.exec(text)) !== null) sdrMap.set(+m[1], +m[2])

  // ── SHAPE_ASPECT → PRODUCT_DEFINITION_SHAPE → PRODUCT_DEFINITION ──────────
  // Note: description field can be a quoted string OR '$' (STEP null) — handle both.
  const shapeToPD = new Map<number, number>()
  const saRx = /#(\d+)\s*=\s*SHAPE_ASPECT\s*\(\s*'[^']*'\s*,\s*(?:'[^']*'|\$)\s*,\s*#(\d+)/gi
  while ((m = saRx.exec(text)) !== null) shapeToPD.set(+m[1], +m[2])

  const pdToPdf  = new Map<number, number>()
  const pdRx2 = /#(\d+)\s*=\s*PRODUCT_DEFINITION\w*\s*\(\s*'[^']*'\s*,\s*(?:'[^']*'|\$)\s*,\s*#(\d+)/gi
  while ((m = pdRx2.exec(text)) !== null) pdToPdf.set(+m[1], +m[2])

  const pdfToProd = new Map<number, number>()
  const pdfRx = /#(\d+)\s*=\s*PRODUCT_DEFINITION_FORMATION[^(]*\(\s*'[^']*'\s*,\s*(?:'[^']*'|\$)\s*,\s*#(\d+)/gi
  while ((m = pdfRx.exec(text)) !== null) pdfToProd.set(+m[1], +m[2])

  const productName = new Map<number, string>()
  const prodRx = /#(\d+)\s*=\s*PRODUCT\s*\(\s*'([^']*)'\s*,\s*'([^']*)'/gi
  while ((m = prodRx.exec(text)) !== null) {
    const name = m[2].trim() || m[3].trim()
    if (name) productName.set(+m[1], name)
  }

  // PDS (PRODUCT_DEFINITION_SHAPE) → PD id
  const pdsToPd = new Map<number, number>()
  const pdsRx = /#(\d+)\s*=\s*PRODUCT_DEFINITION_SHAPE\s*\([^,]*,[^,]*,\s*#(\d+)/gi
  while ((m = pdsRx.exec(text)) !== null) pdsToPd.set(+m[1], +m[2])

  const meshNameForSA = (saId: number): string | null => {
    const pdsId = shapeToPD.get(saId)
    if (pdsId === undefined) return null
    const pdId = pdsToPd.get(pdsId)
    if (pdId === undefined) return null
    const pdfId  = pdToPdf.get(pdId)
    const prodId = pdfId ? pdfToProd.get(pdfId) : undefined
    const name   = prodId ? (productName.get(prodId) ?? '') : ''
    const part   = parts.find(p => p.name === name)
    return part ? (part.instanceId || part.name) : null
  }

  // Helper: get value for a dim entity via DCR → (optional SDR) → measure chain
  const dimValue = (dimId: number): number | undefined => {
    const reprId = dcrMap.get(dimId)
    if (reprId === undefined) return undefined
    // Direct measure entity (complex entity with MEASURE_WITH_UNIT)
    const direct = measureMap.get(reprId)
    if (direct !== undefined) return direct
    // Indirect: reprId is a SHAPE_DIMENSION_REPRESENTATION containing the measure ref
    const innerRef = sdrMap.get(reprId)
    return innerRef !== undefined ? measureMap.get(innerRef) : undefined
  }

  // ── DIMENSIONAL_SIZE: #id=DIMENSIONAL_SIZE(#shapeAspect,'name') ─────────────
  // AP242 actual format: only 2 args — no inline measure reference
  const dimSizeRx = /#(\d+)\s*=\s*DIMENSIONAL_SIZE\s*\(\s*#(\d+)\s*,\s*'([^']*)'\s*\)/gi
  while ((m = dimSizeRx.exec(text)) !== null) {
    const dimId = +m[1], saId = +m[2], name = m[3].trim()
    const val = dimValue(dimId)
    const nameLower = name.toLowerCase()
    const symbol = Object.entries(DIMENSION_SYMBOLS).find(([k]) => nameLower.includes(k))?.[1]
      ?? DIMENSION_SYMBOLS['linear distance']
    pmi.push({
      id: `pmi_${++_pmiCounter}`, type: 'dimension',
      symbol, value: val !== undefined ? `${val.toFixed(2)} mm` : name,
      datums: [], meshName: meshNameForSA(saId), visible: true,
    })
  }

  // ── DIMENSIONAL_LOCATION / ANGULAR_LOCATION ──────────────────────────────────
  // AP242 format: ('name',$,#sa1,#sa2) — name first, nulled second arg, SA refs 3rd/4th
  const dimLocRx = /#(\d+)\s*=\s*(DIMENSIONAL_LOCATION|ANGULAR_LOCATION)\s*\(\s*'([^']*)'\s*,\s*(?:\$|#\d+)\s*,\s*#(\d+)/gi
  while ((m = dimLocRx.exec(text)) !== null) {
    const dimId = +m[1], kind = m[2], name = m[3].trim(), saId = +m[4]
    const val = dimValue(dimId)
    const isAngle = kind === 'ANGULAR_LOCATION' || name.toLowerCase().includes('angle')
    const nameLower = name.toLowerCase()
    const symbol = isAngle ? '∠'
      : (Object.entries(DIMENSION_SYMBOLS).find(([k]) => nameLower.includes(k))?.[1]
         ?? DIMENSION_SYMBOLS['linear distance'])
    const display = val !== undefined
      ? `${val.toFixed(2)}${isAngle ? '°' : ' mm'}`
      : name
    pmi.push({
      id: `pmi_${++_pmiCounter}`, type: 'dimension',
      symbol, value: display, datums: [],
      meshName: meshNameForSA(saId), visible: true,
    })
  }

  // ── GEOMETRIC_TOLERANCE ───────────────────────────────────────────────────────
  // AP242 format: lives inside complex entity blocks (#id=(...GEOMETRIC_TOLERANCE(...)...))
  // After line-joining, the whole block is one line. Match GEOMETRIC_TOLERANCE directly.
  // NOTE: deliberately no #id= prefix so it matches both simple and complex entity forms.
  const geomTolRx = /GEOMETRIC_TOLERANCE\s*\(\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*#(\d+)/gi
  while ((m = geomTolRx.exec(text)) !== null) {
    const name = m[1].trim(), desc = m[2].trim(), tolValueId = +m[3]
    const val = measureMap.get(tolValueId) ?? null
    const nameLower = (name || desc).toLowerCase()
    const symbol = Object.entries(TOLERANCE_SYMBOLS).find(([k]) => nameLower.includes(k))?.[1] ?? '⊞'
    const display = val !== null ? `${val.toFixed(4).replace(/\.?0+$/, '')}` : name || desc
    pmi.push({
      id: `pmi_${++_pmiCounter}`, type: 'tolerance',
      symbol, value: display, datums: [],
      meshName: null, visible: true,
    })
  }

  // ── DATUM: #id=DATUM('',$,#ref,.F.,'A') — label is the last non-empty quoted string ──
  const datumRx = /#(\d+)\s*=\s*DATUM\s*\([^;]+;/gi
  while ((m = datumRx.exec(text)) !== null) {
    const block = m[0]
    const allQuoted = [...block.matchAll(/'([^']*)'/g)].map(q => q[1])
    const label = [...allQuoted].reverse().find(s => s.trim()) ?? ''
    if (!label) continue
    pmi.push({
      id: `pmi_${++_pmiCounter}`, type: 'datum',
      symbol: '▽', value: label, datums: [],
      meshName: null, visible: true,
    })
  }

  // Deduplicate exact (symbol + value + type) combos
  const seen = new Set<string>()
  const result = pmi.filter(a => {
    const key = `${a.type}|${a.symbol}|${a.value}`
    if (seen.has(key)) return false
    seen.add(key); return true
  })

  // Detect AP schema from header for diagnostics
  const schemaMatch = /FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/i.exec(text.slice(0, 2000))
  const schema = schemaMatch?.[1] ?? 'unknown'
  const hasDimSize  = /=\s*DIMENSIONAL_SIZE\s*\(/.test(text)   // avoid false positive from DIMENSIONAL_SIZE_WITH_CONSTRAINTS
  const hasDimLoc   = /=\s*DIMENSIONAL_LOCATION\s*\(/.test(text)
  const hasGeomTol  = /=\s*GEOMETRIC_TOLERANCE\s*\(/.test(text)
  const hasDatum    = /=\s*DATUM\s*\(/.test(text)
  console.info('[PMI] schema:', schema,
    '| DIMENSIONAL_SIZE:', hasDimSize,
    '| DIMENSIONAL_LOCATION:', hasDimLoc,
    '| GEOMETRIC_TOLERANCE:', hasGeomTol,
    '| DATUM:', hasDatum,
    '| extracted:', result.length)

  return result
}

/** Compute centroid of a positions array as a rounded string key. */
function centroidKey(positions: Float32Array): string {
  let x = 0, y = 0, z = 0
  const n = positions.length / 3
  if (n === 0) return '0,0,0'
  for (let i = 0; i < positions.length; i += 3) { x += positions[i]; y += positions[i+1]; z += positions[i+2] }
  // Round to 2 decimal places — enough precision to match same-position parts across XCAF and readGeometryOnly
  return `${(x/n).toFixed(2)},${(y/n).toFixed(2)},${(z/n).toFixed(2)}`
}

/**
 * Apply XCAF colors to geometry parts.
 * When counts match, apply 1:1 by index (fast path).
 * When counts differ (XCAF deduplicates instances), match by centroid — each
 * geometry-only part looks up the XCAF part whose centroid is closest.
 */
function applyXcafColors(xcafParts: StepPart[], geomParts: StepPart[]): void {
  if (xcafParts.length === 0) return

  if (xcafParts.length === geomParts.length) {
    // Fast path: same count, apply 1:1
    geomParts.forEach((p, i) => { p.color = xcafParts[i].color })
    return
  }

  // Slow path: match by centroid
  const xcafByKey = new Map<string, string | null>()
  for (const p of xcafParts) xcafByKey.set(centroidKey(p.positions), p.color)

  for (const p of geomParts) {
    const color = xcafByKey.get(centroidKey(p.positions))
    if (color !== undefined) p.color = color
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

function computeStats(
  parts: StepPart[],
  strategy: ExtractionStats['strategy'],
  parseTimeMs: number,
): ExtractionStats {
  let namedCount   = 0
  let coloredCount = 0
  let totalTriangles = 0
  let minX = Infinity, minY = Infinity, minZ = Infinity
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

  for (const p of parts) {
    if (!/^Part \d+$/.test(p.name)) namedCount++
    if (p.color !== null) coloredCount++
    totalTriangles += p.indices.length / 3
    for (let i = 0; i < p.positions.length; i += 3) {
      const x = p.positions[i], y = p.positions[i + 1], z = p.positions[i + 2]
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z
    }
  }

  const round1 = (v: number) => Math.round(v * 10) / 10
  const bbox = parts.length > 0 && isFinite(maxX)
    ? { w: round1(maxX - minX), d: round1(maxY - minY), h: round1(maxZ - minZ) }
    : { w: 0, d: 0, h: 0 }

  return {
    strategy,
    partCount:      parts.length,
    namedCount,
    coloredCount,
    totalTriangles: Math.round(totalTriangles),
    bbox,
    parseTimeMs:    Math.round(parseTimeMs),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function processSTEP(occ: any, fileBytes: Uint8Array): StepResult {
  const fileName = '/model.step'
  try { occ.FS.unlink(fileName) } catch (_) {}
  occ.FS.createDataFile('/', 'model.step', fileBytes, true, true, true)

  // Pre-parse text tree and PMI (cheap — no OC WASM cost)
  let textTree: TextTree[] | null = null
  try { textTree = extractTextTree(fileBytes) } catch (_) {}

  const t0 = Date.now()

  try {
    // ── Strategy 1: XCAF reader (only when it produces real names) ──────────
    let xcafParts: StepPart[] = []
    try {
      const result = readWithXCAF(occ, fileName)
      if (result.parts.length > 0 && !allGenericNames(result.parts)) {
        const stats = computeStats(result.parts, 'xcaf', Date.now() - t0)
        const pmi   = extractPMI(fileBytes, result.parts)
        return { ...result, stats, pmi }
      }
      xcafParts = result.parts
    } catch (err) {
      console.warn('[StepWorker] XCAF reader failed:', err)
    }

    // ── Strategy 2: text tree + geometry reader ───────────────────────────────
    if (textTree) {
      try {
        const geomParts = readGeometryOnly(occ, fileName)
        if (geomParts.length > 0) {
          applyXcafColors(xcafParts, geomParts)
          const geomCopy = [...geomParts]
          const tree  = assignGeometryToTextTree(textTree, geomCopy, { n: 0 })
          const stats = computeStats(geomCopy, 'text+geometry', Date.now() - t0)
          const pmi   = extractPMI(fileBytes, geomCopy)
          return { parts: geomCopy, tree, stats, pmi }
        }
      } catch (err) {
        console.warn('[StepWorker] Text + geometry fallback failed:', err)
      }
    }

    // ── Strategy 3: geometry only, flat "Part N" names ────────────────────────
    const geomParts = readGeometryOnly(occ, fileName)
    const stats = computeStats(geomParts, 'geometry-only', Date.now() - t0)
    const pmi   = extractPMI(fileBytes, geomParts)
    return {
      parts: geomParts,
      tree:  geomParts.map((p, i) => ({ name: p.name, partIndex: i, instanceId: '', children: [] })),
      stats,
      pmi,
    }
  } finally {
    try { occ.FS.unlink(fileName) } catch (_) {}
  }
}

self.onmessage = async (e: MessageEvent) => {
  const { bytes } = e.data as { bytes: Uint8Array }
  try {
    const occ    = await initOC()
    const result = processSTEP(occ, bytes)

    // ── Debug: validate name-geometry mapping ────────────────────────────────
    console.log(`[StepWorker] strategy=${result.stats.strategy} parts=${result.parts.length}`)
    console.log('[StepWorker] parts:', JSON.stringify(
      result.parts.map((p, i) => ({ i, name: p.name, instanceId: p.instanceId, color: p.color })),
      null, 2
    ))
    // ─────────────────────────────────────────────────────────────────────────

    const transfers: Transferable[] = result.parts.flatMap(p => [p.positions.buffer, p.normals.buffer, p.indices.buffer])
    ;(self as unknown as Worker).postMessage({ ok: true, parts: result.parts, tree: result.tree, stats: result.stats, pmi: result.pmi }, transfers)
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
