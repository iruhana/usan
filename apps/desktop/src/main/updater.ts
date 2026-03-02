/**
 * Auto-updater module — checks for updates on app start.
 * Uses electron-builder's built-in auto-update mechanism.
 * Currently a placeholder — requires code signing and a release server.
 */
import { app } from 'electron'
import { sendNotification } from './notifications'

// Auto-update will be enabled after code signing is set up.
// For now, check version against a simple JSON endpoint.

const UPDATE_CHECK_URL = 'https://usan.ai/api/version'

interface VersionInfo {
  latest: string
  downloadUrl: string
  releaseNotes?: string
}

export async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged) return // Skip in dev mode

  try {
    const res = await fetch(UPDATE_CHECK_URL, {
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return

    const data = (await res.json()) as VersionInfo
    const currentVersion = app.getVersion()

    if (data.latest && data.latest !== currentVersion) {
      sendNotification({
        title: '새 버전이 있습니다',
        body: `우산 ${data.latest} 버전을 다운로드할 수 있습니다.`,
        level: 'info',
      })
    }
  } catch {
    // Silently fail — update check is not critical
  }
}
