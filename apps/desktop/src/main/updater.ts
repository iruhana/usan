/**
 * Auto-updater — electron-updater with GitHub Releases.
 *
 * Behavior:
 * - autoDownload = false (notify user, don't download silently)
 * - Checks every 4 hours
 * - Shows notification when new version is available
 */

import { app } from 'electron'
import { autoUpdater, type UpdateInfo } from 'electron-updater'
import { sendNotification } from './notifications'

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000 // 4 hours

export function initAutoUpdater(): void {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    sendNotification({
      title: '새 버전이 있습니다',
      body: `우산 ${info.version} 버전을 다운로드할 수 있습니다.`,
      level: 'info',
    })
  })

  autoUpdater.on('error', () => {
    // Silently fail — update check is not critical
  })

  // Initial check (delayed 30s to not slow down startup)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 30000)

  // Periodic check
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, CHECK_INTERVAL_MS)
}
