import { Eye, Maximize2, Grid3X3, Layers, Square, Focus } from 'lucide-react'
import { useViewerStore } from '../../store/viewerStore'
import { fitToScene, animateToView } from '../../lib/babylon/CameraManager'
import { ViewCubeIcon } from './ViewIcons'
import type { ViewPreset } from '../../types/viewer'

const VIEW_PRESETS: { id: ViewPreset; face: Parameters<typeof ViewCubeIcon>[0]['face']; label: string }[] = [
  { id: 'FRONT',  face: 'front',  label: 'Front'  },
  { id: 'BACK',   face: 'back',   label: 'Back'   },
  { id: 'RIGHT',  face: 'right',  label: 'Right'  },
  { id: 'LEFT',   face: 'left',   label: 'Left'   },
  { id: 'TOP',    face: 'top',    label: 'Top'    },
  { id: 'BOTTOM', face: 'bottom', label: 'Bottom' },
  { id: 'ISO',    face: 'iso',    label: 'ISO'    },
]

export default function TopToolbar() {
  const cameraMode     = useViewerStore((s) => s.cameraMode)
  const setCameraMode  = useViewerStore((s) => s.setCameraMode)
  const shadingMode    = useViewerStore((s) => s.shadingMode)
  const setShadingMode = useViewerStore((s) => s.setShadingMode)
  const gridVisible         = useViewerStore((s) => s.gridVisible)
  const toggleGrid          = useViewerStore((s) => s.toggleGrid)
  const selectedMeshNames   = useViewerStore((s) => s.selectedMeshNames)
  const isolatedNames       = useViewerStore((s) => s.isolatedNames)
  const isolate             = useViewerStore((s) => s.isolate)
  const unisolate           = useViewerStore((s) => s.unisolate)
  const babylonScene        = useViewerStore((s) => s.babylonScene)
  const cameraRef           = useViewerStore((s) => s.cameraRef)

  const handleFit = () => {
    if (babylonScene && cameraRef) fitToScene(cameraRef, babylonScene.meshes.slice())
  }
  const toggleCam = () => {
    setCameraMode(cameraMode === 'perspective' ? 'orthographic' : 'perspective')
  }

  return (
    <div className="top-toolbar">
      {/* Fit */}
      <button className="pill-btn" data-tip="Fit to Scene (F)" onClick={handleFit}>
        <Maximize2 size={15} strokeWidth={1.75} />
      </button>

      <div className="pill-sep" />

      {/* Shading */}
      <button
        className={`pill-btn${shadingMode === 'shaded' ? ' active' : ''}`}
        data-tip="Solid"
        onClick={() => setShadingMode('shaded')}
      >
        <Square size={15} strokeWidth={1.75} />
      </button>
      <button
        className={`pill-btn${shadingMode === 'wireframe' ? ' active' : ''}`}
        data-tip="Wireframe (W)"
        onClick={() => setShadingMode('wireframe')}
      >
        <Layers size={15} strokeWidth={1.75} />
      </button>
      <button
        className={`pill-btn${shadingMode === 'shadedEdges' ? ' active' : ''}`}
        data-tip="Solid + Edges"
        onClick={() => setShadingMode('shadedEdges')}
      >
        <Square size={15} strokeWidth={2.5} />
      </button>

      <div className="pill-sep" />

      {/* View controls — projection, grid, isolate */}
      <button
        className={`pill-btn${cameraMode === 'orthographic' ? ' active' : ''}`}
        data-tip={cameraMode === 'perspective' ? 'Orthographic (P)' : 'Perspective (P)'}
        onClick={toggleCam}
      >
        <Eye size={15} strokeWidth={1.75} />
      </button>
      <button
        className={`pill-btn${gridVisible ? ' active' : ''}`}
        data-tip="Toggle Grid (G)"
        onClick={toggleGrid}
      >
        <Grid3X3 size={15} strokeWidth={1.75} />
      </button>
      <div className="pill-sep" />
      <button
        className={`pill-btn${isolatedNames.size > 0 ? ' active' : ''}`}
        data-tip={isolatedNames.size > 0 ? 'Unisolate' : 'Isolate selected'}
        disabled={selectedMeshNames.size === 0 && isolatedNames.size === 0}
        onClick={() => isolatedNames.size > 0 ? unisolate() : isolate(selectedMeshNames)}
        style={{ opacity: selectedMeshNames.size === 0 && isolatedNames.size === 0 ? 0.35 : 1 }}
      >
        <Focus size={15} strokeWidth={1.75} />
      </button>

      <div className="pill-sep" />

      {/* View presets */}
      {VIEW_PRESETS.map(({ id, face, label }) => (
        <button
          key={id}
          className="pill-btn"
          data-tip={label}
          onClick={() => animateToView(id)}
        >
          <ViewCubeIcon face={face} size={17} />
        </button>
      ))}
    </div>
  )
}
