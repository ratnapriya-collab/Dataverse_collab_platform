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

export type NodeKind = 'sticky' | 'text' | 'rect' | 'arrow' | 'stroke' | 'chip' | 'image'
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
  /**
   * Visual variants:
   *   'outline' (default) — border box; used for stickies-container / frame
   *   'pill'    — rounded pill; used for column headers & sub-headers
   *   'filled'  — solid-fill rounded box (light peach / orange stickies)
   */
  variant?: 'outline' | 'pill' | 'filled'
  /** Optional title rendered above the rect (used for the framed board). */
  titleAbove?: string
  /** Font size for the label (default 12). */
  fontSize?: number
  /** Rendered z-index — lower numbers sit behind. Optional. */
  z?: number
}

/** User tag chip with a small pointer arrow — the "presence" comment marker. */
export interface ChipNode extends NodeBase {
  kind: 'chip'
  text: string
  /** Direction the cursor arrow points; where the person is "looking". */
  arrow: 'up' | 'down' | 'left' | 'right'
}

/** Image placeholder — used when we don't have a real CAD screenshot yet. */
export interface ImageNode extends NodeBase {
  kind: 'image'
  w: number
  h: number
  label: string
  /** lucide-react icon name (e.g. 'Train', 'DoorOpen'). Renders as a
   *  crisp SVG glyph inside the placeholder — the corporate replacement
   *  for emoji stand-ins. */
  icon?: string
  /** Optional emoji fallback when no icon or src is set. */
  emoji?: string
  /** Optional data URL or public path. */
  src?: string
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
export type CanvasNode =
  | StickyNode
  | TextNode
  | RectNode
  | ArrowNode
  | StrokeNode
  | ChipNode
  | ImageNode

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
  /**
   * Populate the active canvas with the Hyperloop Pod FMEA layout.
   * If viewport is provided, also re-centers pan + auto-fits zoom so the
   * whole frame lands centered in the viewer without further scrolling.
   */
  seedFMEATemplate: (viewport?: { width: number; height: number }) => void
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

      seedFMEATemplate: (viewport) => {
        const partId = get().activePartId
        if (partId === null) return
        const { nodes, bbox } = buildHyperloopFMEA()
        set((s) => ({
          byPartId: { ...s.byPartId, [partId]: [...(s.byPartId[partId] ?? []), ...nodes] },
          selectedId: null,
        }))
        if (viewport !== undefined) {
          // Fit-to-view: pick the largest zoom that leaves ~40 px margin
          // on both sides. Then translate so the frame center lands in
          // the viewport center.
          const marginX = 40
          const marginY = 60
          const zoomFitW = (viewport.width - marginX * 2) / bbox.w
          const zoomFitH = (viewport.height - marginY * 2) / bbox.h
          const nextZoom = Math.max(0.35, Math.min(1, zoomFitW, zoomFitH))
          const frameCX = bbox.x + bbox.w / 2
          const frameCY = bbox.y + bbox.h / 2
          set({
            zoom: nextZoom,
            pan: {
              x: viewport.width / 2 - frameCX * nextZoom,
              y: viewport.height / 2 - frameCY * nextZoom,
            },
          })
        }
      },
    }),
    {
      name: 'dataverse.canvas',
      partialize: (state) => ({ byPartId: state.byPartId }),
    },
  ),
)

export { mid as newNodeId }

// ── FMEA Template — Hyperloop Pod User Story & Failure Mode mapping ────────
// One-shot seed that mirrors the canvas from the reference recording:
// 5 lifecycle-stage columns × [Potential Failure Mode | Effect of Failure]
// grid of sticky notes, with column headers, CAD placeholders, and multi-user
// presence chips (Engineering Manager, Design Engineer, Tony Martini,
// Tooling Engineer). Every position is in canvas world coords so pan/zoom
// treat the whole layout as one deterministic scene.
//
// Colors are neutral tokens — orange stickies for Potential Failure Mode,
// peach for Effect of Failure, sky-blue pills for headers, brand-tinted
// chips per user role. Tweak once here to restyle the entire template.

// Sky-blue corporate palette — the whole board reads as one cohesive
// system. Headers are the deepest tint, sub-headers a step lighter,
// stickies barely tinted. Chips keep individual hues so teammates stay
// visually distinct as they move across the board.
const FMEA_COLORS = {
  frameBorder:    '#cbd5e1',    // slate-300
  frameBg:        '#ffffff',
  headerPillBg:   '#0284c7',    // sky-600 (column headers)
  headerPillText: '#ffffff',
  tabPillBg:      '#bae6fd',    // sky-200 (top tab pills)
  fmOrange:       '#e0f2fe',    // sky-100  (Potential Failure Mode sticky)
  eofPeach:       '#f0f9ff',    // sky-50   (Effect of Failure sticky)
  fmHeader:       '#38bdf8',    // sky-400 (FM sub-header pill)
  eofHeader:      '#7dd3fc',    // sky-300 (EoF sub-header pill)
  chipEngMgr:     '#a855f7',    // purple-500
  chipDesignEng:  '#22c55e',    // green-500
  chipMartini:    '#3b82f6',    // blue-500
  chipTooling:    '#0ea5e9',    // sky-500
} as const

