/**
 * Settings store — synced with main process via IPC
 */

import { create } from 'zustand'
import type { AppSettings } from '@shared/types/ipc'
import { setLocale } from '../i18n'

interface SettingsState {
  settings: AppSettings
  loaded: boolean
  load: () => Promise<void>
  update: (partial: Partial<AppSettings>) => Promise<void>
}

const DEFAULT_SETTINGS: AppSettings = {
  schemaVersion: 2,
  fontScale: 1.0,
  highContrast: false,
  voiceEnabled: true,
  voiceSpeed: 1.0,
  locale: 'ko',
  theme: 'light',
  openAtLogin: true,
  updateChannel: 'stable',
  autoDownloadUpdates: false,
  permissionProfile: 'full',
  sidebarCollapsed: false,
  enterToSend: true,
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    try {
      const settings = await window.usan?.settings.get()
      if (settings) {
        set({ settings, loaded: true })
        applyFontScale(settings.fontScale)
        setLocale(settings.locale || 'ko')
      }
    } catch {
      set({ loaded: true })
    }
  },

  update: async (partial) => {
    set((s) => {
      const next = { ...s.settings, ...partial }
      if (partial.fontScale !== undefined) applyFontScale(partial.fontScale)
      if (partial.locale !== undefined) setLocale(partial.locale)
      return { settings: next }
    })
    await window.usan?.settings.set(partial)
  },
}))

function applyFontScale(scale: number) {
  document.documentElement.style.setProperty('--font-scale', String(scale))
}
