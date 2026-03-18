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
  schemaVersion: 7,
  fontScale: 1.0,
  highContrast: false,
  aiLabelEnabled: true,
  voiceEnabled: false,
  voiceOverlayEnabled: false,
  voiceSpeed: 1.0,
  locale: 'ko',
  localeConfigured: false,
  theme: 'light',
  openAtLogin: true,
  updateChannel: 'stable',
  autoDownloadUpdates: false,
  permissionProfile: 'full',
  beginnerMode: true,
  browserCredentialAutoImportEnabled: true,
  browserCredentialAutoImportDone: false,
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
    const normalizedPartial: Partial<AppSettings> = partial.locale !== undefined
      ? { ...partial, localeConfigured: true }
      : partial

    set((s) => {
      const next = { ...s.settings, ...normalizedPartial }
      if (normalizedPartial.fontScale !== undefined) applyFontScale(normalizedPartial.fontScale)
      if (normalizedPartial.locale !== undefined) setLocale(normalizedPartial.locale)
      return { settings: next }
    })
    await window.usan?.settings.set(normalizedPartial)
  },
}))

function applyFontScale(scale: number) {
  document.documentElement.style.setProperty('--font-scale', String(scale))
}
