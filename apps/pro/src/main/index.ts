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
import { handleChat, stopStream } from './ai-chat'
import { AI_PROVIDERS } from '@shared/types'
import type { AppSettings, ChatPayload } from '@shared/types'
import { createShellSnapshot } from './platform/shell-snapshot'
import { getSettings, updateSettings } from './platform/settings'

// ─── Paths ───────────────────────────────────────────────────────────────────

const SKILLS_ROOT = 'D:/AI-Apps/_extracted/Skills/openclaw/Skill'
const DATA_DIR = join(app.getPath('userData'), 'usan-pro')
const SKILLS_DB = join(DATA_DIR, 'skills.db')
const SETTINGS_FILE = join(DATA_DIR, 'settings.json')

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

// ─── App lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.usan.pro')
  app.on('browser-window-created', (_, win) => optimizer.watchWindowShortcuts(win))

  createWindow()

  // Background-index skills (non-blocking)
  setImmediate(() => {
    try {
      mkdirSync(DATA_DIR, { recursive: true })
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
  return createShellSnapshot()
})

ipcMain.handle('settings:get', () => {
  return getSettings(SETTINGS_FILE)
})

ipcMain.handle('settings:update', (_e, patch: Partial<AppSettings>) => {
  return updateSettings(SETTINGS_FILE, patch)
})

// AI Chat (streaming)
ipcMain.handle('ai:chat', (event, payload: ChatPayload) => {
  handleChat(event.sender, payload)
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
