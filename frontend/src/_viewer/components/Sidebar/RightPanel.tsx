import { useState, useRef, useCallback, useEffect } from 'react'
import { Trash2, Ruler, Square, Maximize2, CircleDot, ArrowLeftRight, Spline,
         Eye, EyeOff, ChevronRight, X, GripVertical, RotateCcw } from 'lucide-react'
import { useViewerStore } from '../../store/viewerStore'
import type { MeasureTool, PMIAnnotation } from '../../types/viewer'
import { selectMesh, deselectMesh, deselectAll } from '../../lib/babylon/SelectionManager'
import type { TreeNode } from '../../types/viewer'
import type { SidebarPanel } from './LeftSidebar'
import RecentFilesPanel from './RecentFilesPanel'

interface Props {
  activePanels: SidebarPanel[]
  onClose:      (panel: SidebarPanel) => void
}

const PANEL_TITLES: Record<SidebarPanel, string> = {
  tree:    'Model Tree',
  measure: 'Measure',
  explode: 'Explode View',
  section: 'Section View',
  pmi:     'Annotations',
  recent:  'Recent Files',
}

export default function RightPanel({ activePanels, onClose }: Props) {
  if (activePanels.length === 0) return null
  return (
    <div className="right-panels-stack">
      {activePanels.map((panel) => (
        <PanelCard key={panel} panel={panel} onClose={onClose} />
      ))}
    </div>
  )
}

/* ── Individual draggable panel card ──────────────────────────────────────── */
function PanelCard({ panel, onClose }: { panel: SidebarPanel; onClose: (p: SidebarPanel) => void }) {
  const [floating, setFloating] = useState(false)
  const [pos,      setPos]      = useState({ x: 0, y: 0 })
  const cardRef = useRef<HTMLDivElement>(null)

  const handleGripMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const rect   = cardRef.current?.getBoundingClientRect()
    const startPx = rect?.left ?? pos.x
    const startPy = rect?.top  ?? pos.y
    setPos({ x: startPx, y: startPy })
    setFloating(true)

    const sx = e.clientX, sy = e.clientY
    const onMove = (ev: MouseEvent) =>
      setPos({ x: startPx + ev.clientX - sx, y: startPy + ev.clientY - sy })
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [pos])

  return (
    <div
      ref={cardRef}
      className={`panel-card${floating ? ' floating' : ''}`}
      style={floating ? { left: pos.x, top: pos.y } : undefined}
    >
      <div className="panel-header">
        <div
          className="panel-drag-grip"
          onMouseDown={handleGripMouseDown}
          title="Drag to move panel"
        >
          <GripVertical size={14} strokeWidth={1.5} />
        </div>
        <span className="panel-header-title">{PANEL_TITLES[panel]}</span>
        {panel === 'pmi' && <PmiEyeToggle />}
        <div className="panel-header-controls">
          <button className="panel-ctrl-btn" onClick={() => onClose(panel)} title="Close panel">
            <X size={13} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {panel === 'measure' && <MeasurePanel />}
      {panel === 'tree'    && <TreePanel />}
      {panel === 'explode' && <ExplodePanel />}
      {panel === 'section' && <SectionPanel />}
      {panel === 'pmi'     && <PMIPanel />}
      {panel === 'recent'  && <RecentFilesPanel />}
    </div>
  )
}

/* ── PMI eye toggle (rendered inline in common header) ─ */
function PmiEyeToggle() {
  const pmiVisible = useViewerStore((s) => s.pmiVisible)
  const togglePmi  = useViewerStore((s) => s.togglePmi)
  return (
    <button
      className="panel-ctrl-btn"
      title={pmiVisible ? 'Hide all annotations' : 'Show all annotations'}
      onClick={togglePmi}
    >
      {pmiVisible
        ? <Eye size={13} strokeWidth={1.5} />
        : <EyeOff size={13} strokeWidth={1.5} />}
    </button>
  )
}

/* ── Measure Panel ─────────────────────────────────────── */

