/**
 * Updater manager with channel control, crash guard, and manual IPC operations.
 */

import { app, crashReporter } from 'electron'
import { autoUpdater, type UpdateInfo } from 'electron-updater'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { UpdateChannel, UpdaterStatus } from '@shared/types/ipc'
import { sendNotification } from './notifications'
import { logObsInfo, logObsWarn } from './observability'

interface UpdaterPreferences {
  updateChannel: UpdateChannel
  autoDownloadUpdates: boolean
}

interface PersistedUpdaterState {
  crashStreak: number
  lastKnownGoodVersion: string
  lastAppliedChannel: UpdateChannel
}

interface StartupMarker {
  version: string
  channel: UpdateChannel
  startedAt: number
  cleanExit: boolean
}

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000
const STARTUP_HEALTHY_MS = 90 * 1000
const INITIAL_CHECK_DELAY_MS = 30 * 1000

const DEFAULT_PREFERENCES: UpdaterPreferences = {
  updateChannel: 'stable',
  autoDownloadUpdates: false,
}

const DEFAULT_STATE: PersistedUpdaterState = {
  crashStreak: 0,
  lastKnownGoodVersion: '',
  lastAppliedChannel: 'stable',
}

let initialized = false
let eventsBound = false
let checkTimer: ReturnType<typeof setInterval> | null = null
let healthyTimer: ReturnType<typeof setTimeout> | null = null

let preferences: UpdaterPreferences = { ...DEFAULT_PREFERENCES }
let persistedState: PersistedUpdaterState = { ...DEFAULT_STATE }

const status: UpdaterStatus = {
  enabled: false,
  channel: 'stable',
  autoDownload: false,
  checking: false,
  updateAvailableVersion: null,
  downloadedVersion: null,
  lastCheckAt: null,
  lastError: null,
  crashStreak: 0,
}

function getPaths(): { statePath: string; markerPath: string; crashDir: string } {
  const userData = app.getPath('userData')
  return {
    statePath: join(userData, 'updater-state.json'),
    markerPath: join(userData, 'updater-startup-marker.json'),
    crashDir: join(userData, 'crash-dumps'),
  }
}

function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function loadPersistedState(): PersistedUpdaterState {
  const { statePath } = getPaths()
  if (!existsSync(statePath)) return { ...DEFAULT_STATE }
  const raw = readFileSync(statePath, 'utf-8')
  const parsed = safeParseJson<Partial<PersistedUpdaterState>>(raw, {})
  return {
    crashStreak: typeof parsed.crashStreak === 'number' && Number.isFinite(parsed.crashStreak)
      ? Math.max(0, Math.min(99, Math.floor(parsed.crashStreak)))
      : 0,
    lastKnownGoodVersion: typeof parsed.lastKnownGoodVersion === 'string' ? parsed.lastKnownGoodVersion : '',
    lastAppliedChannel: parsed.lastAppliedChannel === 'beta' ? 'beta' : 'stable',
  }
}

function savePersistedState(): void {
  const { statePath } = getPaths()
  mkdirSync(dirname(statePath), { recursive: true })
  writeFileSync(statePath, JSON.stringify(persistedState, null, 2), 'utf-8')
}

function readStartupMarker(): StartupMarker | null {
  const { markerPath } = getPaths()
  if (!existsSync(markerPath)) return null
  const raw = readFileSync(markerPath, 'utf-8')
  const parsed = safeParseJson<Partial<StartupMarker>>(raw, {})
  if (typeof parsed.version !== 'string') return null
  return {
    version: parsed.version,
    channel: parsed.channel === 'beta' ? 'beta' : 'stable',
    startedAt: typeof parsed.startedAt === 'number' ? parsed.startedAt : 0,
    cleanExit: parsed.cleanExit === true,
  }
}

function writeStartupMarker(marker: StartupMarker): void {
  const { markerPath } = getPaths()
  writeFileSync(markerPath, JSON.stringify(marker, null, 2), 'utf-8')
}

function startCrashReporter(): void {
  const { crashDir } = getPaths()
  mkdirSync(crashDir, { recursive: true })
  app.setPath('crashDumps', crashDir)
  crashReporter.start({
    companyName: 'Usan',
    productName: 'Usan Desktop',
    submitURL: '',
    uploadToServer: false,
    compress: true,
  })
}

function toUpdaterChannel(channel: UpdateChannel): string {
  return channel === 'beta' ? 'beta' : 'latest'
}

function applyUpdaterPreferences(): void {
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.autoDownload = preferences.autoDownloadUpdates
  autoUpdater.allowPrerelease = preferences.updateChannel === 'beta'
  autoUpdater.channel = toUpdaterChannel(preferences.updateChannel)

  persistedState.lastAppliedChannel = preferences.updateChannel
  status.channel = preferences.updateChannel
  status.autoDownload = preferences.autoDownloadUpdates
  status.crashStreak = persistedState.crashStreak
}

function bindUpdaterEvents(): void {
  if (eventsBound) return
  eventsBound = true

  autoUpdater.on('checking-for-update', () => {
    status.checking = true
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    status.checking = false
    status.updateAvailableVersion = info.version
    status.lastError = null

    sendNotification({
      title: 'Update Available',
      body: `Usan ${info.version} is available.`,
      level: 'info',
    })

    if (preferences.autoDownloadUpdates) {
      void autoUpdater.downloadUpdate().catch((error: unknown) => {
        status.lastError = error instanceof Error ? error.message : String(error)
      })
    }
  })

  autoUpdater.on('update-not-available', () => {
    status.checking = false
    status.lastError = null
    status.updateAvailableVersion = null
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    status.downloadedVersion = info.version
    status.lastError = null

    sendNotification({
      title: 'Update Ready',
      body: `Usan ${info.version} was downloaded and will install on restart.`,
      level: 'info',
    })
  })

  autoUpdater.on('error', (error: unknown) => {
    status.checking = false
    status.lastError = error instanceof Error ? error.message : String(error)
    logObsWarn('updater.error', { message: status.lastError })
  })
}

