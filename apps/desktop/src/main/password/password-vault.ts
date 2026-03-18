import Database from 'better-sqlite3'
import { app } from 'electron'
import { createDecipheriv } from 'crypto'
import { spawnSync } from 'child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { rename, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  type CredentialImportResult,
  type CredentialSummaryItem,
  type CredentialVaultSummary,
} from '@shared/types/ipc'
import { decryptString, encryptString, validatePath } from '../security'

interface VaultCredential {
  id: string
  site: string
  username: string
  password: string
  importedAt: number
}

interface CredentialVault {
  schemaVersion: number
  credentials: VaultCredential[]
  lastImportedAt: number | null
}

interface RawCredentialInput {
  site: string
  username: string
  password: string
}

const VAULT_SCHEMA_VERSION = 1
const MAX_CREDENTIALS = 5000
const PREVIEW_SIZE = 5
const DATA_DIR = join(app.getPath('userData'), 'data')
const VAULT_PATH = join(DATA_DIR, 'credential-vault.bin')

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

function defaultVault(): CredentialVault {
  return {
    schemaVersion: VAULT_SCHEMA_VERSION,
    credentials: [],
    lastImportedAt: null,
  }
}

function isVaultCredential(value: unknown): value is VaultCredential {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return (
    typeof item.id === 'string' &&
    typeof item.site === 'string' &&
    typeof item.username === 'string' &&
    typeof item.password === 'string' &&
    typeof item.importedAt === 'number'
  )
}

function loadVault(): CredentialVault {
  ensureDataDir()
  try {
    const encrypted = readFileSync(VAULT_PATH)
    const decrypted = decryptString(encrypted)
    const parsed = JSON.parse(decrypted) as Partial<CredentialVault>
    const credentials = Array.isArray(parsed.credentials)
      ? parsed.credentials.filter(isVaultCredential).slice(0, MAX_CREDENTIALS)
      : []
    return {
      schemaVersion: VAULT_SCHEMA_VERSION,
      credentials,
      lastImportedAt: typeof parsed.lastImportedAt === 'number' ? parsed.lastImportedAt : null,
    }
  } catch {
    return defaultVault()
  }
}

async function saveVault(vault: CredentialVault): Promise<void> {
  ensureDataDir()
  const serialized = JSON.stringify(vault)
  const encrypted = encryptString(serialized)
  const tmpPath = `${VAULT_PATH}.tmp`
  await writeFile(tmpPath, encrypted)
  await rename(tmpPath, VAULT_PATH)
}

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < input.length; i++) {
    const char = input[i]

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          currentField += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        currentField += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }

    if (char === ',') {
      currentRow.push(currentField)
      currentField = ''
      continue
    }

    if (char === '\n') {
      currentRow.push(currentField)
      rows.push(currentRow)
      currentRow = []
      currentField = ''
      continue
    }

    if (char === '\r') {
      continue
    }

    currentField += char
  }

  currentRow.push(currentField)
  if (currentRow.length > 1 || currentRow[0]?.trim()) {
    rows.push(currentRow)
  }

  return rows
}

function findHeaderIndex(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.indexOf(candidate)
    if (idx >= 0) return idx
  }
  return -1
}

function normalizeSite(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return 'unknown'

  const normalized = trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? trimmed
    : `https://${trimmed}`

  try {
    const host = new URL(normalized).hostname.trim().toLowerCase()
    return host || 'unknown'
  } catch {
    const bare = trimmed
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .trim()
      .toLowerCase()
    return bare || 'unknown'
  }
}

function maskUsername(raw: string): string {
  const value = raw.trim()
  if (!value) return '(empty)'
  if (value.length <= 2) return '*'.repeat(value.length)
  const middle = '*'.repeat(Math.min(8, value.length - 2))
  return `${value[0]}${middle}${value[value.length - 1]}`
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase()
}

