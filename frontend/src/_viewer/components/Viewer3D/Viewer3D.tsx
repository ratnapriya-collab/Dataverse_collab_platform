import { useRef, useEffect, useState } from 'react'
import { Camera, SceneLoader } from '@babylonjs/core'
import { useViewerStore } from '../../store/viewerStore'
import { initScene } from '../../lib/babylon/SceneManager'
import { loadFile, loadSampleGeometry, buildTreeFromMeshes } from '../../lib/babylon/ModelLoader'
import { applyShadingMode, getModelMeshes, getEdgeMeshes } from '../../lib/babylon/ShadingManager'
import { fitToScene } from '../../lib/babylon/CameraManager'
import MeasurementLabels from './MeasurementLabels'
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
          const result = await SceneLoader.ImportMeshAsync('', '', loadUrl, scene, null, '.' + loadExt)
          const meshes = result.meshes.filter((m) => m.getTotalVertices() > 0)
          setModelTree(buildTreeFromMeshes(meshes))
          fitToScene(camera, scene.meshes.slice())
          setLoadedFileName(loadUrl.split('/').pop()?.split('?')[0] ?? loadUrl)
        } catch (err) {
          console.error('Viewer load failed:', err)
        }
      })()
    } else if (loadUrl && (loadExt === 'step' || loadExt === 'stp')) {
      // STEP rendering is stubbed in this build. Show a placeholder instead so
      // the page still indicates the file was uploaded successfully.
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
