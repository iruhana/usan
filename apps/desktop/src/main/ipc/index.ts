import { ipcMain, BrowserWindow, shell, app, dialog } from 'electron'
import { IPC } from '@shared/constants/channels'
import type { AppSettings, ScreenCaptureResult, FileEntry, StoredConversation, Note } from '@shared/types/ipc'
import {
  applyPermissionGrantRequest,
  applyPermissionRevokeRequest,
  isPermissionGranted,
  isTimedGrantActive,
  type PermissionGrantRequest,
  type PermissionRevokeRequest,
} from '@shared/types/permissions'
import { registerAiIpcHandlers, updateAiSettings } from './ai.ipc'
import { toolCatalog } from '../ai/tool-catalog'
import { validatePath } from '../security'
import { loadSettings, saveSettings, loadPermissions, savePermissions, loadConversations, saveConversations, loadNotes, saveNotes, loadMemory, saveMemory } from '../store'
import { updateTrayLocale } from '../index'
import { setAutoStart } from '../admin/elevation'
import { secureDelete } from '../fs/secure-delete'
import { cleanTempFiles } from '../system/temp-cleaner'
import { listStartupPrograms, toggleStartupProgram } from '../system/startup-manager'
import type { StartupSource } from '../system/startup-manager'
import { signInWithEmail, signUp, signInWithOTP, verifyOTP, signOut, getSession } from '../auth/auth-manager'
import { pushData, pullData, getSyncStatus, validateSyncUser } from '../sync/sync-engine'
import type { UserMemory } from '../store'
import { logObsInfo, logObsWarn } from '../observability'

// Persistent settings (loaded from disk on startup)
let settings: AppSettings = loadSettings()
let permissionGrant = loadPermissions()

// Apply saved settings to AI on startup
updateAiSettings(settings)

function requirePermission(feature: string): void {
  if (isPermissionGranted(permissionGrant, { featureName: feature })) return
  const featureGrant = permissionGrant.featureGrants?.[feature]
  const reason =
    featureGrant == null
      ? 'missing_grant'
      : isTimedGrantActive(featureGrant)
        ? 'scope_mismatch'
        : 'expired_grant'
  logObsWarn('permission_denied', {
    scope: 'features',
    item: feature,
    reason,
    expiresAt: featureGrant?.expiresAt ?? null,
  })
  throw new Error(`권한 동의가 필요한 기능입니다: ${feature}`)
}

const ALLOWED_GRANT_SCOPES = new Set(['all', 'tools', 'features', 'skills'])
const MAX_GRANT_ITEMS = 200

function sanitizeGrantRequest(request?: PermissionGrantRequest): PermissionGrantRequest {
  if (!request || !ALLOWED_GRANT_SCOPES.has(String(request.scope))) {
    throw new Error('유효한 권한 요청(scope)이 필요합니다')
  }

  const scope = request.scope as PermissionGrantRequest['scope']
  const ttlMinutes = typeof request.ttlMinutes === 'number' ? request.ttlMinutes : undefined
  const confirmAll = request.confirmAll === true
  const rawItems = Array.isArray(request.items) ? request.items : undefined
  const items = rawItems
    ?.filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length <= 200)
    .slice(0, MAX_GRANT_ITEMS)

  if (scope !== 'all' && (!items || items.length === 0)) {
    throw new Error('세부 권한 항목(items)이 필요합니다')
  }

  return { scope, items, ttlMinutes, confirmAll }
}

