/**
 * Reference data for the Doc editor's inline pickers:
 *   · @Mentions       — teammates
 *   · #Tags           — Quarter20-style categorical tags (part/tool/procedure/…)
 *   · Part numbers    — parts with torque + material metadata for the linker
 *
 * All static seed data for now. When a real people-directory /
 * PLM-integration lands, swap these arrays for API-backed hooks with the
 * same shape — the pickers will keep working unchanged.
 */

export interface DocMember {
  id: string
  name: string
  role: string
  email: string
}

export const DOC_MEMBERS: DocMember[] = [
  { id: 'usr_naga',    name: 'Naga Reddy',       role: 'Design Lead',           email: 'naga@datavers.ai' },
  { id: 'usr_sarah',   name: 'Sarah Chen',       role: 'CAE Engineer',          email: 'sarah@datavers.ai' },
  { id: 'usr_john',    name: 'John Williams',    role: 'Supplier Lead',         email: 'john@datavers.ai' },
  { id: 'usr_maria',   name: 'Maria Garcia',     role: 'Stress Reviewer',       email: 'maria@datavers.ai' },
  { id: 'usr_david',   name: 'David Kim',        role: 'Engineering Manager',   email: 'david@datavers.ai' },
  { id: 'usr_priya',   name: 'Priya Iyer',       role: 'Quality Manager',       email: 'priya@datavers.ai' },
  { id: 'usr_alex',    name: 'Alex Nakamura',    role: 'Manufacturing',         email: 'alex@datavers.ai' },
]

// Quarter20-style tagging system — the tag category tells the reader
// what kind of thing the linked value represents (part / tool / …).
export interface DocTag {
  id: string
  label: string
  category: 'part' | 'tool' | 'procedure' | 'torque' | 'material' | 'standard'
  detail?: string
}

export const DOC_TAGS: DocTag[] = [
  { id: 'tool-torque-1',   label: 'Torque wrench 10-50 Nm', category: 'tool',      detail: 'Calibration ID: TW-047' },
  { id: 'tool-cmm',        label: 'CMM (Zeiss Contura)',    category: 'tool',      detail: 'Room 204, booking required' },
  { id: 'tool-caliper',    label: 'Digital caliper 0-150mm',category: 'tool',      detail: 'Resolution 0.01 mm' },
  { id: 'proc-assy-01',    label: 'PROC-ASSY-01',           category: 'procedure', detail: 'Housing assembly, rev C' },
  { id: 'proc-insp-03',    label: 'PROC-INSP-03',           category: 'procedure', detail: 'Incoming inspection' },
  { id: 'torque-M6-10',    label: '10 Nm ± 0.5',            category: 'torque',    detail: 'M6 fasteners, dry' },
  { id: 'torque-M8-25',    label: '25 Nm ± 1.0',            category: 'torque',    detail: 'M8 fasteners, dry' },
  { id: 'torque-M10-49',   label: '49 Nm ± 2.0',            category: 'torque',    detail: 'M10 fasteners, dry' },
  { id: 'mat-al6061',      label: 'Al 6061-T6',             category: 'material',  detail: 'Yield 276 MPa · ρ 2.70 g/cc' },
  { id: 'mat-ss316',       label: 'SS 316L',                category: 'material',  detail: 'Yield 205 MPa · corrosion-resistant' },
  { id: 'mat-ti6al4v',     label: 'Ti-6Al-4V',              category: 'material',  detail: 'Yield 880 MPa · aerospace grade' },
  { id: 'std-as9100',      label: 'AS9100D §8.4',           category: 'standard',  detail: 'Supplier control' },
  { id: 'std-iso1101',     label: 'ISO 1101',               category: 'standard',  detail: 'GD&T' },
]

// Part numbers with the metadata Quarter20 highlights: torque + material.
export interface DocPart {
  partNumber: string
  name: string
  material: string
  torque?: string     // for fasteners / clamped joints
  weightKg?: number
  supplier?: string
}

export const DOC_PARTS: DocPart[] = [
  { partNumber: 'DV-HSG-100', name: 'Compressor housing',    material: 'Al 6061-T6',  torque: '25 Nm on M8', weightKg: 2.4, supplier: 'In-house' },
  { partNumber: 'DV-IMP-042', name: 'Impeller blade',        material: 'Ti-6Al-4V',   torque: '10 Nm on M6', weightKg: 0.3, supplier: 'AeroFab Ltd.' },
  { partNumber: 'DV-BRG-007', name: 'Angular contact bearing',material: 'SS 440C',    weightKg: 0.15, supplier: 'SKF' },
  { partNumber: 'DV-GSK-011', name: 'Copper gasket',         material: 'Cu C11000',   weightKg: 0.02, supplier: 'GasketPro' },
  { partNumber: 'DV-BLT-M8-25',name: 'M8×25 socket head bolt',material: 'SS A2-70',   torque: '25 Nm dry',   weightKg: 0.01, supplier: 'FastenCo' },
  { partNumber: 'DV-SFT-055', name: 'Drive shaft',            material: 'AISI 4140',  torque: '49 Nm at coupling', weightKg: 1.8, supplier: 'PrecisionShaft Inc.' },
  { partNumber: 'DV-SEAL-33', name: 'Nitrile oil seal',       material: 'NBR-70',     weightKg: 0.05, supplier: 'SealPartners' },
  { partNumber: 'DV-COV-200', name: 'Access cover plate',     material: 'Al 6061-T6', torque: '10 Nm on M6', weightKg: 0.5, supplier: 'In-house' },
]
