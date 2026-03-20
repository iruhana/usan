import { config } from 'dotenv'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'path'

// Load .env from app root (works in dev and packaged)
config({ path: join(__dirname, '../../.env') })
config({ path: join(app.getAppPath(), '.env') })
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { AITabManager } from './ai-tabs'
import { indexSkills, querySkills, readSkillContent } from './skills/indexer'
import { handleChat, resolveToolApproval, stopStream } from './ai-chat'
import { AI_PROVIDERS } from '@shared/types'
import type {
  AppSettings,
  ApprovalDecision,
  BranchShellSessionSeed,
  ChatPayload,
  CreateShellSessionSeed,
  ProviderSecretProvider,
  ShellApproval,
  ShellAttachment,
  ShellArtifact,
  ShellChatMessage,
  ShellLog,
  ShellRunStep,
  ShellSession,
  ShellSnapshot,
} from '@shared/types'
import { getSettings, updateSettings } from './platform/settings'
import { clearLocalCaches, resetWorkspaceData } from './platform/data-maintenance'
import {
  deleteProviderSecret,
  getProviderSecretsStatus,
  initializeSecretStore,
  setProviderSecret,
} from './platform/secret-store'
import {
  appendShellApproval,
  appendShellAttachment,
  appendShellArtifact,
  appendShellLog,
  appendShellMessage,
  appendShellRunStep,
  archiveShellSession,
  branchShellSession,
  createShellSession,
  getShellSnapshot,
  initializeShellState,
  promoteShellSession,
  resolveShellApproval,
  restoreShellSession,
  commitShellAttachments,
  removeShellAttachment,
  setActiveShellSession,
  updateShellRunStep,
  updateShellSession,
} from './platform/shell-state'

// ─── Paths ───────────────────────────────────────────────────────────────────

const SKILLS_ROOT = 'D:/AI-Apps/_extracted/Skills/openclaw/Skill'
const DATA_DIR = join(app.getPath('userData'), 'usan-pro')
const SKILLS_DB = join(DATA_DIR, 'skills.db')
const SETTINGS_FILE = join(DATA_DIR, 'settings.json')
const SHELL_STATE_FILE = join(DATA_DIR, 'shell-state.json')
const SECRETS_FILE = join(DATA_DIR, 'provider-secrets.json')

// ─── Window ──────────────────────────────────────────────────────────────────

// Sidebar width rendered by React
const SIDEBAR_WIDTH = 64   // icon rail
const PANEL_WIDTH  = 240   // expanded panel

let mainWindow: BrowserWindow
let tabManager: AITabManager

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 560,
    frame: false,          // custom titlebar in renderer
    titleBarStyle: 'hidden',
    backgroundColor: '#0f1117',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    initTabManager()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Resize → update content area bounds
  mainWindow.on('resize', () => updateContentBounds())
}

function getContentBounds(): Electron.Rectangle {
  const [w, h] = mainWindow.getContentSize()
  const titleH = 40
  const left = SIDEBAR_WIDTH + PANEL_WIDTH
  return { x: left, y: titleH, width: Math.max(0, w - left), height: Math.max(0, h - titleH) }
}

function updateContentBounds(): void {
  tabManager?.updateBounds(getContentBounds())
}

function initTabManager(): void {
  tabManager = new AITabManager(mainWindow, getContentBounds())
}

function broadcastShellSnapshot(snapshot: ShellSnapshot): void {
  BrowserWindow
    .getAllWindows()
    .map((window) => window.webContents)
    .filter((contents) => !contents.isDestroyed())
    .forEach((contents) => contents.send('shell:snapshot', snapshot))
}

async function clearBrowserCaches(): Promise<void> {
  const seenSessions = new Set<Electron.Session>()

  for (const window of BrowserWindow.getAllWindows()) {
    if (window.webContents.isDestroyed()) {
      continue
    }

    seenSessions.add(window.webContents.session)
  }

  for (const browserSession of seenSessions) {
    await browserSession.clearCache()
    await browserSession.clearStorageData({
      storages: ['serviceworkers', 'cachestorage'],
    })
  }
}

