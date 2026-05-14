/**
 * FacePicker — detects which BREP face a picked triangle belongs to and
 * computes geometric properties of that face.
 *
 * Key insight: OCC (opencascade.js) tessellates each BREP face independently
 * — no shared vertex indices across face boundaries. So vertex-index BFS flood
 * fill = exact BREP face detection. No normal-epsilon heuristics needed.
 */
import type { AbstractMesh } from '@babylonjs/core'
import { Vector3, VertexBuffer, Mesh, VertexData, StandardMaterial, Color3 } from '@babylonjs/core'
import type { Scene } from '@babylonjs/core'

export interface FaceData {
  triangleIndices: number[]   // triangle IDs within the mesh
  normal:          Vector3    // area-weighted average normal (world space)
  centroid:        Vector3    // area-weighted centroid (world space)
  area:            number     // surface area in world units²
  radius:          number | null  // non-null when a cylindrical face is detected
}

// Cache adjacency structure per mesh instance (invalidated automatically when mesh is GC'd)
const adjacencyCache = new WeakMap<AbstractMesh, {
  vertToTris: Map<number, number[]>
  positions:  Float32Array
  indices:    ArrayLike<number>
}>()

function getAdjacency(mesh: AbstractMesh) {
  if (adjacencyCache.has(mesh)) return adjacencyCache.get(mesh)!

  const positions = mesh.getVerticesData(VertexBuffer.PositionKind) as Float32Array
  const indices   = mesh.getIndices()!
  const numTris   = indices.length / 3

  const vertToTris = new Map<number, number[]>()
  for (let t = 0; t < numTris; t++) {
    for (let j = 0; j < 3; j++) {
      const v = indices[t * 3 + j]
      let list = vertToTris.get(v)
      if (!list) { list = []; vertToTris.set(v, list) }
      list.push(t)
    }
  }

  const data = { vertToTris, positions, indices }
  adjacencyCache.set(mesh, data)
  return data
}

/** Transform a vertex index to world-space Vector3 */
function worldPt(positions: Float32Array, vi: number, wm: ReturnType<AbstractMesh['getWorldMatrix']>): Vector3 {
  return Vector3.TransformCoordinates(
    new Vector3(positions[vi * 3], positions[vi * 3 + 1], positions[vi * 3 + 2]),
    wm,
  )
}

export function pickFace(mesh: AbstractMesh, pickedTriangleId: number): FaceData {
  const { vertToTris, positions, indices } = getAdjacency(mesh)
  const wm = mesh.getWorldMatrix()

  // ── BFS flood fill ─────────────────────────────────────────────────────────
  // Since OCC face tessellations share no vertex indices across BREP face
  // boundaries, this naturally finds exactly the one BREP face.
  const faceSet = new Set<number>([pickedTriangleId])
  const queue   = [pickedTriangleId]

  while (queue.length > 0) {
    const t = queue.shift()!
    for (let j = 0; j < 3; j++) {
      const v = indices[t * 3 + j]
      for (const nb of vertToTris.get(v) ?? []) {
        if (!faceSet.has(nb)) {
          faceSet.add(nb)
          queue.push(nb)
        }
      }
    }
  }

  const triangleIndices = Array.from(faceSet)

  // ── Area, centroid, normal ─────────────────────────────────────────────────
  let area       = 0
  const sumN     = new Vector3(0, 0, 0)
  const sumC     = new Vector3(0, 0, 0)

  for (const t of triangleIndices) {
    const p0 = worldPt(positions, indices[t * 3],     wm)
    const p1 = worldPt(positions, indices[t * 3 + 1], wm)
    const p2 = worldPt(positions, indices[t * 3 + 2], wm)
    const cross   = Vector3.Cross(p1.subtract(p0), p2.subtract(p0))
    const triArea = cross.length() * 0.5
    area     += triArea
    sumN.addInPlace(cross)                             // magnitude ∝ 2×triArea (area-weighted)
    sumC.addInPlace(p0.add(p1).add(p2).scale(triArea / 3))
  }

  const normal   = sumN.length()  > 1e-10 ? sumN.normalize()        : Vector3.Up()
  const centroid = area           > 1e-10 ? sumC.scale(1 / area)    : Vector3.Zero()

  // ── Radius detection ───────────────────────────────────────────────────────
  const radius = triangleIndices.length >= 6
    ? detectCylinderRadius(triangleIndices, indices, positions, wm, normal)
    : null

  return { triangleIndices, normal, centroid, area, radius }
}

/**
 * If the face is cylindrical (normals rotate around a common axis), return
 * the radius. Otherwise return null.
 *
 * Method:
 *  1. Sample triangle normals; if they're all nearly equal → flat → null.
 *  2. Cross-product pairs of normals → estimate the cylinder axis.
 *  3. Project all face vertices onto the plane ⊥ to axis, compute centroid.
 *  4. Average distance from projected centroid = radius.
 */