function evaluateStartupCrashGuard(): void {
  const previous = readStartupMarker()
  if (previous && previous.cleanExit === false) {
    persistedState.crashStreak = Math.min(persistedState.crashStreak + 1, 99)
    status.lastError = 'previous_run_unclean_exit'
    logObsWarn('updater.previous_unclean_exit', {
      previousVersion: previous.version,
      crashStreak: persistedState.crashStreak,
    })
  }

  if (persistedState.crashStreak >= 2 && preferences.updateChannel === 'beta') {
    preferences.updateChannel = 'stable'
    preferences.autoDownloadUpdates = false
    status.lastError = 'rollback_guard_applied'

    sendNotification({
      title: 'Update Safety Mode Enabled',
      body: 'Repeated unstable startups detected. Switched update channel to Stable.',
      level: 'warning',
    })

    logObsWarn('updater.rollback_guard_applied', { crashStreak: persistedState.crashStreak })
  }
}

export function initAutoUpdater(options?: Partial<UpdaterPreferences>): void {
  if (initialized) return
  initialized = true

  startCrashReporter()

  if (!app.isPackaged) {
    status.enabled = false
    return
  }

  status.enabled = true
  persistedState = loadPersistedState()

  preferences = {
    updateChannel: options?.updateChannel ?? persistedState.lastAppliedChannel ?? DEFAULT_PREFERENCES.updateChannel,
    autoDownloadUpdates: options?.autoDownloadUpdates ?? DEFAULT_PREFERENCES.autoDownloadUpdates,
  }

  evaluateStartupCrashGuard()
  applyUpdaterPreferences()
  bindUpdaterEvents()

  writeStartupMarker({
    version: app.getVersion(),
    channel: preferences.updateChannel,
    startedAt: Date.now(),
    cleanExit: false,
  })

  healthyTimer = setTimeout(() => {
    markUpdaterHealthyStartup()
  }, STARTUP_HEALTHY_MS)

  setTimeout(() => {
    void checkForUpdatesNow()
  }, INITIAL_CHECK_DELAY_MS)

  checkTimer = setInterval(() => {
    void checkForUpdatesNow()
  }, CHECK_INTERVAL_MS)

  savePersistedState()
}

export function configureAutoUpdater(options: Partial<UpdaterPreferences>): UpdaterStatus {
  if (typeof options.updateChannel === 'string') {
    preferences.updateChannel = options.updateChannel === 'beta' ? 'beta' : 'stable'
  }
  if (typeof options.autoDownloadUpdates === 'boolean') {
    preferences.autoDownloadUpdates = options.autoDownloadUpdates
  }

  if (status.enabled) {
    applyUpdaterPreferences()
    savePersistedState()
  }

  return getUpdaterStatus()
}

export async function checkForUpdatesNow(): Promise<UpdaterStatus> {
  if (!status.enabled) return getUpdaterStatus()
  try {
    status.checking = true
    status.lastCheckAt = Date.now()
    await autoUpdater.checkForUpdates()
    status.lastError = null
  } catch (error) {
    status.lastError = error instanceof Error ? error.message : String(error)
  } finally {
    status.checking = false
  }
  return getUpdaterStatus()
}

export async function downloadLatestUpdate(): Promise<UpdaterStatus> {
  if (!status.enabled) return getUpdaterStatus()
  try {
    await autoUpdater.downloadUpdate()
    status.lastError = null
  } catch (error) {
    status.lastError = error instanceof Error ? error.message : String(error)
  }
  return getUpdaterStatus()
}

export function installDownloadedUpdate(): { queued: boolean } {
  if (!status.enabled || !status.downloadedVersion) return { queued: false }
  autoUpdater.quitAndInstall(false, true)
  return { queued: true }
}

export function markUpdaterHealthyStartup(): void {
  if (!status.enabled) return
  persistedState.crashStreak = 0
  persistedState.lastKnownGoodVersion = app.getVersion()
  status.crashStreak = 0
  savePersistedState()
  logObsInfo('updater.startup_healthy', { version: app.getVersion() })
}

export function markUpdaterWillQuit(): void {
  if (!status.enabled) return

  if (checkTimer) {
    clearInterval(checkTimer)
    checkTimer = null
  }
  if (healthyTimer) {
    clearTimeout(healthyTimer)
    healthyTimer = null
  }

  writeStartupMarker({
    version: app.getVersion(),
    channel: preferences.updateChannel,
    startedAt: Date.now(),
    cleanExit: true,
  })

  savePersistedState()
}

export function getUpdaterStatus(): UpdaterStatus {
  return {
    enabled: status.enabled,
    channel: status.channel,
    autoDownload: status.autoDownload,
    checking: status.checking,
    updateAvailableVersion: status.updateAvailableVersion,
    downloadedVersion: status.downloadedVersion,
    lastCheckAt: status.lastCheckAt,
    lastError: status.lastError,
    crashStreak: status.crashStreak,
  }
}
