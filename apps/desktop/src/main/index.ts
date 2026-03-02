import { app, BrowserWindow, shell, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc'
import { isUrlSafe } from './security'
import { browserDisconnect } from './browser/browser-manager'
import { reminderManager } from './reminders/reminder-manager'
import { ensureElevated } from './admin/elevation'
import { initAutoUpdater } from './updater'
import type { Locale } from '@shared/types/ipc'
let currentLocale: Locale = 'ko'

const trayLabels: Record<Locale, { tooltip: string; open: string; quit: string }> = {
  ko: { tooltip: '우산 — AI 비서', open: '우산 열기', quit: '종료' },
  en: { tooltip: 'Usan — AI Assistant', open: 'Open Usan', quit: 'Quit' },
  ja: { tooltip: 'ウサン — AIアシスタント', open: 'ウサンを開く', quit: '終了' },
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

function createTrayIcon(): Electron.NativeImage {
  // Create a 16x16 tray icon programmatically (blue circle with white dot)
  const size = 16
  const canvas = Buffer.alloc(size * size * 4)
  const cx = size / 2
  const cy = size / 2
  const r = 6

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      const offset = (y * size + x) * 4

      if (dist <= r) {
        // Blue circle (#3b82f6)
        canvas[offset] = 0x3b     // R
        canvas[offset + 1] = 0x82 // G
        canvas[offset + 2] = 0xf6 // B
        canvas[offset + 3] = 0xff // A
      } else if (dist <= r + 1) {
        // Anti-alias edge
        const alpha = Math.max(0, Math.round((1 - (dist - r)) * 255))
        canvas[offset] = 0x3b
        canvas[offset + 1] = 0x82
        canvas[offset + 2] = 0xf6
        canvas[offset + 3] = alpha
      } else {
        // Transparent
        canvas[offset] = 0
        canvas[offset + 1] = 0
        canvas[offset + 2] = 0
        canvas[offset + 3] = 0
      }
    }
  }

  return nativeImage.createFromBuffer(canvas, { width: size, height: size })
}

function buildTrayMenu(locale: Locale): Electron.Menu {
  return Menu.buildFromTemplate([
    {
      label: trayLabels[locale].open,
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      },
    },
    { type: 'separator' },
    {
      label: trayLabels[locale].quit,
      click: () => {
        app.quit()
      },
    },
  ])
}

function createTray(): void {
  const icon = createTrayIcon()
  tray = new Tray(icon)
  tray.setToolTip(trayLabels[currentLocale].tooltip)
  tray.setContextMenu(buildTrayMenu(currentLocale))

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.focus()
    } else {
      mainWindow?.show()
      mainWindow?.focus()
    }
  })
}

function createWindow(): void {
  const isDev = !app.isPackaged
  const devUrl = process.env['ELECTRON_RENDERER_URL']

  const isAppNavigation = (url: string): boolean => {
    if (url.startsWith('file://')) return true
    if (!devUrl) return false
    try {
      return new URL(url).origin === new URL(devUrl).origin
    } catch {
      return false
    }
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      navigateOnDragDrop: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => { mainWindow = null })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAppNavigation(url)) return
    event.preventDefault()
    if (isUrlSafe(url)) {
      shell.openExternal(url)
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (isUrlSafe(details.url)) {
      shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })

  // Dev: load from vite dev server, Prod: load built files
  if (isDev && devUrl) {
    mainWindow.loadURL(devUrl)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

let isQuitting = false

app.whenReady().then(() => {
  app.setAppUserModelId('com.usan.app')

  // Re-launch as admin via Task Scheduler if not elevated (production only)
  if (ensureElevated()) return

  // Register all IPC handlers before creating window
  registerIpcHandlers()

  createWindow()
  createTray()
  initAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  app.on('before-quit', (event) => {
    if (!isQuitting) {
      isQuitting = true
      event.preventDefault()
      reminderManager.cleanup()
      browserDisconnect().finally(() => app.exit(0))
    }
  })
})

app.on('window-all-closed', () => {
  // Don't quit when tray is active — app stays in system tray
  if (process.platform !== 'darwin' && !tray) {
    app.quit()
  }
})

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function updateTrayLocale(locale: Locale): void {
  currentLocale = locale
  if (tray) {
    tray.setToolTip(trayLabels[locale].tooltip)
    tray.setContextMenu(buildTrayMenu(locale))
  }
}
