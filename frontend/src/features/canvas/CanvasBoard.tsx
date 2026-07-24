'use client'

/**
 * CanvasBoard — the infinite scrollable board.
 *
 * Pattern:
 *   · A container `<div>` sized to the full remaining space is the
 *     viewport. Pointer events (pan / click-to-add / drag) fire here.
 *   · An inner `<div class="canvas-world">` is `absolute` positioned and
 *     `transform: translate(pan) scale(zoom)`. All nodes live inside it
 *     so pan / zoom apply uniformly.
 *   · Nodes render as absolute-positioned React elements in WORLD coords
 *     (no scaling per-node — the world transform does it).
 *
 * Interactions per tool:
 *   · Select   — click a node to select, drag to move, Delete to remove
 *   · Sticky   — click empty canvas to drop a sticky note (auto-focus)
 *   · Text     — click empty canvas to drop an inline text label
 *   · Rect     — click empty canvas to drop a labelled rectangle
 *   · Arrow    — click-drag to draw a straight arrow from A to B
 *   · Pencil   — click-drag to draw a freehand SVG path
 *   · Eraser   — click a node to delete it
 *   · Middle-mouse or space+drag pans the world regardless of tool
 */

import { useEffect, useRef, useState } from 'react'
import {
  DoorOpen,
  Lock,
  OctagonAlert,
  Rocket,
  Train,
  Zap,
  Image as ImageIcon,
  type LucideIcon,
} from 'lucide-react'
import { useCanvasStore, newNodeId, type CanvasNode } from './canvasStore'
import LiveCursors from './LiveCursors'

const LUCIDE_ICONS: Record<string, LucideIcon> = {
  DoorOpen,
  Lock,
  OctagonAlert,
  Rocket,
  Train,
  Zap,
}

interface Props {
  partId: string
}

