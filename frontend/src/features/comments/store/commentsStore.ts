'use client'

/**
 * commentsStore — single source of truth for UI state in the v2 comment system.
 *
 * Selection, drawer, filters, drafts, pin-density mode, hover sync.
 *
 * IMPORTANT: server data (threads, replies, users) does NOT live here. That
 * goes through the storage hooks (useThreads, useReplies) which read/write
 * localStorage in Phase 1. When we swap to a real backend, those hooks
 * become React Query queries and this store stays untouched.
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type {
  PinDensityMode,
  SelectionSource,
  ThreadFilters,
  ThreadPriority,
  ThreadStatus,
} from '../types/thread.types'

export interface CommentsState {
  // Selection — viewer + sidebar both write to this.
  selectedThreadId: string | null
  selectionSource: SelectionSource
  hoveredThreadId: string | null

  // Drawer
  drawerOpen: boolean
  drawerWidth: number

  // Filters
  filters: ThreadFilters
  sort: 'newest' | 'oldest' | 'most-active' | 'priority'

  // Drafts
  drafts: Record<string, string> // threadId → body
  rootDraft: string

  // Viewer pin density
  pinDensityMode: PinDensityMode

  // Export
  exportDialogOpen: boolean
  selectedForExport: Set<string>

  // Actions
  selectThread: (id: string | null, source: SelectionSource) => void
  setHovered: (id: string | null) => void
  closeDrawer: () => void
  setFilter: <K extends keyof ThreadFilters>(key: K, value: ThreadFilters[K]) => void
  resetFilters: () => void
  setSort: (sort: CommentsState['sort']) => void
  setDraft: (threadId: string, body: string) => void
  clearDraft: (threadId: string) => void
  setRootDraft: (body: string) => void
  setPinDensityMode: (mode: PinDensityMode) => void
  openExportDialog: (preselect?: string[]) => void
  closeExportDialog: () => void
  toggleExportSelection: (id: string) => void
}

const DEFAULT_FILTERS: ThreadFilters = {
  status: ['open'],
  priority: [],
  assignedToMe: false,
  mentionsMe: false,
  searchQuery: '',
}

export const useCommentsStore = create<CommentsState>()(
  subscribeWithSelector((set) => ({
    selectedThreadId: null,
    selectionSource: null,
    hoveredThreadId: null,
    drawerOpen: false,
    drawerWidth: 480,
    filters: DEFAULT_FILTERS,
    sort: 'most-active',
    drafts: {},
    rootDraft: '',
    pinDensityMode: 'open-only',
    exportDialogOpen: false,
    selectedForExport: new Set(),

    selectThread: (id, source) =>
      set({
        selectedThreadId: id,
        selectionSource: source,
        drawerOpen: id !== null,
      }),
    setHovered: (id) => set({ hoveredThreadId: id }),
    closeDrawer: () =>
      set({ drawerOpen: false, selectedThreadId: null, selectionSource: null }),
    setFilter: (key, value) =>
      set((s) => ({ filters: { ...s.filters, [key]: value } })),
    resetFilters: () => set({ filters: DEFAULT_FILTERS }),
    setSort: (sort) => set({ sort }),
    setDraft: (threadId, body) =>
      set((s) => ({ drafts: { ...s.drafts, [threadId]: body } })),
    clearDraft: (threadId) =>
      set((s) => {
        const next = { ...s.drafts }
        delete next[threadId]
        return { drafts: next }
      }),
    setRootDraft: (body) => set({ rootDraft: body }),
    setPinDensityMode: (mode) => set({ pinDensityMode: mode }),
    openExportDialog: (preselect) =>
      set({
        exportDialogOpen: true,
        selectedForExport: new Set(preselect ?? []),
      }),
    closeExportDialog: () =>
      set({ exportDialogOpen: false, selectedForExport: new Set() }),
    toggleExportSelection: (id) =>
      set((s) => {
        const next = new Set(s.selectedForExport)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return { selectedForExport: next }
      }),
  })),
)

/** Helper for predicate-based thread filtering. */
export function matchesFilters(
  thread: {
    status: ThreadStatus
    priority: ThreadPriority
    assigneeName: string | null
    participantIds: string[]
    title: string
  },
  filters: ThreadFilters,
  currentUserName: string,
): boolean {
  if (filters.status.length > 0 && !filters.status.includes(thread.status)) return false
  if (filters.priority.length > 0 && !filters.priority.includes(thread.priority)) return false
  if (filters.assignedToMe && thread.assigneeName !== currentUserName) return false
  if (filters.mentionsMe && !thread.participantIds.includes(currentUserName)) return false
  if (filters.searchQuery.trim() !== '') {
    const q = filters.searchQuery.toLowerCase().trim()
    if (!thread.title.toLowerCase().includes(q)) return false
  }
  return true
}
