/**
 * Stable face UUID tests — the foundation of anchor stability across re-uploads.
 *
 * If any of these break, every persisted anchor in production would orphan on
 * the next file re-upload. Treat as load-bearing.
 */

import { describe, expect, it } from 'vitest'
import { stableFaceUuid } from './geomHash'

interface FaceData {
  triangleIndices: number[]
  normal: { x: number; y: number; z: number }
  centroid: { x: number; y: number; z: number }
  area: number
}

function face(overrides: Partial<FaceData> = {}): FaceData {
  return {
    triangleIndices: [0, 1],
    normal: { x: 0, y: 0, z: 1 },
    centroid: { x: 1.0, y: 2.0, z: 3.0 },
    area: 4.5,
    ...overrides,
  }
}

describe('stableFaceUuid', () => {
  it('is deterministic — same inputs produce the same UUID', async () => {
    const a = await stableFaceUuid(face(), 'sampleBox')
    const b = await stableFaceUuid(face(), 'sampleBox')
    expect(a).toBe(b)
  })

  it('absorbs sub-tolerance floating-point drift', async () => {
    // Drift well below 1 µm (POSITION_TOLERANCE = 1e-3) on every component.
    const a = await stableFaceUuid(face(), 'sampleBox')
    const drifted = await stableFaceUuid(
      face({
        centroid: { x: 1.0 + 1e-7, y: 2.0 - 2e-7, z: 3.0 + 3e-7 },
        area: 4.5 + 1e-6,
      }),
      'sampleBox',
    )
    expect(drifted).toBe(a)
  })

  it('flips when the face normal changes', async () => {
    const upward = await stableFaceUuid(face({ normal: { x: 0, y: 0, z: 1 } }), 'sampleBox')
    const sideways = await stableFaceUuid(
      face({ normal: { x: 1, y: 0, z: 0 } }),
      'sampleBox',
    )
    expect(upward).not.toBe(sideways)
  })

  it('flips when topology changes (different triangle count)', async () => {
    const fewTris = await stableFaceUuid(face({ triangleIndices: [0, 1] }), 'sampleBox')
    const manyTris = await stableFaceUuid(
      face({ triangleIndices: [0, 1, 2, 3, 4, 5] }),
      'sampleBox',
    )
    expect(fewTris).not.toBe(manyTris)
  })

  it('formats the result as a UUID (8-4-4-4-12 hex)', async () => {
    const uuid = await stableFaceUuid(face(), 'sampleBox')
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('treats different mesh names as distinct faces', async () => {
    // Even with identical geometry, the same face on a different mesh should
    // hash differently — prevents anchors leaking between part instances.
    const onBox = await stableFaceUuid(face(), 'sampleBox')
    const onSphere = await stableFaceUuid(face(), 'sampleSphere')
    expect(onBox).not.toBe(onSphere)
  })
})
