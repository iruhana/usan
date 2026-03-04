import { create } from 'zustand'
import type { HotkeyBinding } from '@shared/types/infrastructure'

interface HotkeyState {
  items: HotkeyBinding[]
  lastTriggered: string | null
  loading: boolean
  error: string | null

  initialize: () => void
  load: () => Promise<void>
  save: (binding: HotkeyBinding) => Promise<boolean>
  remove: (id: string) => Promise<void>
}

let hotkeyUnsubscribe: (() => void) | null = null

export const useHotkeyStore = create<HotkeyState>((set, get) => ({
  items: [],
  lastTriggered: null,
  loading: false,
  error: null,

  initialize: () => {
    if (hotkeyUnsubscribe || !window.usan?.hotkey) return
    hotkeyUnsubscribe = window.usan.hotkey.onTriggered((event) => {
      set({ lastTriggered: `${event.id} (${event.action})` })
    })
  },

  load: async () => {
    set({ loading: true, error: null })
    try {
      const items = await window.usan?.hotkey.list()
      set({ items: items ?? [], loading: false })
    } catch (err) {
      set({ loading: false, error: (err as Error).message })
    }
  },

  save: async (binding) => {
    try {
      const success = await window.usan?.hotkey.set(binding)
      if (success) await get().load()
      return Boolean(success)
    } catch (err) {
      set({ error: (err as Error).message })
      return false
    }
  },

  remove: async (id) => {
    try {
      await window.usan?.hotkey.remove(id)
      await get().load()
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },
}))
