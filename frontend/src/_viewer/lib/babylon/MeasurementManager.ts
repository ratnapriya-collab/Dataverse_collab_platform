import type { Scene, AbstractMesh } from '@babylonjs/core'
import { Vector3, MeshBuilder, StandardMaterial, Color3, Color4 } from '@babylonjs/core'
import type { MeasurementEntry } from '../../types/viewer'
import type { FaceData, MinDistResult, BrepEdgeResult } from './FacePicker'
import { createFaceHighlight } from './FacePicker'

let counter = 0

// ── Shared helpers ─────────────────────────────────────────────────────────────

export function createPickMarker(scene: Scene, position: Vector3, name: string): AbstractMesh {
  const sphere = MeshBuilder.CreateSphere(name, { diameter: 0.08 }, scene) as AbstractMesh
  sphere.position = position.clone()
  const mat = new StandardMaterial(`${name}_mat`, scene)
  mat.diffuseColor = Color3.FromHexString('#00d4ff')
  mat.emissiveColor = Color3.FromHexString('#00d4ff').scale(0.5)
  sphere.material = mat
  sphere.isPickable = false
  sphere.renderingGroupId = 1
  return sphere
}

export function createLeaderLine(scene: Scene, p1: Vector3, p2: Vector3, name: string): AbstractMesh {
  const c = new Color4(0, 0.83, 1, 1)
  const line = MeshBuilder.CreateLines(name, { points: [p1, p2], colors: [c, c] }, scene) as AbstractMesh
  line.isPickable = false
  line.renderingGroupId = 1
  return line
}

// ── Format helpers ─────────────────────────────────────────────────────────────

function fmtLength(worldUnits: number): string {
  const mm = worldUnits * 1000
  return mm >= 100 ? `${(mm / 10).toFixed(1)} cm` : `${mm.toFixed(2)} mm`
}

function fmtArea(worldUnits2: number): string {
  const mm2 = worldUnits2 * 1e6
  return mm2 >= 100 ? `${(mm2 / 100).toFixed(2)} cm²` : `${mm2.toFixed(2)} mm²`
}

// ── Distance ───────────────────────────────────────────────────────────────────

export function buildMeasurement(
  scene: Scene,
  p1: Vector3, p2: Vector3,
  marker1: AbstractMesh, marker2: AbstractMesh,
): MeasurementEntry {
  const id       = `measure_${++counter}`
  const distance = Vector3.Distance(p1, p2)
  const midpoint = Vector3.Center(p1, p2)
  const leader   = createLeaderLine(scene, p1, p2, `${id}_line`)
  return {
    id, type: 'point-to-point',
    points: [p1, p2], midpoint,
    value: distance, display: fmtLength(distance),
    meshes: [marker1, marker2, leader],
  }
}

// ── Face Area ──────────────────────────────────────────────────────────────────

export function buildFaceAreaMeasurement(
  scene: Scene,
  mesh:  AbstractMesh,
  face:  FaceData,
): MeasurementEntry {
  const id      = `measure_${++counter}`
  const overlay = createFaceHighlight(scene, mesh, face, `${id}_overlay`, new Color3(0.15, 0.65, 1.0))
  return {
    id, type: 'face-area',
    points:   [face.centroid],
    midpoint: face.centroid,
    value:    face.area,
    display:  fmtArea(face.area),
    meshes:   [overlay],
  }
}

// ── Angle ──────────────────────────────────────────────────────────────────────

export function buildAngleMeasurement(
  scene:  Scene,
  mesh1:  AbstractMesh, face1: FaceData,
  mesh2:  AbstractMesh, face2: FaceData,
): MeasurementEntry {
  const id       = `measure_${++counter}`
  const dot      = Math.max(-1, Math.min(1, Vector3.Dot(face1.normal, face2.normal)))
  const angleDeg = Math.acos(Math.abs(dot)) * (180 / Math.PI)

  const overlay1 = createFaceHighlight(scene, mesh1, face1, `${id}_ov1`, new Color3(0.15, 0.65, 1.0))
  const overlay2 = createFaceHighlight(scene, mesh2, face2, `${id}_ov2`, new Color3(1.0, 0.55, 0.1))

  // Label anchor = midpoint between the two face centroids
  const midpoint = Vector3.Center(face1.centroid, face2.centroid)

  return {
    id, type: 'angle',
    points:   [face1.centroid, face2.centroid],
    midpoint,
    value:    angleDeg,
    display:  `${angleDeg.toFixed(1)}°`,
    meshes:   [overlay1, overlay2],
  }
}

// ── Minimum Distance ───────────────────────────────────────────────────────────

export function buildMinDistMeasurement(
  scene:   Scene,
  mesh1:   AbstractMesh, face1: FaceData,
  mesh2:   AbstractMesh, face2: FaceData,
  result:  MinDistResult,
): MeasurementEntry {
  const id      = `measure_${++counter}`
  const marker1 = createPickMarker(scene, result.p1, `${id}_m1`)
  const marker2 = createPickMarker(scene, result.p2, `${id}_m2`)
  const leader  = createLeaderLine(scene, result.p1, result.p2, `${id}_line`)
  const ov1     = createFaceHighlight(scene, mesh1, face1, `${id}_ov1`, new Color3(0.15, 0.65, 1.0))
  const ov2     = createFaceHighlight(scene, mesh2, face2, `${id}_ov2`, new Color3(1.0, 0.55, 0.1))
  return {
    id, type: 'point-to-point',
    points:   [result.p1, result.p2],
    midpoint: Vector3.Center(result.p1, result.p2),
    value:    result.distance,
    display:  `min ${fmtLength(result.distance)}`,
    meshes:   [marker1, marker2, leader, ov1, ov2],
  }
}

// ── Edge Length ────────────────────────────────────────────────────────────────

export function buildEdgeLengthMeasurement(
  scene:  Scene,
  result: BrepEdgeResult,
): MeasurementEntry {
  const id  = `measure_${++counter}`
  const c   = new Color4(0.2, 1.0, 0.4, 1.0)
  const pts = result.points
  // Highlight the edge with a bright line
  const line = MeshBuilder.CreateLines(`${id}_edge`, {
    points: pts,
    colors: pts.map(() => c),
  }, scene) as AbstractMesh
  line.isPickable      = false
  line.renderingGroupId = 2
  // Endpoint markers
  const m1 = createPickMarker(scene, pts[0],              `${id}_m1`)
  const m2 = createPickMarker(scene, pts[pts.length - 1], `${id}_m2`)
  return {
    id, type: 'point-to-point',
    points:   [pts[0], pts[pts.length - 1]],
    midpoint: result.midpoint,
    value:    result.length,
    display:  fmtLength(result.length),
    meshes:   [line, m1, m2],
  }
}

// ── Radius ─────────────────────────────────────────────────────────────────────

export function buildRadiusMeasurement(
  scene: Scene,
  mesh:  AbstractMesh,
  face:  FaceData,
): MeasurementEntry | null {
  if (face.radius === null) return null
  const id      = `measure_${++counter}`
  const overlay = createFaceHighlight(scene, mesh, face, `${id}_overlay`, new Color3(0.2, 1.0, 0.5))
  const display = `R ${fmtLength(face.radius)}  ⌀ ${fmtLength(face.radius * 2)}`
  return {
    id, type: 'radius',
    points:   [face.centroid],
    midpoint: face.centroid,
    value:    face.radius,
    display,
    meshes:   [overlay],
  }
}
