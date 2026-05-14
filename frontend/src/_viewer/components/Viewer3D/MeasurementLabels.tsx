import { useEffect, useState } from 'react'
import { Vector3, Matrix, Viewport } from '@babylonjs/core'
import { useViewerStore } from '../../store/viewerStore'
import type { PMIAnnotation } from '../../types/viewer'

interface ScreenPos {
  id: string
  x: number
  y: number
  display: string
}

interface PmiScreenPos {
  id:         string
  x:          number   // frame left/top reference (before CSS transform)
  y:          number
  ax:         number   // anchor on model surface
  ay:         number
  annotation: PMIAnnotation
}

interface Props {
  showPmi?: boolean
}

export default function MeasurementLabels({ showPmi = false }: Props) {
  const scene          = useViewerStore((s) => s.babylonScene)
  const measurements   = useViewerStore((s) => s.measurements)
  const pmiAnnotations = useViewerStore((s) => s.pmiAnnotations)
  const pmiVisible     = useViewerStore((s) => s.pmiVisible) && showPmi
  const [positions,    setPositions]    = useState<ScreenPos[]>([])
  const [pmiPositions, setPmiPositions] = useState<PmiScreenPos[]>([])

  useEffect(() => {
    if (!scene) { setPositions([]); setPmiPositions([]); return }
    if (measurements.length === 0 && pmiAnnotations.length === 0) {
      setPositions([]); setPmiPositions([]); return
    }

    const observer = scene.onBeforeRenderObservable.add(() => {
      const engine = scene.getEngine()
      const camera = scene.activeCamera
      if (!camera) return

      const canvas = engine.getRenderingCanvas()
      const vw = canvas?.clientWidth  ?? engine.getRenderWidth()
      const vh = canvas?.clientHeight ?? engine.getRenderHeight()
      const transform = camera.getViewMatrix().multiply(camera.getProjectionMatrix())
      const viewport  = new Viewport(0, 0, vw, vh)

      const project = (v: Vector3) =>
        Vector3.Project(v, Matrix.Identity(), transform, viewport)

      // ── Measurement labels ──────────────────────────────────────────────────
      const next: ScreenPos[] = []
      for (const m of measurements) {
        if (!m.midpoint) continue
        const p = project(m.midpoint)
        if (p.z < 0 || p.z > 1) continue
        next.push({ id: m.id, x: p.x, y: p.y, display: m.display })
      }
      setPositions(next)

      // ── PMI GD&T frames ─────────────────────────────────────────────────────
      if (!pmiVisible) { setPmiPositions([]); return }

      // Collect solid meshes for bounding box computation
      const solidMeshes = scene.meshes.filter(
        m => m.isEnabled() && m.getTotalVertices() > 0 && !m.name.startsWith('edges_')
      )
      if (solidMeshes.length === 0) { setPmiPositions([]); return }

      // Overall world-space bounding box across all solid meshes
      let wx0 = Infinity, wy0 = Infinity, wz0 = Infinity
      let wx1 = -Infinity, wy1 = -Infinity, wz1 = -Infinity
      for (const mesh of solidMeshes) {
        const bb = mesh.getBoundingInfo().boundingBox
        const lo = bb.minimumWorld, hi = bb.maximumWorld
        wx0 = Math.min(wx0, lo.x); wy0 = Math.min(wy0, lo.y); wz0 = Math.min(wz0, lo.z)
        wx1 = Math.max(wx1, hi.x); wy1 = Math.max(wy1, hi.y); wz1 = Math.max(wz1, hi.z)
      }
      // Project the 8 bounding box corners to find screen-space extent
      const corners = [
        new Vector3(wx0,wy0,wz0), new Vector3(wx1,wy0,wz0),
        new Vector3(wx0,wy1,wz0), new Vector3(wx1,wy1,wz0),
        new Vector3(wx0,wy0,wz1), new Vector3(wx1,wy0,wz1),
        new Vector3(wx0,wy1,wz1), new Vector3(wx1,wy1,wz1),
      ].map(project).filter(p => p.z > 0 && p.z < 1)

      let sxMin = Infinity, sxMax = -Infinity, syMin = Infinity, syMax = -Infinity
      for (const p of corners) {
        sxMin = Math.min(sxMin, p.x); sxMax = Math.max(sxMax, p.x)
        syMin = Math.min(syMin, p.y); syMax = Math.max(syMax, p.y)
      }
      if (!isFinite(sxMin)) { setPmiPositions([]); return }

      // Screen-space model center and half-extents — used for orbit layout
      const cx = (sxMin + sxMax) / 2
      const cy = (syMin + syMax) / 2
      const rw = (sxMax - sxMin) / 2   // half-width on screen
      const rh = (syMax - syMin) / 2   // half-height on screen

      // Separate annotations: mesh-specific vs fallback (null meshName)
      const fallbackAnnotations = pmiAnnotations.filter(a => a.visible && !a.meshName)
      const N = fallbackAnnotations.length

      const pmiNext: PmiScreenPos[] = []
      let fallbackIdx = 0

      for (const a of pmiAnnotations) {
        if (!a.visible) continue

        let ax: number, ay: number
        let fx: number, fy: number

        if (a.meshName) {
          // Mesh-anchored: camera-facing surface of the specific mesh
          const mesh = scene.getMeshByName(a.meshName)
          if (!mesh) continue
          const bb = mesh.getBoundingInfo().boundingBox
          const mc = bb.centerWorld
          const r  = bb.extendSizeWorld.length()
          const cd = mc.subtract(camera.position).normalize()
          const sp = mc.subtract(cd.scale(r))
          const proj = project(sp)
          if (proj.z < 0 || proj.z > 1) continue
          ax = proj.x
          ay = proj.y
          fx = ax + 80
          fy = ay - 50
        } else {
          // Fallback: distribute frames clockwise around the model on an oval orbit,
          // and point each leader line from the model's bbox edge toward its frame.
          const t = N > 1 ? fallbackIdx / (N - 1) : 0.5
          // angle: start at top (-π/2) going clockwise (positive = downward in screen Y)
          const angle = t * 2 * Math.PI - Math.PI / 2
          const cosA  = Math.cos(angle)
          const sinA  = Math.sin(angle)

          // Frame position on orbit oval outside the model bbox
          fx = cx + (rw * 1.8 + 80) * cosA
          fy = cy + (rh * 1.8 + 45) * sinA

          // Anchor: walk from model center toward frame direction,
          // stopping at 88% of the way to the bbox edge so it sits on the model face.
          const tx = Math.abs(cosA) > 1e-6 ? rw / Math.abs(cosA) : Infinity
          const ty = Math.abs(sinA) > 1e-6 ? rh / Math.abs(sinA) : Infinity
          const tr  = Math.min(tx, ty) * 0.88
          ax = cx + cosA * tr
          ay = cy + sinA * tr

          fallbackIdx++
        }

        pmiNext.push({ id: a.id, x: fx, y: fy, ax, ay, annotation: a })
      }
      setPmiPositions(pmiNext)
    })

    return () => { scene.onBeforeRenderObservable.remove(observer) }
  }, [scene, measurements, pmiAnnotations, pmiVisible])

  return (
    <>
      {/* Measurement labels */}
      {positions.map((p) => (
        <div
          key={p.id}
          className="measure-label"
          style={{ left: p.x, top: p.y, transform: 'translate(-50%, -100%) translateY(-8px)' }}
        >
          {p.display}
        </div>
      ))}

      {/* Leader lines with arrowhead pointing at the model */}
      {pmiPositions.length > 0 && (
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 13, overflow: 'visible' }}>
          <defs>
            <marker id="pmi-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0.5 L0,5.5 L5.5,3 Z" fill="rgba(20,20,20,0.65)" />
            </marker>
          </defs>
          {pmiPositions.map((p) => (
            <line
              key={p.id}
              x1={p.x}  y1={p.y}
              x2={p.ax} y2={p.ay}
              stroke="rgba(20,20,20,0.55)"
              strokeWidth="1"
              markerEnd="url(#pmi-arrow)"
            />
          ))}
        </svg>
      )}

      {/* PMI annotation labels — 3 visual styles */}
      {pmiPositions.map((p) => {
        const a = p.annotation
        const transform = 'translate(-50%, -100%) translateY(-6px)'

        if (a.type === 'datum') {
          return (
            <div key={p.id} className="pmi-datum-box"
              style={{ left: p.x, top: p.y, transform }}>
              {a.value}
            </div>
          )
        }

        if (a.type === 'dimension') {
          return (
            <div key={p.id} className="pmi-dim-label"
              style={{ left: p.x, top: p.y, transform }}>
              {a.symbol}{a.value}
            </div>
          )
        }

        // tolerance → GD&T divided frame
        return (
          <div key={p.id} className="gdt-frame"
            style={{ left: p.x, top: p.y, transform }}>
            <div className="gdt-cell gdt-symbol">{a.symbol}</div>
            <div className="gdt-cell">{a.value}</div>
            {a.datums.map(d => (
              <div key={d} className="gdt-cell gdt-datum">{d}</div>
            ))}
          </div>
        )
      })}
    </>
  )
}