async function mergeCredentials(records: RawCredentialInput[], sourcePath: string): Promise<CredentialImportResult> {
  const vault = loadVault()
  const existingKeys = new Set(vault.credentials.map((item) => `${item.site}\u0000${item.username}\u0000${item.password}`))

  let importedCount = 0
  let skippedCount = 0
  const importedAt = Date.now()

  for (const item of records) {
    const site = normalizeSite(item.site)
    const username = item.username.trim()
    const password = item.password.trim()

    if (!password) {
      skippedCount += 1
      continue
    }

    const key = `${site}\u0000${username}\u0000${password}`
    if (existingKeys.has(key)) {
      skippedCount += 1
      continue
    }

    if (vault.credentials.length >= MAX_CREDENTIALS) {
      skippedCount += 1
      continue
    }

    vault.credentials.push({
      id: crypto.randomUUID(),
      site,
      username,
      password,
      importedAt,
    })
    existingKeys.add(key)
    importedCount += 1
  }

  if (importedCount > 0) {
    vault.lastImportedAt = importedAt
    await saveVault(vault)
  }

  return {
    importedCount,
    skippedCount,
    totalCount: vault.credentials.length,
    sourcePath,
  }
}

function decryptDpapi(data: Buffer): Buffer | null {
  if (process.platform !== 'win32' || data.length === 0) return null

  const script = [
    "$ErrorActionPreference='Stop'",
    `$enc=[Convert]::FromBase64String('${data.toString('base64')}')`,
    '$dec=[System.Security.Cryptography.ProtectedData]::Unprotect($enc,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)',
    '[Console]::Out.Write([Convert]::ToBase64String($dec))',
  ].join('; ')

  const result = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 5000,
  })

  if (result.status !== 0) return null

  const output = result.stdout.trim()
  if (!output) return null

  try {
    return Buffer.from(output, 'base64')
  } catch {
    return null
  }
}

function decryptChromiumPassword(blob: Buffer, masterKey: Buffer | null): string {
  if (!blob || blob.length === 0) return ''

  const prefix = blob.subarray(0, 3).toString('utf8')
  if ((prefix === 'v10' || prefix === 'v11') && masterKey && masterKey.length === 32) {
    try {
      const iv = blob.subarray(3, 15)
      const payload = blob.subarray(15)
      const cipherText = payload.subarray(0, payload.length - 16)
      const authTag = payload.subarray(payload.length - 16)
      const decipher = createDecipheriv('aes-256-gcm', masterKey, iv)
      decipher.setAuthTag(authTag)
      const decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()])
      return decrypted.toString('utf8')
    } catch {
      return ''
    }
  }

  const dpapi = decryptDpapi(blob)
  return dpapi?.toString('utf8') ?? ''
}

function getChromiumMasterKey(localStatePath: string): Buffer | null {
  try {
    const localState = JSON.parse(readFileSync(localStatePath, 'utf-8')) as {
      os_crypt?: { encrypted_key?: string }
    }
    const encoded = localState.os_crypt?.encrypted_key
    if (!encoded) return null

    const encrypted = Buffer.from(encoded, 'base64')
    const payload = encrypted.subarray(0, 5).toString('utf8') === 'DPAPI'
      ? encrypted.subarray(5)
      : encrypted
    return decryptDpapi(payload)
  } catch {
    return null
  }
}

