/**
 * Stable face UUID derived from BREP topology, not array index.
 *
 * ARCHITECTURAL NON-NEGOTIABLE #2: if we used the in-mesh face index, the same
 * physical face would get a different ID after a re-upload (OCC may emit faces
 * in a different order). Hashing geometric invariants — centroid, normal,
 * triangle count, and area — keeps the ID stable across re-uploads while
 * tolerating tiny floating-point drift via rounding.
 *
 * NOTE on the viewer: the FacePicker (`_viewer/lib/babylon/FacePicker.ts`)
 * returns FaceData with `centroid`, `normal`, `area`, and `triangleIndices`.
 * Those are exactly the invariants we hash. Triangle indices themselves are
 * NOT stable — we use only the count.
 */

/**
 * Local copy of the viewer's FaceData shape — keeps geomHash decoupled from
 * the vendored viewer's TypeScript declarations. Only the fields we hash are
 * declared here. (The viewer's actual FaceData has more fields.)
 */
interface FaceData {
  triangleIndices: number[]
  normal: { x: number; y: number; z: number }
  centroid: { x: number; y: number; z: number }
  area: number
}

const POSITION_TOLERANCE = 1e-3 // 1 µm at the viewer's auto-scaled units
const NORMAL_TOLERANCE = 1e-4
const AREA_TOLERANCE = 1e-4

function round(v: number, step: number): number {
  return Math.round(v / step) * step
}

function fmt(v: number): string {
  // Stable string representation that includes sign and a fixed digit count.
  return v.toFixed(6)
}

/**
 * Build the canonical hash input for a face. The same physical face must
 * always produce the same string, regardless of re-tessellation order.
 */
function canonicalInput(face: FaceData, meshName: string): string {
  const cx = fmt(round(face.centroid.x, POSITION_TOLERANCE))
  const cy = fmt(round(face.centroid.y, POSITION_TOLERANCE))
  const cz = fmt(round(face.centroid.z, POSITION_TOLERANCE))
  const nx = fmt(round(face.normal.x, NORMAL_TOLERANCE))
  const ny = fmt(round(face.normal.y, NORMAL_TOLERANCE))
  const nz = fmt(round(face.normal.z, NORMAL_TOLERANCE))
  const area = fmt(round(face.area, AREA_TOLERANCE))
  const triCount = face.triangleIndices.length
  return `${meshName}|c:${cx},${cy},${cz}|n:${nx},${ny},${nz}|a:${area}|t:${triCount}`
}

/**
 * SHA-256 of the canonical input. We use the browser's SubtleCrypto so we
 * don't pull in a hashing library. Returns the first 32 hex chars (128 bits)
 * formatted as a UUID-shaped string — plenty of entropy for our space.
 */
export async function stableFaceUuid(face: FaceData, meshName: string): Promise<string> {
  const input = canonicalInput(face, meshName)
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const bytes2 = new Uint8Array(digest)
  let hex = ''
  for (let i = 0; i < bytes2.length; i++) {
    const b = bytes2[i] as number
    hex += b.toString(16).padStart(2, '0')
  }
  // Format as 8-4-4-4-12 like a UUID for readability.
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-')
}

/** Exposed for debugging / unit tests. */
export const __test__ = { canonicalInput }