async function confirmGrantRequest(
  request: PermissionGrantRequest,
  senderWindow: BrowserWindow | null,
): Promise<void> {
  if (request.scope !== 'all') return

  if (request.confirmAll !== true) {
    throw new Error('전체 권한 승인은 confirmAll=true로만 요청할 수 있습니다')
  }

  const dialogOptions: Electron.MessageBoxOptions = {
    type: 'warning',
    buttons: ['허용', '취소'],
    defaultId: 1,
    cancelId: 1,
    title: '권한 승인 요청',
    message: 'Usan이 전체 권한 승인을 요청했습니다.',
    detail: [
      '요청 범위: all',
      `TTL(분): ${request.ttlMinutes ?? '기본값'}`,
      '',
      '전체 권한은 파일/명령/브라우저 제어를 포함합니다.',
      '신뢰할 수 있는 상황에서만 허용하세요.',
    ].join('\n'),
    noLink: true,
  }

  const response = senderWindow
    ? await dialog.showMessageBox(senderWindow, dialogOptions)
    : await dialog.showMessageBox(dialogOptions)

  if (response.response !== 0) {
    throw new Error('사용자가 권한 요청을 취소했습니다')
  }
}

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
    requirePermission('computer.screenshot')
    const result = await toolCatalog.execute('screenshot', {})
    if (result.error) throw new Error(result.error)
    return result.result as ScreenCaptureResult
  })

  // ─── File System (validation delegated to ToolCatalog) ──
  ipcMain.handle(IPC.FS_READ, async (_, { path }: { path: string }): Promise<string> => {
    requirePermission('fs.read')
    const result = await toolCatalog.execute('read_file', { path })
    if (result.error) throw new Error(result.error)
    return (result.result as { content: string }).content
  })

  ipcMain.handle(IPC.FS_WRITE, async (_, { path, content }: { path: string; content: string }) => {
    requirePermission('fs.write')
    const result = await toolCatalog.execute('write_file', { path, content })
    if (result.error) throw new Error(result.error)
  })

  ipcMain.handle(IPC.FS_DELETE, async (_, { path }: { path: string }) => {
    requirePermission('fs.delete')
    const result = await toolCatalog.execute('delete_file', { path })
    if (result.error) throw new Error(result.error)
  })

  ipcMain.handle(IPC.FS_LIST, async (_, { dir }: { dir: string }): Promise<FileEntry[]> => {
    requirePermission('fs.list')
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
      requirePermission('shell.exec')
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
    if (partial.openAtLogin !== undefined) safe.openAtLogin = Boolean(partial.openAtLogin)
    if (partial.cloudApiKey !== undefined && partial.cloudApiKey !== '••••••••') safe.cloudApiKey = String(partial.cloudApiKey)
    settings = { ...settings, ...safe }
    await saveSettings(settings)
    updateAiSettings(settings)
    if (safe.locale) {
      updateTrayLocale(safe.locale as 'ko' | 'en' | 'ja')
    }
    if (safe.openAtLogin !== undefined) {
      setAutoStart(safe.openAtLogin)
    }
  })

  // ─── Permissions ──────────────────────────────
  ipcMain.handle(IPC.PERMISSIONS_GET, () => permissionGrant)
  ipcMain.handle(IPC.PERMISSIONS_GRANT, async (event, request?: PermissionGrantRequest) => {
    const sanitizedRequest = sanitizeGrantRequest(request)
    const senderWindow = BrowserWindow.fromWebContents(event.sender)
    await confirmGrantRequest(sanitizedRequest, senderWindow)

    permissionGrant = applyPermissionGrantRequest(permissionGrant, sanitizedRequest)
    await savePermissions(permissionGrant)
    logObsInfo('permission_granted', {
      scope: sanitizedRequest.scope ?? 'all',
      items: sanitizedRequest.items ?? null,
      ttlMinutes: sanitizedRequest.ttlMinutes ?? null,
      grantedAll: permissionGrant.grantedAll,
    })
    return permissionGrant
  })
  ipcMain.handle(IPC.PERMISSIONS_REVOKE, async (_, request?: PermissionRevokeRequest) => {
    permissionGrant = applyPermissionRevokeRequest(permissionGrant, request)
    await savePermissions(permissionGrant)
    logObsInfo('permission_revoked', {
      scope: request?.scope ?? 'all',
      items: request?.items ?? null,
      grantedAll: permissionGrant.grantedAll,
    })
    return permissionGrant
  })

  // ─── Conversations (persistence) ────────────────
  // Rate limit: max 1 save per 3 seconds, queue depth limit 2
  let lastConvSave = 0
  let convSaveQueue = 0
  ipcMain.handle(IPC.CONVERSATIONS_LOAD, (): StoredConversation[] => {
    return loadConversations()
  })
  ipcMain.handle(IPC.CONVERSATIONS_SAVE, async (_, conversations: StoredConversation[]) => {
    if (!Array.isArray(conversations)) throw new Error('Invalid data')
    if (conversations.length > 500) throw new Error('Too many conversations')
    const now = Date.now()
    if (now - lastConvSave < 3000) throw new Error('Too many save requests')
    if (convSaveQueue >= 2) throw new Error('Save queue full')
    convSaveQueue++
    try {
      const serialized = JSON.stringify(conversations)
      if (serialized.length > 50 * 1024 * 1024) throw new Error('Data too large')
      lastConvSave = now
      await saveConversations(conversations)
    } finally {
      convSaveQueue--
    }
  })

  // ─── Notes ──────────────────────────────────────
  let lastNotesSave = 0
  let notesSaveQueue = 0
  ipcMain.handle(IPC.NOTES_LOAD, (): Note[] => {
    return loadNotes()
  })
  ipcMain.handle(IPC.NOTES_SAVE, async (_, notes: Note[]) => {
    if (!Array.isArray(notes)) throw new Error('Invalid data')
    if (notes.length > 1000) throw new Error('Too many notes')
    const now = Date.now()
    if (now - lastNotesSave < 3000) throw new Error('Too many save requests')
    if (notesSaveQueue >= 2) throw new Error('Save queue full')
    notesSaveQueue++
    try {
      const serialized = JSON.stringify(notes)
      if (serialized.length > 50 * 1024 * 1024) throw new Error('Data too large')
      lastNotesSave = now
      await saveNotes(notes)
    } finally {
      notesSaveQueue--
    }
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
    requirePermission('fs.openPath')
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

  // ─── Secure Delete ────────────────────────────────
  ipcMain.handle(IPC.FS_SECURE_DELETE, async (_, filePath: string) => {
    requirePermission('fs.secureDelete')
    if (typeof filePath !== 'string' || !filePath.trim()) throw new Error('Invalid file path')
    return secureDelete(filePath)
  })

  // ─── System Optimization ────────────────────────
  ipcMain.handle(IPC.SYSTEM_CLEAN_TEMP, async () => {
    requirePermission('system.cleanTemp')
    return cleanTempFiles()
  })
  ipcMain.handle(IPC.SYSTEM_STARTUP_LIST, async () => {
    requirePermission('system.startupList')
    return listStartupPrograms()
  })
  ipcMain.handle(IPC.SYSTEM_STARTUP_TOGGLE, async (_, { name, source, enabled }: { name: string; source: StartupSource; enabled: boolean }) => {
    requirePermission('system.startupToggle')
    if (!name || !source) throw new Error('Invalid parameters')
    return toggleStartupProgram(name, source, enabled)
  })

  // ─── Auth ──────────────────────────────────────────
  ipcMain.handle(IPC.AUTH_LOGIN, async (_, { email, password }: { email: string; password: string }) => {
    return signInWithEmail(email, password)
  })
  ipcMain.handle(IPC.AUTH_SIGNUP, async (_, { email, password, displayName }: { email: string; password: string; displayName?: string }) => {
    return signUp(email, password, displayName)
  })
  ipcMain.handle(IPC.AUTH_LOGOUT, async () => {
    return signOut()
  })
  ipcMain.handle(IPC.AUTH_SESSION, async () => {
    return getSession()
  })
  ipcMain.handle(IPC.AUTH_LOGIN_OTP, async (_, { phone }: { phone: string }) => {
    return signInWithOTP(phone)
  })
  ipcMain.handle(IPC.AUTH_VERIFY_OTP, async (_, { phone, token }: { phone: string; token: string }) => {
    return verifyOTP(phone, token)
  })

  // ─── Sync ──────────────────────────────────────────
  ipcMain.handle(IPC.SYNC_PUSH, async (_, { userId, dataType, data }: { userId: string; dataType: string; data: string }) => {
    const authError = await validateSyncUser(userId)
    if (authError) return { success: false, error: authError }
    return pushData(userId, dataType, data)
  })
  ipcMain.handle(IPC.SYNC_PULL, async (_, { userId, dataType }: { userId: string; dataType: string }) => {
    const authError = await validateSyncUser(userId)
    if (authError) return { success: false, error: authError }
    return pullData(userId, dataType)
  })
  ipcMain.handle(IPC.SYNC_STATUS, () => {
    return getSyncStatus()
  })

  // ─── Memory (long-term user preferences) ────────
  ipcMain.handle(IPC.MEMORY_LOAD, (): UserMemory => {
    return loadMemory()
  })
  ipcMain.handle(IPC.MEMORY_SAVE, async (_, memory: UserMemory) => {
    if (!memory || !Array.isArray(memory.facts) || !Array.isArray(memory.preferences)) {
      throw new Error('Invalid memory format')
    }
    // Limit array sizes to prevent OOM
    if (memory.facts.length > 5000 || memory.preferences.length > 5000) {
      throw new Error('Memory entry count exceeded (max 5000 per category)')
    }
    const MAX_ENTRY_LEN = 10000
    const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
    const sanitizeEntries = (arr: unknown[]) => arr.filter((e): e is { key: string; value: string; learnedAt: number; source: string } =>
      !!e && typeof e === 'object' &&
      typeof (e as Record<string, unknown>).key === 'string' && !BLOCKED_KEYS.has((e as Record<string, unknown>).key as string) &&
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
