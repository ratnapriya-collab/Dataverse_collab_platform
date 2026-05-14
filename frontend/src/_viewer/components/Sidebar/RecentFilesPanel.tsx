import { useEffect, useState } from 'react'
import { FolderOpen, Trash2, Clock } from 'lucide-react'
import { listCachedModels, deleteCachedModel, loadFromCache, type ModelMeta } from '../../lib/ModelCache'
import { buildMeshes, convertTree } from '../../lib/babylon/StepLoader'
import type { ExtractionStats } from '../../lib/babylon/StepWorker'
import { useViewerStore } from '../../store/viewerStore'
import { applyShadingMode, getModelMeshes, getEdgeMeshes } from '../../lib/babylon/ShadingManager'
import { fitToScene } from '../../lib/babylon/CameraManager'

function formatDate(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTriangles(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k`
  return String(n)
}

const STRATEGY_LABEL: Record<ExtractionStats['strategy'], string> = {
  'xcaf':           'XCAF',
  'text+geometry':  'Text',
  'geometry-only':  'Geo',
}

function StatsRow({ stats }: { stats: ExtractionStats }) {
  const { strategy, partCount, namedCount, coloredCount, totalTriangles, bbox, parseTimeMs } = stats
  return (
    <div className="recent-stats">
      <span className={`recent-strategy recent-strategy--${strategy.replace('+', '-')}`}>
        {STRATEGY_LABEL[strategy]}
      </span>
      <span className="recent-stat" title={`${namedCount} of ${partCount} parts have non-generic names`}>
        {namedCount}/{partCount} named
      </span>
      <span className="recent-stat" title={`${coloredCount} parts have file-sourced colors`}>
        {coloredCount} colored
      </span>
      <span className="recent-stat" title={`${totalTriangles.toLocaleString()} triangles total`}>
        {formatTriangles(totalTriangles)} tris
      </span>
      <span className="recent-stat" title={`Bounding box ${bbox.w} × ${bbox.d} × ${bbox.h} mm`}>
        {bbox.w}×{bbox.d}×{bbox.h}
      </span>
      <span className="recent-stat" title="Parse time">
        {parseTimeMs}ms
      </span>
    </div>
  )
}

export default function RecentFilesPanel() {
  const [models, setModels]   = useState<ModelMeta[]>([])
  const [loading, setLoading] = useState<string | null>(null)

  const babylonScene  = useViewerStore((s) => s.babylonScene)
  const cameraRef     = useViewerStore((s) => s.cameraRef)
  const shadingMode   = useViewerStore((s) => s.shadingMode)
  const setModelTree  = useViewerStore((s) => s.setModelTree)
  const setLoadedFileName = useViewerStore((s) => s.setLoadedFileName)
  const setLoadingMsg     = useViewerStore((s) => s.setLoadingMsg)
  const setPmiAnnotations = useViewerStore((s) => s.setPmiAnnotations)

  useEffect(() => {
    listCachedModels().then(setModels)
  }, [])

  const handleLoad = async (meta: ModelMeta) => {
    if (!babylonScene || !cameraRef) return
    setLoading(meta.id)
    setLoadingMsg(`Loading ${meta.name}…`)
    try {
      const cached = await loadFromCache(meta.name, meta.size)
      if (!cached) { alert('Cache entry not found — please re-load the original file.'); return }

      getModelMeshes(babylonScene).forEach(m => m.dispose())
      getEdgeMeshes(babylonScene).forEach(m => m.dispose())
      setModelTree([])

      const { meshes, colorMap } = buildMeshes(babylonScene, cached.parts)
      const tree = convertTree(cached.tree, colorMap)
      setModelTree(tree)
      setPmiAnnotations(cached.pmi ?? [])
      applyShadingMode(shadingMode, meshes)
      fitToScene(cameraRef, meshes)
      setLoadedFileName(meta.name)
    } catch (err) {
      alert(`Failed to load: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(null)
      setLoadingMsg(null)
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await deleteCachedModel(id)
    setModels(prev => prev.filter(m => m.id !== id))
  }

  return (
    <div className="panel-body">
        {models.length === 0 ? (
          <p className="panel-empty-msg">No cached models yet. Load a STEP or GLB file to cache it.</p>
        ) : (
          <div className="recent-list">
            {models.map(m => (
              <div
                key={m.id}
                className={`recent-item${loading === m.id ? ' loading' : ''}`}
                onClick={() => handleLoad(m)}
                title={`${m.name} · ${formatSize(m.size)}`}
              >
                <FolderOpen size={14} strokeWidth={1.5} className="recent-icon" />
                <div className="recent-info">
                  <span className="recent-name">{m.name}</span>
                  <span className="recent-meta">
                    <Clock size={10} strokeWidth={1.5} />
                    {formatDate(m.processedAt)} · {m.partCount} parts · {formatSize(m.size)}
                  </span>
                  {m.stats && <StatsRow stats={m.stats} />}
                </div>
                <button
                  className="recent-delete"
                  onClick={e => handleDelete(e, m.id)}
                  title="Remove from cache"
                >
                  <Trash2 size={12} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
