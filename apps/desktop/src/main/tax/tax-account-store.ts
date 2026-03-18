import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import type {
  TaxAccountConfigInput,
  TaxAccountStatus,
  TaxServiceAuthMode,
  TaxServicePreset,
} from '@shared/types/ipc'
import { decryptString, encryptString } from '../security'

const DATA_DIR = join(app.getPath('userData'), 'data')
const TAX_ACCOUNT_PATH = join(DATA_DIR, 'tax-account.bin')
const VALID_PRESETS = new Set<TaxServicePreset>(['barobill', 'custom'])
const VALID_AUTH_MODES = new Set<TaxServiceAuthMode>(['header', 'bearer', 'query'])

export interface StoredTaxAccountConfig {
  preset: TaxServicePreset
  apiBaseUrl: string
  apiKey: string
  authMode: TaxServiceAuthMode
  providerLabel?: string
  memberId?: string
  corporationNumber?: string
  userId?: string
  businessStatePath?: string
  hometaxPath?: string
  taxInvoicePath?: string
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

function isStoredTaxAccountConfig(value: unknown): value is StoredTaxAccountConfig {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>

  return (
    VALID_PRESETS.has(candidate.preset as TaxServicePreset) &&
    typeof candidate.apiBaseUrl === 'string' &&
    typeof candidate.apiKey === 'string' &&
    VALID_AUTH_MODES.has(candidate.authMode as TaxServiceAuthMode) &&
    (candidate.providerLabel == null || typeof candidate.providerLabel === 'string') &&
    (candidate.memberId == null || typeof candidate.memberId === 'string') &&
    (candidate.corporationNumber == null || typeof candidate.corporationNumber === 'string') &&
    (candidate.userId == null || typeof candidate.userId === 'string') &&
    (candidate.businessStatePath == null || typeof candidate.businessStatePath === 'string') &&
    (candidate.hometaxPath == null || typeof candidate.hometaxPath === 'string') &&
    (candidate.taxInvoicePath == null || typeof candidate.taxInvoicePath === 'string') &&
    typeof candidate.updatedAt === 'number' &&
    (typeof candidate.lastVerifiedAt === 'number' || candidate.lastVerifiedAt === null)
  )
}

export function normalizeTaxAccountConfigInput(
  input: TaxAccountConfigInput,
  options?: {
    fallbackApiKey?: string
    lastVerifiedAt?: number | null
  },
): StoredTaxAccountConfig {
  const preset = VALID_PRESETS.has(input.preset) ? input.preset : 'barobill'
  const apiBaseUrl = normalizeUrl(input.apiBaseUrl, 'tax API base URL')
  const apiKey =
    normalizeText(input.apiKey, 'tax API key') ||
    normalizeText(options?.fallbackApiKey, 'saved tax API key', true)
  const authMode = VALID_AUTH_MODES.has(input.authMode) ? input.authMode : 'header'

  return {
    preset,
    apiBaseUrl,
    apiKey,
    authMode,
    providerLabel: normalizeText(input.providerLabel, 'tax provider label') || undefined,
    memberId: normalizeText(input.memberId, 'tax member ID') || undefined,
    corporationNumber: normalizeText(input.corporationNumber, 'tax corporation number') || undefined,
    userId: normalizeText(input.userId, 'tax user ID') || undefined,
    businessStatePath: normalizeOptionalPath(input.businessStatePath),
    hometaxPath: normalizeOptionalPath(input.hometaxPath),
    taxInvoicePath: normalizeOptionalPath(input.taxInvoicePath),
    updatedAt: Date.now(),
    lastVerifiedAt: options?.lastVerifiedAt ?? null,
  }
}

export function loadTaxAccountConfig(): StoredTaxAccountConfig | null {
  ensureDataDir()
  try {
    const encrypted = readFileSync(TAX_ACCOUNT_PATH)
    const parsed = JSON.parse(decryptString(encrypted)) as unknown
    return isStoredTaxAccountConfig(parsed) ? parsed : null
  } catch {
    return null
  }
}

export async function saveStoredTaxAccountConfig(
  config: StoredTaxAccountConfig,
): Promise<StoredTaxAccountConfig> {
  ensureDataDir()
  const encrypted = encryptString(JSON.stringify(config))
  await writeFile(TAX_ACCOUNT_PATH, encrypted)
  return config
}

export async function clearTaxAccountConfig(): Promise<void> {
  await unlink(TAX_ACCOUNT_PATH).catch(() => {})
}

export function toTaxAccountStatus(
  config: StoredTaxAccountConfig | null,
): TaxAccountStatus {
  if (!config) {
    return {
      provider: 'none',
      configured: false,
      hasStoredApiKey: false,
      lastVerifiedAt: null,
    }
  }

  return {
    provider: 'barobill',
    configured: true,
    preset: config.preset,
    apiBaseUrl: config.apiBaseUrl,
    authMode: config.authMode,
    providerLabel: config.providerLabel,
    memberId: config.memberId,
    corporationNumber: config.corporationNumber,
    userId: config.userId,
    businessStatePath: config.businessStatePath,
    hometaxPath: config.hometaxPath,
    taxInvoicePath: config.taxInvoicePath,
    hasStoredApiKey: config.apiKey.length > 0,
    lastVerifiedAt: config.lastVerifiedAt,
  }
}
