import { create } from 'zustand'
import type { ClipboardEntry, ClipboardTransformFormat } from '@shared/types/infrastructure'
import { toClipboardErrorMessage } from '../lib/user-facing-errors'

const DEFAULT_TRANSFORM: ClipboardTransformFormat = 'json_pretty'

interface ClipboardState {
  entries: ClipboardEntry[]
  query: string
  transform: ClipboardTransformFormat
  loading: boolean
  error: string | null

  setQuery: (query: string) => void
  setTransform: (format: ClipboardTransformFormat) => void
  load: () => Promise<void>
  clear: () => Promise<void>
  pin: (id: string, pinned: boolean) => Promise<void>
  transformAndCopy: (id: string) => Promise<void>
}

export const useClipboardStore = create<ClipboardState>((set, get) => ({
  entries: [],
  query: '',
  transform: DEFAULT_TRANSFORM,
  loading: false,
  error: null,

  setQuery: (query) => set({ query }),
  setTransform: (format) => set({ transform: format }),

  load: async () => {
    set({ loading: true, error: null })
    try {
      const entries = await window.usan?.clipboardManager.history()
      set({ entries: entries ?? [], loading: false })
    } catch (err) {
      set({ loading: false, error: toClipboardErrorMessage(err, 'load') })
    }
  },

  clear: async () => {
    try {
      await window.usan?.clipboardManager.clear()
      await get().load()
    } catch (err) {
      set({ error: toClipboardErrorMessage(err, 'clear') })
    }
  },

  pin: async (id, pinned) => {
    try {
      if (pinned) {
        await window.usan?.clipboardManager.pin(id)
      } else {
        await window.usan?.clipboardManager.unpin(id)
      }
      await get().load()
    } catch (err) {
      set({ error: toClipboardErrorMessage(err, 'pin') })
    }
  },

  transformAndCopy: async (id) => {
    try {
      const format = get().transform
      const transformed = await window.usan?.clipboardManager.transform(id, format)
      if (typeof transformed === 'string' && transformed.length > 0) {
        await navigator.clipboard.writeText(transformed)
      }
    } catch (err) {
      set({ error: toClipboardErrorMessage(err, 'transform') })
    }
  },
}))
