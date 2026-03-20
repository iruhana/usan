import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { createRequire } from 'node:module'
import type {
  ProviderSecretProvider,
  ProviderSecretsSnapshot,
  ProviderSecretStatus,
} from '@shared/types'

interface SecretCryptoAdapter {
  isEncryptionAvailable(): boolean
  encryptString(value: string): Buffer
  decryptString(value: Buffer): string
}

interface StoredSecretRecord {
  ciphertext: string
}

interface StoredSecretsFile {
  version: 1
  secrets: Partial<Record<ProviderSecretProvider, StoredSecretRecord>>
}

const SECRET_PROVIDERS: ProviderSecretProvider[] = ['anthropic', 'openai', 'google']
const require = createRequire(import.meta.url)

let secretStoreFilePath: string | null = null
let cryptoAdapterOverride: SecretCryptoAdapter | null = null

function getEnvVarName(provider: ProviderSecretProvider): 'ANTHROPIC_API_KEY' | 'OPENAI_API_KEY' | 'GEMINI_API_KEY' {
  switch (provider) {
    case 'anthropic':
      return 'ANTHROPIC_API_KEY'
    case 'openai':
      return 'OPENAI_API_KEY'
    case 'google':
      return 'GEMINI_API_KEY'
  }
}

function createEmptySecretsFile(): StoredSecretsFile {
  return {
    version: 1,
    secrets: {},
  }
}

function getCryptoAdapter(): SecretCryptoAdapter | null {
  if (cryptoAdapterOverride) {
    return cryptoAdapterOverride
  }

  if (!process.versions.electron) {
    return null
  }

  try {
    const electron = require('electron')
    if (!electron || typeof electron === 'string' || !electron.safeStorage) {
      return null
    }

    return electron.safeStorage as SecretCryptoAdapter
  } catch {
    return null
  }
}

function isStoredSecretRecord(value: unknown): value is StoredSecretRecord {
  return typeof value === 'object' && value !== null && typeof (value as StoredSecretRecord).ciphertext === 'string'
}

function sanitizeSecretsFile(value: unknown): StoredSecretsFile {
  const candidate = typeof value === 'object' && value !== null ? value as Partial<StoredSecretsFile> : {}
  const secrets: Partial<Record<ProviderSecretProvider, StoredSecretRecord>> = {}

  for (const provider of SECRET_PROVIDERS) {
    const record = candidate.secrets?.[provider]
    if (isStoredSecretRecord(record) && record.ciphertext.trim()) {
      secrets[provider] = { ciphertext: record.ciphertext }
    }
  }

  return {
    version: 1,
    secrets,
  }
}

function archiveCorruptFile(filePath: string): void {
  if (!existsSync(filePath)) {
    return
  }

  renameSync(filePath, `${filePath}.corrupt-${Date.now()}`)
}

function writeSecretsFile(filePath: string, secretsFile: StoredSecretsFile): void {
  mkdirSync(dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.tmp`
  writeFileSync(tempPath, JSON.stringify(secretsFile, null, 2), 'utf8')
  renameSync(tempPath, filePath)
}

function readSecretsFile(filePath: string): StoredSecretsFile {
  if (!existsSync(filePath)) {
    const empty = createEmptySecretsFile()
    writeSecretsFile(filePath, empty)
    return empty
  }

  try {
    const raw = readFileSync(filePath, 'utf8')
    const parsed = raw ? JSON.parse(raw) : {}
    const sanitized = sanitizeSecretsFile(parsed)
    writeSecretsFile(filePath, sanitized)
    return sanitized
  } catch {
    archiveCorruptFile(filePath)
    const empty = createEmptySecretsFile()
    writeSecretsFile(filePath, empty)
    return empty
  }
}

function resolveStoredSecret(provider: ProviderSecretProvider, secretsFile: StoredSecretsFile): string | null {
  const adapter = getCryptoAdapter()
  const record = secretsFile.secrets[provider]
  if (!adapter || !adapter.isEncryptionAvailable() || !record?.ciphertext) {
    return null
  }

  try {
    const decrypted = adapter.decryptString(Buffer.from(record.ciphertext, 'base64')).trim()
    return decrypted || null
  } catch {
    return null
  }
}

function resolveEnvironmentSecret(provider: ProviderSecretProvider): string | null {
  const value = process.env[getEnvVarName(provider)]?.trim()
  return value ? value : null
}

function buildStatus(provider: ProviderSecretProvider, secretsFile: StoredSecretsFile): ProviderSecretStatus {
  const storedSecret = resolveStoredSecret(provider, secretsFile)
  if (storedSecret) {
    return {
      provider,
      configured: true,
      source: 'secure_store',
    }
  }

  const environmentSecret = resolveEnvironmentSecret(provider)
  if (environmentSecret) {
    return {
      provider,
      configured: true,
      source: 'environment',
    }
  }

  return {
    provider,
    configured: false,
    source: 'none',
  }
}

function getSecretsFileOrEmpty(): StoredSecretsFile {
  if (!secretStoreFilePath) {
    return createEmptySecretsFile()
  }

  return readSecretsFile(secretStoreFilePath)
}

export function initializeSecretStore(filePath: string): ProviderSecretsSnapshot {
  secretStoreFilePath = filePath
  readSecretsFile(filePath)
  return getProviderSecretsStatus()
}

export function getProviderSecret(provider: ProviderSecretProvider): string | null {
  const secretsFile = getSecretsFileOrEmpty()
  return resolveStoredSecret(provider, secretsFile) ?? resolveEnvironmentSecret(provider)
}

export function getProviderSecretsStatus(): ProviderSecretsSnapshot {
  const adapter = getCryptoAdapter()
  const secretsFile = getSecretsFileOrEmpty()

  return {
    encryptionAvailable: Boolean(adapter?.isEncryptionAvailable()),
    providers: SECRET_PROVIDERS.map((provider) => buildStatus(provider, secretsFile)),
  }
}

export function setProviderSecret(provider: ProviderSecretProvider, value: string): ProviderSecretsSnapshot {
  if (!secretStoreFilePath) {
    throw new Error('Secure secret storage is not initialized.')
  }

  const nextValue = value.trim()
  if (!nextValue) {
    return deleteProviderSecret(provider)
  }

  const adapter = getCryptoAdapter()
  if (!adapter || !adapter.isEncryptionAvailable()) {
    throw new Error('Secure local secret storage is unavailable on this system.')
  }

  const secretsFile = readSecretsFile(secretStoreFilePath)
  secretsFile.secrets[provider] = {
    ciphertext: adapter.encryptString(nextValue).toString('base64'),
  }
  writeSecretsFile(secretStoreFilePath, secretsFile)
  return getProviderSecretsStatus()
}

export function deleteProviderSecret(provider: ProviderSecretProvider): ProviderSecretsSnapshot {
  if (!secretStoreFilePath) {
    return getProviderSecretsStatus()
  }

  const secretsFile = readSecretsFile(secretStoreFilePath)
  delete secretsFile.secrets[provider]
  writeSecretsFile(secretStoreFilePath, secretsFile)
  return getProviderSecretsStatus()
}

export function setSecretStoreCryptoAdapterForTests(adapter: SecretCryptoAdapter | null): void {
  cryptoAdapterOverride = adapter
}

export function resetSecretStoreForTests(): void {
  secretStoreFilePath = null
  cryptoAdapterOverride = null
}
