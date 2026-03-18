import { create } from 'zustand'
import type {
  RagDocument,
  RagSearchResult,
  RagIndexProgress,
  RagIndexFileResult,
  RagIndexFolderResult,
} from '@shared/types/infrastructure'
import { toKnowledgeErrorMessage } from '../lib/user-facing-errors'

interface RagIndexSummary {
  scope: 'file' | 'folder'
  indexedCount: number
  skippedCount: number
  failedCount: number
  totalChunks: number
}

interface KnowledgeState {
  documents: RagDocument[]
  searchResults: RagSearchResult[]
  indexingProgress: RagIndexProgress | null
  indexSummary: RagIndexSummary | null
  loading: boolean
  error: string | null

  initialize: () => void
  load: () => Promise<void>
  indexFile: (path: string) => Promise<void>
  indexFolder: (path: string) => Promise<void>
  removeDocument: (id: string) => Promise<void>
  search: (query: string) => Promise<void>
  clearSearch: () => void
  clearIndexSummary: () => void
}

let ragProgressUnsub: (() => void) | null = null

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  documents: [],
  searchResults: [],
  indexingProgress: null,
  indexSummary: null,
  loading: false,
  error: null,

  initialize: () => {
    if (ragProgressUnsub || !window.usan?.rag) return

    ragProgressUnsub = window.usan.rag.onProgress((progress) => {
      set({ indexingProgress: progress })
    })
  },

  load: async () => {
    set({ loading: true, error: null })
    try {
      const result = await window.usan?.rag.list()
      set({
        documents: result?.documents ?? [],
        loading: false,
      })
    } catch (err) {
      set({ loading: false, error: toKnowledgeErrorMessage(err, 'load') })
    }
  },

  indexFile: async (path) => {
    set({ loading: true, error: null, indexingProgress: { current: 0, total: 1, fileName: path }, indexSummary: null })
    try {
      const result = await window.usan?.rag.indexFile(path) as RagIndexFileResult | undefined
      await get().load()
      if (result) {
        set({
          indexSummary: {
            scope: 'file',
            indexedCount: result.skipped ? 0 : 1,
            skippedCount: result.skipped ? 1 : 0,
            failedCount: 0,
            totalChunks: result.chunks,
          },
        })
      }
    } catch (err) {
      set({ error: toKnowledgeErrorMessage(err, 'index') })
    } finally {
      set({ loading: false, indexingProgress: null })
    }
  },

  indexFolder: async (path) => {
    set({ loading: true, error: null, indexingProgress: { current: 0, total: 1, fileName: path }, indexSummary: null })
    try {
      const result = await window.usan?.rag.indexFolder(path) as RagIndexFolderResult | undefined
      await get().load()
      if (result) {
        set({
          indexSummary: {
            scope: 'folder',
            indexedCount: result.indexedCount,
            skippedCount: result.skippedCount,
            failedCount: result.failedCount,
            totalChunks: result.totalChunks,
          },
        })
      }
    } catch (err) {
      set({ error: toKnowledgeErrorMessage(err, 'index') })
    } finally {
      set({ loading: false, indexingProgress: null })
    }
  },

  removeDocument: async (id) => {
    set({ error: null })
    try {
      await window.usan?.rag.remove(id)
      set((state) => ({
        documents: state.documents.filter((d) => d.id !== id),
        searchResults: state.searchResults.filter((r) => r.documentId !== id),
      }))
    } catch (err) {
      set({ error: toKnowledgeErrorMessage(err, 'remove') })
    }
  },

  search: async (query) => {
    const normalized = query.trim()
    if (!normalized) {
      set({ searchResults: [] })
      return
    }

    set({ loading: true, error: null })
    try {
      const result = await window.usan?.rag.search(normalized, 8)
      set({ searchResults: result?.results ?? [], loading: false })
    } catch (err) {
      set({ loading: false, error: toKnowledgeErrorMessage(err, 'search') })
    }
  },

  clearSearch: () => {
    set({ searchResults: [] })
  },

  clearIndexSummary: () => {
    set({ indexSummary: null })
  },
}))
