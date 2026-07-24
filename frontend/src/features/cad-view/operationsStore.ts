'use client'

/**
 * operationsStore — Zustand store for the CAD View's Operations panel.
 * Persisted per-part in localStorage so operations survive refresh.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface OperationPart {
  meshName: string
  label: string
  qty: string
}

export interface Operation {
  id: string
  number: number
  title: string
  parts: OperationPart[]
  notes: string
  createdAt: string
}

interface OperationsState {
  byPartId: Record<string, Operation[]>
  activePartId: string | null
  selectedOpId: string | null

  loadForPart: (partId: string) => void
  addOperation: (partId: string) => void
  removeOperation: (partId: string, opId: string) => void
  renameOperation: (partId: string, opId: string, title: string) => void
  addPartToOperation: (partId: string, opId: string, meshName: string, label: string, qty?: string) => void
  removePartFromOperation: (partId: string, opId: string, meshName: string) => void
  selectOperation: (opId: string | null) => void
}

const mid = (): string =>
  `op_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
const nowIso = (): string => new Date().toISOString()

export const useOperationsStore = create<OperationsState>()(
  persist(
    (set, get) => ({
      byPartId: {},
      activePartId: null,
      selectedOpId: null,

      loadForPart: (partId) => {
        const state = get()
        set({
          activePartId: partId,
          selectedOpId: null,
          byPartId: state.byPartId[partId]
            ? state.byPartId
            : {
                ...state.byPartId,
                [partId]: [
                  {
                    id: mid(),
                    number: 1,
                    title: 'Operation 1',
                    parts: [],
                    notes: '',
                    createdAt: nowIso(),
                  },
                ],
              },
        })
      },

      addOperation: (partId) => {
        set((s) => {
          const existing = s.byPartId[partId] ?? []
          const nextNum =
            existing.length === 0
              ? 1
              : Math.max(...existing.map((o) => o.number)) + 1
          return {
            byPartId: {
              ...s.byPartId,
              [partId]: [
                ...existing,
                {
                  id: mid(),
                  number: nextNum,
                  title: `Operation ${nextNum}`,
                  parts: [],
                  notes: '',
                  createdAt: nowIso(),
                },
              ],
            },
          }
        })
      },

      removeOperation: (partId, opId) => {
        set((s) => ({
          byPartId: {
            ...s.byPartId,
            [partId]: (s.byPartId[partId] ?? []).filter((o) => o.id !== opId),
          },
          selectedOpId: s.selectedOpId === opId ? null : s.selectedOpId,
        }))
      },

      renameOperation: (partId, opId, title) => {
        set((s) => ({
          byPartId: {
            ...s.byPartId,
            [partId]: (s.byPartId[partId] ?? []).map((o) =>
              o.id === opId ? { ...o, title } : o,
            ),
          },
        }))
      },

      addPartToOperation: (partId, opId, meshName, label, qty = 'x1') => {
        set((s) => ({
          byPartId: {
            ...s.byPartId,
            [partId]: (s.byPartId[partId] ?? []).map((o) => {
              if (o.id !== opId) return o
              if (o.parts.some((p) => p.meshName === meshName)) return o
              return { ...o, parts: [...o.parts, { meshName, label, qty }] }
            }),
          },
        }))
      },

      removePartFromOperation: (partId, opId, meshName) => {
        set((s) => ({
          byPartId: {
            ...s.byPartId,
            [partId]: (s.byPartId[partId] ?? []).map((o) =>
              o.id === opId
                ? { ...o, parts: o.parts.filter((p) => p.meshName !== meshName) }
                : o,
            ),
          },
        }))
      },

      selectOperation: (selectedOpId) => set({ selectedOpId }),
    }),
    {
      name: 'dataverse.cadview.operations',
      partialize: (state) => ({ byPartId: state.byPartId }),
    },
  ),
)
