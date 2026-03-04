import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync, mkdirSync, existsSync } from 'fs'
import { writeFile as writeFileAsync, rename as renameAsync } from 'fs/promises'

// Mock electron before importing store
vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/usan-test',
  },
}))

// Mock security (safeStorage wrappers)
vi.mock('@main/security', () => ({
  encryptString: (s: string) => Buffer.from(s),
  decryptString: (b: Buffer) => b.toString(),
}))

// Mock fs
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

describe('store — loadSettings', () => {
  let loadSettings: typeof import('@main/store').loadSettings

  beforeEach(async () => {
    vi.clearAllMocks()
    // Re-import to reset module state
    const mod = await import('@main/store')
    loadSettings = mod.loadSettings
  })

  it('파일 없으면 기본 설정 반환', () => {
    vi.mocked(readFileSync).mockImplementation(() => { throw new Error('ENOENT') })
    const settings = loadSettings()
    expect(settings.schemaVersion).toBe(2)
    expect(settings.fontScale).toBe(1.0)
    expect(settings.sidebarCollapsed).toBe(false)
    expect(settings.enterToSend).toBe(true)
    expect(settings.locale).toBe('ko')
  })

  it('v1 설정 → v2 마이그레이션 (새 필드 기본값 주입)', () => {
    const v1Settings = JSON.stringify({
      fontScale: 1.5,
      highContrast: true,
      voiceEnabled: false,
      voiceSpeed: 1.2,
      locale: 'en',
      theme: 'dark',
      openAtLogin: false,
      updateChannel: 'beta',
      autoDownloadUpdates: true,
      permissionProfile: 'balanced',
      // no schemaVersion, no sidebarCollapsed, no enterToSend
    })
    vi.mocked(readFileSync).mockReturnValue(v1Settings)
    const settings = loadSettings()
    expect(settings.schemaVersion).toBe(2)
    expect(settings.fontScale).toBe(1.5)
    expect(settings.highContrast).toBe(true)
    expect(settings.locale).toBe('en')
    expect(settings.theme).toBe('dark')
    // Migrated fields should have defaults
    expect(settings.sidebarCollapsed).toBe(false)
    expect(settings.enterToSend).toBe(true)
  })

  it('v2 설정 그대로 로드 (마이그레이션 불필요)', () => {
    const v2Settings = JSON.stringify({
      schemaVersion: 2,
      fontScale: 1.2,
      highContrast: false,
      voiceEnabled: true,
      voiceSpeed: 1.0,
      locale: 'ja',
      theme: 'system',
      openAtLogin: true,
      updateChannel: 'stable',
      autoDownloadUpdates: false,
      permissionProfile: 'strict',
      sidebarCollapsed: true,
      enterToSend: false,
    })
    vi.mocked(readFileSync).mockReturnValue(v2Settings)
    const settings = loadSettings()
    expect(settings.schemaVersion).toBe(2)
    expect(settings.sidebarCollapsed).toBe(true)
    expect(settings.enterToSend).toBe(false)
    expect(settings.locale).toBe('ja')
  })

  it('잘못된 값 → 기본값 폴백', () => {
    const badSettings = JSON.stringify({
      fontScale: 'not-a-number',
      highContrast: 42,
      locale: 'zz',
      theme: 'neon',
      updateChannel: 'nightly',
      permissionProfile: 'yolo',
    })
    vi.mocked(readFileSync).mockReturnValue(badSettings)
    const settings = loadSettings()
    expect(settings.fontScale).toBe(1.0)
    expect(settings.highContrast).toBe(false)
    expect(settings.locale).toBe('ko')
    expect(settings.theme).toBe('light')
    expect(settings.updateChannel).toBe('stable')
    expect(settings.permissionProfile).toBe('full')
  })

  it('범위 밖 fontScale → 기본값', () => {
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ fontScale: 10 }))
    const settings = loadSettings()
    expect(settings.fontScale).toBe(1.0)
  })

  it('손상된 JSON → 기본 설정', () => {
    vi.mocked(readFileSync).mockReturnValue('{bad json...')
    const settings = loadSettings()
    expect(settings.schemaVersion).toBe(2)
    expect(settings.fontScale).toBe(1.0)
  })
})
