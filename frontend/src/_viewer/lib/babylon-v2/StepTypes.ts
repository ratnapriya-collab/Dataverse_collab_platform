/**
 * Proprietary - Copyright (c) 2026 datavers.ai. All rights reserved.
 * Contact: engineering@datavers.ai
 *
 * Shared STEP-result types consumed by the loader, cache, parseStepApi
 * client, and downstream renderer code. Previously co-located with the
 * in-browser Web Worker (StepWorker.ts) which is no longer shipped — the
 * types live here so they don't pull in worker code on import.
 *
 * Ported from dv-3d-viewer. Pure types — no runtime dependencies.
 */

import type { ViewPreset } from '../../types/viewer-v2'

/**
 * Metadata for one BREP face within a part's flat geometry arrays.
 * startIndex + vertexCount span the exact vertex range in the positions
 * array (OCC tessellates each face independently — no shared vertices
 * across face bounds).
 */
export interface FaceMeta {
  startIndex: number // first vertex index in the part's positions array
  vertexCount: number // number of vertices this face owns
  centroid: [number, number, number] // average vertex position (STEP-space)
  normal: [number, number, number] // area-weighted average face normal (unit vector)
  /**
   * Canonical analytic surface descriptor in the same frame as `centroid`.
   * Lets the diff engine do deterministic per-face equality (plane equation,
   * cylinder axis + radius, …) for the ~85% of CAD geometry with analytic
   * surfaces — no tolerance heuristics needed. Free-form surfaces
   * (`type='bspline'` or `'other'`) leave `params` empty and force the diff
   * to fall back to centroid/area heuristics.
   *
   * Optional because older IndexedDB-cached entries (parsed before backend
   * gained surface extraction) don't carry it.
   */
  surface?: FaceSurface
}

export type FaceSurfaceType =
  | 'plane' // params = [nx, ny, nz, d]                       (n·x = d)
  | 'cylinder' // params = [ox, oy, oz, dx, dy, dz, r]           (axis Ax1 + radius)
  | 'cone' // params = [apexX, apexY, apexZ, dx, dy, dz, halfAngle]
  | 'sphere' // params = [cx, cy, cz, r]
  | 'torus' // params = [cx, cy, cz, dx, dy, dz, majorR, minorR]
  | 'bspline' // params = []  (free-form; frontend falls back to heuristic)
  | 'other' // params = []  (unknown / unsupported)

export interface FaceSurface {
  type: FaceSurfaceType
  params: number[]
}

export interface StepPart {
  positions: Float32Array
  normals: Float32Array
  indices: Uint32Array
  name: string
  color: string | null // hex color from STEP file, null if not present
  instanceId: string // 'xcaf_N' for XCAF strategy; '' for others
  edgePositions: Float32Array // BREP edge polyline vertices (x,y,z per node)
  edgeIndices: Uint32Array // Line segment index pairs (i0,i1, i2,i3, …)
  edgeGroupStarts: Uint32Array // Index into edgeIndices (in pairs) where each BREP edge starts
  vertexPositions: Float32Array // BREP vertex (corner) positions (x,y,z per vertex)
  faces: FaceMeta[] // per-BREP-face metadata for PMI association + highlight
}

/** Node in the assembly tree. Leaf nodes have partIndex ≥ 0 (index into parts[]). */
export interface StepTreeNode {
  name: string
  partIndex: number // ≥0 = index into flat parts[]; -1 = assembly-only
  instanceId: string // same as StepPart.instanceId for leaves; '' for assemblies
  children: StepTreeNode[]
}

export interface ExtractionStats {
  strategy: 'xcaf' | 'text+geometry' | 'geometry-only'
  partCount: number
  namedCount: number // parts with non-generic names (not "Part N")
  coloredCount: number // parts with file-sourced colors
  totalTriangles: number
  bbox: { w: number; d: number; h: number } // raw STEP units (mm)
  parseTimeMs: number
  pmi?: { dim: number; tol: number; datum: number; note: number } // PMI annotation counts by type
}

/**
 * Server-side PMI shape. Distinct from the runtime PMIAnnotation in
 * types/viewer-v2 — this one carries STEP-space coordinates (which
 * StepLoader transforms to world space after buildMeshes runs).
 */
export interface PMIAnnotation {
  id: string
  type: 'dimension' | 'tolerance' | 'datum' | 'note'
  subtype: string
  symbol: string
  value: string
  datums: string[]
  meshName: string | null
  visible: boolean
  /** STEP-space from server; transformed to world-space by StepLoader. */
  anchorWorld: [number, number, number] | null
  normal: [number, number, number] | null
  readingDir: [number, number, number] | null
  upDir: [number, number, number] | null
  referencedFaceIdx: number | undefined
  /** STEP-space line geometry; transformed by StepLoader. */
  lineStrips: [number, number, number][][] | null
  /** STEP-space filled glyphs (AP242 ed2); transformed by StepLoader. */
  triMeshes:
    | { positions: [number, number, number][]; indices: number[] }[]
    | null
  calloutId: number | null
  views: string[]
  /** Nearest standard camera face (sign-aware, computed in StepLoader). */
  viewPreset: ViewPreset | null
}

export interface CameraView {
  /** STEP-space camera position (transformed to world by StepLoader). */
  eye: [number, number, number]
  /** STEP-space look-at point (transformed to world alongside eye). */
  target: [number, number, number]
  /** Camera's screen-up direction in world space. */
  up: [number, number, number]
}

export interface StepResult {
  parts: StepPart[]
  tree: StepTreeNode[]
  stats: ExtractionStats
  pmi: PMIAnnotation[]
  cameraViews: Record<string, CameraView>
}