export default function CanvasBoard({ partId }: Props): JSX.Element {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const nodes = useCanvasStore((s) => s.byPartId[partId] ?? [])
  const tool = useCanvasStore((s) => s.tool)
  const color = useCanvasStore((s) => s.color)
  const pan = useCanvasStore((s) => s.pan)
  const zoom = useCanvasStore((s) => s.zoom)
  const setPan = useCanvasStore((s) => s.setPan)
  const setZoom = useCanvasStore((s) => s.setZoom)
  const selectedId = useCanvasStore((s) => s.selectedId)
  const select = useCanvasStore((s) => s.select)
  const addNode = useCanvasStore((s) => s.addNode)
  const patchNode = useCanvasStore((s) => s.patchNode)
  const removeNode = useCanvasStore((s) => s.removeNode)
  const loadForPart = useCanvasStore((s) => s.loadForPart)

  const [panStart, setPanStart] = useState<{
    x: number; y: number; startPan: { x: number; y: number }
  } | null>(null)
  const [dragStart, setDragStart] = useState<{
    id: string; x: number; y: number; nodeX: number; nodeY: number
  } | null>(null)
  const [drawing, setDrawing] = useState<{
    kind: 'arrow' | 'stroke'
    startX: number; startY: number
    tempD?: string
    id?: string
  } | null>(null)

  useEffect(() => {
    loadForPart(partId)
  }, [partId, loadForPart])

  /** Convert pointer client-coords → world coords using pan/zoom. */
  const toWorld = (clientX: number, clientY: number): { x: number; y: number } => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (rect === undefined) return { x: 0, y: 0 }
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    }
  }

  // Delete-key removes the selected node
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (selectedId !== null && (e.key === 'Delete' || e.key === 'Backspace')) {
        // Don't delete when typing into a sticky / text node
        const t = e.target as HTMLElement | null
        if (t?.isContentEditable || t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA') return
        removeNode(selectedId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, removeNode])

  // Wheel = zoom (with modifier) or pan (default)
  const handleWheel = (e: React.WheelEvent): void => {
    if (e.ctrlKey || e.metaKey) {
      const delta = -e.deltaY * 0.001
      setZoom(Math.max(0.2, Math.min(3, zoom + delta)))
    } else {
      setPan({ x: pan.x - e.deltaX, y: pan.y - e.deltaY })
    }
  }

  const handlePointerDown = (e: React.PointerEvent): void => {
    if (e.target !== viewportRef.current) return
    const w = toWorld(e.clientX, e.clientY)

    // Middle-mouse pan
    if (e.button === 1) {
      setPanStart({ x: e.clientX, y: e.clientY, startPan: { ...pan } })
      viewportRef.current?.setPointerCapture(e.pointerId)
      return
    }

    if (tool === 'sticky') {
      // Uniform compact size — matches the FMEA-style grid in the
      // reference video where every box aligns to the same 128×72 cell.
      const CELL_W = 128
      const CELL_H = 72
      addNode({
        id: newNodeId('sticky'),
        kind: 'sticky',
        x: w.x - CELL_W / 2,
        y: w.y - CELL_H / 2,
        w: CELL_W,
        h: CELL_H,
        color,
        text: '',
      })
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>('[data-selected-sticky] [contenteditable]')
        el?.focus()
      })
    } else if (tool === 'text') {
      addNode({
        id: newNodeId('text'),
        kind: 'text',
        x: w.x,
        y: w.y,
        color,
        text: 'Type here',
        size: 14,
      })
    } else if (tool === 'rect') {
      // Same 128×72 uniform cell as sticky so grids align neatly when
      // mixing outlined + filled boxes side-by-side.
      const CELL_W = 128
      const CELL_H = 72
      addNode({
        id: newNodeId('rect'),
        kind: 'rect',
        x: w.x - CELL_W / 2,
        y: w.y - CELL_H / 2,
        w: CELL_W,
        h: CELL_H,
        color,
        text: '',
      })
    } else if (tool === 'arrow') {
      setDrawing({ kind: 'arrow', startX: w.x, startY: w.y })
    } else if (tool === 'pencil') {
      setDrawing({
        kind: 'stroke',
        startX: w.x,
        startY: w.y,
        tempD: `M${w.x.toFixed(1)} ${w.y.toFixed(1)}`,
      })
    } else if (tool === 'select') {
      select(null)
      // Empty-space drag with select tool = pan
      setPanStart({ x: e.clientX, y: e.clientY, startPan: { ...pan } })
      viewportRef.current?.setPointerCapture(e.pointerId)
    }
  }

  const handlePointerMove = (e: React.PointerEvent): void => {
    if (panStart !== null) {
      setPan({
        x: panStart.startPan.x + (e.clientX - panStart.x),
        y: panStart.startPan.y + (e.clientY - panStart.y),
      })
      return
    }
    if (dragStart !== null) {
      const w = toWorld(e.clientX, e.clientY)
      patchNode(dragStart.id, {
        x: dragStart.nodeX + (w.x - dragStart.x),
        y: dragStart.nodeY + (w.y - dragStart.y),
      } as Partial<CanvasNode>)
      return
    }
    if (drawing !== null) {
      const w = toWorld(e.clientX, e.clientY)
      if (drawing.kind === 'stroke') {
        setDrawing({
          ...drawing,
          tempD: `${drawing.tempD} L${w.x.toFixed(1)} ${w.y.toFixed(1)}`,
        })
      } else {
        // Arrow preview — just re-render, endpoint tracked as w in drawing.tempD
        setDrawing({ ...drawing, tempD: `${w.x},${w.y}` })
      }
    }
  }

  const handlePointerUp = (e: React.PointerEvent): void => {
    if (panStart !== null) {
      viewportRef.current?.releasePointerCapture(e.pointerId)
      setPanStart(null)
      return
    }
    if (dragStart !== null) {
      setDragStart(null)
      return
    }
    if (drawing !== null) {
      const w = toWorld(e.clientX, e.clientY)
      if (drawing.kind === 'stroke' && drawing.tempD !== undefined) {
        addNode({
          id: newNodeId('stroke'),
          kind: 'stroke',
          x: 0, y: 0,  // strokes use absolute path coords
          color,
          d: drawing.tempD,
          width: 2,
        })
      } else if (drawing.kind === 'arrow') {
        addNode({
          id: newNodeId('arrow'),
          kind: 'arrow',
          x: drawing.startX,
          y: drawing.startY,
          x2: w.x,
          y2: w.y,
          color,
        })
      }
      setDrawing(null)
    }
  }

  /** Cursor style per tool for feedback. */
  const cursorFor = (): string => {
    if (tool === 'select') return panStart !== null ? 'grabbing' : 'default'
    if (tool === 'sticky' || tool === 'text' || tool === 'rect') return 'copy'
    if (tool === 'pencil') return 'crosshair'
    if (tool === 'arrow') return 'crosshair'
    if (tool === 'eraser') return 'not-allowed'
    return 'default'
  }

  return (
    <div
      ref={viewportRef}
      className="dv-canvas-viewport relative h-full w-full select-none overflow-hidden"
      style={{
        cursor: cursorFor(),
        // Dotted background — moves with pan for infinite-canvas feel.
        backgroundColor: '#f8fafc',
        backgroundImage:
          'radial-gradient(rgba(100,116,139,0.25) 1px, transparent 1px)',
        backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
      }}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* World layer — everything inside inherits the pan/zoom transform. */}
      <div
        className="absolute left-0 top-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {nodes.map((n) => (
          <NodeView
            key={n.id}
            node={n}
            selected={n.id === selectedId}
            tool={tool}
            onSelect={() => {
              if (tool === 'eraser') removeNode(n.id)
              else if (tool === 'select') select(n.id)
            }}
            onDragStart={(e) => {
              if (tool !== 'select') return
              const w = toWorld(e.clientX, e.clientY)
              select(n.id)
              setDragStart({ id: n.id, x: w.x, y: w.y, nodeX: n.x, nodeY: n.y })
            }}
            onChangeText={(text) =>
              patchNode(n.id, { text } as Partial<CanvasNode>)
            }
          />
        ))}

        {/* Preview shapes while drawing */}
        {drawing?.kind === 'stroke' && drawing.tempD !== undefined && (
          <svg className="pointer-events-none absolute left-0 top-0 h-full w-full overflow-visible">
            <path
              d={drawing.tempD}
              stroke={color}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        )}
        {drawing?.kind === 'arrow' && drawing.tempD !== undefined && (
          <svg className="pointer-events-none absolute left-0 top-0 h-full w-full overflow-visible">
            {(() => {
              const [x2s, y2s] = drawing.tempD.split(',')
              const x2 = Number(x2s), y2 = Number(y2s)
              return (
                <line
                  x1={drawing.startX} y1={drawing.startY}
                  x2={x2} y2={y2}
                  stroke={color} strokeWidth={2}
                  markerEnd="url(#arrow-preview-head)"
                />
              )
            })()}
            <defs>
              <marker
                id="arrow-preview-head"
                markerWidth="10" markerHeight="10"
                refX="8" refY="3" orient="auto"
              >
                <path d="M0,0 L0,6 L9,3 z" fill={color} />
              </marker>
            </defs>
          </svg>
        )}
      </div>

      {/* Simulated live-cursor overlay — sits in world coords too. */}
      <div
        className="pointer-events-none absolute left-0 top-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <LiveCursors />
      </div>
    </div>
  )
}