interface FMEAColumn {
  title: string
  /** lucide-react icon name — corporate replacement for the emoji. */
  icon: string
  fm: string[]
  eof: string[]
}

const FMEA_COLUMNS: FMEAColumn[] = [
  {
    title: 'Enter pod from right side',
    icon: 'DoorOpen',
    fm: [
      "Door won't latch / obstruction sensor false trip",
      'Seat restraint fails to lock',
      'Boarding bridge misalignment with pod sill',
    ],
    eof: [
      'Boarding delayed: departure slips, passenger anxiety',
      'Repeated cycling jams door; pod taken out of service',
      'Passenger unsecured at launch; injury risk under accel',
      'System inhibits launch; trip cannot start',
      'Trip hazard at threshold; passenger fall',
    ],
  },
  {
    title: 'Close and seal door',
    icon: 'Lock',
    fm: [
      'Cabin fails to reach pressure',
      'Door seal leak (slow loss)',
    ],
    eof: [
      'Hypoxia risk to passengers',
      'Boarding aborted; passengers deplane',
      'Ear discomfort, passenger distress',
      'Gradual depressurization in transit; emergency descent in pressure',
      'Whistling noise; comfort and confidence loss',
      "Pressurization sensor false 'OK' reading",
      'Undetected unsafe condition; launch into hazard',
    ],
  },
  {
    title: 'Launch and accelerate',
    icon: 'Rocket',
    fm: ['Loss of propulsive thrust'],
    eof: [
      'Pod stalls in tube; mission abort, rescue needed',
      'Schedule cascade affects following pods',
    ],
  },
  {
    title: 'Cruise and lift',
    icon: 'Zap',
    fm: [
      'Levitation collapse / air-gap loss',
      'Tube pressure breach (vacuum loss)',
      'Guidance / position signal loss',
    ],
    eof: [
      'Pod contacts guideway at speed; catastrophic damage, injury',
      'Emergency wheel deploy; harsh ride, abrupt slowdown',
      'Sudden drag spike; violent deceleration',
      'Reduced range; pod cannot reach destination',
      'Erratic motion; collision risk with terminal or lead pod',
    ],
  },
  {
    title: 'Decelerate and brake to stop',
    icon: 'OctagonAlert',
    fm: ['Brake actuation failure'],
    eof: ['Overrun of stop point; collision with terminal or pod ahead'],
  },
]

