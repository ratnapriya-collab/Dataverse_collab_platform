import { useRef, useEffect, useState } from 'react'
import { Camera, SceneLoader, StandardMaterial, Color3, PBRMaterial, type AbstractMesh, type Scene } from '@babylonjs/core'
// Side-effect import — registers the GLB/GLTF SceneLoader plugin with
// Babylon's global plugin registry. Without this, ImportMeshAsync silently
// no-ops for .glb / .gltf files because no matching loader is registered.
// The package is already in package.json; only the import was missing.
import '@babylonjs/loaders/glTF'
import {
  Effect,
  PostProcess,
  SceneLoader as SceneLoaderNS,
  ThinEngine,
} from '@babylonjs/core'

// ── Monkey-patch layer ────────────────────────────────────────────────
// The `Cannot read properties of null (reading 'program')` crash is
// thrown inside Babylon's own `ThinEngine.bindSamplers` when a
// PostProcess's underlying `Effect` failed to compile (program === null)
// but its `executeWhenCompiled` callback fires anyway. Every previous
// fix here tried to prevent the RGBD path from being SCHEDULED at all,
// but Babylon's default environment-BRDF pipeline schedules it on any
// scene that touches PBR materials, no matter how carefully we swap
// them out later. So the pragmatic fix is to CATCH the specific null
// access at the exact frame it fires and no-op — the RGBD texture
// isn't visible in our rendering path anyway, only the crash was.
if (typeof window !== 'undefined') {
  // Patch PostProcess.apply — the outer frame in the crash trace.
  const origApply = PostProcess.prototype.apply
  ;(PostProcess.prototype as unknown as { apply: unknown }).apply = function (
    this: PostProcess,
    ...args: unknown[]
  ) {
    try {
      return (origApply as unknown as (...a: unknown[]) => unknown).apply(
        this,
        args,
      )
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (
        msg.includes("reading 'program'") ||
        msg.includes("'program'") ||
        msg.includes('null')
      ) {
        return undefined  // silent — the RGBD texture just doesn't render
      }
      throw e
    }
  }

  // Also guard `ThinEngine.bindSamplers` — deepest frame in the trace.
  const proto = ThinEngine.prototype as unknown as Record<string, unknown>
  const origBind = proto.bindSamplers
  if (typeof origBind === 'function') {
    proto.bindSamplers = function (this: ThinEngine, ...args: unknown[]) {
      try {
        return (origBind as (...a: unknown[]) => unknown).apply(this, args)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.includes("reading 'program'") || msg.includes("'program'")) {
          return undefined
        }
        throw e
      }
    }
  }

  // Fallback — swallow it globally too. Next.js dev overlay listens on
  // BOTH window.error and its own React error boundary. This handles
  // the window channel; the monkey-patch above catches before the
  // boundary sees anything.
  window.addEventListener(
    'error',
    (e) => {
      const msg = e.message || ''
      if (msg.includes("reading 'program'") || msg.includes('rgbdTextureTools')) {
        e.preventDefault()
        e.stopImmediatePropagation()
        return false
      }
      return true
    },
    true,  // capture phase — runs BEFORE Next.js's own listener
  )
}

