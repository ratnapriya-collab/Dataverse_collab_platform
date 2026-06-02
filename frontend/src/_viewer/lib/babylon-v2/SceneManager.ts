/**
 * Proprietary - Copyright (c) 2026 datavers.ai. All rights reserved.
 *
 * Ported from dv-3d-viewer. Initialises the Babylon Engine + Scene +
 * ArcRotateCamera + lights + grid + origin compass for a viewer canvas.
 * Pure scene setup — no external coupling.
 *
 * Z-up engineering convention: scene.upVector = +Z, so the ViewCube and
 * view-preset alpha/beta in CameraManager.VIEWS resolve to TOP=+Z,
 * FRONT=-Y, RIGHT=+X (same as Onshape / NX).
 */

import {
  Engine,
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  DirectionalLight,
  Vector3,
  Color3,
  Color4,
  MeshBuilder,
  StandardMaterial,
} from '@babylonjs/core'

// Camera params — Z-up engineering CAD convention. ArcRotateCamera α/β are
// defined relative to the scene's upVector, so with upVector=+Z:
//   α=π/4, β=acos(1/√3)  →  ISO view (camera up-and-front-right of model)
const CAMERA_ALPHA = Math.PI / 4
const CAMERA_BETA = Math.acos(1 / Math.sqrt(3))
const CAMERA_RADIUS = Math.sqrt(5 * 5 + 3.5 * 3.5 + 6 * 6)

export interface SceneSetup {
  engine: Engine
  scene: Scene
  camera: ArcRotateCamera
  gridMesh: { setEnabled: (v: boolean) => void }
}

export function initScene(canvas: HTMLCanvasElement): SceneSetup {
  const engine = new Engine(
    canvas,
    true,
    {
      preserveDrawingBuffer: true,
      stencil: true,
    },
    true, // adaptToDeviceRatio — crisp edges on retina
  )

  const scene = new Scene(engine)
  scene.useRightHandedSystem = true
  scene.clearColor = new Color4(0.094, 0.106, 0.133, 1)

  // Disable Babylon's lazy-loaded BRDF environment texture. Otherwise PBR
  // materials trigger a CDN fetch + RGBD-expansion post-process that races
  // with scene state changes, throwing
  //   "Cannot read properties of null (reading 'program')" at bindSamplers.
  // PBR falls back to a polynomial Fresnel approximation — visually
  // indistinguishable for CAD-viewer lighting.
  ;(scene as unknown as { environmentBRDFTexture: unknown }).environmentBRDFTexture = null

  // Camera (Z-up). All view-preset alpha/beta in CameraManager.VIEWS resolve
  // to engineering-convention orientations under this upVector: TOP=+Z,
  // FRONT=-Y, RIGHT=+X — same as the ViewCube widget.
  const camera = new ArcRotateCamera(
    'camera',
    CAMERA_ALPHA,
    CAMERA_BETA,
    CAMERA_RADIUS,
    new Vector3(0, 0, 0.5),
    scene,
  )
  camera.upVector = new Vector3(0, 0, 1)
  camera.attachControl(canvas, true)
  camera.inertia = 0.92
  camera.panningInertia = 0.92
  camera.allowUpsideDown = true
  // Babylon defaults lowerBetaLimit=0.01, upperBetaLimit=π-0.01, which clamps
  // vertical orbit to one hemisphere (~180°). Clear both so the camera can
  // tumble through the poles continuously — matches Onshape/NX feel.
  camera.lowerBetaLimit = null
  camera.upperBetaLimit = null
  camera.minZ = 0.01
  camera.maxZ = 1000
  camera.fov = (45 * Math.PI) / 180
  camera.wheelPrecision = 20
  camera.panningSensibility = 100

  // Lights (Y-up — kept Y-axis for traditional 3-point lighting feel even
  // though geometry is in Z-up; hemispheric light is direction-agnostic).
  const hemi = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), scene)
  hemi.intensity = 1.0
  hemi.diffuse = new Color3(1, 1, 1)
  hemi.groundColor = new Color3(0.7, 0.7, 0.75)

  const main = new DirectionalLight(
    'mainLight',
    new Vector3(-5, 5, -8).normalize(),
    scene,
  )
  main.intensity = 1.4

  const fill = new DirectionalLight(
    'fillLight',
    new Vector3(3, -4, -2).normalize(),
    scene,
  )
  fill.intensity = 0.5

  // Grid + axes
  const gridMesh = buildGrid(scene)
  buildOriginCompass(scene)

  engine.runRenderLoop(() => scene.render())

  return { engine, scene, camera, gridMesh }
}

function buildGrid(scene: Scene) {
  const size = 12
  const divisions = 24
  const step = size / divisions
  const half = size / 2

  const majorColor = Color3.FromHexString('#c0c0cc')
  const minorColor = Color3.FromHexString('#d4d4de')

  const lines: Vector3[][] = []
  const colors: Color4[][] = []

  for (let i = 0; i <= divisions; i++) {
    const pos = -half + i * step
    const isMajor = i % 4 === 0
    const color = isMajor ? majorColor : minorColor
    const c4 = new Color4(color.r, color.g, color.b, 1)

    // Ground grid lies on the XY plane (Z = 0) for Z-up scene.
    lines.push([new Vector3(pos, -half, 0), new Vector3(pos, half, 0)])
    colors.push([c4, c4])
    lines.push([new Vector3(-half, pos, 0), new Vector3(half, pos, 0)])
    colors.push([c4, c4])
  }

  const grid = MeshBuilder.CreateLineSystem(
    'viewerGrid',
    { lines, colors, useVertexAlpha: false },
    scene,
  )
  grid.isPickable = false
  // Render in either pane when compare-mode is active. CompareViewManager
  // assigns each camera a side-specific layerMask; chrome (grid, axes,
  // origin compass) opts into both ranges via the BOTH mask.
  grid.layerMask = 0x1fffffff
  return grid
}

function buildOriginCompass(scene: Scene) {
  const len = 0.5
  const axes = [
    { dir: new Vector3(len, 0, 0), color: '#ef4444' },
    { dir: new Vector3(0, len, 0), color: '#22c55e' },
    { dir: new Vector3(0, 0, len), color: '#3b82f6' },
  ]

  axes.forEach((ax, i) => {
    const c = Color3.FromHexString(ax.color)
    const c4 = new Color4(c.r, c.g, c.b, 1)

    const line = MeshBuilder.CreateLines(
      `originAxis_${i}`,
      {
        points: [Vector3.Zero(), ax.dir],
        colors: [c4, c4],
      },
      scene,
    )
    line.isPickable = false
    line.layerMask = 0x1fffffff

    const tip = MeshBuilder.CreateSphere(`originTip_${i}`, { diameter: 0.06 }, scene)
    tip.position = ax.dir.clone()
    const mat = new StandardMaterial(`originTipMat_${i}`, scene)
    mat.diffuseColor = c
    mat.emissiveColor = c.scale(0.4)
    tip.material = mat
    tip.isPickable = false
    tip.layerMask = 0x1fffffff
  })
}
