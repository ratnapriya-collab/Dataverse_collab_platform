/**
 * viewer-v2 types — richer viewer type surface ported from
 * dv-3d-viewer (Datavers.ai). These run alongside the existing
 * types/viewer.ts during the engine port.
 *
 * Both can coexist — `viewer.ts` is what the current /parts/[id]
 * page imports; `viewer-v2.ts` is what the new lib/babylon-v2/*
 * managers import. Once Phase 5 swaps the page over, viewer.ts
 * can be deleted.
 *
 * Differences from viewer.ts:
 *   · MeasureTool gains `min-distance`, `face-distance`, `edge-distance`
 *   · MeasurementEntry gains optional `labels[]` for multi-anchor labels
 *     (e.g. min + max for min-distance)
 *   · PMIAnnotation gains subtype, world-space geometry (anchor / normal
 *     / readingDir / upDir / lineStrips / triMeshes), callout grouping,
 *     view associations, and per-callout view preset
 *   · Adds SectionClipMode, HatchSettings, SectionPlanes (with defaults),
 *     WorkStep — concepts the original types/viewer.ts didn't model
 */

import type { AbstractMesh, Vector3 } from '@babylonjs/core'

export type ShadingMode = 'shaded' | 'wireframe' | 'shadedEdges'

export type CameraMode = 'perspective' | 'orthographic'

export type ViewPreset = 'FRONT' | 'BACK' | 'RIGHT' | 'LEFT' | 'TOP' | 'BOTTOM' | 'ISO'

export type MeasureTool =
  | 'distance'
  | 'min-distance'
  | 'face-distance'
  | 'edge-distance'
  | 'edge-length'
  | 'face-area'
  | 'angle'
  | 'radius'

export type SectionClipMode = 'intersection' | 'section-box'

export interface MeasurementLabel {
  text: string
  anchor: Vector3
}

export interface MeasurementEntry {
  id: string
  type:
    | 'point-to-point'
    | 'face-area'
    | 'angle'
    | 'radius'
    | 'face-distance'
    | 'edge-distance'
  points: Vector3[] // [p1, p2] for distance/angle; [centroid] for area/radius
  midpoint: Vector3 // label anchor in world space (used when labels is absent)
  value: number // raw value (world units, world units², degrees, world units)
  display: string // formatted string shown in UI and viewport
  meshes: AbstractMesh[]
  labels?: MeasurementLabel[] // multiple labels at distinct anchors (e.g. min + max)
}

export interface SelectionInfo {
  meshName: string
  width: number
  depth: number
  height: number
}

export interface PMIAnnotation {
  id: string
  type: 'dimension' | 'tolerance' | 'datum' | 'note'
  /** STEP keyword, e.g. 'DIMENSIONAL_SIZE', 'PERPENDICULARITY', 'DATUM'. */
  subtype: string
  symbol: string
  value: string
  datums: string[]
  meshName: string | null
  visible: boolean
  /** World-space anchor; transformed by StepLoader after buildMeshes. */
  anchorWorld: [number, number, number] | null
  /** Annotation plane normal (unit vector). */
  normal: [number, number, number] | null
  /** Annotation plane xAxis — text reading direction (world). */
  readingDir: [number, number, number] | null
  /** Annotation plane yAxis — text baseline-up direction (world). */
  upDir: [number, number, number] | null
  /** Index into FaceMeta[] stored on mesh.metadata.faces. */
  referencedFaceIdx: number | undefined
  /** World-space line geometry (TESSELLATED_CURVE_SET). */
  lineStrips: [number, number, number][][] | null
  /** World-space filled glyphs (COMPLEX_TRIANGULATED_SURFACE_SET, AP242 ed2). */
  triMeshes:
    | { positions: [number, number, number][]; indices: number[] }[]
    | null
  /** Groups related annotations (dimension + tolerance + datum). */
  calloutId: number | null
  /** DRAUGHTING_MODEL view names (e.g. 'MBD_A', 'MBD_B'). */
  views: string[]
  /** Nearest standard camera face (computed from plane normal in StepLoader). */
  viewPreset: ViewPreset | null
}

export type HatchMode =
  | 'diagonal45'
  | 'diagonal135'
  | 'horizontal'
  | 'vertical'
  | 'cross'
  | 'diagCross'

export interface HatchSettings {
  mode: HatchMode
  /** Whether to render hatch pattern (default true). */
  tilingEnabled: boolean
  /** Line frequency (default 500). */
  tiling: number
  /** Line width fraction (default 0.05). */
  thickness: number
  /** Overall opacity (default 1.0). */
  intensity: number
  /** CSS hex — hatch line color (default '#000000'). */
  color: string
}

export const DEFAULT_HATCH_SETTINGS: HatchSettings = {
  mode: 'diagonal45',
  tilingEnabled: true,
  tiling: 500,
  thickness: 0.05,
  intensity: 1.0,
  color: '#000000',
}

export interface SectionPlaneState {
  enabled: boolean
  flipped: boolean
  /** -1 to +1, mapped to model bounds by SectionController. */
  offset: number
  /** CSS hex — cap fill background color. */
  bgColor: string
}

export interface SectionPlanes {
  /** Clips along Z axis (normal ±Z) — top/bottom cut. */
  XY: SectionPlaneState
  /** Clips along X axis (normal ±X) — left/right cut. */
  YZ: SectionPlaneState
  /** Clips along Y axis (normal ±Y) — front/back cut. */
  ZX: SectionPlaneState
}

// Cap colours follow the RGB ↔ XYZ axis convention: each cap is tinted
// with its plane normal's axis color, so a red cap visually says "this
// cut is perpendicular to X" without checking the panel.
export const DEFAULT_SECTION_PLANES: SectionPlanes = {
  XY: { enabled: false, flipped: false, offset: 0, bgColor: '#2f6dbf' }, // blue  — normal ±Z
  YZ: { enabled: false, flipped: false, offset: 0, bgColor: '#c63838' }, // red   — normal ±X
  ZX: { enabled: false, flipped: false, offset: 0, bgColor: '#1f9b4f' }, // green — normal ±Y
}

export interface TreeNode {
  id: string
  name: string
  /** Babylon mesh name; null for assembly-only nodes. */
  meshName: string | null
  /** CSS hex color from material; '' for assemblies. */
  color: string
  visible: boolean
  children: TreeNode[]
}

/**
 * Work-instructions step: a single frame in an authored assembly
 * walkthrough. Captures the viewpoint, the currently-selected parts, and
 * a free-form note so the sequence can later be replayed (or published
 * as an embed link a non-CAD viewer can click through).
 */
export interface WorkStep {
  id: string
  title: string
  note: string
  camera: {
    eye: [number, number, number]
    target: [number, number, number]
    up: [number, number, number]
  }
  selectedMeshNames: string[]
  createdAt: number
}