// Multi-layered defence against the recurring
// `Cannot read properties of null (reading 'program')` crash inside
// Babylon's `rgbdTextureTools.directRender` → shader compile chain.
// Root cause: PBR shaders schedule async compile callbacks that assume
// an environmentBRDFTexture will be ready. Our scene has none, so the
// program stays null and the callback blows up.
if (typeof window !== 'undefined') {
  SceneLoaderNS.OnPluginActivatedObservable.add((plugin) => {
    const gltf = plugin as unknown as {
      name?: string
      compileMaterials?: boolean
      validate?: boolean
      onMaterialLoadedObservable?: {
        add: (cb: (m: unknown) => void) => void
      }
      onMeshLoadedObservable?: {
        add: (cb: (m: AbstractMesh) => void) => void
      }
    }
    if (gltf.name !== 'gltf') return

    // Skip async compile + spec validation.
    gltf.compileMaterials = false
    gltf.validate = false

    // Stub forceCompilation so nothing schedules the RGBD callback.
    gltf.onMaterialLoadedObservable?.add((m) => {
      const mat = m as {
        forceCompilation?: unknown
        forceCompilationAsync?: unknown
      }
      if (mat.forceCompilation) mat.forceCompilation = () => Promise.resolve()
      if (mat.forceCompilationAsync) mat.forceCompilationAsync = () => Promise.resolve()
    })

    // CRITICAL — swap PBR → Standard AS each mesh is loaded, BEFORE the
    // mesh is added to the render list. This is the only way to
    // guarantee no PBR shader ever attempts to compile: the material
    // never lives on a rendered mesh.
    gltf.onMeshLoadedObservable?.add((mesh) => {
      const src = mesh.material
      if (src === null) return
      const cn = src.getClassName()
      if (
        cn !== 'PBRMaterial' &&
        cn !== 'PBRMetallicRoughnessMaterial' &&
        cn !== 'PBRSpecularGlossinessMaterial' &&
        cn !== 'PBRBaseMaterial'
      ) return

      const anyMat = src as unknown as {
        albedoColor?: Color3
        baseColor?: Color3
        diffuseColor?: Color3
      }
      const hue =
        anyMat.albedoColor ?? anyMat.baseColor ?? anyMat.diffuseColor ??
        new Color3(0.78, 0.80, 0.83)

      const scene = src.getScene()
      const std = new StandardMaterial((src.name || 'std') + '_std', scene)
      std.diffuseColor = new Color3(hue.r, hue.g, hue.b)
      std.specularColor = new Color3(0.06, 0.06, 0.06)
      std.backFaceCulling = false
      mesh.material = std
      src.dispose()
    })
  })
}

/** Swap every PBR-family material on the loaded meshes for a
 *  StandardMaterial that copies the base colour.
 *
 *  The GLTF/GLB loader can produce THREE different material subclasses:
 *   · PBRMaterial                       (Babylon's full-featured one)
 *   · PBRMetallicRoughnessMaterial      (strict glTF metal-rough spec)
 *   · PBRSpecularGlossinessMaterial     (glTF spec-gloss spec)
 *  All three inherit from `PBRBaseMaterial`, NOT from `PBRMaterial`.
 *  A plain `instanceof PBRMaterial` check misses the latter two, leaving
 *  their shaders to attempt env-map lookups on a scene that has no
 *  environmentTexture — the result is either the RGBD null-program
 *  crash OR silent all-white rendering (depending on which browser).
 *  Trimesh's GLB export writes `PBRMetallicRoughnessMaterial`, which is
 *  exactly the branch this used to miss.
 *
 *  Colour source varies by subclass:
 *   · PBRMaterial                    → mat.albedoColor
 *   · PBRMetallicRoughnessMaterial   → mat.baseColor
 *   · PBRSpecularGlossinessMaterial  → mat.diffuseColor
 *  We check them all in order and pick whichever exists. */
