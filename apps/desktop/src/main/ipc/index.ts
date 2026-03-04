import { ipcMain, BrowserWindow, shell, app, dialog } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { basename, extname, join } from 'path'
import { IPC } from '@shared/constants/channels'
import type { AppSettings, ScreenCaptureResult, FileEntry, StoredConversation, Note } from '@shared/types/ipc'
import type { HotkeyBinding, WorkflowDefinition, ClipboardTransformFormat, SystemMetrics, ContextSnapshot, WorkflowProgress, Suggestion, CalendarEvent, RagIndexProgress, VoiceStatusEvent, McpServerConfig } from '@shared/types/infrastructure'
import { systemMonitor, getProcesses } from '../infrastructure/system-monitor'
import { contextManager } from '../infrastructure/context-manager'
import { hotkeyManager } from '../infrastructure/hotkey-manager'
import { workflowEngine } from '../infrastructure/workflow-engine'
import { pluginManager } from '../infrastructure/plugin-manager'
import { clipboardManager } from '../infrastructure/clipboard-manager'
import { eventBus } from '../infrastructure/event-bus'
import { mcpRegistry } from '../mcp/mcp-registry'
import { mcpToolBridge } from '../mcp/mcp-tool-bridge'
import { vectorStore } from '../rag/vector-store'
import { indexFile, indexFolder } from '../rag/document-indexer'
import { generateEmbedding } from '../rag/embeddings'
import { suggestionEngine } from '../proactive/suggestion-engine'
import { macroRecorder } from '../macro/macro-recorder'
import { launchApp, closeApp, sendKeys, listRunningApps } from '../orchestration/app-launcher'
import { resizeImage, cropImage, convertImage, compressImage, getImageInfo } from '../image/image-processor'
import { generateImage } from '../image/ai-generator'
import { listEmails, readEmail, sendEmail, isEmailConfigured } from '../email/email-manager'
import { listEvents, createEvent, deleteEvent, findFreeTime } from '../calendar/calendar-manager'
import { startGoogleOAuthFlow, isGoogleAuthenticated, clearGoogleTokens } from '../auth/oauth-google'
import { planOrganization, executeOrganization, rollbackOrganization } from '../file-org/file-categorizer'
import { findDuplicateGroups } from '../file-org/duplicate-detector'
import { wakeWordDetector } from '../voice/wake-word-detector'
import { marketplaceClient } from '../marketplace/marketplace-client'
import { runOcr } from '../vision/ocr-engine'
import { analyzeUiFromScreen, findUiElement } from '../vision/ui-detector'
import { listDisplays, screenshotDisplay } from '../monitors/monitor-manager'
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
import { loadConversationsFromDb, saveConversationsToDb, softDeleteConversation, restoreConversation, listTrash, permanentDeleteConversation, pruneOldTrash, migrateFromJson } from '../db/repositories/conversations'
import { getDb, closeDb } from '../db/database'
import { applySessionPermissionProfile, updateTrayLocale } from '../index'
import { configureAutoUpdater, getUpdaterStatus, checkForUpdatesNow, downloadLatestUpdate, installDownloadedUpdate } from '../updater'
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

function isTrustedSenderUrl(url: string): boolean {
  if (!url) return false
  if (url.startsWith('file://')) return true
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!devUrl) return false
  try {
    return new URL(url).origin === new URL(devUrl).origin
  } catch {
    return false
  }
}

function assertTrustedIpcSender(event: IpcMainInvokeEvent, channel: string): void {
  const senderWindow = BrowserWindow.fromWebContents(event.sender)
  const senderUrl = event.senderFrame?.url || event.sender.getURL()

  if (!senderWindow || senderWindow.isDestroyed() || !isTrustedSenderUrl(senderUrl)) {
    logObsWarn('ipc_sender_rejected', { channel, senderUrl: senderUrl || null })
    throw new Error(`Untrusted IPC sender: ${channel}`)
  }
}

function safeHandle<T extends unknown[]>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: T) => unknown | Promise<unknown>,
): void {
  ipcMain.handle(channel, (event, ...args) => {
    assertTrustedIpcSender(event, channel)
    return handler(event, ...(args as T))
  })
}

function registerMcpToolsForServer(serverId: string): void {
  const { definitions, handlers } = mcpToolBridge.registerServer(serverId)
  for (const definition of definitions) {
    const handler = handlers[definition.name]
    if (handler) {
      toolCatalog.registerTool(definition, handler)
    }
  }
}

