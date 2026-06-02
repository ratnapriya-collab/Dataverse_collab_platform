import { create } from 'zustand'
import type { Scene, ArcRotateCamera } from '@babylonjs/core'
import type { ShadingMode, CameraMode, MeasureTool, MeasurementEntry, SelectionInfo, TreeNode, PMIAnnotation } from '../types/viewer'

// ── Tree helpers ──────────────────────────────────────────────────────────────

function mapTree(nodes: TreeNode[], fn: (n: TreeNode) => TreeNode): TreeNode[] {
  return nodes.map(n => fn({ ...n, children: mapTree(n.children, fn) }))
}

function setSubtreeVisible(nodes: TreeNode[], visible: boolean): TreeNode[] {
  return nodes.map(n => ({ ...n, visible, children: setSubtreeVisible(n.children, visible) }))
}

// ── Store interface ───────────────────────────────────────────────────────────

interface ViewerStore {
  // Scene
  babylonScene: Scene | null
  cameraRef: ArcRotateCamera | null
  cursorPos: { x: string; y: string; z: string }
  setBabylonScene: (s: Scene | null) => void
  setCameraRef: (c: ArcRotateCamera | null) => void
  setCursorPos: (p: { x: string; y: string; z: string }) => void

  // View settings
  shadingMode: ShadingMode
  cameraMode: CameraMode
  gridVisible: boolean
  axesVisible: boolean
  setShadingMode: (m: ShadingMode) => void
  setCameraMode: (m: CameraMode) => void
  toggleGrid: () => void
  toggleAxes: () => void

  // Explode
  explodeFactor: number                   // 0..1
  setExplodeFactor: (v: number) => void

  // Measurement
  activeMeasureTool: MeasureTool | null   // null = measure mode off
  measurements: MeasurementEntry[]
  setMeasureTool: (t: MeasureTool | null) => void
  addMeasurement: (m: MeasurementEntry) => void
  removeMeasurement: (id: string) => void
  clearMeasurements: () => void

  // Face-pick mode (DataVerse extension — picks BREP faces, not meshes)
  facePickMode: boolean
  setFacePickMode: (v: boolean) => void

  // Selection (multi-select)
  selectModeActive: boolean
  setSelectModeActive: (v: boolean) => void
  selectedMeshNames: Set<string>
  selectionInfo: SelectionInfo | null
  addSelection:   (name: string, info: SelectionInfo) => void
  removeSelection:(name: string) => void
  clearSelection: () => void

  // Isolate
  isolatedNames: Set<string>
  isolate:   (names: Set<string>) => void
  unisolate: () => void

  // Section plane
  sectionPlane: { axis: 'X' | 'Y' | 'Z'; offset: number } | null
  setSectionPlane: (p: { axis: 'X' | 'Y' | 'Z'; offset: number } | null) => void

  // File loading status
  loadedFileName: string | null
  loadingMsg: string | null
  setLoadedFileName: (name: string | null) => void
  setLoadingMsg: (msg: string | null) => void

  // Model tree
  modelTree: TreeNode[]
  setModelTree: (tree: TreeNode[]) => void
  setNodeVisibility: (id: string, visible: boolean) => void

  // PMI annotations
  pmiAnnotations:    PMIAnnotation[]
  pmiVisible:        boolean
  setPmiAnnotations: (a: PMIAnnotation[]) => void
  togglePmi:         () => void
  setPmiVisibility:  (id: string, visible: boolean) => void

