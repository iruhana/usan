import { ipcMain, BrowserWindow, shell, app } from 'electron'
import { IPC } from '@shared/constants/channels'
import type { AppSettings, ScreenCaptureResult, FileEntry, StoredConversation, Note } from '@shared/types/ipc'
import { registerAiIpcHandlers, updateAiSettings } from './ai.ipc'
import { toolCatalog } from '../ai/tool-catalog'
import { validatePath } from '../security'
import { loadSettings, saveSettings, loadPermissions, savePermissions, loadConversations, saveConversations, loadNotes, saveNotes, loadMemory, saveMemory } from '../store'
import { updateTrayLocale } from '../index'
import type { UserMemory } from '../store'

// Persistent settings (loaded from disk on startup)
let settings: AppSettings = loadSettings()
let permissionGrant = loadPermissions()

// Apply saved settings to AI on startup
updateAiSettings(settings)

export function registerIpcHandlers(): void {
  // ─── AI Handlers ────────────────────────────
  registerAiIpcHandlers()

  // ─── Window Controls ──────────────────────────
  ipcMain.handle('window:minimize', () => {
    BrowserWindow.getFocusedWindow()?.minimize()
  })
  ipcMain.handle('window:maximize', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })
  ipcMain.handle('window:close', () => {
    BrowserWindow.getFocusedWindow()?.close()
  })

  // ─── Computer Use: Screenshot ─────────────────
  ipcMain.handle(IPC.COMPUTER_SCREENSHOT, async (): Promise<ScreenCaptureResult> => {
    const result = await toolCatalog.execute('screenshot', {})
    if (result.error) throw new Error(result.error)
    return result.result as ScreenCaptureResult
  })

  // ─── File System (validation delegated to ToolCatalog) ──
  ipcMain.handle(IPC.FS_READ, async (_, { path }: { path: string }): Promise<string> => {
    const result = await toolCatalog.execute('read_file', { path })
    if (result.error) throw new Error(result.error)
    return (result.result as { content: string }).content
  })

  ipcMain.handle(IPC.FS_WRITE, async (_, { path, content }: { path: string; content: string }) => {
    const result = await toolCatalog.execute('write_file', { path, content })
    if (result.error) throw new Error(result.error)
  })

  ipcMain.handle(IPC.FS_DELETE, async (_, { path }: { path: string }) => {
    const result = await toolCatalog.execute('delete_file', { path })
    if (result.error) throw new Error(result.error)
  })

  ipcMain.handle(IPC.FS_LIST, async (_, { dir }: { dir: string }): Promise<FileEntry[]> => {
    const result = await toolCatalog.execute('list_directory', { path: dir })
    if (result.error) throw new Error(result.error)
    const data = result.result as { entries: Array<{ name: string; isDirectory: boolean; size: number; modified: string }> }
    return data.entries.map((e) => ({
      name: e.name,
      path: `${dir}/${e.name}`,
      isDirectory: e.isDirectory,
      size: e.size,
      modifiedAt: new Date(e.modified).getTime(),
    }))
  })

  // ─── Shell ────────────────────────────────────
  ipcMain.handle(
    IPC.SHELL_EXEC,
    async (_, { command, cwd }: { command: string; cwd?: string }) => {
      const result = await toolCatalog.execute('run_command', { command, cwd })
      if (result.error) {
        return { stdout: '', stderr: result.error, exitCode: 1 }
      }
      return result.result
    }
  )

  // ─── Settings ─────────────────────────────────
  ipcMain.handle(IPC.SETTINGS_GET, () => {
    // Mask API key when sending to renderer
    return { ...settings, cloudApiKey: settings.cloudApiKey ? '••••••••' : '' }
  })
  ipcMain.handle(IPC.SETTINGS_SET, async (_, partial: Partial<AppSettings>) => {
    // Explicit key picking to prevent prototype pollution
    const safe: Partial<AppSettings> = {}
    if (partial.fontScale !== undefined) safe.fontScale = Number(partial.fontScale)
    if (partial.highContrast !== undefined) safe.highContrast = Boolean(partial.highContrast)
    if (partial.voiceEnabled !== undefined) safe.voiceEnabled = Boolean(partial.voiceEnabled)
    if (partial.voiceSpeed !== undefined) safe.voiceSpeed = Number(partial.voiceSpeed)
    if (partial.locale !== undefined && ['ko', 'en', 'ja'].includes(partial.locale)) safe.locale = partial.locale
    if (partial.theme !== undefined && ['light', 'dark', 'system'].includes(partial.theme)) safe.theme = partial.theme
    if (partial.cloudApiKey !== undefined && partial.cloudApiKey !== '••••••••') safe.cloudApiKey = String(partial.cloudApiKey)
    settings = { ...settings, ...safe }
    await saveSettings(settings)
    updateAiSettings(settings)
    if (safe.locale) {
      updateTrayLocale(safe.locale as 'ko' | 'en' | 'ja')
    }
  })

  // ─── Permissions ──────────────────────────────
  ipcMain.handle(IPC.PERMISSIONS_GET, () => permissionGrant)
  ipcMain.handle(IPC.PERMISSIONS_GRANT, async () => {
    permissionGrant = {
      grantedAll: true,
      grantedAt: Date.now(),
      version: '0.1.0',
    }
    await savePermissions(permissionGrant)
    return permissionGrant
  })

  // ─── Conversations (persistence) ────────────────
  ipcMain.handle(IPC.CONVERSATIONS_LOAD, (): StoredConversation[] => {
    return loadConversations()
  })
  ipcMain.handle(IPC.CONVERSATIONS_SAVE, async (_, conversations: StoredConversation[]) => {
    if (!Array.isArray(conversations)) throw new Error('Invalid data')
    const serialized = JSON.stringify(conversations)
    if (serialized.length > 50 * 1024 * 1024) throw new Error('Data too large')
    await saveConversations(conversations)
  })

  // ─── Notes ──────────────────────────────────────
  ipcMain.handle(IPC.NOTES_LOAD, (): Note[] => {
    return loadNotes()
  })
  ipcMain.handle(IPC.NOTES_SAVE, async (_, notes: Note[]) => {
    if (!Array.isArray(notes)) throw new Error('Invalid data')
    const serialized = JSON.stringify(notes)
    if (serialized.length > 50 * 1024 * 1024) throw new Error('Data too large')
    await saveNotes(notes)
  })

  // ─── AI Key Validation ──────────────────────────
  ipcMain.handle(IPC.AI_VALIDATE_KEY, async (_, apiKey: string): Promise<{ valid: boolean; error?: string }> => {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
      })
      if (res.ok) return { valid: true }
      if (res.status === 401) return { valid: false, error: 'API 키가 올바르지 않습니다' }
      return { valid: false, error: `서버 응답 오류 (${res.status})` }
    } catch {
      return { valid: false, error: '서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.' }
    }
  })

  // ─── File: Open in default app ──────────────────
  ipcMain.handle(IPC.FS_OPEN_PATH, async (_, filePath: string) => {
    const pathError = validatePath(filePath, 'read')
    if (pathError) throw new Error(pathError)
    const errorMsg = await shell.openPath(filePath)
    if (errorMsg) throw new Error(errorMsg)
  })

  // ─── System paths ────────────────────────────────
  ipcMain.handle(IPC.SYSTEM_DESKTOP_PATH, () => {
    return app.getPath('desktop')
  })

  // ─── Locale detection (OS locale → IP geolocation fallback) ──
  ipcMain.handle(IPC.LOCALE_DETECT, async (): Promise<'ko' | 'en' | 'ja'> => {
    // 1. Try OS locale first (no network needed)
    const osLocale = app.getLocale().toLowerCase()
    if (osLocale.startsWith('ko')) return 'ko'
    if (osLocale.startsWith('ja')) return 'ja'
    if (osLocale.startsWith('en')) return 'en'

    // 2. Fallback: IP geolocation
    try {
      const res = await fetch('https://ipapi.co/json/', {
        signal: AbortSignal.timeout(3000),
      })
      if (res.ok) {
        const data = await res.json() as { country_code?: string }
        if (data.country_code === 'KR') return 'ko'
        if (data.country_code === 'JP') return 'ja'
        return 'en'
      }
    } catch {
      // Network failure — use best guess from OS
    }

    return 'ko' // Final fallback
  })

  // ─── Memory (long-term user preferences) ────────
  ipcMain.handle(IPC.MEMORY_LOAD, (): UserMemory => {
    return loadMemory()
  })
  ipcMain.handle(IPC.MEMORY_SAVE, async (_, memory: UserMemory) => {
    if (!memory || !Array.isArray(memory.facts) || !Array.isArray(memory.preferences)) {
      throw new Error('Invalid memory format')
    }
    const MAX_ENTRY_LEN = 10000
    const sanitizeEntries = (arr: unknown[]) => arr.filter((e): e is { key: string; value: string; learnedAt: number; source: string } =>
      !!e && typeof e === 'object' &&
      typeof (e as Record<string, unknown>).key === 'string' && (e as Record<string, unknown>).key !== '__proto__' &&
      typeof (e as Record<string, unknown>).value === 'string' &&
      ((e as Record<string, unknown>).key as string).length <= MAX_ENTRY_LEN &&
      ((e as Record<string, unknown>).value as string).length <= MAX_ENTRY_LEN
    )
    await saveMemory({
      facts: sanitizeEntries(memory.facts) as UserMemory['facts'],
      preferences: sanitizeEntries(memory.preferences) as UserMemory['preferences'],
    })
  })
}
