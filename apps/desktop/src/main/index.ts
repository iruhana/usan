import { app, BrowserWindow, shell, Tray, Menu, nativeImage, powerMonitor } from 'electron'
import type { WebContents } from 'electron'
import { join } from 'path'
import { registerIpcHandlers, registerInfrastructureEventForwarding } from './ipc'
import { isUrlSafe } from './security'
import { browserDisconnect } from './browser/browser-manager'
import { reminderManager } from './reminders/reminder-manager'
import { ensureElevated } from './admin/elevation'
import { initAutoUpdater, markUpdaterWillQuit } from './updater'
import { loadSettings } from './store'
import type { Locale, PermissionProfile } from '@shared/types/ipc'

// Infrastructure modules
import { eventBus } from './infrastructure/event-bus'
import { systemMonitor } from './infrastructure/system-monitor'
import { contextManager } from './infrastructure/context-manager'
import { hotkeyManager } from './infrastructure/hotkey-manager'
import { workflowEngine } from './infrastructure/workflow-engine'
import { pluginManager } from './infrastructure/plugin-manager'
import { clipboardManager } from './infrastructure/clipboard-manager'
import { suggestionEngine } from './proactive/suggestion-engine'
import { macroRecorder } from './macro/macro-recorder'
import { vectorStore } from './rag/vector-store'
import { toolCatalog } from './ai/tool-catalog'
import { mcpRegistry } from './mcp/mcp-registry'
import { mcpToolBridge } from './mcp/mcp-tool-bridge'
import { closeDb } from './db/database'
let currentLocale: Locale = 'ko'
let powerProfileListenersRegistered = false
const ALLOWED_SESSION_PERMISSIONS = new Set<string>()
const IS_SMOKE_SELFTEST = process.env['USAN_SMOKE_SELFTEST'] === '1'
const SMOKE_TIMEOUT_MS = Number.parseInt(process.env['USAN_SMOKE_SELFTEST_TIMEOUT_MS'] ?? '30000', 10)
const DEFAULT_PERMISSION_PROFILE: PermissionProfile = 'full'

const POWER_PROFILES = {
  ac: {
    systemMonitorIntervalMs: 5000,
    clipboardPollIntervalMs: 500,
  },
  battery: {
    systemMonitorIntervalMs: 15000,
    clipboardPollIntervalMs: 1500,
  },
} as const

