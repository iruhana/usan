import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import type {
  PublicDataAccountConfigInput,
  PublicDataAccountPreset,
  PublicDataAccountStatus,
  PublicDataAuthMode,
  PublicDataFormat,
} from '@shared/types/ipc'
import { decryptString, encryptString } from '../security'

const DATA_DIR = join(app.getPath('userData'), 'data')
const PUBLIC_DATA_ACCOUNT_PATH = join(DATA_DIR, 'public-data-account.bin')
const VALID_PRESETS = new Set<PublicDataAccountPreset>(['data-go-kr', 'odcloud', 'custom'])
const VALID_AUTH_MODES = new Set<PublicDataAuthMode>(['query', 'header', 'both'])
const VALID_FORMATS = new Set<PublicDataFormat>(['json', 'xml'])

export interface StoredPublicDataAccountConfig {
  preset: PublicDataAccountPreset
  apiBaseUrl: string
  serviceKey: string
  authMode: PublicDataAuthMode
  providerLabel?: string
  serviceName?: string
  defaultPath?: string
  defaultFormat: PublicDataFormat
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
    return new URL(trimmed).toString().replace(/\/$/, '')
  } catch {
    throw new Error(`Invalid ${label}`)
  }
}

function normalizeText(value: string | undefined, label: string, required = false): string {
  const trimmed = value?.trim() ?? ''
  if (required && !trimmed) {
    throw new Error(`Missing ${label}`)
  }
  return trimmed
}

function normalizeOptionalPath(value: string | undefined): string | undefined {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return undefined
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function isStoredPublicDataAccountConfig(value: unknown): value is StoredPublicDataAccountConfig {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>

  return (
    VALID_PRESETS.has(candidate.preset as PublicDataAccountPreset) &&
    typeof candidate.apiBaseUrl === 'string' &&
    typeof candidate.serviceKey === 'string' &&
    VALID_AUTH_MODES.has(candidate.authMode as PublicDataAuthMode) &&
    (candidate.providerLabel == null || typeof candidate.providerLabel === 'string') &&
    (candidate.serviceName == null || typeof candidate.serviceName === 'string') &&
    (candidate.defaultPath == null || typeof candidate.defaultPath === 'string') &&
    VALID_FORMATS.has(candidate.defaultFormat as PublicDataFormat) &&
    typeof candidate.updatedAt === 'number' &&
    (typeof candidate.lastVerifiedAt === 'number' || candidate.lastVerifiedAt === null)
  )
}

export function normalizePublicDataAccountConfigInput(
  input: PublicDataAccountConfigInput,
  options?: {
    fallbackServiceKey?: string
    lastVerifiedAt?: number | null
  },
): StoredPublicDataAccountConfig {
  const preset = VALID_PRESETS.has(input.preset) ? input.preset : 'data-go-kr'
  const apiBaseUrl = normalizeUrl(input.apiBaseUrl, 'public data API base URL')
  const serviceKey =
    normalizeText(input.serviceKey, 'public data service key') ||
    normalizeText(options?.fallbackServiceKey, 'saved public data service key', true)
  const authMode = VALID_AUTH_MODES.has(input.authMode) ? input.authMode : 'query'
  const providerLabel = normalizeText(input.providerLabel, 'public data provider label') || undefined
  const serviceName = normalizeText(input.serviceName, 'public data service name') || undefined
  const defaultPath = normalizeOptionalPath(input.defaultPath)
  const defaultFormat = VALID_FORMATS.has(input.defaultFormat as PublicDataFormat)
    ? (input.defaultFormat as PublicDataFormat)
    : 'json'

  return {
    preset,
    apiBaseUrl,
    serviceKey,
    authMode,
    providerLabel,
    serviceName,
    defaultPath,
    defaultFormat,
    updatedAt: Date.now(),
    lastVerifiedAt: options?.lastVerifiedAt ?? null,
  }
}

export function loadPublicDataAccountConfig(): StoredPublicDataAccountConfig | null {
  ensureDataDir()
  try {
    const encrypted = readFileSync(PUBLIC_DATA_ACCOUNT_PATH)
    const parsed = JSON.parse(decryptString(encrypted)) as unknown
    return isStoredPublicDataAccountConfig(parsed) ? parsed : null
  } catch {
    return null
  }
}

export async function saveStoredPublicDataAccountConfig(
  config: StoredPublicDataAccountConfig,
): Promise<StoredPublicDataAccountConfig> {
  ensureDataDir()
  const encrypted = encryptString(JSON.stringify(config))
  await writeFile(PUBLIC_DATA_ACCOUNT_PATH, encrypted)
  return config
}

export async function clearPublicDataAccountConfig(): Promise<void> {
  await unlink(PUBLIC_DATA_ACCOUNT_PATH).catch(() => {})
}

export function toPublicDataAccountStatus(
  config: StoredPublicDataAccountConfig | null,
): PublicDataAccountStatus {
  if (!config) {
    return {
      provider: 'none',
      configured: false,
      hasStoredServiceKey: false,
      lastVerifiedAt: null,
    }
  }

  return {
    provider: config.preset === 'odcloud' ? 'odcloud' : 'data-go-kr',
    configured: true,
    preset: config.preset,
    apiBaseUrl: config.apiBaseUrl,
    authMode: config.authMode,
    providerLabel: config.providerLabel,
    serviceName: config.serviceName,
    defaultPath: config.defaultPath,
    defaultFormat: config.defaultFormat,
    hasStoredServiceKey: config.serviceKey.length > 0,
    lastVerifiedAt: config.lastVerifiedAt,
  }
}
