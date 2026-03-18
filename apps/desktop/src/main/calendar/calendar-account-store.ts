import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import type {
  CalendarAccountConfigInput,
  CalendarAccountPreset,
  CalendarAccountStatus,
} from '@shared/types/ipc'
import { decryptString, encryptString } from '../security'

const DATA_DIR = join(app.getPath('userData'), 'data')
const CALENDAR_ACCOUNT_PATH = join(DATA_DIR, 'calendar-account.bin')
const VALID_PRESETS = new Set<CalendarAccountPreset>(['custom', 'icloud', 'fastmail', 'nextcloud'])

export interface StoredCalendarAccountConfig {
  preset: CalendarAccountPreset
  serverUrl: string
  username: string
  password: string
  calendarUrl: string
  calendarName?: string
  updatedAt: number
  lastVerifiedAt: number | null
}

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

function normalizeUrl(url: string, label: string): string {
  const trimmed = url.trim()
  if (!trimmed) {
    throw new Error(`Missing ${label}`)
  }

  try {
    return new URL(trimmed).toString()
  } catch {
    throw new Error(`Invalid ${label}`)
  }
}

function isStoredCalendarAccountConfig(value: unknown): value is StoredCalendarAccountConfig {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    VALID_PRESETS.has(candidate.preset as CalendarAccountPreset) &&
    typeof candidate.serverUrl === 'string' &&
    typeof candidate.username === 'string' &&
    typeof candidate.password === 'string' &&
    typeof candidate.calendarUrl === 'string' &&
    typeof candidate.updatedAt === 'number' &&
    (typeof candidate.calendarName === 'string' || candidate.calendarName === undefined) &&
    (typeof candidate.lastVerifiedAt === 'number' || candidate.lastVerifiedAt === null)
  )
}

export function normalizeCalendarAccountConfigInput(
  input: CalendarAccountConfigInput,
  options?: {
    fallbackPassword?: string
    calendarUrl?: string
    calendarName?: string
    lastVerifiedAt?: number | null
  },
): StoredCalendarAccountConfig {
  const preset = VALID_PRESETS.has(input.preset) ? input.preset : 'custom'
  const serverUrl = normalizeUrl(input.serverUrl, 'CalDAV server URL')
  const username = input.username.trim()
  const password = input.password?.trim() || options?.fallbackPassword?.trim() || ''
  const rawCalendarUrl = input.calendarUrl?.trim() || options?.calendarUrl?.trim() || ''
  const calendarUrl = rawCalendarUrl ? normalizeUrl(rawCalendarUrl, 'calendar URL') : ''
  const calendarName = input.calendarName?.trim() || options?.calendarName?.trim() || undefined

  if (!username) {
    throw new Error('Missing calendar username')
  }
  if (!password) {
    throw new Error('Missing calendar credentials')
  }

  return {
    preset,
    serverUrl,
    username,
    password,
    calendarUrl,
    calendarName,
    updatedAt: Date.now(),
    lastVerifiedAt: options?.lastVerifiedAt ?? null,
  }
}

export function loadCalendarAccountConfig(): StoredCalendarAccountConfig | null {
  ensureDataDir()
  try {
    const encrypted = readFileSync(CALENDAR_ACCOUNT_PATH)
    const parsed = JSON.parse(decryptString(encrypted)) as unknown
    return isStoredCalendarAccountConfig(parsed) ? parsed : null
  } catch {
    return null
  }
}

export async function saveCalendarAccountConfig(
  input: CalendarAccountConfigInput,
  options?: {
    fallbackPassword?: string
    calendarUrl?: string
    calendarName?: string
    lastVerifiedAt?: number | null
  },
): Promise<StoredCalendarAccountConfig> {
  ensureDataDir()
  const next = normalizeCalendarAccountConfigInput(input, options)
  const encrypted = encryptString(JSON.stringify(next))
  await writeFile(CALENDAR_ACCOUNT_PATH, encrypted)
  return next
}

export async function clearCalendarAccountConfig(): Promise<void> {
  await unlink(CALENDAR_ACCOUNT_PATH).catch(() => {})
}

export function toCalendarAccountStatus(config: StoredCalendarAccountConfig | null): CalendarAccountStatus {
  if (!config) {
    return {
      provider: 'none',
      configured: false,
      hasStoredPassword: false,
      lastVerifiedAt: null,
    }
  }

  return {
    provider: 'caldav',
    configured: true,
    preset: config.preset,
    username: config.username,
    serverUrl: config.serverUrl,
    calendarUrl: config.calendarUrl,
    calendarName: config.calendarName,
    hasStoredPassword: config.password.length > 0,
    lastVerifiedAt: config.lastVerifiedAt,
  }
}