function buildHyperloopFMEA(): { nodes: CanvasNode[]; bbox: { x: number; y: number; w: number; h: number } } {
  const newNodeId = mid
  const nodes: CanvasNode[] = []
  // Grid geometry — each column is CELL_W wide, plus a gap. Rows share
  // a fixed height so the mesh always aligns visually.
  const COL_W = 260
  const COL_GAP = 12
  const SUB_W = (COL_W - COL_GAP) / 2
  const CELL_H = 84
  const CELL_GAP = 10
  const HEADER_H = 30
  const IMG_H = 90

  // Placed at world (0, 0). Fit-to-view logic in the store recomputes
  // pan + zoom so the frame lands centered in the viewport regardless
  // of window size.
  const originX = 0
  const originY = 0

  // Frame — outlined container; title sits INSIDE it at the top-left
  // (matches the reference recording).
  const framePadX = 20
  const titleH = 34
  const tabsH  = 30
  const topPad = titleH + tabsH + 14
  const frameW = FMEA_COLUMNS.length * COL_W + (FMEA_COLUMNS.length - 1) * COL_GAP + framePadX * 2
  const maxEofRows = Math.max(...FMEA_COLUMNS.map((c) => c.eof.length))
  const maxFmRows  = Math.max(...FMEA_COLUMNS.map((c) => c.fm.length))
  const gridRows   = Math.max(maxFmRows, maxEofRows)
  const frameH = topPad + HEADER_H + 14 + IMG_H + 14 + 22 + 10 + gridRows * (CELL_H + CELL_GAP) + 40

  nodes.push({
    id: newNodeId('frame'),
    kind: 'rect',
    x: originX,
    y: originY,
    w: frameW,
    h: frameH,
    color: FMEA_COLORS.frameBorder,
    text: '',
    variant: 'outline',
    z: 0,
  })

  // Title INSIDE the frame at top-left (no wrap).
  nodes.push({
    id: newNodeId('title'),
    kind: 'text',
    x: originX + framePadX,
    y: originY + 14,
    color: '#0f172a',
    text: 'Hyperloop Pod User Story and Failure Mode and Effects Mapping',
    size: 16,
  })

  // Three tab pills below the title.
  const tabY = originY + titleH + 8
  ;['User Step', 'Potential Failure Mode', 'Effect of Failure'].forEach((label, i) => {
    nodes.push({
      id: newNodeId('tab'),
      kind: 'rect',
      x: originX + framePadX + i * 138,
      y: tabY,
      w: 128,
      h: 24,
      color: FMEA_COLORS.tabPillBg,
      text: label,
      variant: 'pill',
      fontSize: 10.5,
    })
  })

  // Per-column construction.
  const colBaseY = originY + topPad
  FMEA_COLUMNS.forEach((col, ci) => {
    const colX = originX + framePadX + ci * (COL_W + COL_GAP)

    nodes.push({
      id: newNodeId('colhdr'),
      kind: 'rect',
      x: colX,
      y: colBaseY,
      w: COL_W,
      h: HEADER_H,
      color: FMEA_COLORS.headerPillBg,
      text: col.title,
      variant: 'pill',
      fontSize: 12,
    })

    nodes.push({
      id: newNodeId('img'),
      kind: 'image',
      x: colX,
      y: colBaseY + HEADER_H + 14,
      w: COL_W,
      h: IMG_H,
      color: FMEA_COLORS.frameBg,
      label: col.title,
      icon: col.icon,
    })

    const subHdrY = colBaseY + HEADER_H + 14 + IMG_H + 14
    nodes.push({
      id: newNodeId('subhdr'),
      kind: 'rect',
      x: colX,
      y: subHdrY,
      w: SUB_W,
      h: 22,
      color: FMEA_COLORS.fmHeader,
      text: 'Potential Failure Mode',
      variant: 'pill',
      fontSize: 10,
    })
    nodes.push({
      id: newNodeId('subhdr'),
      kind: 'rect',
      x: colX + SUB_W + COL_GAP,
      y: subHdrY,
      w: SUB_W,
      h: 22,
      color: FMEA_COLORS.eofHeader,
      text: 'Effect of Failure',
      variant: 'pill',
      fontSize: 10,
    })

    const cellY = subHdrY + 22 + 10
    col.fm.forEach((text, i) => {
      nodes.push({
        id: newNodeId('sticky'),
        kind: 'sticky',
        x: colX,
        y: cellY + i * (CELL_H + CELL_GAP),
        w: SUB_W,
        h: CELL_H,
        color: FMEA_COLORS.fmOrange,
        text,
      })
    })
    col.eof.forEach((text, i) => {
      nodes.push({
        id: newNodeId('sticky'),
        kind: 'sticky',
        x: colX + SUB_W + COL_GAP,
        y: cellY + i * (CELL_H + CELL_GAP),
        w: SUB_W,
        h: CELL_H,
        color: FMEA_COLORS.eofPeach,
        text,
      })
    })
  })

  // Presence chips — anchored just below the CAD-image row of their
  // "assigned" column so each teammate reads as reviewing that stage.
  const chipY = colBaseY + HEADER_H + 14 + IMG_H + 4
  const colX = (i: number): number => originX + framePadX + i * (COL_W + COL_GAP)

  nodes.push({
    id: newNodeId('chip'),
    kind: 'chip',
    x: colX(1) + SUB_W - 40,
    y: chipY,
    color: FMEA_COLORS.chipEngMgr,
    text: 'Engineering Manager',
    arrow: 'up',
  })
  nodes.push({
    id: newNodeId('chip'),
    kind: 'chip',
    x: colX(2) + SUB_W - 30,
    y: chipY,
    color: FMEA_COLORS.chipMartini,
    text: 'Tony Martini',
    arrow: 'up',
  })
  nodes.push({
    id: newNodeId('chip'),
    kind: 'chip',
    x: colX(3) + SUB_W - 30,
    y: chipY,
    color: FMEA_COLORS.chipDesignEng,
    text: 'Design Engineer',
    arrow: 'up',
  })
  nodes.push({
    id: newNodeId('chip'),
    kind: 'chip',
    x: colX(4) + SUB_W - 30,
    y: chipY,
    color: FMEA_COLORS.chipTooling,
    text: 'Tooling Engineer',
    arrow: 'up',
  })

  // Free-floating callout text from the Engineering Manager, hovering
  // above the "Launch and accelerate" column.
  nodes.push({
    id: newNodeId('text'),
    kind: 'text',
    x: colX(2) + 30,
    y: chipY + 30,
    color: FMEA_COLORS.chipEngMgr,
    text: 'More detail needed here',
    size: 12,
  })

  return {
    nodes,
    bbox: { x: originX, y: originY, w: frameW, h: frameH },
  }
}
