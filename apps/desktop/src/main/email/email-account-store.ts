import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import type {
  EmailAccountConfigInput,
  EmailAccountPreset,
  EmailAccountStatus,
  EmailServerConfig,
} from '@shared/types/ipc'
import { decryptString, encryptString } from '../security'

const DATA_DIR = join(app.getPath('userData'), 'data')
const EMAIL_ACCOUNT_PATH = join(DATA_DIR, 'email-account.bin')
const VALID_PRESETS = new Set<EmailAccountPreset>(['custom', 'gmail', 'outlook', 'naver', 'daum'])

export interface StoredEmailAccountConfig {
  preset: EmailAccountPreset
  displayName?: string
  emailAddress: string
  username: string
  password: string
  imap: EmailServerConfig
  smtp: EmailServerConfig
  updatedAt: number
  lastVerifiedAt: number | null
}

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

function normalizePort(port: number, fallback: number): number {
  const safePort = Math.floor(Number(port))
  if (!Number.isFinite(safePort) || safePort < 1 || safePort > 65535) {
    return fallback
  }
  return safePort
}

function normalizeServerConfig(
  config: EmailServerConfig | undefined,
  defaults: EmailServerConfig,
): EmailServerConfig {
  return {
    host: config?.host?.trim() ?? defaults.host,
    port: normalizePort(config?.port ?? defaults.port, defaults.port),
    secure: typeof config?.secure === 'boolean' ? config.secure : defaults.secure,
  }
}

export function normalizeEmailAccountConfigInput(
  input: EmailAccountConfigInput,
  options?: {
    fallbackPassword?: string
    lastVerifiedAt?: number | null
  },
): StoredEmailAccountConfig {
  const preset = VALID_PRESETS.has(input.preset) ? input.preset : 'custom'
  const displayName = input.displayName?.trim()
  const emailAddress = input.emailAddress.trim()
  const username = input.username.trim()
  const password = input.password?.trim() || options?.fallbackPassword?.trim() || ''
  const imap = normalizeServerConfig(input.imap, { host: '', port: 993, secure: true })
  const smtp = normalizeServerConfig(input.smtp, { host: '', port: 587, secure: false })

  if (!emailAddress || !emailAddress.includes('@')) {
    throw new Error('Invalid email address')
  }
  if (!username) {
    throw new Error('Missing email username')
  }
  if (!password) {
    throw new Error('Missing email credentials')
  }
  if (!imap.host || !smtp.host) {
    throw new Error('Missing email server host')
  }

  return {
    preset,
    displayName: displayName || undefined,
    emailAddress,
    username,
    password,
    imap,
    smtp,
    updatedAt: Date.now(),
    lastVerifiedAt: options?.lastVerifiedAt ?? null,
  }
}

function isServerConfig(value: unknown): value is EmailServerConfig {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.host === 'string' &&
    typeof candidate.port === 'number' &&
    typeof candidate.secure === 'boolean'
  )
}

function isStoredEmailAccountConfig(value: unknown): value is StoredEmailAccountConfig {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    VALID_PRESETS.has(candidate.preset as EmailAccountPreset) &&
    typeof candidate.emailAddress === 'string' &&
    typeof candidate.username === 'string' &&
    typeof candidate.password === 'string' &&
    isServerConfig(candidate.imap) &&
    isServerConfig(candidate.smtp) &&
    typeof candidate.updatedAt === 'number' &&
    (typeof candidate.lastVerifiedAt === 'number' || candidate.lastVerifiedAt === null)
  )
}

export function loadEmailAccountConfig(): StoredEmailAccountConfig | null {
  ensureDataDir()
  try {
    const encrypted = readFileSync(EMAIL_ACCOUNT_PATH)
    const parsed = JSON.parse(decryptString(encrypted)) as unknown
    return isStoredEmailAccountConfig(parsed) ? parsed : null
  } catch {
    return null
  }
}

export async function saveEmailAccountConfig(
  input: EmailAccountConfigInput,
  options?: {
    fallbackPassword?: string
    lastVerifiedAt?: number | null
  },
): Promise<StoredEmailAccountConfig> {
  ensureDataDir()
  const next = normalizeEmailAccountConfigInput(input, options)
  const encrypted = encryptString(JSON.stringify(next))
  await writeFile(EMAIL_ACCOUNT_PATH, encrypted)
  return next
}

export async function clearEmailAccountConfig(): Promise<void> {
  await unlink(EMAIL_ACCOUNT_PATH).catch(() => {})
}

export function toEmailAccountStatus(config: StoredEmailAccountConfig | null): EmailAccountStatus {
  if (!config) {
    return {
      provider: 'none',
      configured: false,
      hasStoredPassword: false,
      lastVerifiedAt: null,
    }
  }

  return {
    provider: 'imap-smtp',
    configured: true,
    displayName: config.displayName,
    emailAddress: config.emailAddress,
    username: config.username,
    preset: config.preset,
    imap: config.imap,
    smtp: config.smtp,
    hasStoredPassword: config.password.length > 0,
    lastVerifiedAt: config.lastVerifiedAt,
  }
}
