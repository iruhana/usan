/**
 * Cloud sync module — optional backup of notes and conversations.
 * Uses usan.ai API for server-side storage.
 * Sync is opt-in: user must explicitly enable it in settings.
 *
 * This is a foundation module — actual sync will be connected
 * when the usan.ai backend is ready.
 */
import { app } from 'electron'

export interface SyncConfig {
  enabled: boolean
  userId?: string
  lastSyncedAt?: number
  endpoint: string
}

const DEFAULT_SYNC_CONFIG: SyncConfig = {
  enabled: false,
  endpoint: 'https://usan.ai/api/sync',
}

export interface SyncPayload {
  deviceId: string
  appVersion: string
  conversations?: unknown[]
  notes?: unknown[]
  memory?: unknown
  timestamp: number
}

/** Generate a stable device ID from machine-specific info */
function getDeviceId(): string {
  const userData = app.getPath('userData')
  // Simple hash from user data path (unique per machine/user)
  let hash = 0
  for (let i = 0; i < userData.length; i++) {
    hash = ((hash << 5) - hash + userData.charCodeAt(i)) | 0
  }
  return `device-${Math.abs(hash).toString(36)}`
}

export function createSyncPayload(data: Partial<Pick<SyncPayload, 'conversations' | 'notes' | 'memory'>>): SyncPayload {
  return {
    deviceId: getDeviceId(),
    appVersion: app.getVersion(),
    ...data,
    timestamp: Date.now(),
  }
}

function sanitizeUserId(id: string): string {
  return id.replace(/[^\w-]/g, '').slice(0, 128)
}

export async function pushSync(config: SyncConfig, payload: SyncPayload): Promise<boolean> {
  if (!config.enabled || !config.userId) return false

  try {
    const res = await fetch(`${config.endpoint}/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': sanitizeUserId(config.userId),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function pullSync(config: SyncConfig): Promise<SyncPayload | null> {
  if (!config.enabled || !config.userId) return null

  try {
    const res = await fetch(`${config.endpoint}/pull?deviceId=${encodeURIComponent(getDeviceId())}`, {
      headers: { 'X-User-Id': sanitizeUserId(config.userId) },
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) return null
    return (await res.json()) as SyncPayload
  } catch {
    return null
  }
}

export function getDefaultSyncConfig(): SyncConfig {
  return { ...DEFAULT_SYNC_CONFIG }
}