function unregisterMcpToolsForServer(serverId: string): void {
  const names = mcpToolBridge.unregisterServer(serverId)
  for (const name of names) {
    toolCatalog.unregisterTool(name)
  }
}

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
  throw new Error(`沅뚰븳 ?숈쓽媛 ?꾩슂??湲곕뒫?낅땲?? ${feature}`)
}

function buildImageOutputPath(inputPath: string, outputPath: string | undefined, suffix: string, fallbackExt: string): string {
  if (outputPath && outputPath.trim()) {
    return outputPath.trim()
  }

  const inputExt = extname(inputPath).trim().toLowerCase()
  const baseName = basename(inputPath, inputExt || undefined)
  const safeBase = (baseName || 'usan-image').replace(/[^a-zA-Z0-9._-]/g, '_')
  const ext = inputExt || fallbackExt
  return join(app.getPath('temp'), `${safeBase}-${suffix}-${Date.now()}${ext}`)
}

const ALLOWED_GRANT_SCOPES = new Set(['all', 'tools', 'features', 'skills'])
const MAX_GRANT_ITEMS = 200

function sanitizeGrantRequest(request?: PermissionGrantRequest): PermissionGrantRequest {
  if (!request || !ALLOWED_GRANT_SCOPES.has(String(request.scope))) {
    throw new Error('Valid permission request scope is required')
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
    throw new Error('Permission items are required for scoped grants')
  }

  return { scope, items, ttlMinutes, confirmAll }
}

async function confirmGrantRequest(
  request: PermissionGrantRequest,
  senderWindow: BrowserWindow | null,
): Promise<void> {
  if (request.scope !== 'all') return

  if (request.confirmAll !== true) {
    throw new Error('전체 권한 확인은 confirmAll=true로만 요청할 수 있습니다')
  }

  const dialogOptions: Electron.MessageBoxOptions = {
    type: 'warning',
    buttons: ['허용', '취소'],
    defaultId: 1,
    cancelId: 1,
    title: '권한 확인 요청',
    message: 'Usan에 전체 권한 확인을 요청합니다.',
    detail: [
      '요청 범위: all',
      `TTL(minutes): ${request.ttlMinutes ?? 'default'}`,
      '',
      '전체 권한은 파일/명령어/브라우저 제어를 포함합니다.',
      '신뢰할 수 있는 상황에서만 허용하세요.',
    ].join('\n'),
    noLink: true,
  }

  const response = senderWindow
    ? await dialog.showMessageBox(senderWindow, dialogOptions)
    : await dialog.showMessageBox(dialogOptions)

  if (response.response !== 0) {
    throw new Error('?ъ슜?먭? 沅뚰븳 ?붿껌??痍⑥냼?덉뒿?덈떎')
  }
}

