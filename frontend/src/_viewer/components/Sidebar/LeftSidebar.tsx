import { useRef } from 'react'
import { Upload, Boxes, Ruler, Tags, MousePointer2, Atom, History, SplitSquareHorizontal } from 'lucide-react'
import { useViewerStore } from '../../store/viewerStore'
import { loadFile } from '../../lib/babylon/ModelLoader'
import { applyShadingMode, getModelMeshes, getEdgeMeshes } from '../../lib/babylon/ShadingManager'
import { fitToScene } from '../../lib/babylon/CameraManager'
import type { ReactNode } from 'react'

export type SidebarPanel = 'measure' | 'tree' | 'recent' | 'pmi' | 'explode' | 'section'

const PANEL_ITEMS: { id: SidebarPanel; icon: ReactNode; label: string }[] = [
  { id: 'tree',    icon: <Boxes                  size={18} strokeWidth={1.75} />, label: 'Model Tree'   },
  { id: 'measure', icon: <Ruler                  size={18} strokeWidth={1.75} />, label: 'Measure'      },
  { id: 'explode', icon: <Atom                   size={18} strokeWidth={1.75} />, label: 'Explode'      },
  { id: 'section', icon: <SplitSquareHorizontal  size={18} strokeWidth={1.75} />, label: 'Section View' },
  { id: 'pmi',     icon: <Tags                   size={18} strokeWidth={1.75} />, label: 'Annotations'  },
]

interface Props {
  activePanels: SidebarPanel[]
  onToggle: (panel: SidebarPanel) => void
}

export default function LeftSidebar({ activePanels, onToggle }: Props) {
  const fileInputRef    = useRef<HTMLInputElement>(null)
  const babylonScene    = useViewerStore((s) => s.babylonScene)
  const cameraRef       = useViewerStore((s) => s.cameraRef)
  const shadingMode     = useViewerStore((s) => s.shadingMode)
  const setLoadedFileName  = useViewerStore((s) => s.setLoadedFileName)
  const setLoadingMsg      = useViewerStore((s) => s.setLoadingMsg)
  const setModelTree       = useViewerStore((s) => s.setModelTree)
  const setPmiAnnotations  = useViewerStore((s) => s.setPmiAnnotations)
  const selectModeActive    = useViewerStore((s) => s.selectModeActive)
  const setSelectModeActive = useViewerStore((s) => s.setSelectModeActive)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !babylonScene || !cameraRef) return
    getModelMeshes(babylonScene).forEach((m) => m.dispose())
    getEdgeMeshes(babylonScene).forEach((m) => m.dispose())
    setModelTree([])
    try {
      setLoadingMsg(`Loading ${file.name}…`)
      const { meshes, tree, pmi } = await loadFile(file, babylonScene, () => {})
      setModelTree(tree)
      setPmiAnnotations(pmi)
      applyShadingMode(shadingMode, meshes)
      fitToScene(cameraRef, meshes)
      setLoadedFileName(file.name)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      alert(`Failed to load file:\n${msg}`)
    } finally {
      setLoadingMsg(null)
    }
    e.target.value = ''
  }

  return (
    <div className="left-sidebar">
      <div
        className="sidebar-item sidebar-action"
        data-tip="Load file"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={16} strokeWidth={1.75} />
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.gltf,.stp,.step"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <div
        data-tip="Recent"
        className={`sidebar-item${activePanels.includes('recent') ? ' active' : ''}`}
        onClick={() => onToggle('recent')}
      >
        <History size={18} strokeWidth={1.75} />
      </div>

      <div className="sidebar-sep" />

      {/* Select mode toggle */}
      <div
        data-tip="Select (S)"
        className={`sidebar-item${selectModeActive ? ' active' : ''}`}
        onClick={() => setSelectModeActive(!selectModeActive)}
      >
        <MousePointer2 size={18} strokeWidth={1.75} />
      </div>


      {PANEL_ITEMS.map(({ id, icon, label }) => (
        <div
          key={id}
          data-tip={label}
          className={`sidebar-item${activePanels.includes(id) ? ' active' : ''}`}
          onClick={() => onToggle(id)}
        >
          {icon}
        </div>
      ))}
    </div>
  )
}