const SESSION_PERMISSION_PROFILES: Record<PermissionProfile, ReadonlyArray<string>> = {
  full: [
    'media',
    'geolocation',
    'notifications',
    'midi',
    'midiSysex',
    'pointerLock',
    'fullscreen',
    'openExternal',
    'clipboard-read',
    'clipboard-sanitized-write',
    'idle-detection',
    'serial',
    'usb',
    'hid',
  ],
  balanced: [
    'notifications',
    'clipboard-read',
    'clipboard-sanitized-write',
    'fullscreen',
    'openExternal',
  ],
  strict: [],
}

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
    if (!IS_SMOKE_SELFTEST) {
      mainWindow?.show()
    }
    if (mainWindow) registerInfrastructureEventForwarding(mainWindow)

    if (IS_SMOKE_SELFTEST) {
      setTimeout(() => app.exit(0), 200)
    }
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

  configureSessionPermissionHandlers(mainWindow)

  // Dev: load from vite dev server, Prod: load built files
  mainWindow.webContents.on('did-fail-load', (_event, code, description) => {
    if (IS_SMOKE_SELFTEST) {
      console.error(`Smoke self-test load failure (${code}): ${description}`)
      app.exit(1)
    }
  })

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

  const startupSettings = loadSettings()
  applySessionPermissionProfile(startupSettings.permissionProfile ?? DEFAULT_PERMISSION_PROFILE)

  // Register all IPC handlers before creating window
  registerIpcHandlers()

  // Initialize infrastructure services
  initInfrastructure()

  createWindow()
  if (!IS_SMOKE_SELFTEST) {
    createTray()
    initAutoUpdater({
      updateChannel: startupSettings.updateChannel,
      autoDownloadUpdates: startupSettings.autoDownloadUpdates,
    })
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  app.on('before-quit', (event) => {
    if (!isQuitting) {
      isQuitting = true
      event.preventDefault()
      markUpdaterWillQuit()
      cleanupInfrastructure()
      reminderManager.cleanup()
      browserDisconnect().finally(() => app.exit(0))
    }
  })

  if (IS_SMOKE_SELFTEST) {
    setTimeout(() => {
      console.error('Smoke self-test timed out before app was ready')
      app.exit(1)
    }, Number.isFinite(SMOKE_TIMEOUT_MS) && SMOKE_TIMEOUT_MS > 0 ? SMOKE_TIMEOUT_MS : 30000)
  }
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

export function applySessionPermissionProfile(profile: PermissionProfile): void {
  const resolved: PermissionProfile =
    profile === 'balanced' || profile === 'strict' ? profile : DEFAULT_PERMISSION_PROFILE
  ALLOWED_SESSION_PERMISSIONS.clear()
  for (const permission of SESSION_PERMISSION_PROFILES[resolved]) {
    ALLOWED_SESSION_PERMISSIONS.add(permission)
  }
}

// ─── Infrastructure Lifecycle ────────────────────
function initInfrastructure(): void {
  // Connect workflow engine to tool catalog
  workflowEngine.setToolExecutor(async (name, args) => {
    const result = await toolCatalog.execute(name, args)
    if (result.error) throw new Error(result.error)
    return result.result
  })

  // Load persisted data
  workflowEngine.loadFromDisk().catch(() => {})
  pluginManager.init().catch(() => {})
  mcpRegistry.loadConfigs().then(() => mcpRegistry.connectAll()).then(() => {
    const { definitions, handlers } = mcpToolBridge.syncTools()
    for (const definition of definitions) {
      const handler = handlers[definition.name]
      if (handler) {
        toolCatalog.registerTool(definition, handler)
      }
    }
  }).catch(() => {})
  hotkeyManager.loadUserBindings().catch(() => {})
  macroRecorder.loadFromDisk().catch(() => {})
  vectorStore.loadFromDisk().catch(() => {})

  // Start monitoring services (delayed to not slow app start)
  setTimeout(() => {
    systemMonitor.start()
    contextManager.start()
    clipboardManager.start()
    suggestionEngine.start()
    applyPowerAwarePerformanceProfile(powerMonitor.isOnBatteryPower())
    registerPowerProfileListeners()
  }, 3000)
}

function cleanupInfrastructure(): void {
  try { closeDb() } catch { /* db already closed */ }
  if (powerProfileListenersRegistered) {
    powerMonitor.removeListener('on-battery', handleOnBattery)
    powerMonitor.removeListener('on-ac', handleOnAc)
    powerProfileListenersRegistered = false
  }
  suggestionEngine.destroy()
  clipboardManager.destroy()
  macroRecorder.destroy()
  vectorStore.destroy()
  systemMonitor.destroy()
  contextManager.destroy()
  hotkeyManager.destroy()
  workflowEngine.destroy()
  mcpRegistry.destroy()
  pluginManager.destroy()
  eventBus.destroy()
}

function applyPowerAwarePerformanceProfile(onBattery: boolean): void {
  const profile = onBattery ? POWER_PROFILES.battery : POWER_PROFILES.ac
  systemMonitor.setIntervalMs(profile.systemMonitorIntervalMs)
  clipboardManager.setPollIntervalMs(profile.clipboardPollIntervalMs)
}

function handleOnBattery(): void {
  applyPowerAwarePerformanceProfile(true)
}

function handleOnAc(): void {
  applyPowerAwarePerformanceProfile(false)
}

function registerPowerProfileListeners(): void {
  if (powerProfileListenersRegistered) return
  powerMonitor.on('on-battery', handleOnBattery)
  powerMonitor.on('on-ac', handleOnAc)
  powerProfileListenersRegistered = true
}

function configureSessionPermissionHandlers(window: BrowserWindow): void {
  const ses = window.webContents.session

  const isTrustedRendererRequest = (webContents: WebContents | null, requestingUrl?: string): boolean => {
    if (!webContents) return false
    if (webContents.id !== window.webContents.id) return false
    const originUrl = requestingUrl || webContents.getURL()
    if (!originUrl) return false
    if (originUrl.startsWith('file://')) return true
    return isUrlSafe(originUrl)
  }

  ses.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    if (!isTrustedRendererRequest(webContents, requestingOrigin)) return false
    return ALLOWED_SESSION_PERMISSIONS.has(permission)
  })

  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingUrl = details.requestingUrl || webContents.getURL()
    const trustedRequest = isTrustedRendererRequest(webContents, requestingUrl)

    if (!trustedRequest) {
      callback(false)
      return
    }

    callback(ALLOWED_SESSION_PERMISSIONS.has(permission))
  })
}
