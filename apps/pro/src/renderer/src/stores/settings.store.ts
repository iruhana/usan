import { create } from 'zustand'
import { DEFAULT_APP_SETTINGS, type AppSettings } from '@shared/types'
import { useChatStore } from './chat.store'

function applyTheme(theme: AppSettings['theme']): void {
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? '' : theme)
}

function syncDerivedState(settings: AppSettings): void {
  applyTheme(settings.theme)
  useChatStore.getState().setModel(settings.defaultModel)
}

interface SettingsState {
  settings: AppSettings
  hydrated: boolean
  hydrate: () => Promise<void>
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_APP_SETTINGS,
  hydrated: false,
  hydrate: async () => {
    const settings = await window.usan?.settings?.get?.() ?? DEFAULT_APP_SETTINGS
    syncDerivedState(settings)
    set({ settings, hydrated: true })
  },
  updateSettings: async (patch) => {
    const next = await window.usan?.settings?.update?.(patch) ?? {
      ...get().settings,
      ...patch,
    }
    syncDerivedState(next)
    set({ settings: next, hydrated: true })
  },
}))
