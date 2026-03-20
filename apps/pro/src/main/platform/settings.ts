import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { DEFAULT_APP_SETTINGS, type AppSettings, type AppLanguage, type AppTheme } from '@shared/types'

function isTheme(value: unknown): value is AppTheme {
  return value === 'dark' || value === 'light'
}

function isLanguage(value: unknown): value is AppLanguage {
  return value === 'ko' || value === 'en'
}

function sanitizeSettings(value: unknown): AppSettings {
  const candidate = typeof value === 'object' && value !== null ? value as Partial<AppSettings> : {}

  return {
    theme: isTheme(candidate.theme) ? candidate.theme : DEFAULT_APP_SETTINGS.theme,
    language: isLanguage(candidate.language) ? candidate.language : DEFAULT_APP_SETTINGS.language,
    autoSave: typeof candidate.autoSave === 'boolean' ? candidate.autoSave : DEFAULT_APP_SETTINGS.autoSave,
    showTemplates: typeof candidate.showTemplates === 'boolean' ? candidate.showTemplates : DEFAULT_APP_SETTINGS.showTemplates,
    toolUseEnabled: typeof candidate.toolUseEnabled === 'boolean' ? candidate.toolUseEnabled : DEFAULT_APP_SETTINGS.toolUseEnabled,
    defaultModel: typeof candidate.defaultModel === 'string' && candidate.defaultModel.trim()
      ? candidate.defaultModel
      : DEFAULT_APP_SETTINGS.defaultModel,
    onboardingDismissed: typeof candidate.onboardingDismissed === 'boolean'
      ? candidate.onboardingDismissed
      : DEFAULT_APP_SETTINGS.onboardingDismissed,
  }
}

function writeSettings(filePath: string, settings: AppSettings): void {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8')
}

export function getSettings(filePath: string): AppSettings {
  if (!existsSync(filePath)) {
    writeSettings(filePath, DEFAULT_APP_SETTINGS)
    return DEFAULT_APP_SETTINGS
  }

  try {
    const raw = readFileSync(filePath, 'utf8')
    const parsed = raw ? JSON.parse(raw) : {}
    const settings = sanitizeSettings(parsed)
    writeSettings(filePath, settings)
    return settings
  } catch {
    writeSettings(filePath, DEFAULT_APP_SETTINGS)
    return DEFAULT_APP_SETTINGS
  }
}

export function updateSettings(filePath: string, patch: Partial<AppSettings>): AppSettings {
  const next = sanitizeSettings({
    ...getSettings(filePath),
    ...patch,
  })
  writeSettings(filePath, next)
  return next
}
