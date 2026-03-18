import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import type {
  FinanceAccountConfigInput,
  FinanceAccountPreset,
  FinanceAccountStatus,
  FinanceTransferDefaults,
} from '@shared/types/ipc'
import { decryptString, encryptString } from '../security'

const DATA_DIR = join(app.getPath('userData'), 'data')
const FINANCE_ACCOUNT_PATH = join(DATA_DIR, 'finance-account.bin')
const VALID_PRESETS = new Set<FinanceAccountPreset>([
  'openbanking-testbed',
  'openbanking-production',
  'mydata-compatible',
  'custom',
])

export interface StoredFinanceAccountConfig {
  preset: FinanceAccountPreset
  apiBaseUrl: string
  clientId: string
  clientSecret: string
  accessToken: string
  refreshToken?: string
  fintechUseNum: string
  userSeqNo?: string
  scope?: string
  accountAlias?: string
  providerLabel?: string
  transferDefaults?: FinanceTransferDefaults
  bankName?: string
  accountMask?: string
  lastBalance?: string
  currency?: string
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

function normalizeTransferDefaults(
  defaults: FinanceTransferDefaults | undefined,
): FinanceTransferDefaults | undefined {
  if (!defaults) return undefined

  const normalized: FinanceTransferDefaults = {
    contractAccountType: normalizeText(defaults.contractAccountType, 'contract account type'),
    contractAccountNum: normalizeText(defaults.contractAccountNum, 'contract account number'),
    withdrawPassPhrase: normalizeText(defaults.withdrawPassPhrase, 'withdraw pass phrase'),
    withdrawPrintContent: normalizeText(defaults.withdrawPrintContent, 'withdraw print content'),
    clientName: normalizeText(defaults.clientName, 'request client name'),
    clientBankCode: normalizeText(defaults.clientBankCode, 'request client bank code'),
    clientAccountNum: normalizeText(defaults.clientAccountNum, 'request client account number'),
    clientIdentifier: normalizeText(defaults.clientIdentifier, 'request client identifier'),
    nameCheckOption: defaults.nameCheckOption === 'on' ? 'on' : 'off',
    transferPurpose: normalizeText(defaults.transferPurpose, 'transfer purpose'),
  }

  const hasAnyValue = Object.values(normalized).some((value) => typeof value === 'string' && value.length > 0)
  return hasAnyValue ? normalized : undefined
}

function isTransferDefaults(value: unknown): value is FinanceTransferDefaults {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>

  const optionalStringKeys = [
    'contractAccountType',
    'contractAccountNum',
    'withdrawPassPhrase',
    'withdrawPrintContent',
    'clientName',
    'clientBankCode',
    'clientAccountNum',
    'clientIdentifier',
    'transferPurpose',
  ]

  return (
    optionalStringKeys.every((key) => candidate[key] == null || typeof candidate[key] === 'string') &&
    (candidate.nameCheckOption == null ||
      candidate.nameCheckOption === 'on' ||
      candidate.nameCheckOption === 'off')
  )
}

function isStoredFinanceAccountConfig(value: unknown): value is StoredFinanceAccountConfig {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>

  return (
    VALID_PRESETS.has(candidate.preset as FinanceAccountPreset) &&
    typeof candidate.apiBaseUrl === 'string' &&
    typeof candidate.clientId === 'string' &&
    typeof candidate.clientSecret === 'string' &&
    typeof candidate.accessToken === 'string' &&
    typeof candidate.fintechUseNum === 'string' &&
    (candidate.refreshToken == null || typeof candidate.refreshToken === 'string') &&
    (candidate.userSeqNo == null || typeof candidate.userSeqNo === 'string') &&
    (candidate.scope == null || typeof candidate.scope === 'string') &&
    (candidate.accountAlias == null || typeof candidate.accountAlias === 'string') &&
    (candidate.providerLabel == null || typeof candidate.providerLabel === 'string') &&
    (candidate.bankName == null || typeof candidate.bankName === 'string') &&
    (candidate.accountMask == null || typeof candidate.accountMask === 'string') &&
    (candidate.lastBalance == null || typeof candidate.lastBalance === 'string') &&
    (candidate.currency == null || typeof candidate.currency === 'string') &&
    (candidate.transferDefaults == null || isTransferDefaults(candidate.transferDefaults)) &&
    typeof candidate.updatedAt === 'number' &&
    (typeof candidate.lastVerifiedAt === 'number' || candidate.lastVerifiedAt === null)
  )
}

export function normalizeFinanceAccountConfigInput(
  input: FinanceAccountConfigInput,
  options?: {
    fallbackClientSecret?: string
    fallbackAccessToken?: string
    fallbackRefreshToken?: string
    fallbackTransferDefaults?: FinanceTransferDefaults
    lastVerifiedAt?: number | null
    bankName?: string
    accountMask?: string
    lastBalance?: string
    currency?: string
  },
): StoredFinanceAccountConfig {
  const preset = VALID_PRESETS.has(input.preset) ? input.preset : 'openbanking-testbed'
  const apiBaseUrl = normalizeUrl(input.apiBaseUrl, 'finance API base URL')
  const clientId = normalizeText(input.clientId, 'finance client ID', true)
  const clientSecret =
    normalizeText(input.clientSecret, 'finance client secret') ||
    normalizeText(options?.fallbackClientSecret, 'saved finance client secret')
  const accessToken =
    normalizeText(input.accessToken, 'finance access token') ||
    normalizeText(options?.fallbackAccessToken, 'saved finance access token')
  const refreshToken =
    normalizeText(input.refreshToken, 'finance refresh token') ||
    normalizeText(options?.fallbackRefreshToken, 'saved finance refresh token') ||
    undefined
  const fintechUseNum = normalizeText(input.fintechUseNum, 'fintech use number', true)
  const userSeqNo = normalizeText(input.userSeqNo, 'user sequence number') || undefined
  const scope = normalizeText(input.scope, 'scope') || undefined
  const accountAlias = normalizeText(input.accountAlias, 'account alias') || undefined
  const providerLabel = normalizeText(input.providerLabel, 'provider label') || undefined
  const transferDefaults =
    normalizeTransferDefaults(input.transferDefaults) ??
    normalizeTransferDefaults(options?.fallbackTransferDefaults)

  if (!accessToken && !refreshToken) {
    throw new Error('Missing finance access token')
  }

  if (!accessToken && refreshToken && !clientSecret) {
    throw new Error('Client secret is required when only a refresh token is provided')
  }

  return {
    preset,
    apiBaseUrl,
    clientId,
    clientSecret,
    accessToken,
    refreshToken,
    fintechUseNum,
    userSeqNo,
    scope,
    accountAlias,
    providerLabel,
    transferDefaults,
    bankName: normalizeText(options?.bankName, 'bank name') || undefined,
    accountMask: normalizeText(options?.accountMask, 'account mask') || undefined,
    lastBalance: normalizeText(options?.lastBalance, 'last balance') || undefined,
    currency: normalizeText(options?.currency, 'currency') || undefined,
    updatedAt: Date.now(),
    lastVerifiedAt: options?.lastVerifiedAt ?? null,
  }
}

export function loadFinanceAccountConfig(): StoredFinanceAccountConfig | null {
  ensureDataDir()
  try {
    const encrypted = readFileSync(FINANCE_ACCOUNT_PATH)
    const parsed = JSON.parse(decryptString(encrypted)) as unknown
    return isStoredFinanceAccountConfig(parsed) ? parsed : null
  } catch {
    return null
  }
}

export async function saveFinanceAccountConfig(
  input: FinanceAccountConfigInput,
  options?: Parameters<typeof normalizeFinanceAccountConfigInput>[1],
): Promise<StoredFinanceAccountConfig> {
  const next = normalizeFinanceAccountConfigInput(input, options)
  await saveStoredFinanceAccountConfig(next)
  return next
}

export async function saveStoredFinanceAccountConfig(
  config: StoredFinanceAccountConfig,
): Promise<StoredFinanceAccountConfig> {
  ensureDataDir()
  const encrypted = encryptString(JSON.stringify(config))
  await writeFile(FINANCE_ACCOUNT_PATH, encrypted)
  return config
}

export async function clearFinanceAccountConfig(): Promise<void> {
  await unlink(FINANCE_ACCOUNT_PATH).catch(() => {})
}

export function toFinanceAccountStatus(
  config: StoredFinanceAccountConfig | null,
): FinanceAccountStatus {
  if (!config) {
    return {
      provider: 'none',
      configured: false,
      hasStoredAccessToken: false,
      hasStoredRefreshToken: false,
      hasStoredClientSecret: false,
      lastVerifiedAt: null,
    }
  }

  return {
    provider: config.preset === 'mydata-compatible' ? 'mydata' : 'open-banking',
    configured: true,
    preset: config.preset,
    apiBaseUrl: config.apiBaseUrl,
    clientId: config.clientId,
    fintechUseNum: config.fintechUseNum,
    userSeqNo: config.userSeqNo,
    accountAlias: config.accountAlias,
    providerLabel: config.providerLabel,
    scope: config.scope,
    transferDefaults: config.transferDefaults,
    bankName: config.bankName,
    accountMask: config.accountMask,
    lastBalance: config.lastBalance,
    currency: config.currency,
    hasStoredAccessToken: config.accessToken.length > 0,
    hasStoredRefreshToken: Boolean(config.refreshToken),
    hasStoredClientSecret: config.clientSecret.length > 0,
    lastVerifiedAt: config.lastVerifiedAt,
  }
}