const MEASURE_TOOLS: { id: MeasureTool; icon: React.ReactNode; label: string; hint: string }[] = [
  { id: 'distance',     icon: <Ruler         size={13} strokeWidth={1.75} />, label: 'Distance',    hint: 'Click two points' },
  { id: 'min-distance', icon: <ArrowLeftRight size={13} strokeWidth={1.75} />, label: 'Min Dist',   hint: 'Click two faces' },
  { id: 'edge-length',  icon: <Spline        size={13} strokeWidth={1.75} />, label: 'Edge Length', hint: 'Click near an edge' },
  { id: 'face-area',    icon: <Square        size={13} strokeWidth={1.75} />, label: 'Face Area',   hint: 'Click a face' },
  { id: 'angle',        icon: <Maximize2     size={13} strokeWidth={1.75} />, label: 'Angle',       hint: 'Click two faces' },
  { id: 'radius',       icon: <CircleDot     size={13} strokeWidth={1.75} />, label: 'Radius',      hint: 'Click a cylindrical face' },
]

const TYPE_LABELS: Record<string, string> = {
  'point-to-point': 'Distance',
  'face-area':      'Face Area',
  'angle':          'Angle',
  'radius':         'Radius',
}

function MeasurePanel() {
  const activeTool        = useViewerStore((s) => s.activeMeasureTool)
  const setMeasureTool    = useViewerStore((s) => s.setMeasureTool)
  const measurements      = useViewerStore((s) => s.measurements)
  const removeMeasurement = useViewerStore((s) => s.removeMeasurement)
  const clearMeasurements = useViewerStore((s) => s.clearMeasurements)

  // Restore: clear active tool when panel closes
  useEffect(() => () => { setMeasureTool(null) }, [])

  const handleRemove = (id: string) => {
    const m = measurements.find((m) => m.id === id)
    if (m) m.meshes.forEach((mesh) => { try { mesh.dispose() } catch (_) {} })
    removeMeasurement(id)
  }

  const handleClearAll = () => {
    measurements.forEach((m) => m.meshes.forEach((mesh) => { try { mesh.dispose() } catch (_) {} }))
    clearMeasurements()
  }

  const activeMeta = MEASURE_TOOLS.find(t => t.id === activeTool)

  return (
    <div className="panel-body">
      <div className="measure-tools">
        {MEASURE_TOOLS.map(({ id, icon, label }) => (
          <button
            key={id}
            className={`measure-tool-btn${activeTool === id ? ' active' : ''}`}
            title={label}
            onClick={() => setMeasureTool(activeTool === id ? null : id)}
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </div>

      {activeTool && (
        <p className="measure-hint">{activeMeta?.hint}…</p>
      )}

      {measurements.length > 0 && (
        <div className="panel-section">
          <div className="panel-section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Results</span>
            <button className="measure-clear-btn" onClick={handleClearAll}>Clear all</button>
          </div>
          {measurements.map((m) => (
            <div key={m.id} className="measure-item">
              <div>
                <div className="measure-item-type">{TYPE_LABELS[m.type] ?? m.type}</div>
                <div className="measure-value">{m.display}</div>
              </div>
              <button className="measure-delete" onClick={() => handleRemove(m.id)} title="Delete">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {!activeTool && measurements.length === 0 && (
        <p className="panel-empty-msg">Select a tool above then click in the viewport.</p>
      )}
    </div>
  )
}

/* ── Tree Panel ────────────────────────────────────────── */
function TreePanel() {
  const modelTree        = useViewerStore((s) => s.modelTree)
  const setNodeVisibility = useViewerStore((s) => s.setNodeVisibility)
  const babylonScene      = useViewerStore((s) => s.babylonScene)
  const selectedMeshNames = useViewerStore((s) => s.selectedMeshNames)
  const addSelection      = useViewerStore((s) => s.addSelection)
  const removeSelection   = useViewerStore((s) => s.removeSelection)
  const clearSelection    = useViewerStore((s) => s.clearSelection)

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [initialised, setInitialised]  = useState(false)

  if (!initialised && modelTree.length > 0) {
    const allIds = new Set<string>()
    const collect = (nodes: TreeNode[]) => nodes.forEach(n => { allIds.add(n.id); collect(n.children) })
    collect(modelTree)
    setExpandedIds(allIds)
    setInitialised(true)
  }
  if (initialised && modelTree.length === 0) {
    setInitialised(false)
    setExpandedIds(new Set())
  }

  const toggleExpand = (id: string) =>
    setExpandedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const handleSelect = (meshName: string, multi: boolean) => {
    if (!babylonScene) return
    const mesh = babylonScene.getMeshByName(meshName)
    if (!mesh) return
    if (selectedMeshNames.has(meshName)) {
      deselectMesh(mesh)
      removeSelection(meshName)
    } else {
      if (!multi) {
        deselectAll()
        clearSelection()
      }
      const selInfo = selectMesh(mesh)
      addSelection(meshName, selInfo)
    }
  }

  const toggleVisibility = (node: TreeNode) => {
    const newVisible = !node.visible
    setNodeVisibility(node.id, newVisible)
    const applyToSubtree = (n: TreeNode) => {
      if (n.meshName && babylonScene) {
        const mesh = babylonScene.getMeshByName(n.meshName)
        if (mesh) mesh.setEnabled(newVisible)
        const edgeMesh = babylonScene.getMeshByName(`edges_${n.meshName}`)
        if (edgeMesh) edgeMesh.setEnabled(newVisible)
      }
      n.children.forEach(applyToSubtree)
    }
    applyToSubtree(node)
  }

  return (
    <div className="panel-body">
      {modelTree.length === 0 ? (
        <p className="panel-empty-msg">No model loaded.</p>
      ) : (
        <div className="tree-list">
          {modelTree.map(node => (
            <TreeRow
              key={node.id}
              node={node}
              depth={0}
              expandedIds={expandedIds}
              selectedMeshNames={selectedMeshNames}
              onToggleExpand={toggleExpand}
              onSelect={handleSelect}
              onToggleVisibility={toggleVisibility}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Recursive tree row ────────────────────────────────── */
interface RowProps {
  node:               TreeNode
  depth:              number
  expandedIds:        Set<string>
  selectedMeshNames:  Set<string>
  onToggleExpand:     (id: string) => void
  onSelect:           (meshName: string, multi: boolean) => void
  onToggleVisibility: (node: TreeNode) => void
}

function TreeRow({ node, depth, expandedIds, selectedMeshNames, onToggleExpand, onSelect, onToggleVisibility }: RowProps) {
  const isAssembly = node.children.length > 0
  const isExpanded = expandedIds.has(node.id)
  const isSelected = node.meshName !== null && selectedMeshNames.has(node.meshName)

  return (
    <>
      <div
        className={`tree-item${isSelected ? ' selected' : ''}${!node.visible ? ' hidden' : ''}`}
        style={{ paddingLeft: `${10 + depth * 14}px` }}
        onClick={(e) => node.meshName ? onSelect(node.meshName, e.shiftKey || e.metaKey) : onToggleExpand(node.id)}
      >
        <span
          className={`tree-chevron${isExpanded ? ' expanded' : ''}`}
          style={{ visibility: isAssembly ? 'visible' : 'hidden' }}
          onClick={(e) => { e.stopPropagation(); onToggleExpand(node.id) }}
        >
          <ChevronRight size={11} strokeWidth={2} />
        </span>

        {node.color
          ? <span className="tree-item-dot" style={{ background: node.color }} />
          : <span className="tree-item-dot assembly" />}

        <span className="tree-item-name" title={node.name}>{node.name}</span>

        <button
          className="tree-item-eye"
          onClick={(e) => { e.stopPropagation(); onToggleVisibility(node) }}
          title={node.visible ? 'Hide' : 'Show'}
        >
          {node.visible
            ? <Eye size={13} strokeWidth={1.5} />
            : <EyeOff size={13} strokeWidth={1.5} />}
        </button>
      </div>

      {isAssembly && isExpanded && node.children.map(child => (
        <TreeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          expandedIds={expandedIds}
          selectedMeshNames={selectedMeshNames}
          onToggleExpand={onToggleExpand}
          onSelect={onSelect}
          onToggleVisibility={onToggleVisibility}
        />
      ))}
    </>
  )
}

/* ── PMI / Annotations Panel ───────────────────────────── */
function PMIPanel() {
  const pmiAnnotations   = useViewerStore((s) => s.pmiAnnotations)
  const setPmiVisibility = useViewerStore((s) => s.setPmiVisibility)

  const groups: { label: string; items: PMIAnnotation[] }[] = [
    { label: 'Dimensions', items: pmiAnnotations.filter(a => a.type === 'dimension') },
    { label: 'Tolerances', items: pmiAnnotations.filter(a => a.type === 'tolerance') },
    { label: 'Datums',     items: pmiAnnotations.filter(a => a.type === 'datum')     },
  ].filter(g => g.items.length > 0)

  return (
    <div className="panel-body">
      {pmiAnnotations.length === 0 ? (
        <p className="panel-empty-msg">
          No GD&amp;T annotations found.<br />
          PMI requires a STEP AP242 file with embedded dimension or tolerance data.
        </p>
      ) : (
        groups.map(({ label, items }) => (
          <div key={label} className="panel-section">
            <div className="panel-section-label">{label}</div>
            {items.map(a => (
              <div key={a.id} className="pmi-item">
                <div className="pmi-symbol">{a.symbol}</div>
                <div className="pmi-value">{a.value}</div>
                {a.datums.length > 0 && (
                  <div className="pmi-datums">{a.datums.join(' | ')}</div>
                )}
                <button
                  className="pmi-eye"
                  title={a.visible ? 'Hide' : 'Show'}
                  onClick={() => setPmiVisibility(a.id, !a.visible)}
                >
                  {a.visible ? <Eye size={12} strokeWidth={1.5} /> : <EyeOff size={12} strokeWidth={1.5} />}
                </button>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}

/* ── Explode Panel ─────────────────────────────────────── */
function ExplodePanel() {
  const explodeFactor    = useViewerStore((s) => s.explodeFactor)
  const setExplodeFactor = useViewerStore((s) => s.setExplodeFactor)

  // Restore: reset explode when panel closes
  useEffect(() => () => { setExplodeFactor(0) }, [])

  const pct = Math.round(explodeFactor * 100)

  return (
    <div className="panel-body explode-panel">
      <div className="explode-row">
        <span className="explode-label">Spread</span>
        <span className="explode-pct">{pct}%</span>
      </div>
      <input
        type="range"
        min={0} max={1} step={0.01}
        value={explodeFactor}
        onChange={(e) => setExplodeFactor(parseFloat(e.target.value))}
        className="explode-slider"
      />
      <div className="explode-hints">
        <span>Assembled</span>
        <span>Exploded</span>
      </div>
      <button
        className="explode-reset-btn"
        onClick={() => setExplodeFactor(0)}
        disabled={explodeFactor === 0}
      >
        <RotateCcw size={12} strokeWidth={1.75} />
        Reset
      </button>
    </div>
  )
}

/* ── Section Panel ─────────────────────────────────────── */
const AXES = ['X', 'Y', 'Z'] as const

function SectionPanel() {
  const sectionPlane    = useViewerStore((s) => s.sectionPlane)
  const setSectionPlane = useViewerStore((s) => s.setSectionPlane)

  // Restore: clear section plane when panel closes
  useEffect(() => () => { setSectionPlane(null) }, [])

  const axis   = sectionPlane?.axis   ?? 'Y'
  const offset = sectionPlane?.offset ?? 0
  const active = sectionPlane !== null

  const setAxis = (a: 'X' | 'Y' | 'Z') =>
    setSectionPlane(active ? { axis: a, offset } : null)

  const setOffset = (v: number) =>
    setSectionPlane({ axis, offset: v })

  const toggle = () =>
    setSectionPlane(active ? null : { axis, offset })

  return (
    <div className="panel-body section-panel">
      {/* Axis selector */}
      <div className="section-row">
        <span className="section-label">Axis</span>
        <div className="section-axis-btns">
          {AXES.map(a => (
            <button
              key={a}
              className={`section-axis-btn${axis === a ? ' active' : ''}`}
              onClick={() => { setAxis(a); if (!active) setSectionPlane({ axis: a, offset }) }}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Offset slider — -1 to 1 mapped across model bounds by SectionController */}
      <div className="section-row">
        <span className="section-label">Position</span>
        <span className="explode-pct">{offset >= 0 ? '+' : ''}{offset.toFixed(2)}</span>
      </div>
      <input
        type="range" min={-1} max={1} step={0.01}
        value={offset}
        onChange={(e) => setOffset(parseFloat(e.target.value))}
        className="explode-slider"
        disabled={!active}
      />
      <div className="explode-hints"><span>−</span><span>+</span></div>

      {/* Enable / disable */}
      <button
        className={`section-toggle-btn${active ? ' active' : ''}`}
        onClick={toggle}
      >
        {active ? <><RotateCcw size={12} strokeWidth={1.75} /> Clear section</> : 'Enable section'}
      </button>
    </div>
  )
}