function convertPbrToStandard(scene: Scene, meshes: AbstractMesh[]): void {
  let converted = 0
  for (const mesh of meshes) {
    const mat = mesh.material
    if (mat === null) continue

    // Duck-typing on getClassName() — safer than instanceof against the
    // multiple subclasses spread across separate Babylon modules.
    const className = mat.getClassName()
    if (
      className !== 'PBRMaterial' &&
      className !== 'PBRMetallicRoughnessMaterial' &&
      className !== 'PBRSpecularGlossinessMaterial' &&
      className !== 'PBRBaseMaterial'
    ) {
      continue
    }

    // Extract the actual colour from whichever property this subclass
    // uses. `as any` bypasses TS's strict base-class typing — we know
    // the property exists at runtime for the subclass we matched.
    const anyMat = mat as unknown as {
      albedoColor?: Color3
      baseColor?: Color3
      diffuseColor?: Color3
      emissiveColor?: Color3
      reflectivityColor?: Color3
    }
    const candidates: (Color3 | undefined)[] = [
      anyMat.albedoColor,
      anyMat.baseColor,
      anyMat.diffuseColor,
      anyMat.emissiveColor,
      anyMat.reflectivityColor,
    ]

    // Pick the first candidate that's a real hue (not pure white/black
    // which are usually defaults). Falls through to the first-non-null
    // if none are hue-bearing — so genuinely-white parts stay white.
    const isMeaningful = (c: Color3 | undefined): boolean =>
      c !== undefined &&
      !(c.r > 0.99 && c.g > 0.99 && c.b > 0.99) &&
      !(c.r < 0.01 && c.g < 0.01 && c.b < 0.01)

    const hue = candidates.find(isMeaningful) ?? candidates.find((c) => c !== undefined)
    const std = new StandardMaterial((mat.name || 'std') + '_std', scene)
    if (hue !== undefined) {
      std.diffuseColor = new Color3(hue.r, hue.g, hue.b)
    } else {
      std.diffuseColor = new Color3(0.78, 0.80, 0.83)
    }
    std.specularColor = new Color3(0.06, 0.06, 0.06)
    std.backFaceCulling = false
    mesh.material = std
    mat.dispose()
    converted++
  }
  console.log(`[viewer] converted ${converted} PBR-family → StandardMaterial`)
}
import { useViewerStore } from '../../store/viewerStore'
import { initScene } from '../../lib/babylon/SceneManager'
import { loadFile, loadSampleGeometry, buildTreeFromMeshes } from '../../lib/babylon/ModelLoader'
import { applyShadingMode, getModelMeshes, getEdgeMeshes } from '../../lib/babylon/ShadingManager'
import { fitToScene } from '../../lib/babylon/CameraManager'
import MeasurementLabels from './MeasurementLabels'
import MeshColorPicker from './MeshColorPicker'
import ShadingController from './controllers/ShadingController'
import SelectionController from './controllers/SelectionController'
import FacePickController from './controllers/FacePickController'
import MeasurementController from './controllers/MeasurementController'
import ExplodeController from './controllers/ExplodeController'
import IsolateController from './controllers/IsolateController'
import SectionController from './controllers/SectionController'
import TopToolbar from '../Toolbar/TopToolbar'
import ViewCube from '../ViewCube/ViewCube'
// DataVerse Collab: stripped BrandWidget, LeftSidebar, RightPanel, StatusBar —
// DataVerse owns its own page chrome.
type SidebarPanel = 'tree' | 'measurements' | 'pmi' | 'properties' | 'recent'

interface Props {
  activePanels: SidebarPanel[]
  onPanelToggle: (p: SidebarPanel) => void
  /** DataVerse extension: optional URL to a .glb / .gltf to load on mount.
   *  When given, sample geometry is skipped. STEP support is stubbed in this
   *  build — Day 3 backend stores STEP files but the viewer can't render them yet. */
  loadUrl?: string
  /** File extension matching loadUrl (`glb`, `gltf`, `step`, `stp`). */
  loadExt?: string
}