  // Comments overlay (pins + floating comment cards on the 3D viewer).
  // Single switch — both render layers gate on this flag together so the
  // viewer goes from "annotated" to "clean geometry" in one click.
  commentsOverlayVisible: boolean
  toggleCommentsOverlay:  () => void
  setCommentsOverlayVisible: (visible: boolean) => void
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useViewerStore = create<ViewerStore>((set) => ({
  // Scene
  babylonScene: null,
  cameraRef: null,
  cursorPos: { x: '0.00', y: '0.00', z: '0.00' },
  setBabylonScene: (babylonScene) => set({ babylonScene }),
  setCameraRef: (cameraRef) => set({ cameraRef }),
  setCursorPos: (cursorPos) => set({ cursorPos }),

  // View settings
  shadingMode: 'shadedEdges',
  cameraMode: 'perspective',
  gridVisible: true,
  axesVisible: true,
  setShadingMode: (shadingMode) => set({ shadingMode }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  toggleGrid: () => set((s) => ({ gridVisible: !s.gridVisible })),
  toggleAxes: () => set((s) => ({ axesVisible: !s.axesVisible })),

  // Explode
  explodeFactor: 0,
  setExplodeFactor: (explodeFactor) => set({ explodeFactor }),

  // Measurement
  activeMeasureTool: null,
  measurements: [],
  setMeasureTool: (activeMeasureTool) => set((s) => ({
    activeMeasureTool,
    // activating a measure tool exits select mode
    selectModeActive: activeMeasureTool ? false : s.selectModeActive,
  })),
  addMeasurement: (m) => set((s) => ({ measurements: [...s.measurements, m] })),
  removeMeasurement: (id) => set((s) => ({ measurements: s.measurements.filter((m) => m.id !== id) })),
  clearMeasurements: () => set({ measurements: [] }),

  // Face-pick mode (DataVerse extension)
  facePickMode: true,
  setFacePickMode: (facePickMode) => set((s) => ({
    facePickMode,
    // turning on face-pick exits mesh selection AND any measure tool
    selectModeActive: facePickMode ? false : s.selectModeActive,
    activeMeasureTool: facePickMode ? null : s.activeMeasureTool,
  })),

  // Selection
  selectModeActive: false,
  setSelectModeActive: (selectModeActive) => set((s) => ({
    selectModeActive,
    // activating select mode exits any active measure tool AND face-pick
    activeMeasureTool: selectModeActive ? null : s.activeMeasureTool,
    facePickMode: selectModeActive ? false : s.facePickMode,
  })),
  selectedMeshNames: new Set<string>(),
  selectionInfo: null,
  addSelection: (name, info) => set((s) => ({
    selectedMeshNames: new Set([...s.selectedMeshNames, name]),
    selectionInfo: info,
  })),
  removeSelection: (name) => set((s) => {
    const next = new Set(s.selectedMeshNames)
    next.delete(name)
    return { selectedMeshNames: next, selectionInfo: next.size === 0 ? null : s.selectionInfo }
  }),
  clearSelection: () => set({ selectedMeshNames: new Set(), selectionInfo: null }),

  // Isolate — actual mesh show/hide is handled by IsolateController
  isolatedNames: new Set<string>(),
  isolate:   (names) => set({ isolatedNames: new Set(names) }),
  unisolate: () => set({ isolatedNames: new Set() }),

  // Section plane — actual clipping handled by SectionController
  sectionPlane: null,
  setSectionPlane: (sectionPlane) => set({ sectionPlane }),

  // File loading status
  loadedFileName: null,
  loadingMsg: null,
  setLoadedFileName: (loadedFileName) => set({ loadedFileName }),
  setLoadingMsg: (loadingMsg) => set({ loadingMsg }),

  // Model tree
  modelTree: [],
  setModelTree: (modelTree) => set({ modelTree, explodeFactor: 0 }),
  setNodeVisibility: (id, visible) =>
    set((s) => ({
      modelTree: mapTree(s.modelTree, (n) =>
        n.id === id
          ? { ...n, visible, children: setSubtreeVisible(n.children, visible) }
          : n
      ),
    })),

  // PMI annotations
  pmiAnnotations: [],
  pmiVisible: true,
  setPmiAnnotations: (pmiAnnotations) => set({ pmiAnnotations }),
  togglePmi: () => set((s) => ({ pmiVisible: !s.pmiVisible })),
  setPmiVisibility: (id, visible) => set((s) => ({
    pmiAnnotations: s.pmiAnnotations.map(a => a.id === id ? { ...a, visible } : a),
  })),

  // Comments overlay — default ON (matches the original behaviour). When
  // false, CommentLabels renders nothing — clean geometry view.
  commentsOverlayVisible: true,
  toggleCommentsOverlay: () => set((s) => ({ commentsOverlayVisible: !s.commentsOverlayVisible })),
  setCommentsOverlayVisible: (commentsOverlayVisible) => set({ commentsOverlayVisible }),
}))
