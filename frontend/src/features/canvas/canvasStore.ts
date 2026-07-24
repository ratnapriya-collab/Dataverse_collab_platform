'use client'

/**
 * canvasStore — Zustand store for the collaborative canvas.
 *
 * State is per-partId + persisted to localStorage so refreshes preserve
 * whatever the user placed on the board. A single flat `nodes` array
 * holds every element (sticky note / text / rectangle / arrow / stroke)
 * because that keeps hit-testing simple and matches the video reference
 * (no nesting — everything is a top-level shape on an infinite plane).
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type NodeKind = 'sticky' | 'text' | 'rect' | 'arrow' | 'stroke'
export type ToolKind =
  | 'select'
  | 'sticky'
  | 'text'
  | 'rect'
  | 'arrow'
  | 'pencil'
  | 'eraser'

/** All node shapes share these fields — position + colour + z-order. */
interface NodeBase {
  id: string
  kind: NodeKind
  x: number
  y: number
  color: string
}

export interface StickyNode extends NodeBase {
  kind: 'sticky'
  w: number
  h: number
  text: string
}
export interface TextNode extends NodeBase {
  kind: 'text'
  text: string
  size: number
}
export interface RectNode extends NodeBase {
  kind: 'rect'
  w: number
  h: number
  text: string
}
export interface ArrowNode extends NodeBase {
  kind: 'arrow'
  x2: number
  y2: number
}
export interface StrokeNode extends NodeBase {
  kind: 'stroke'
  /** Flat SVG path d-string, drawn in canvas world coords. */
  d: string
  width: number
}
export type CanvasNode = StickyNode | TextNode | RectNode | ArrowNode | StrokeNode

interface CanvasState {
  byPartId: Record<string, CanvasNode[]>
  activePartId: string | null

  /** Currently active drawing tool. */
  tool: ToolKind
  /** Currently active colour swatch (hex). */
  color: string
  /** Currently selected node id (for delete / drag). */
  selectedId: string | null
  /** Pan + zoom of the viewport. Zoom = scale multiplier. */
  pan: { x: number; y: number }
  zoom: number

  loadForPart: (partId: string) => void
  setTool: (t: ToolKind) => void
  setColor: (hex: string) => void
  setPan: (pan: { x: number; y: number }) => void
  setZoom: (z: number) => void
  select: (id: string | null) => void
  addNode: (node: CanvasNode) => void
  patchNode: (id: string, patch: Partial<CanvasNode>) => void
  removeNode: (id: string) => void
  clearAll: () => void
}

const mid = (p: string): string =>
  `${p}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      byPartId: {},
      activePartId: null,
      tool: 'select',
      color: '#facc15',           // yellow default (sticky note colour)
      selectedId: null,
      pan: { x: 0, y: 0 },
      zoom: 1,

      loadForPart: (partId) => set({ activePartId: partId, selectedId: null }),

      setTool: (tool) => set({ tool, selectedId: tool === 'select' ? get().selectedId : null }),
      setColor: (color) => set({ color }),
      setPan: (pan) => set({ pan }),
      setZoom: (zoom) => set({ zoom }),
      select: (selectedId) => set({ selectedId }),

      addNode: (node) => {
        const partId = get().activePartId
        if (partId === null) return
        set((s) => ({
          byPartId: {
            ...s.byPartId,
            [partId]: [...(s.byPartId[partId] ?? []), node],
          },
          selectedId: node.id,
        }))
      },

      patchNode: (id, patch) => {
        const partId = get().activePartId
        if (partId === null) return
        set((s) => ({
          byPartId: {
            ...s.byPartId,
            [partId]: (s.byPartId[partId] ?? []).map((n) =>
              n.id === id ? ({ ...n, ...patch } as CanvasNode) : n,
            ),
          },
        }))
      },

      removeNode: (id) => {
        const partId = get().activePartId
        if (partId === null) return
        set((s) => ({
          byPartId: {
            ...s.byPartId,
            [partId]: (s.byPartId[partId] ?? []).filter((n) => n.id !== id),
          },
          selectedId: s.selectedId === id ? null : s.selectedId,
        }))
      },

      clearAll: () => {
        const partId = get().activePartId
        if (partId === null) return
        set((s) => ({
          byPartId: { ...s.byPartId, [partId]: [] },
          selectedId: null,
        }))
      },
    }),
    {
      name: 'dataverse.canvas',
      partialize: (state) => ({ byPartId: state.byPartId }),
    },
  ),
)

export { mid as newNodeId }