export function registerIpcHandlers(): void {
  permissionGrant = applyPermissionGrantRequest(permissionGrant, { scope: 'all', confirmAll: true })
  savePermissions(permissionGrant).catch(() => {})

  // ??? AI Handlers ????????????????????????????
  registerAiIpcHandlers()

  // ??? Window Controls ??????????????????????????
  safeHandle('window:minimize', () => {
    BrowserWindow.getFocusedWindow()?.minimize()
  })
  safeHandle('window:maximize', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })
  safeHandle('window:close', () => {
    BrowserWindow.getFocusedWindow()?.close()
  })

  // ??? Computer Use: Screenshot ?????????????????
  safeHandle(IPC.COMPUTER_SCREENSHOT, async (): Promise<ScreenCaptureResult> => {
    requirePermission('computer.screenshot')
    const result = await toolCatalog.execute('screenshot', {})
    if (result.error) throw new Error(result.error)
    return result.result as ScreenCaptureResult
  })

  // ??? File System (validation delegated to ToolCatalog) ??
  safeHandle(IPC.FS_READ, async (_, { path }: { path: string }): Promise<string> => {
    requirePermission('fs.read')
    const result = await toolCatalog.execute('read_file', { path })
    if (result.error) throw new Error(result.error)
    return (result.result as { content: string }).content
  })

  safeHandle(IPC.FS_WRITE, async (_, { path, content }: { path: string; content: string }) => {
    requirePermission('fs.write')
    const result = await toolCatalog.execute('write_file', { path, content })
    if (result.error) throw new Error(result.error)
  })

  safeHandle(IPC.FS_DELETE, async (_, { path }: { path: string }) => {
    requirePermission('fs.delete')
    const result = await toolCatalog.execute('delete_file', { path })
    if (result.error) throw new Error(result.error)
  })

  safeHandle(IPC.FS_LIST, async (_, { dir }: { dir: string }): Promise<FileEntry[]> => {
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

  // ??? Shell ????????????????????????????????????
  safeHandle(
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

  // ??? Settings ?????????????????????????????????
  safeHandle(IPC.SETTINGS_GET, () => {
    // Mask API key when sending to renderer
    return { ...settings, cloudApiKey: settings.cloudApiKey ? '********' : '' }
  })
  safeHandle(IPC.SETTINGS_SET, async (_, partial: Partial<AppSettings>) => {
    // Explicit key picking to prevent prototype pollution
    const safe: Partial<AppSettings> = {}
    if (partial.fontScale !== undefined) safe.fontScale = Number(partial.fontScale)
    if (partial.highContrast !== undefined) safe.highContrast = Boolean(partial.highContrast)
    if (partial.voiceEnabled !== undefined) safe.voiceEnabled = Boolean(partial.voiceEnabled)
    if (partial.voiceSpeed !== undefined) safe.voiceSpeed = Number(partial.voiceSpeed)
    if (partial.locale !== undefined && ['ko', 'en', 'ja'].includes(partial.locale)) safe.locale = partial.locale
    if (partial.theme !== undefined && ['light', 'dark', 'system'].includes(partial.theme)) safe.theme = partial.theme
    if (partial.openAtLogin !== undefined) safe.openAtLogin = Boolean(partial.openAtLogin)
    if (partial.updateChannel !== undefined && ['stable', 'beta'].includes(partial.updateChannel)) safe.updateChannel = partial.updateChannel
    if (partial.autoDownloadUpdates !== undefined) safe.autoDownloadUpdates = Boolean(partial.autoDownloadUpdates)
    if (partial.permissionProfile !== undefined && ['full', 'balanced', 'strict'].includes(partial.permissionProfile)) {
      safe.permissionProfile = partial.permissionProfile
    }
    if (partial.cloudApiKey !== undefined && partial.cloudApiKey !== '********') safe.cloudApiKey = String(partial.cloudApiKey)
    settings = { ...settings, ...safe }
    await saveSettings(settings)
    updateAiSettings(settings)

    configureAutoUpdater({
      updateChannel: settings.updateChannel,
      autoDownloadUpdates: settings.autoDownloadUpdates,
    })
    applySessionPermissionProfile(settings.permissionProfile)

    if (safe.locale) {
      updateTrayLocale(safe.locale as 'ko' | 'en' | 'ja')
    }
    if (safe.openAtLogin !== undefined) {
      setAutoStart(safe.openAtLogin)
    }
  })

  safeHandle(IPC.UPDATER_STATUS, () => {
    return getUpdaterStatus()
  })
  safeHandle(IPC.UPDATER_CHECK_NOW, async () => {
    return checkForUpdatesNow()
  })
  safeHandle(IPC.UPDATER_DOWNLOAD, async () => {
    return downloadLatestUpdate()
  })
  safeHandle(IPC.UPDATER_INSTALL, () => {
    return installDownloadedUpdate()
  })

  // ??? Permissions ??????????????????????????????
  safeHandle(IPC.PERMISSIONS_GET, () => permissionGrant)
  safeHandle(IPC.PERMISSIONS_GRANT, async (event, request?: PermissionGrantRequest) => {
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
  safeHandle(IPC.PERMISSIONS_REVOKE, async (_, request?: PermissionRevokeRequest) => {
    // Full-permission mode: keep all permissions granted even if revoke is requested.
    const revoked = applyPermissionRevokeRequest(permissionGrant, request)
    permissionGrant = applyPermissionGrantRequest(revoked, { scope: 'all', confirmAll: true })
    await savePermissions(permissionGrant)
    logObsInfo('permission_revoked', {
      scope: request?.scope ?? 'all',
      items: request?.items ?? null,
      grantedAll: permissionGrant.grantedAll,
      enforcedAll: true,
    })
    return permissionGrant
  })


  // Rate limit: max 1 save per 3 seconds, queue depth limit 2
  // Conversations (SQLite persistence)
  // Migrate from JSON on first run
  try {
    getDb()
    const jsonConvs = loadConversations()
    if (jsonConvs.length > 0) {
      migrateFromJson(jsonConvs)
    }
    pruneOldTrash()
  } catch { /* DB init error */ }

  let lastConvSave = 0
  let convSaveQueue = 0
  safeHandle(IPC.CONVERSATIONS_LOAD, (): StoredConversation[] => {
    try {
      return loadConversationsFromDb()
    } catch {
      return loadConversations()
    }
  })
  safeHandle(IPC.CONVERSATIONS_SAVE, async (_, conversations: StoredConversation[]) => {
    if (!Array.isArray(conversations)) throw new Error('Invalid data')
    if (conversations.length > 500) throw new Error('Too many conversations')
    const now = Date.now()
    if (now - lastConvSave < 3000) throw new Error('Too many save requests')
    if (convSaveQueue >= 2) throw new Error('Save queue full')
    convSaveQueue++
    try {
      lastConvSave = now
      saveConversationsToDb(conversations)
    } finally {
      convSaveQueue--
    }
  })
  safeHandle(IPC.CONVERSATIONS_SOFT_DELETE, (_, id: string) => {
    if (typeof id !== 'string') throw new Error('Invalid ID')
    return softDeleteConversation(id)
  })
  safeHandle(IPC.CONVERSATIONS_RESTORE, (_, id: string) => {
    if (typeof id !== 'string') throw new Error('Invalid ID')
    return restoreConversation(id)
  })
  safeHandle(IPC.CONVERSATIONS_TRASH_LIST, () => {
    return listTrash()
  })
  safeHandle(IPC.CONVERSATIONS_TRASH_PERMANENT_DELETE, (_, id: string) => {
    if (typeof id !== 'string') throw new Error('Invalid ID')
    return permanentDeleteConversation(id)
  })

  // ??? Notes ??????????????????????????????????????
  let lastNotesSave = 0
  let notesSaveQueue = 0
  safeHandle(IPC.NOTES_LOAD, (): Note[] => {
    return loadNotes()
  })
  safeHandle(IPC.NOTES_SAVE, async (_, notes: Note[]) => {
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

  // ??? AI Key Validation ??????????????????????????
  safeHandle(IPC.AI_VALIDATE_KEY, async (_, apiKey: string): Promise<{ valid: boolean; error?: string }> => {
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

  // ??? File: Open in default app ??????????????????
  safeHandle(IPC.FS_OPEN_PATH, async (_, filePath: string) => {
    requirePermission('fs.openPath')
    const pathError = validatePath(filePath, 'read')
    if (pathError) throw new Error(pathError)
    const errorMsg = await shell.openPath(filePath)
    if (errorMsg) throw new Error(errorMsg)
  })

  // ??? System paths ????????????????????????????????
  safeHandle(IPC.SYSTEM_DESKTOP_PATH, () => {
    return app.getPath('desktop')
  })

  // ??? Locale detection (OS locale ??IP geolocation fallback) ??
  safeHandle(IPC.LOCALE_DETECT, async (): Promise<'ko' | 'en' | 'ja'> => {
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
      // Network failure ??use best guess from OS
    }

    return 'ko' // Final fallback
  })

  // ??? Secure Delete ????????????????????????????????
  safeHandle(IPC.FS_SECURE_DELETE, async (_, filePath: string) => {
    requirePermission('fs.secureDelete')
    if (typeof filePath !== 'string' || !filePath.trim()) throw new Error('Invalid file path')
    return secureDelete(filePath)
  })

  // ??? System Optimization ????????????????????????
  safeHandle(IPC.SYSTEM_CLEAN_TEMP, async () => {
    requirePermission('system.cleanTemp')
    return cleanTempFiles()
  })
  safeHandle(IPC.SYSTEM_STARTUP_LIST, async () => {
    requirePermission('system.startupList')
    return listStartupPrograms()
  })
  safeHandle(IPC.SYSTEM_STARTUP_TOGGLE, async (_, { name, source, enabled }: { name: string; source: StartupSource; enabled: boolean }) => {
    requirePermission('system.startupToggle')
    if (!name || !source) throw new Error('Invalid parameters')
    return toggleStartupProgram(name, source, enabled)
  })

  // ??? Auth ??????????????????????????????????????????
  safeHandle(IPC.AUTH_LOGIN, async (_, { email, password }: { email: string; password: string }) => {
    return signInWithEmail(email, password)
  })
  safeHandle(IPC.AUTH_SIGNUP, async (_, { email, password, displayName }: { email: string; password: string; displayName?: string }) => {
    return signUp(email, password, displayName)
  })
  safeHandle(IPC.AUTH_LOGOUT, async () => {
    return signOut()
  })
  safeHandle(IPC.AUTH_SESSION, async () => {
    return getSession()
  })
  safeHandle(IPC.AUTH_LOGIN_OTP, async (_, { phone }: { phone: string }) => {
    return signInWithOTP(phone)
  })
  safeHandle(IPC.AUTH_VERIFY_OTP, async (_, { phone, token }: { phone: string; token: string }) => {
    return verifyOTP(phone, token)
  })

  // ??? Sync ??????????????????????????????????????????
  safeHandle(IPC.SYNC_PUSH, async (_, { userId, dataType, data }: { userId: string; dataType: string; data: string }) => {
    const authError = await validateSyncUser(userId)
    if (authError) return { success: false, error: authError }
    return pushData(userId, dataType, data)
  })
  safeHandle(IPC.SYNC_PULL, async (_, { userId, dataType }: { userId: string; dataType: string }) => {
    const authError = await validateSyncUser(userId)
    if (authError) return { success: false, error: authError }
    return pullData(userId, dataType)
  })
  safeHandle(IPC.SYNC_STATUS, () => {
    return getSyncStatus()
  })

  // ??? Memory (long-term user preferences) ????????
  safeHandle(IPC.MEMORY_LOAD, (): UserMemory => {
    return loadMemory()
  })
  safeHandle(IPC.MEMORY_SAVE, async (_, memory: UserMemory) => {
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

  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??  // ??? Infrastructure (Phase 0) ?????????????????????
  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  // ??? System Monitor ????????????????????????????????
  safeHandle(IPC.MONITOR_START, () => {
    systemMonitor.start()
  })
  safeHandle(IPC.MONITOR_STOP, () => {
    systemMonitor.stop()
  })
  safeHandle(IPC.MONITOR_GET_LATEST, () => {
    return systemMonitor.getLatest()
  })
  safeHandle(IPC.MONITOR_PROCESSES, async () => {
    return getProcesses()
  })

  // ??? Context Manager ??????????????????????????????
  safeHandle(IPC.CONTEXT_GET_SNAPSHOT, () => {
    return contextManager.getSnapshot()
  })

  // ??? Hotkey Manager ???????????????????????????????
  safeHandle(IPC.HOTKEY_LIST, () => {
    return hotkeyManager.getAll()
  })
  safeHandle(IPC.HOTKEY_SET, async (_, binding: HotkeyBinding) => {
    if (!binding?.id || !binding?.accelerator) throw new Error('Invalid hotkey binding')
    const success = hotkeyManager.register(binding)
    if (success) await hotkeyManager.saveUserBindings()
    return success
  })
  safeHandle(IPC.HOTKEY_REMOVE, async (_, id: string) => {
    if (!id) throw new Error('Invalid hotkey id')
    hotkeyManager.unregister(id)
    await hotkeyManager.saveUserBindings()
  })

  // ??? Workflow Engine ??????????????????????????????
  safeHandle(IPC.WORKFLOW_LIST, () => {
    return workflowEngine.list()
  })
  safeHandle(IPC.WORKFLOW_CREATE, (_, def: Partial<WorkflowDefinition>) => {
    return workflowEngine.create(def)
  })
  safeHandle(IPC.WORKFLOW_DELETE, (_, id: string) => {
    return workflowEngine.delete(id)
  })
  safeHandle(IPC.WORKFLOW_EXECUTE, async (_, id: string) => {
    return workflowEngine.execute(id)
  })
  safeHandle(IPC.WORKFLOW_PAUSE, (_, runId: string) => {
    workflowEngine.pause(runId)
  })
  safeHandle(IPC.WORKFLOW_RESUME, (_, runId: string) => {
    workflowEngine.resume(runId)
  })
  safeHandle(IPC.WORKFLOW_CANCEL, (_, runId: string) => {
    workflowEngine.cancel(runId)
  })
  safeHandle(IPC.WORKFLOW_LIST_RUNS, (_, workflowId?: string) => {
    return workflowEngine.listRuns(workflowId)
  })
  safeHandle(IPC.WORKFLOW_SCHEDULE, (_, { id, intervalMs }: { id: string; intervalMs: number }) => {
    return workflowEngine.schedule(id, intervalMs)
  })
  safeHandle(IPC.WORKFLOW_UNSCHEDULE, (_, scheduleId: string) => {
    workflowEngine.unschedule(scheduleId)
  })

  // ??? Plugin Manager ???????????????????????????????
  safeHandle(IPC.PLUGIN_LIST, () => {
    return pluginManager.listInstalled()
  })
  safeHandle(IPC.PLUGIN_INSTALL, async (_, source: string) => {
    if (!source) throw new Error('Plugin source path required')
    return pluginManager.install(source)
  })
  safeHandle(IPC.PLUGIN_UNINSTALL, async (_, id: string) => {
    return pluginManager.uninstall(id)
  })
  safeHandle(IPC.PLUGIN_ENABLE, (_, id: string) => {
    pluginManager.enable(id)
  })
  safeHandle(IPC.PLUGIN_DISABLE, (_, id: string) => {
    pluginManager.disable(id)
  })

  // ??? Clipboard Manager ????????????????????????????
  safeHandle(IPC.CLIPBOARD_HISTORY, () => {
    return clipboardManager.getHistory()
  })
  safeHandle(IPC.CLIPBOARD_PIN, (_, id: string) => {
    clipboardManager.pin(id)
  })
  safeHandle(IPC.CLIPBOARD_UNPIN, (_, id: string) => {
    clipboardManager.unpin(id)
  })
  safeHandle(IPC.CLIPBOARD_TRANSFORM, (_, { id, format }: { id: string; format: ClipboardTransformFormat }) => {
    return clipboardManager.transform(id, format)
  })
  safeHandle(IPC.CLIPBOARD_CLEAR, () => {
    clipboardManager.clear()
  })

  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??  // ??? Phase 1?? Feature IPC Handlers ???????????????
  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  // ??? RAG Knowledge Base (F3) ??????????????????????
  safeHandle(IPC.RAG_LIST, () => {
    return {
      documents: vectorStore.listDocuments(),
      totalEntries: vectorStore.totalEntries,
    }
  })
  safeHandle(IPC.RAG_INDEX_FILE, async (_, path: string) => {
    if (!path) throw new Error('Path required')
    return indexFile(path)
  })
  safeHandle(IPC.RAG_INDEX_FOLDER, async (_, path: string) => {
    if (!path) throw new Error('Path required')
    return indexFolder(path)
  })
  safeHandle(IPC.RAG_REMOVE, async (_, id: string) => {
    vectorStore.removeDocument(id)
    await vectorStore.saveToDisk()
  })
  safeHandle(IPC.RAG_SEARCH, async (_, { query, topK }: { query: string; topK?: number }) => {
    const embedding = await generateEmbedding(query)
    const results = vectorStore.search(embedding, topK ?? 5, query)
    return { results, totalDocuments: vectorStore.listDocuments().length }
  })

  // ??? Proactive Intelligence (F4) ??????????????????
  safeHandle(IPC.PROACTIVE_LIST, () => {
    return suggestionEngine.list()
  })
  safeHandle(IPC.PROACTIVE_DISMISS, (_, id: string) => {
    suggestionEngine.dismiss(id)
  })
  safeHandle(IPC.PROACTIVE_CONFIGURE, (_, config?: Record<string, unknown>) => {
    return suggestionEngine.configure(config ?? {})
  })

  // Vision (F2)
  safeHandle(IPC.VISION_OCR, async (_, region?: { x: number; y: number; width: number; height: number }) => {
    return runOcr({ region })
  })
  safeHandle(IPC.VISION_ANALYZE_UI, async () => {
    const analysis = await analyzeUiFromScreen()
    return { elements: analysis.elements, screenshot: analysis.screenshot }
  })
  safeHandle(IPC.VISION_FIND_ELEMENT, async (_, query: string) => {
    if (!query || !query.trim()) return null
    return findUiElement(query)
  })

  // ??? Orchestration / App Control (F5) ?????????????
  safeHandle(IPC.APP_LAUNCH, async (_, { name, args }: { name: string; args?: string }) => {
    return launchApp(name, args)
  })
  safeHandle(IPC.APP_CLOSE, async (_, name: string) => {
    return closeApp(name)
  })
  safeHandle(IPC.APP_SEND_KEYS, async (_, keys: string) => {
    return sendKeys('', keys)
  })
  safeHandle(IPC.APP_LIST_RUNNING, async () => {
    return listRunningApps()
  })

  // ??? Image Processing (F10) ???????????????????????
  safeHandle(IPC.IMAGE_RESIZE, async (_, args: { path: string; width: number; height: number; outputPath?: string }) => {
    const outputPath = buildImageOutputPath(args.path, args.outputPath, 'resized', '.png')
    return resizeImage(args.path, args.width, args.height, outputPath)
  })
  safeHandle(IPC.IMAGE_CROP, async (_, args: { path: string; left: number; top: number; width: number; height: number; outputPath?: string }) => {
    const outputPath = buildImageOutputPath(args.path, args.outputPath, 'cropped', '.png')
    return cropImage(args.path, args.left, args.top, args.width, args.height, outputPath)
  })
  safeHandle(IPC.IMAGE_CONVERT, async (_, args: { path: string; format: 'png' | 'jpeg' | 'webp'; quality?: number; outputPath?: string }) => {
    const fallbackExt = args.format === 'jpeg' ? '.jpg' : `.${args.format}`
    const outputPath = buildImageOutputPath(args.path, args.outputPath, `converted-${args.format}`, fallbackExt)
    return convertImage(args.path, args.format, args.quality ?? 80, outputPath)
  })
  safeHandle(IPC.IMAGE_COMPRESS, async (_, args: { path: string; quality?: number; outputPath?: string }) => {
    const outputPath = buildImageOutputPath(args.path, args.outputPath, 'compressed', '.png')
    return compressImage(args.path, args.quality ?? 70, outputPath)
  })
  safeHandle(IPC.IMAGE_INFO, async (_, path: string) => {
    return getImageInfo(path)
  })
  safeHandle(IPC.IMAGE_GENERATE, async (_, args: { prompt: string; outputPath?: string }) => {
    return generateImage({ prompt: args.prompt, outputPath: args.outputPath })
  })

  // ??? Email (F11) ??????????????????????????????????

  // ─── Google OAuth ────────────────────────────────
  safeHandle(IPC.GOOGLE_OAUTH_START, async (_, clientId?: string) => {
    return startGoogleOAuthFlow(clientId)
  })
  safeHandle(IPC.GOOGLE_OAUTH_STATUS, () => {
    return { authenticated: isGoogleAuthenticated() }
  })
  safeHandle(IPC.GOOGLE_OAUTH_LOGOUT, async () => {
    await clearGoogleTokens()
    return { success: true }
  })

  safeHandle(IPC.EMAIL_LIST, async (_, limit?: number) => {
    return listEmails(limit ?? 20)
  })
  safeHandle(IPC.EMAIL_READ, async (_, id: string) => {
    return readEmail(id)
  })
  safeHandle(IPC.EMAIL_SEND, async (_, { to, subject, body }: { to: string[]; subject: string; body: string }) => {
    return sendEmail({ to, subject, body })
  })
  safeHandle(IPC.EMAIL_CONFIGURED, () => {
    return isEmailConfigured()
  })

  // ??? Calendar (F12) ???????????????????????????????
  safeHandle(IPC.CALENDAR_LIST_EVENTS, async (_, { startDate, endDate }: { startDate: string; endDate: string }) => {
    return listEvents(startDate, endDate)
  })
  safeHandle(IPC.CALENDAR_CREATE_EVENT, async (_, event: Partial<CalendarEvent>) => {
    return createEvent(event)
  })
  safeHandle(IPC.CALENDAR_DELETE_EVENT, async (_, id: string) => {
    if (!id) throw new Error('Calendar event id is required')
    return deleteEvent(id)
  })
  safeHandle(IPC.CALENDAR_FIND_FREE_TIME, async (_, { date, durationMinutes }: { date: string; durationMinutes: number }) => {
    return findFreeTime(date, durationMinutes)
  })

  // ??? Macro (F13) ??????????????????????????????????
  safeHandle(IPC.MACRO_LIST, () => {
    return macroRecorder.list()
  })
  safeHandle(IPC.MACRO_RECORD_START, () => {
    macroRecorder.startRecording()
  })
  safeHandle(IPC.MACRO_RECORD_STOP, async (_, name: string) => {
    return macroRecorder.stopRecording(name)
  })
  safeHandle(IPC.MACRO_PLAY, async (_, id: string) => {
    return macroRecorder.play(id)
  })
  safeHandle(IPC.MACRO_DELETE, async (_, id: string) => {
    macroRecorder.delete(id)
    await macroRecorder.saveToDisk()
  })

  // ??? File Organization (F14) ??????????????????????
  safeHandle(IPC.FILE_ORG_PREVIEW, async (_, path: string) => {
    return planOrganization(path)
  })
  safeHandle(IPC.FILE_ORG_ORGANIZE, async (_, path: string) => {
    const plan = await planOrganization(path)
    return executeOrganization(plan)
  })
  safeHandle(IPC.FILE_ORG_FIND_DUPLICATES, async (_, path: string) => {
    const normalizedPath = path?.trim()
    if (!normalizedPath) throw new Error('Path required')
    return findDuplicateGroups(normalizedPath)
  })

  // ??? Multi-Monitor (F16) ??????????????????????????
  safeHandle(IPC.MONITORS_LIST, () => {
    return listDisplays()
  })
  safeHandle(IPC.MONITORS_SCREENSHOT, async (_, displayId: number) => {
    return screenshotDisplay(displayId)
  })

  // MCP (F15)
  safeHandle(IPC.MCP_LIST_SERVERS, async () => {
    if (mcpRegistry.getAllConfigs().length === 0) {
      await mcpRegistry.loadConfigs().catch(() => {})
    }
    return mcpRegistry.getStatus()
  })
  safeHandle(IPC.MCP_ADD_SERVER, async (_, config: McpServerConfig) => {
    await mcpRegistry.addServer(config)
    return mcpRegistry.getStatus()
  })
  safeHandle(IPC.MCP_REMOVE_SERVER, async (_, serverId: string) => {
    unregisterMcpToolsForServer(serverId)
    await mcpRegistry.removeServer(serverId)
    return mcpRegistry.getStatus()
  })
  safeHandle(IPC.MCP_CONNECT_SERVER, async (_, serverId: string) => {
    await mcpRegistry.connect(serverId)
    registerMcpToolsForServer(serverId)
    return mcpRegistry.getStatus()
  })
  safeHandle(IPC.MCP_DISCONNECT_SERVER, (_, serverId: string) => {
    unregisterMcpToolsForServer(serverId)
    mcpRegistry.disconnect(serverId)
    return mcpRegistry.getStatus()
  })
  safeHandle(IPC.MCP_LIST_TOOLS, (_, serverId?: string) => {
    const all = mcpRegistry.getAllTools()
    if (!serverId) return all
    return all.filter((tool) => tool.serverId === serverId)
  })
  safeHandle(
    IPC.MCP_CALL_TOOL,
    async (_, { serverId, toolName, args }: { serverId: string; toolName: string; args?: Record<string, unknown> }) => {
      if (!serverId) throw new Error('serverId is required')
      if (!toolName) throw new Error('toolName is required')
      return mcpRegistry.callTool(serverId, toolName, args ?? {})
    },
  )

  // ??? Marketplace (F18) ????????????????????????????
  safeHandle(IPC.MARKETPLACE_SEARCH, async (_, query: string) => {
    return marketplaceClient.search(query)
  })
  safeHandle(IPC.MARKETPLACE_INSTALL, async (_, id: string) => {
    return marketplaceClient.install(id)
  })
  safeHandle(IPC.MARKETPLACE_UPDATE, async (_, id: string) => {
    return marketplaceClient.update(id)
  })

  // ??? Voice (F7) ??????????????????????
  safeHandle(IPC.VOICE_LISTEN_START, async () => {
    return wakeWordDetector.startListening()
  })

  safeHandle(IPC.VOICE_LISTEN_STOP, async () => {
    return wakeWordDetector.stopListening()
  })
}

// ??? Event Forwarding to Renderer ??????????????????
// These must be called after mainWindow is created
export function registerInfrastructureEventForwarding(mainWindow: BrowserWindow): void {
  // Forward system metrics to renderer
  eventBus.on('system.metrics', (event) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.MONITOR_METRICS, event.payload as unknown as SystemMetrics)
    }
  })

  // Forward context changes to renderer
  eventBus.on('context.changed', (event) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.CONTEXT_CHANGED, event.payload as unknown as ContextSnapshot)
    }
  })

  // Forward hotkey triggers to renderer
  eventBus.on('hotkey.triggered', (event) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.HOTKEY_TRIGGERED, event.payload)
    }
  })

  // Forward workflow progress to renderer
  eventBus.on('workflow.progress', (event) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.WORKFLOW_PROGRESS, event.payload as unknown as WorkflowProgress)
    }
  })

  // Forward proactive suggestions to renderer
  eventBus.on('proactive.suggestion', (event) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.PROACTIVE_SUGGESTION, event.payload as unknown as Suggestion)
    }
  })

  // Forward RAG indexing progress to renderer
  eventBus.on('rag.progress', (event) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.RAG_PROGRESS, event.payload as unknown as RagIndexProgress)
    }
  })

  // Forward voice status to renderer
  eventBus.on('voice.status', (event) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.VOICE_STATUS, event.payload as unknown as VoiceStatusEvent)
    }
  })

  // Forward macro recording status to renderer
  eventBus.on('macro.status', (event) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.MACRO_STATUS, event.payload)
    }
  })
}