function detectCylinderRadius(
  tris:      number[],
  indices:   ArrayLike<number>,
  positions: Float32Array,
  wm:        ReturnType<AbstractMesh['getWorldMatrix']>,
  avgNormal: Vector3,
): number | null {
  // Sample up to 24 triangle normals
  const step   = Math.max(1, Math.floor(tris.length / 24))
  const normals: Vector3[] = []

  for (let i = 0; i < tris.length; i += step) {
    const t  = tris[i]
    const p0 = worldPt(positions, indices[t * 3],     wm)
    const p1 = worldPt(positions, indices[t * 3 + 1], wm)
    const p2 = worldPt(positions, indices[t * 3 + 2], wm)
    const n  = Vector3.Cross(p1.subtract(p0), p2.subtract(p0))
    if (n.length() > 1e-8) normals.push(n.normalize())
  }

  if (normals.length < 4) return null

  // Planarity check: all normals ≈ avgNormal → flat face
  const dotSum = normals.reduce((s, n) => s + Math.abs(Vector3.Dot(n, avgNormal)), 0)
  if (dotSum / normals.length > 0.95) return null

  // Estimate cylinder axis as average of pairwise cross products
  let axisX = 0, axisY = 0, axisZ = 0
  let axisCount = 0
  for (let i = 0; i < normals.length - 1; i++) {
    const c = Vector3.Cross(normals[i], normals[i + 1])
    const len = c.length()
    if (len > 0.05) {
      // Consistent orientation
      if (axisCount > 0 && (c.x * axisX + c.y * axisY + c.z * axisZ) < 0) c.scaleInPlace(-1)
      axisX += c.x; axisY += c.y; axisZ += c.z; axisCount++
    }
  }
  if (axisCount === 0) return null
  const axis = new Vector3(axisX, axisY, axisZ).normalize()

  // Collect unique vertex positions and project onto plane ⊥ to axis
  const seen = new Set<number>()
  const projected: Vector3[] = []

  for (const t of tris) {
    for (let j = 0; j < 3; j++) {
      const v = indices[t * 3 + j]
      if (seen.has(v)) continue
      seen.add(v)
      const p    = worldPt(positions, v, wm)
      const proj = p.subtract(axis.scale(Vector3.Dot(p, axis)))
      projected.push(proj)
    }
  }

  if (projected.length === 0) return null

  // Centroid of projected points
  const cx = projected.reduce((s, p) => s + p.x, 0) / projected.length
  const cy = projected.reduce((s, p) => s + p.y, 0) / projected.length
  const cz = projected.reduce((s, p) => s + p.z, 0) / projected.length
  const center = new Vector3(cx, cy, cz)

  // Average distance = radius
  const r = projected.reduce((s, p) => s + Vector3.Distance(p, center), 0) / projected.length
  return r > 1e-4 ? r : null
}

// ── Minimum distance between two faces ────────────────────────────────────────

export interface MinDistResult {
  distance: number
  p1: Vector3   // closest point on face 1 (world space)
  p2: Vector3   // closest point on face 2 (world space)
}

export function minFaceDistance(
  mesh1: AbstractMesh, face1: FaceData,
  mesh2: AbstractMesh, face2: FaceData,
): MinDistResult {
  const { positions: pos1, indices: idx1 } = getAdjacency(mesh1)
  const { positions: pos2, indices: idx2 } = getAdjacency(mesh2)
  const wm1 = mesh1.getWorldMatrix()
  const wm2 = mesh2.getWorldMatrix()

  // Collect unique vertices from each face
  const verts1 = uniqueWorldVerts(face1.triangleIndices, idx1, pos1, wm1)
  const verts2 = uniqueWorldVerts(face2.triangleIndices, idx2, pos2, wm2)

  let best = Infinity, bestP1 = verts1[0], bestP2 = verts2[0]
  for (const a of verts1) {
    for (const b of verts2) {
      const d = Vector3.DistanceSquared(a, b)
      if (d < best) { best = d; bestP1 = a; bestP2 = b }
    }
  }
  return { distance: Math.sqrt(best), p1: bestP1, p2: bestP2 }
}

function uniqueWorldVerts(
  tris:      number[],
  indices:   ArrayLike<number>,
  positions: Float32Array,
  wm:        ReturnType<AbstractMesh['getWorldMatrix']>,
): Vector3[] {
  const seen = new Set<number>()
  const out: Vector3[] = []
  for (const t of tris) {
    for (let j = 0; j < 3; j++) {
      const v = indices[t * 3 + j]
      if (!seen.has(v)) { seen.add(v); out.push(worldPt(positions, v, wm)) }
    }
  }
  return out
}

// ── BREP edge picking ──────────────────────────────────────────────────────────

export interface BrepEdgeResult {
  length:    number
  points:    Vector3[]   // world-space polyline points of the picked BREP edge
  midpoint:  Vector3
}