function collectChromiumCandidates(): Array<{ browserName: string; loginDbPath: string; localStatePath: string }> {
  if (process.platform !== 'win32') return []

  const localAppData = process.env['LOCALAPPDATA'] ?? ''
  if (!localAppData) return []

  const browserRoots = [
    { browserName: 'Chrome', userDataPath: join(localAppData, 'Google', 'Chrome', 'User Data') },
    { browserName: 'Edge', userDataPath: join(localAppData, 'Microsoft', 'Edge', 'User Data') },
    { browserName: 'Brave', userDataPath: join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data') },
  ]

  const result: Array<{ browserName: string; loginDbPath: string; localStatePath: string }> = []

  for (const browser of browserRoots) {
    if (!existsSync(browser.userDataPath)) continue

    const localStatePath = join(browser.userDataPath, 'Local State')
    if (!existsSync(localStatePath)) continue

    let entries: string[] = []
    try {
      entries = readdirSync(browser.userDataPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    } catch {
      continue
    }

    for (const profileName of entries) {
      if (!/^Default$|^Profile\s+\d+$|^Guest Profile$/.test(profileName)) continue
      const loginDbPath = join(browser.userDataPath, profileName, 'Login Data')
      if (!existsSync(loginDbPath)) continue
      result.push({
        browserName: browser.browserName,
        loginDbPath,
        localStatePath,
      })
    }
  }

  return result
}

function extractCredentialsFromChromiumDb(loginDbPath: string, masterKey: Buffer | null): RawCredentialInput[] {
  const tempCopyPath = join(
    tmpdir(),
    `usan-login-${process.pid}-${Date.now()}-${Math.round(Math.random() * 1e6)}.db`,
  )

  try {
    copyFileSync(loginDbPath, tempCopyPath)
    const db = new Database(tempCopyPath, { readonly: true, fileMustExist: true })
    const rows = db
      .prepare('SELECT origin_url, username_value, password_value FROM logins WHERE blacklisted_by_user = 0')
      .all() as Array<{ origin_url: string; username_value: string; password_value: Buffer }>
    db.close()

    const credentials: RawCredentialInput[] = []
    for (const row of rows) {
      const password = decryptChromiumPassword(Buffer.from(row.password_value), masterKey)
      if (!password) continue
      credentials.push({
        site: row.origin_url ?? '',
        username: row.username_value ?? '',
        password,
      })
    }

    return credentials
  } catch {
    return []
  } finally {
    try {
      rmSync(tempCopyPath, { force: true })
    } catch {
      // ignore cleanup errors
    }
  }
}

export function parseCredentialCsv(content: string): Array<{ site: string; username: string; password: string }> {
  const rows = parseCsvRows(content.replace(/^\uFEFF/, ''))
  if (rows.length <= 1) return []

  const header = rows[0].map((cell) => normalizeHeader(cell))
  const siteIdx = findHeaderIndex(header, ['url', 'website', 'site', 'origin', 'hostname', 'name'])
  const userIdx = findHeaderIndex(header, ['username', 'user name', 'login', 'account', 'email'])
  const passwordIdx = findHeaderIndex(header, ['password', 'pass', 'secret'])

  if (passwordIdx < 0) return []

  const credentials: RawCredentialInput[] = []
  for (const row of rows.slice(1)) {
    const password = (row[passwordIdx] ?? '').trim()
    if (!password) continue

    const siteRaw = siteIdx >= 0 ? row[siteIdx] ?? '' : ''
    const userRaw = userIdx >= 0 ? row[userIdx] ?? '' : ''

    credentials.push({
      site: siteRaw,
      username: userRaw.trim(),
      password,
    })
  }

  return credentials
}

export async function importCredentialCsv(filePath: string): Promise<CredentialImportResult> {
  const pathError = validatePath(filePath, 'read')
  if (pathError) {
    throw new Error(pathError)
  }

  const content = readFileSync(filePath, 'utf-8')
  const parsed = parseCredentialCsv(content)
  return mergeCredentials(parsed, filePath)
}

export async function autoImportFromInstalledBrowsers(): Promise<CredentialImportResult> {
  const candidates = collectChromiumCandidates()
  const collected: RawCredentialInput[] = []

  for (const candidate of candidates) {
    const masterKey = getChromiumMasterKey(candidate.localStatePath)
    const credentials = extractCredentialsFromChromiumDb(candidate.loginDbPath, masterKey)

    for (const item of credentials) {
      collected.push(item)
    }
  }

  return mergeCredentials(collected, 'auto://installed-browsers')
}

function toSummaryItem(credential: VaultCredential): CredentialSummaryItem {
  return {
    id: credential.id,
    site: credential.site,
    usernameMasked: maskUsername(credential.username),
    importedAt: credential.importedAt,
  }
}

export function getCredentialVaultSummary(): CredentialVaultSummary {
  const vault = loadVault()
  const preview = [...vault.credentials]
    .sort((a, b) => b.importedAt - a.importedAt)
    .slice(0, PREVIEW_SIZE)
    .map(toSummaryItem)

  return {
    totalCount: vault.credentials.length,
    lastImportedAt: vault.lastImportedAt,
    preview,
  }
}

export async function clearCredentialVault(): Promise<void> {
  await saveVault(defaultVault())
}
