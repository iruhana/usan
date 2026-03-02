/**
 * Notes store — manages notes CRUD + disk persistence
 */

import { create } from 'zustand'
import type { Note } from '@shared/types/ipc'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

interface NotesState {
  notes: Note[]
  selectedId: string | null
  loading: boolean

  load: () => Promise<void>
  create: () => void
  remove: (id: string) => void
  select: (id: string) => void
  updateTitle: (id: string, title: string) => void
  updateContent: (id: string, content: string) => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
let pendingNotes: Note[] | null = null

function persistNotes(notes: Note[]) {
  pendingNotes = notes
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    pendingNotes = null
    window.usan?.notes.save(notes)
  }, 1000)
}

// Flush pending save on app shutdown
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (saveTimer && pendingNotes) {
      clearTimeout(saveTimer)
      window.usan?.notes.save(pendingNotes)
    }
  })
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  selectedId: null,
  loading: true,

  load: async () => {
    try {
      const loaded = await window.usan?.notes.load()
      if (loaded && loaded.length > 0) {
        set({ notes: loaded, selectedId: loaded[0].id, loading: false })
      } else {
        set({ loading: false })
      }
    } catch {
      set({ loading: false })
    }
  },

  create: () => {
    const note: Note = {
      id: generateId(),
      title: '',
      content: '',
      updatedAt: Date.now(),
    }
    const updated = [note, ...get().notes]
    set({ notes: updated, selectedId: note.id })
    persistNotes(updated)
  },

  remove: (id) => {
    const updated = get().notes.filter((n) => n.id !== id)
    const newSelected = get().selectedId === id
      ? (updated.length > 0 ? updated[0].id : null)
      : get().selectedId
    set({ notes: updated, selectedId: newSelected })
    persistNotes(updated)
  },

  select: (id) => set({ selectedId: id }),

  updateTitle: (id, title) => {
    const updated = get().notes.map((n) =>
      n.id === id ? { ...n, title, updatedAt: Date.now() } : n,
    )
    set({ notes: updated })
    persistNotes(updated)
  },

  updateContent: (id, content) => {
    const updated = get().notes.map((n) =>
      n.id === id ? { ...n, content, updatedAt: Date.now() } : n,
    )
    set({ notes: updated })
    persistNotes(updated)
  },
}))
