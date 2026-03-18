import { create } from 'zustand'
import type { MacroEntry } from '@shared/types/infrastructure'
import { toMacroErrorMessage } from '../lib/user-facing-errors'

interface MacroState {
  items: MacroEntry[]
  recording: boolean
  loading: boolean
  error: string | null

  initialize: () => void
  load: () => Promise<void>
  startRecording: () => Promise<void>
  stopRecording: (name: string) => Promise<void>
  play: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

let statusUnsubscribe: (() => void) | null = null

export const useMacroStore = create<MacroState>((set, get) => ({
  items: [],
  recording: false,
  loading: false,
  error: null,

  initialize: () => {
    if (statusUnsubscribe || !window.usan?.macro) return
    statusUnsubscribe = window.usan.macro.onStatus((status) => {
      set({ recording: status.recording })
    })
  },

  load: async () => {
    set({ loading: true, error: null })
    try {
      const items = await window.usan?.macro.list()
      set({ items: items ?? [], loading: false })
    } catch (err) {
      set({ loading: false, error: toMacroErrorMessage(err, 'load') })
    }
  },

  startRecording: async () => {
    try {
      await window.usan?.macro.recordStart()
      set({ recording: true, error: null })
    } catch (err) {
      set({ error: toMacroErrorMessage(err, 'recordStart') })
    }
  },

  stopRecording: async (name) => {
    try {
      await window.usan?.macro.recordStop(name.trim() || 'Macro')
      set({ recording: false, error: null })
      await get().load()
    } catch (err) {
      set({ error: toMacroErrorMessage(err, 'recordStop') })
    }
  },

  play: async (id) => {
    try {
      await window.usan?.macro.play(id)
    } catch (err) {
      set({ error: toMacroErrorMessage(err, 'play') })
    }
  },

  remove: async (id) => {
    try {
      await window.usan?.macro.delete(id)
      await get().load()
    } catch (err) {
      set({ error: toMacroErrorMessage(err, 'delete') })
    }
  },
}))