// ── Per-node rendering ─────────────────────────────────────────────────

function NodeView({
  node, selected, tool, onSelect, onDragStart, onChangeText,
}: {
  node: CanvasNode
  selected: boolean
  tool: string
  onSelect: () => void
  onDragStart: (e: React.PointerEvent) => void
  onChangeText: (text: string) => void
}): JSX.Element | null {
  const dragProps = {
    onPointerDown: (e: React.PointerEvent) => {
      e.stopPropagation()
      onSelect()
      onDragStart(e)
    },
  }
  const ring = selected ? '0 0 0 2px #06b6d4' : 'none'

  if (node.kind === 'sticky') {
    return (
      <div
        data-selected-sticky={selected ? '' : undefined}
        {...dragProps}
        style={{
          position: 'absolute',
          left: node.x, top: node.y,
          width: node.w, height: node.h,
          backgroundColor: node.color,
          boxShadow: `0 4px 12px rgba(15,23,42,0.15), ${ring}`,
          borderRadius: 4,
          cursor: tool === 'select' ? 'move' : 'default',
        }}
      >
        <div
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => onChangeText((e.currentTarget as HTMLDivElement).innerText)}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            padding: 12, height: '100%', outline: 'none',
            fontSize: 13, lineHeight: 1.35, color: '#0f172a',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}
        >
          {node.text}
        </div>
      </div>
    )
  }

  if (node.kind === 'text') {
    return (
      <div
        {...dragProps}
        style={{
          position: 'absolute', left: node.x, top: node.y,
          padding: '2px 4px',
          color: node.color,
          fontSize: node.size,
          fontWeight: 600,
          boxShadow: ring,
          borderRadius: 3,
          cursor: tool === 'select' ? 'move' : 'default',
        }}
      >
        <span
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => onChangeText((e.currentTarget as HTMLSpanElement).innerText)}
          onPointerDown={(e) => e.stopPropagation()}
          style={{ outline: 'none', display: 'inline-block', minWidth: 40 }}
        >
          {node.text}
        </span>
      </div>
    )
  }

  if (node.kind === 'rect') {
    const variant = node.variant ?? 'outline'
    const fontSize = node.fontSize ?? 12
    // 'pill' — flat pill button (used for column headers + tab pills)
    // 'filled' — solid rounded box (used for the framed board bg)
    // 'outline' (default) — border-only box; the FMEA frame + generic rects
    const isPill = variant === 'pill'
    const isFilled = variant === 'filled'
    const style: React.CSSProperties = {
      position: 'absolute',
      left: node.x,
      top: node.y,
      width: node.w,
      height: node.h,
      border: isPill || isFilled ? 'none' : `1.5px solid ${node.color}`,
      borderRadius: isPill ? 999 : 8,
      backgroundColor: isPill || isFilled ? node.color : `${node.color}12`,
      boxShadow: ring,
      cursor: tool === 'select' ? 'move' : 'default',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: isPill ? '0 12px' : 8,
      zIndex: node.z,
    }
    return (
      <>
        {node.titleAbove !== undefined && (
          <div
            style={{
              position: 'absolute',
              left: node.x + 4,
              top: node.y - 22,
              fontSize: 13,
              fontWeight: 700,
              color: '#0f172a',
              letterSpacing: 0.1,
            }}
          >
            {node.titleAbove}
          </div>
        )}
        <div {...dragProps} style={style}>
          <span
            contentEditable={!isPill}
            suppressContentEditableWarning
            onInput={(e) => onChangeText((e.currentTarget as HTMLSpanElement).innerText)}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              outline: 'none',
              fontSize,
              fontWeight: isPill ? 700 : 600,
              color: '#0f172a',
              textAlign: 'center',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
            }}
          >
            {node.text || (variant === 'outline' ? '' : '')}
          </span>
        </div>
      </>
    )
  }

  if (node.kind === 'chip') {
    // Colored pill with a cursor-shaped tail — the "presence" marker
    // showing which teammate is looking at what.
    const arrowDx = node.arrow === 'left' ? -8 : node.arrow === 'right' ? 8 : 0
    const arrowDy = node.arrow === 'up' ? -10 : node.arrow === 'down' ? 10 : 0
    return (
      <div
        {...dragProps}
        style={{
          position: 'absolute', left: node.x, top: node.y,
          display: 'flex', alignItems: 'center', gap: 6,
          cursor: tool === 'select' ? 'move' : 'default',
          boxShadow: ring, borderRadius: 6,
        }}
      >
        {/* Cursor arrow — small triangle in the same color, offset above/beside */}
        <svg
          width={14}
          height={14}
          viewBox="0 0 14 14"
          style={{
            position: 'absolute',
            left: arrowDx - 4,
            top: arrowDy - 4,
            filter: 'drop-shadow(0 1px 1px rgba(15,23,42,0.25))',
          }}
        >
          <path d="M0 0 L14 5 L6 7 L4 14 Z" fill={node.color} />
        </svg>
        <span
          style={{
            display: 'inline-block',
            backgroundColor: node.color,
            color: '#ffffff',
            fontSize: 11,
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 6px rgba(15,23,42,0.18)',
          }}
        >
          {node.text}
        </span>
      </div>
    )
  }

  if (node.kind === 'image') {
    // Lucide icon placeholder for a CAD screenshot. Right-click / future
    // "Replace with capture" swaps in an actual image.
    const IconCmp: LucideIcon =
      node.icon !== undefined ? (LUCIDE_ICONS[node.icon] ?? ImageIcon) : ImageIcon
    return (
      <div
        {...dragProps}
        style={{
          position: 'absolute', left: node.x, top: node.y,
          width: node.w, height: node.h,
          borderRadius: 10,
          background: node.src === undefined
            ? 'linear-gradient(135deg,#f0f9ff 0%, #e0f2fe 100%)'
            : `#fff url(${node.src}) center/contain no-repeat`,
          border: '1px solid #bae6fd',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: ring !== 'none' ? ring : '0 1px 2px rgba(2,132,199,0.08)',
          cursor: tool === 'select' ? 'move' : 'default',
        }}
      >
        {node.src === undefined && (
          node.icon !== undefined
            ? <IconCmp size={52} strokeWidth={1.4} color="#0284c7" />
            : <span style={{ fontSize: 48, opacity: 0.85 }}>{node.emoji ?? '📷'}</span>
        )}
      </div>
    )
  }

  if (node.kind === 'arrow') {
    // Arrow lives in its own SVG so the arrowhead marker positions
    // correctly regardless of parent transforms.
    const minX = Math.min(node.x, node.x2) - 4
    const minY = Math.min(node.y, node.y2) - 4
    const w = Math.abs(node.x2 - node.x) + 8
    const h = Math.abs(node.y2 - node.y) + 8
    return (
      <svg
        {...dragProps}
        width={w} height={h}
        style={{
          position: 'absolute', left: minX, top: minY,
          overflow: 'visible',
          cursor: tool === 'select' ? 'move' : 'default',
        }}
      >
        <defs>
          <marker id={`arr-${node.id}`} markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill={node.color} />
          </marker>
        </defs>
        <line
          x1={node.x - minX} y1={node.y - minY}
          x2={node.x2 - minX} y2={node.y2 - minY}
          stroke={node.color} strokeWidth={2}
          markerEnd={`url(#arr-${node.id})`}
        />
        {selected && (
          <rect
            x={0} y={0} width={w} height={h}
            fill="none" stroke="#06b6d4" strokeWidth={1.5} strokeDasharray="4 4"
          />
        )}
      </svg>
    )
  }

  if (node.kind === 'stroke') {
    return (
      <svg
        {...dragProps}
        className="absolute left-0 top-0 overflow-visible"
        style={{ pointerEvents: 'stroke', width: '100%', height: '100%' }}
      >
        <path
          d={node.d}
          stroke={node.color}
          strokeWidth={node.width}
          fill="none"
          strokeLinecap="round"
          style={{ filter: selected ? 'drop-shadow(0 0 4px #06b6d4)' : 'none' }}
        />
      </svg>
    )
  }

  return null
}