// ─── App lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.usan.pro')
  app.on('browser-window-created', (_, win) => optimizer.watchWindowShortcuts(win))
  mkdirSync(DATA_DIR, { recursive: true })
  initializeShellState(SHELL_STATE_FILE)
  initializeSecretStore(SECRETS_FILE)

  createWindow()

  // Background-index skills (non-blocking)
  setImmediate(() => {
    try {
      const count = indexSkills(SKILLS_ROOT, SKILLS_DB)
      console.log(`[skills] indexed ${count} skills`)
    } catch (e) {
      console.warn('[skills] index failed:', e)
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── IPC ─────────────────────────────────────────────────────────────────────

// AI tabs
ipcMain.handle('tabs:switch', async (_e, providerId: string) => {
  await tabManager?.switchTo(providerId)
})

ipcMain.handle('tabs:list', () => AI_PROVIDERS)

// Skills
ipcMain.handle('skills:list', (_e, query?: string) => {
  try {
    return querySkills(SKILLS_DB, query)
  } catch {
    return []
  }
})

ipcMain.handle('skills:read', (_e, skillPath: string) => {
  return readSkillContent(skillPath)
})

ipcMain.handle('skills:reindex', () => {
  const count = indexSkills(SKILLS_ROOT, SKILLS_DB)
  return { count }
})

// Shell snapshot + settings
ipcMain.handle('shell:get-snapshot', () => {
  return getShellSnapshot()
})

ipcMain.handle('shell:set-active-session', (_e, sessionId: string) => {
  const snapshot = setActiveShellSession(sessionId)
  broadcastShellSnapshot(snapshot)
  return snapshot
})

ipcMain.handle('shell:create-session', (_e, seed?: CreateShellSessionSeed) => {
  const snapshot = createShellSession(seed)
  broadcastShellSnapshot(snapshot)
  return snapshot
})

ipcMain.handle('shell:branch-session', (_e, sessionId: string, seed?: BranchShellSessionSeed) => {
  const snapshot = branchShellSession(sessionId, seed)
  broadcastShellSnapshot(snapshot)
  return snapshot
})

ipcMain.handle('shell:promote-session', (_e, sessionId: string) => {
  const snapshot = promoteShellSession(sessionId)
  broadcastShellSnapshot(snapshot)
  return snapshot
})

ipcMain.handle('shell:archive-session', (_e, sessionId: string) => {
  const snapshot = archiveShellSession(sessionId)
  broadcastShellSnapshot(snapshot)
  return snapshot
})

ipcMain.handle('shell:restore-session', (_e, sessionId: string) => {
  const snapshot = restoreShellSession(sessionId)
  broadcastShellSnapshot(snapshot)
  return snapshot
})

ipcMain.handle('shell:append-message', (_e, sessionId: string, message: ShellChatMessage) => {
  const snapshot = appendShellMessage(sessionId, message)
  broadcastShellSnapshot(snapshot)
  return snapshot
})

ipcMain.handle('shell:update-session', (_e, sessionId: string, patch: Partial<ShellSession>) => {
  const snapshot = updateShellSession(sessionId, patch)
  broadcastShellSnapshot(snapshot)
  return snapshot
})

ipcMain.handle('shell:append-run-step', (_e, step: ShellRunStep) => {
  const snapshot = appendShellRunStep(step)
  broadcastShellSnapshot(snapshot)
  return snapshot
})

ipcMain.handle('shell:update-run-step', (_e, stepId: string, patch: Partial<ShellRunStep>) => {
  const snapshot = updateShellRunStep(stepId, patch)
  broadcastShellSnapshot(snapshot)
  return snapshot
})

ipcMain.handle('shell:append-log', (_e, log: ShellLog) => {
  const snapshot = appendShellLog(log)
  broadcastShellSnapshot(snapshot)
  return snapshot
})

ipcMain.handle('shell:append-attachment', (_e, attachment: ShellAttachment) => {
  const snapshot = appendShellAttachment(attachment)
  broadcastShellSnapshot(snapshot)
  return snapshot
})

ipcMain.handle('shell:remove-attachment', (_e, attachmentId: string) => {
  const snapshot = removeShellAttachment(attachmentId)
  broadcastShellSnapshot(snapshot)
  return snapshot
})

ipcMain.handle('shell:commit-attachments', (_e, sessionId: string, attachmentIds: string[], messageId: string) => {
  const snapshot = commitShellAttachments(sessionId, attachmentIds, messageId)
  broadcastShellSnapshot(snapshot)
  return snapshot
})

ipcMain.handle('shell:append-artifact', (_e, artifact: ShellArtifact) => {
  const snapshot = appendShellArtifact(artifact)
  broadcastShellSnapshot(snapshot)
  return snapshot
})

ipcMain.handle('shell:append-approval', (_e, approval: ShellApproval) => {
  const snapshot = appendShellApproval(approval)
  broadcastShellSnapshot(snapshot)
  return snapshot
})

ipcMain.handle('shell:resolve-approval', (_e, approvalId: string, decision: ApprovalDecision) => {
  const snapshot = resolveShellApproval(approvalId, decision)
  resolveToolApproval(approvalId, decision)
  broadcastShellSnapshot(snapshot)
  return snapshot
})

ipcMain.handle('settings:get', () => {
  return getSettings(SETTINGS_FILE)
})

ipcMain.handle('settings:update', (_e, patch: Partial<AppSettings>) => {
  return updateSettings(SETTINGS_FILE, patch)
})

ipcMain.handle('secrets:get-status', () => {
  return getProviderSecretsStatus()
})

ipcMain.handle('secrets:set-provider-key', (_e, provider: ProviderSecretProvider, value: string) => {
  return setProviderSecret(provider, value)
})

ipcMain.handle('secrets:delete-provider-key', (_e, provider: ProviderSecretProvider) => {
  return deleteProviderSecret(provider)
})

ipcMain.handle('data:reset-workspace', () => {
  const result = resetWorkspaceData({
    dataDir: DATA_DIR,
    settingsFile: SETTINGS_FILE,
    shellStateFile: SHELL_STATE_FILE,
    secretsFile: SECRETS_FILE,
    skillsDb: SKILLS_DB,
    skillsRoot: SKILLS_ROOT,
  })
  broadcastShellSnapshot(result.snapshot)
  return result
})

ipcMain.handle('data:clear-cache', async () => {
  return clearLocalCaches({
    dataDir: DATA_DIR,
    settingsFile: SETTINGS_FILE,
    shellStateFile: SHELL_STATE_FILE,
    secretsFile: SECRETS_FILE,
    skillsDb: SKILLS_DB,
    skillsRoot: SKILLS_ROOT,
    clearBrowserCaches,
  })
})

// AI Chat (streaming)
ipcMain.handle('ai:chat', (event, payload: ChatPayload) => {
  void handleChat(event.sender, payload, broadcastShellSnapshot)
  return null // streaming is via 'ai:chunk' events
})

ipcMain.handle('ai:stop', (_e, requestId: string) => {
  stopStream(requestId)
})

// Window controls
ipcMain.handle('window:minimize', () => mainWindow?.minimize())
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.handle('window:close', () => mainWindow?.close())
ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false)