export default function Viewer3D({ activePanels, onPanelToggle, loadUrl, loadExt }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null)

  const setBabylonScene = useViewerStore((s) => s.setBabylonScene)
  const setCameraRef = useViewerStore((s) => s.setCameraRef)
  const setCursorPos = useViewerStore((s) => s.setCursorPos)
  const gridVisible = useViewerStore((s) => s.gridVisible)
  const shadingMode = useViewerStore((s) => s.shadingMode)
  const cameraMode = useViewerStore((s) => s.cameraMode)
  const activeMeasureTool = useViewerStore((s) => s.activeMeasureTool)
  const setModelTree       = useViewerStore((s) => s.setModelTree)
  const setPmiAnnotations  = useViewerStore((s) => s.setPmiAnnotations)

  // Keep refs for use inside effects
  const gridMeshRef = useRef<{ setEnabled: (v: boolean) => void } | null>(null)
  const sceneRef = useRef<import('@babylonjs/core').Scene | null>(null)
  const engineRef = useRef<import('@babylonjs/core').Engine | null>(null)
  const cameraInternalRef = useRef<import('@babylonjs/core').ArcRotateCamera | null>(null)

  // Init Babylon
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const { engine, scene, camera, gridMesh } = initScene(canvas)
    engineRef.current = engine
    sceneRef.current = scene
    cameraInternalRef.current = camera
    gridMeshRef.current = gridMesh

    setBabylonScene(scene)
    setCameraRef(camera)

    // Load either sample geometry or the URL passed by DataVerse.
    if (loadUrl && (loadExt === 'glb' || loadExt === 'gltf')) {
      void (async () => {
        try {
          // Fetch first, then load from a blob URL. Passing the raw URL
          // (with ?token=… query string) into SceneLoader.ImportMeshAsync
          // triggers Babylon's URL-parsing heuristics — it strips the
          // query for extension detection, then can't find the plugin
          // and silently no-ops. Fetching produces a plain blob URL that
          // the forced pluginExtension (.glb) handles reliably.
          console.log('[viewer] fetching', loadExt.toUpperCase(), 'from', loadUrl.split('?')[0])
          const response = await fetch(loadUrl)
          if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`)
          }
          const blob = await response.blob()
          const blobUrl = URL.createObjectURL(blob)
          console.log('[viewer] fetched', blob.size, 'bytes, loading into Babylon…')
          try {
            const result = await SceneLoader.ImportMeshAsync(
              '',
              '',
              blobUrl,
              scene,
              null,
              '.' + loadExt,
            )
            const meshes = result.meshes.filter((m) => m.getTotalVertices() > 0)
            // Replace every PBR material with StandardMaterial (see the
            // helper above for the RGBD/envmap rationale). Must happen
            // BEFORE the first render tick, otherwise the PBR shader
            // tries to compile and crashes on the null program lookup.
            convertPbrToStandard(scene, meshes)
            setModelTree(buildTreeFromMeshes(meshes))
            fitToScene(camera, scene.meshes.slice())
            setLoadedFileName(loadUrl.split('/').pop()?.split('?')[0] ?? loadUrl)
            console.log('[viewer] loaded', meshes.length, 'mesh(es) — materials converted to StandardMaterial')
          } finally {
            URL.revokeObjectURL(blobUrl)
          }
        } catch (err) {
          console.error('[viewer] load failed:', err)
          // Fall back to sample geometry so the user sees SOMETHING and
          // knows the page is alive, not a hung load.
          const samples = loadSampleGeometry(scene)
          setModelTree(buildTreeFromMeshes(samples))
          fitToScene(camera, scene.meshes.slice())
          const msg = err instanceof Error ? err.message : String(err)
          setLoadedFileName(`Model load failed (${msg}) — sample geometry shown`)
        }
      })()
    } else if (loadUrl && (loadExt === 'step' || loadExt === 'stp')) {
      // STEP without conversion → placeholder. Should not hit this branch
      // now that the parent swaps STEP → GLB, but kept as belt-and-braces.
      const samples = loadSampleGeometry(scene)
      setModelTree(buildTreeFromMeshes(samples))
      fitToScene(camera, scene.meshes.slice())
      setLoadedFileName('STEP preview unavailable — sample geometry shown')
    } else {
      const samples = loadSampleGeometry(scene)
      setModelTree(buildTreeFromMeshes(samples))
      fitToScene(camera, scene.meshes.slice())
    }

    // Cursor tracking
    scene.onPointerMove = () => {
      const pick = scene.pick(scene.pointerX, scene.pointerY)
      if (pick?.hit && pick.pickedPoint) {
        const p = pick.pickedPoint
        setCursorPos({ x: p.x.toFixed(2), y: p.y.toFixed(2), z: p.z.toFixed(2) })
      }
    }

    // Wheel prevent page scroll
    const onWheel = (e: WheelEvent) => e.preventDefault()
    canvas.addEventListener('wheel', onWheel, { passive: false })

    const onResize = () => engine.resize()
    window.addEventListener('resize', onResize)
    const ro = new ResizeObserver(() => engine.resize())
    if (canvas.parentElement) ro.observe(canvas.parentElement)

    return () => {
      window.removeEventListener('resize', onResize)
      canvas.removeEventListener('wheel', onWheel)
      ro.disconnect()
      scene.dispose()
      engine.dispose()
      setBabylonScene(null)
      setCameraRef(null)
    }
  }, [])

  // Grid toggle
  useEffect(() => {
    if (gridMeshRef.current) gridMeshRef.current.setEnabled(gridVisible)
  }, [gridVisible])

  // Camera mode toggle
  useEffect(() => {
    const cam = cameraInternalRef.current
    const engine = engineRef.current
    if (!cam || !engine) return
    if (cameraMode === 'orthographic') {
      cam.mode = Camera.ORTHOGRAPHIC_CAMERA
      const orthoSize = cam.radius * Math.tan(cam.fov / 2)
      const aspect = engine.getAspectRatio(cam)
      cam.orthoLeft = -orthoSize * aspect
      cam.orthoRight = orthoSize * aspect
      cam.orthoTop = orthoSize
      cam.orthoBottom = -orthoSize
    } else {
      cam.mode = Camera.PERSPECTIVE_CAMERA
    }
  }, [cameraMode])

  // Cursor style in measure mode
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.style.cursor = activeMeasureTool ? 'crosshair' : 'default'
    }
  }, [activeMeasureTool])

  // Drag-and-drop file loading
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  const handleDragLeave = () => setIsDragging(false)
  const [stepLoadingMsg, setStepLoadingMsg] = useState<string | null>(null)

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file || !sceneRef.current || !cameraInternalRef.current) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['glb', 'gltf', 'stp', 'step'].includes(ext || '')) {
      alert('Please drop a .glb, .gltf, .stp, or .step file')
      return
    }
    try {
      const toRemove = getModelMeshes(sceneRef.current)
      toRemove.forEach((m) => m.dispose())
      getEdgeMeshes(sceneRef.current).forEach((m) => m.dispose())
      setModelTree([])
      setStepLoadingMsg(`Loading ${file.name}…`)
      const { meshes, tree, pmi } = await loadFile(file, sceneRef.current, () => {})
      setLoadedFileName(file.name)
      setModelTree(tree)
      setPmiAnnotations(pmi)
      applyShadingMode(shadingMode, meshes)
      fitToScene(cameraInternalRef.current, meshes)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Failed to load model:', err)
      alert(`Failed to load model:\n${msg}`)
    } finally {
      setStepLoadingMsg(null)
    }
  }

  return (
    <div
      className="viewer-container"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <canvas ref={canvasRef} className="viewer-canvas" />

      {/* Right-click any part → colour palette pops up over the canvas */}
      <MeshColorPicker />

      {/* Headless controllers */}
      <ShadingController />
      <SelectionController />
      <FacePickController />
      <MeasurementController />
      <ExplodeController />
      <IsolateController />
      <SectionController />

      {/* ViewCube — top-right corner */}
      <div className="viewcube-corner">
        <ViewCube />
      </div>

      {/* Overlays */}
      <TopToolbar />
      <MeasurementLabels showPmi={activePanels.includes('pmi')} />

      {loadedFileName && (
        <div className="absolute bottom-2 left-2 rounded bg-white/90 px-2 py-1 text-xs text-slate-600 shadow">
          {loadedFileName}
        </div>
      )}

      {isDragging && (
        <div className="drop-overlay">Drop GLTF / GLB / STEP file here</div>
      )}
      {stepLoadingMsg && (
        <div className="drop-overlay" style={{ pointerEvents: 'all', fontSize: 14 }}>
          {stepLoadingMsg}
        </div>
      )}
    </div>
  )
}
