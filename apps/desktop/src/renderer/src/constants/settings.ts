export type SettingsSectionId =
  | 'general'
  | 'account'
  | 'connectors'
  | 'security'
  | 'models'
  | 'about'

export type LegacySettingsTab = 'display' | 'sound' | 'system' | 'advanced'

export type SettingsTab = SettingsSectionId | LegacySettingsTab

export const DEFAULT_SETTINGS_TAB: SettingsSectionId = 'general'

export function normalizeSettingsTab(tab?: SettingsTab): SettingsSectionId {
  switch (tab) {
    case 'display':
    case 'sound':
      return 'general'
    case 'system':
      return 'connectors'
    case 'advanced':
      return 'security'
    case 'general':
    case 'account':
    case 'connectors':
    case 'security':
    case 'models':
    case 'about':
      return tab
    default:
      return DEFAULT_SETTINGS_TAB
  }
}
