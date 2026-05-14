import type { AbstractMesh, Vector3 } from '@babylonjs/core'

export type ShadingMode = 'shaded' | 'wireframe' | 'shadedEdges'

export type CameraMode = 'perspective' | 'orthographic'

export type ViewPreset = 'FRONT' | 'BACK' | 'RIGHT' | 'LEFT' | 'TOP' | 'BOTTOM' | 'ISO'

export type MeasureTool = 'distance' | 'min-distance' | 'edge-length' | 'face-area' | 'angle' | 'radius'

export interface MeasurementEntry {
  id:       string
  type:     'point-to-point' | 'face-area' | 'angle' | 'radius'
  points:   Vector3[]   // [p1, p2] for distance/angle; [centroid] for area/radius
  midpoint: Vector3     // label anchor in world space
  value:    number      // raw value (world units, world units², degrees, world units)
  display:  string      // formatted string shown in UI and viewport
  meshes:   AbstractMesh[]
}

export interface SelectionInfo {
  meshName: string
  width: number
  depth: number
  height: number
}

export interface PMIAnnotation {
  id:       string
  type:     'dimension' | 'tolerance' | 'datum'
  symbol:   string        // e.g. '⌀', '⊥', 'A'
  value:    string        // formatted display string
  datums:   string[]      // referenced datum labels e.g. ['A', 'B']
  meshName: string | null // part this annotation belongs to (null = unassigned)
  visible:  boolean
}

export interface TreeNode {
  id:       string           // stable unique key
  name:     string           // display name
  meshName: string | null    // Babylon mesh name; null for assembly-only nodes
  color:    string           // CSS hex color from material; '' for assemblies
  visible:  boolean
  children: TreeNode[]
}
