import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'fs'

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/usan-test',
  },
}))

vi.mock('@main/security', () => ({
  encryptString: (value: string) => Buffer.from(value),
  decryptString: (value: Buffer) => value.toString(),
}))

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    readFileSync: vi.fn(),
    mkdirSync: vi.fn(),
    existsSync: vi.fn(() => true),
  }
})

vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises')
  return {
    ...actual,
    writeFile: vi.fn(async () => {}),
    rename: vi.fn(async () => {}),
  }
})

describe('store.loadSettings', () => {
  let loadSettings: typeof import('@main/store').loadSettings

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@main/store')
    loadSettings = mod.loadSettings
  })

  it('returns defaults when settings file is missing', () => {
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error('ENOENT')
    })

    const settings = loadSettings()
    expect(settings.schemaVersion).toBe(7)
    expect(settings.locale).toBe('ko')
    expect(settings.localeConfigured).toBe(false)
    expect(settings.beginnerMode).toBe(true)
    expect(settings.voiceOverlayEnabled).toBe(true)
    expect(settings.browserCredentialAutoImportEnabled).toBe(true)
    expect(settings.browserCredentialAutoImportDone).toBe(false)
    expect(settings.sidebarCollapsed).toBe(false)
    expect(settings.enterToSend).toBe(true)
  })

  it('migrates v1 settings to include newer fields', () => {
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        fontScale: 1.2,
        highContrast: true,
        voiceEnabled: false,
        voiceOverlayEnabled: false,
        voiceSpeed: 1.1,
        locale: 'en',
        theme: 'dark',
        openAtLogin: false,
        updateChannel: 'beta',
        autoDownloadUpdates: true,
        permissionProfile: 'balanced',
      }),
    )

    const settings = loadSettings()
    expect(settings.schemaVersion).toBe(7)
    expect(settings.beginnerMode).toBe(true)
    expect(settings.voiceOverlayEnabled).toBe(false)
    expect(settings.localeConfigured).toBe(true)
    expect(settings.browserCredentialAutoImportEnabled).toBe(true)
    expect(settings.browserCredentialAutoImportDone).toBe(false)
    expect(settings.sidebarCollapsed).toBe(false)
    expect(settings.enterToSend).toBe(true)
    expect(settings.locale).toBe('en')
  })

  it('keeps v7 settings values as-is', () => {
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        schemaVersion: 7,
        fontScale: 1.3,
        highContrast: false,
        voiceEnabled: true,
        voiceOverlayEnabled: false,
        voiceSpeed: 1,
        locale: 'ja',
        localeConfigured: true,
        theme: 'system',
        openAtLogin: true,
        updateChannel: 'stable',
        autoDownloadUpdates: false,
        permissionProfile: 'strict',
        beginnerMode: false,
        browserCredentialAutoImportEnabled: false,
        browserCredentialAutoImportDone: true,
        sidebarCollapsed: true,
        enterToSend: false,
      }),
    )

    const settings = loadSettings()
    expect(settings.schemaVersion).toBe(7)
    expect(settings.beginnerMode).toBe(false)
    expect(settings.voiceOverlayEnabled).toBe(false)
    expect(settings.localeConfigured).toBe(true)
    expect(settings.browserCredentialAutoImportEnabled).toBe(false)
    expect(settings.browserCredentialAutoImportDone).toBe(true)
    expect(settings.sidebarCollapsed).toBe(true)
    expect(settings.enterToSend).toBe(false)
    expect(settings.locale).toBe('ja')
  })

  it('falls back to defaults for invalid values', () => {
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        fontScale: 'invalid',
        highContrast: 1,
        locale: 'zz',
        theme: 'neon',
        updateChannel: 'nightly',
        permissionProfile: 'invalid',
        beginnerMode: 'true',
      }),
    )

    const settings = loadSettings()
    expect(settings.fontScale).toBe(1)
    expect(settings.highContrast).toBe(false)
    expect(settings.voiceOverlayEnabled).toBe(true)
    expect(settings.locale).toBe('ko')
    expect(settings.localeConfigured).toBe(false)
    expect(settings.theme).toBe('light')
    expect(settings.updateChannel).toBe('stable')
    expect(settings.permissionProfile).toBe('full')
    expect(settings.beginnerMode).toBe(true)
    expect(settings.browserCredentialAutoImportEnabled).toBe(true)
  })
})