/**
 * Given a world-space pick point and a solid mesh, find the nearest BREP edge
 * using the `edgeGroupStarts` stored on the sibling `edges_*` mesh metadata.
 *
 * Each group in edgeGroupStarts corresponds to exactly one BREP edge (one
 * (face, edge) pair from PolygonOnTriangulation). Binary-search the group that
 * owns the nearest segment and sum only its segments.
 */
export function pickEdge(solidMesh: AbstractMesh, pickedPoint: Vector3): BrepEdgeResult | null {
  const scene    = solidMesh.getScene()
  const edgeMesh = scene.getMeshByName(`edges_${solidMesh.name}`)
  if (!edgeMesh) return null

  const rawPos = edgeMesh.getVerticesData(VertexBuffer.PositionKind)
  const rawIdx = edgeMesh.getIndices()
  if (!rawPos || !rawIdx || rawIdx.length === 0) return null

  const groupStarts: Uint32Array = edgeMesh.metadata?.edgeGroupStarts ?? new Uint32Array(0)
  const wm = edgeMesh.getWorldMatrix()
  const pos = rawPos as Float32Array
  const numSegments = rawIdx.length / 2

  // Find the nearest segment (index into rawIdx pairs)
  let nearestSeg = 0
  let nearestDist = Infinity
  for (let i = 0; i < numSegments; i++) {
    const a = worldPt(pos, rawIdx[i * 2],     wm)
    const b = worldPt(pos, rawIdx[i * 2 + 1], wm)
    const d = pointToSegmentDistSq(pickedPoint, a, b)
    if (d < nearestDist) { nearestDist = d; nearestSeg = i }
  }

  // Binary-search groupStarts to find which BREP edge owns nearestSeg
  let groupIdx = 0
  if (groupStarts.length > 0) {
    let lo = 0, hi = groupStarts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (groupStarts[mid] <= nearestSeg) lo = mid
      else hi = mid - 1
    }
    groupIdx = lo
  }

  // Extract the group's segment range
  const segStart = groupStarts.length > 0 ? groupStarts[groupIdx]     : 0
  const segEnd   = groupStarts.length > 0 && groupIdx + 1 < groupStarts.length
    ? groupStarts[groupIdx + 1]
    : numSegments

  // Reconstruct the ordered polyline and compute length
  // Segments within a group are consecutive (head→tail from PolygonOnTriangulation)
  const points: Vector3[] = []
  let length = 0

  for (let i = segStart; i < segEnd; i++) {
    const a = worldPt(pos, rawIdx[i * 2],     wm)
    const b = worldPt(pos, rawIdx[i * 2 + 1], wm)
    if (i === segStart) points.push(a)
    points.push(b)
    length += Vector3.Distance(a, b)
  }

  if (points.length < 2) return null

  const midpoint = points[Math.floor(points.length / 2)]
  return { length, points, midpoint }
}

function pointToSegmentDistSq(p: Vector3, a: Vector3, b: Vector3): number {
  const ab   = b.subtract(a)
  const len2 = ab.lengthSquared()
  if (len2 < 1e-12) return Vector3.DistanceSquared(p, a)
  const t  = Math.max(0, Math.min(1, Vector3.Dot(p.subtract(a), ab) / len2))
  return Vector3.DistanceSquared(p, a.add(ab.scale(t)))
}

// ── Face highlight overlay ─────────────────────────────────────────────────────

/**
 * Create a semi-transparent mesh covering exactly the face triangles.
 * Store it in `measurement.meshes` so it's disposed with the measurement.
 */
export function createFaceHighlight(
  scene:    Scene,
  mesh:     AbstractMesh,
  face:     FaceData,
  name:     string,
  color:    Color3 = new Color3(0.15, 0.6, 1.0),
): AbstractMesh {
  const srcPos = mesh.getVerticesData(VertexBuffer.PositionKind)!
  const srcIdx = mesh.getIndices()!

  const vertMap    = new Map<number, number>()
  const newPos: number[] = []
  const newIdx: number[] = []

  for (const t of face.triangleIndices) {
    for (let j = 0; j < 3; j++) {
      const v = srcIdx[t * 3 + j]
      if (!vertMap.has(v)) {
        vertMap.set(v, newPos.length / 3)
        newPos.push(srcPos[v * 3], srcPos[v * 3 + 1], srcPos[v * 3 + 2])
      }
      newIdx.push(vertMap.get(v)!)
    }
  }

  const overlay = new Mesh(name, scene)
  const vd      = new VertexData()
  vd.positions  = newPos
  vd.indices    = newIdx
  vd.applyToMesh(overlay)

  overlay.parent       = mesh.parent
  overlay.isPickable   = false
  overlay.renderingGroupId = 1

  const mat              = new StandardMaterial(`${name}_mat`, scene)
  mat.diffuseColor       = color
  mat.emissiveColor      = color.scale(0.4)
  mat.alpha              = 0.45
  mat.backFaceCulling    = false
  overlay.material       = mat

  return overlay
}
