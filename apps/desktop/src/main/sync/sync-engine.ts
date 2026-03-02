/**
 * Cloud sync engine — local-first with Supabase push/pull.
 *
 * Strategy:
 * - All data stored locally first (existing JSON files)
 * - When online + authenticated: push/pull to Supabase
 * - Conflict resolution: last-write-wins (timestamp)
 * - Data encrypted with AES-256-GCM before upload
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'crypto'
import { dirname, join } from 'path'
import { homedir } from 'os'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { getSupabaseClient } from '../auth/supabase-client'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const SALT_LENGTH = 32
const AUTH_TAG_LENGTH = 16
const SYNC_CIPHER_VERSION = 'v2'
const SYNC_SECRET_PATH = process.env.USAN_SYNC_SECRET_PATH || join(homedir(), '.usan', 'sync-secret.bin')

export interface SyncStatus {
  lastSynced: number
  pending: number
  status: 'idle' | 'syncing' | 'error'
  error?: string
}

let syncStatus: SyncStatus = {
  lastSynced: 0,
  pending: 0,
  status: 'idle',
}

let cachedRootSecret: Buffer | null = null

/**
 * Resolve a root secret for sync encryption.
 * Priority:
 * 1) Shared env secret (for multi-device compatibility)
 * 2) Local device secret file (fallback)
 */
function getRootSecret(): Buffer {
  if (cachedRootSecret) return cachedRootSecret

  const envSecret = process.env.USAN_SYNC_SECRET || process.env.SYNC_ENCRYPTION_SECRET
  if (envSecret && envSecret.trim().length > 0) {
    cachedRootSecret = createHash('sha256').update(envSecret, 'utf-8').digest()
    return cachedRootSecret
  }

  try {
    if (existsSync(SYNC_SECRET_PATH)) {
      const secret = readFileSync(SYNC_SECRET_PATH)
      if (secret.length === KEY_LENGTH) {
        cachedRootSecret = secret
        return secret
      }
    }
  } catch {
    // continue and regenerate below
  }

  const generated = randomBytes(KEY_LENGTH)
  try {
    mkdirSync(dirname(SYNC_SECRET_PATH), { recursive: true })
    writeFileSync(SYNC_SECRET_PATH, generated, { mode: 0o600 })
  } catch {
    // If writing fails, still use in-memory secret for this process
  }
  cachedRootSecret = generated
  return generated
}

/** Legacy key derivation (v1) kept for backward compatibility. */
function deriveLegacyKey(userId: string, salt: Buffer): Buffer {
  return scryptSync(userId, salt, KEY_LENGTH, { N: 16384, r: 8, p: 1 })
}

/** Derive a sync encryption key from user ID + secret + random salt using scrypt. */
function deriveKey(userId: string, salt: Buffer): Buffer {
  const rootSecret = getRootSecret()
  const material = Buffer.concat([Buffer.from(userId, 'utf-8'), Buffer.from(':'), rootSecret])
  return scryptSync(material, salt, KEY_LENGTH, { N: 16384, r: 8, p: 1 })
}

function encrypt(plaintext: string, userId: string): string {
  const salt = randomBytes(SALT_LENGTH)
  const key = deriveKey(userId, salt)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, 'utf-8', 'base64')
  encrypted += cipher.final('base64')
  const tag = cipher.getAuthTag()
  // v2 format: v2:salt:iv:tag:ciphertext (all base64 except prefix)
  return `${SYNC_CIPHER_VERSION}:${salt.toString('base64')}:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted}`
}

function decrypt(data: string, userId: string): string {
  const parts = data.split(':')
  const isV2 = parts[0] === SYNC_CIPHER_VERSION
  const expectedLen = isV2 ? 5 : 4
  if (parts.length !== expectedLen) throw new Error('Invalid encrypted data format')

  const offset = isV2 ? 1 : 0
  const salt = Buffer.from(parts[offset], 'base64')
  const iv = Buffer.from(parts[offset + 1], 'base64')
  const tag = Buffer.from(parts[offset + 2], 'base64')
  const ciphertext = parts[offset + 3]
  // Validate decoded lengths to catch malformed input
  if (salt.length !== SALT_LENGTH) throw new Error('Invalid salt length')
  if (iv.length !== IV_LENGTH) throw new Error('Invalid IV length')
  if (tag.length !== AUTH_TAG_LENGTH) throw new Error('Invalid auth tag length')
  const key = isV2 ? deriveKey(userId, salt) : deriveLegacyKey(userId, salt)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  let decrypted = decipher.update(ciphertext, 'base64', 'utf-8')
  decrypted += decipher.final('utf-8')
  return decrypted
}

export async function pushData(
  userId: string,
  dataType: string,
  localData: string,
): Promise<{ success: boolean; error?: string }> {
  syncStatus = { ...syncStatus, status: 'syncing' }
  try {
    const supabase = getSupabaseClient()
    const encrypted = encrypt(localData, userId)

    const { error } = await supabase
      .from('user_sync')
      .upsert({
        user_id: userId,
        data_type: dataType,
        encrypted_data: encrypted,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,data_type' })

    if (error) {
      syncStatus = { ...syncStatus, status: 'error', error: error.message }
      return { success: false, error: error.message }
    }

    syncStatus = { ...syncStatus, status: 'idle', lastSynced: Date.now() }
    return { success: true }
  } catch (err) {
    const msg = (err as Error).message
    syncStatus = { ...syncStatus, status: 'error', error: msg }
    return { success: false, error: msg }
  }
}

export async function pullData(
  userId: string,
  dataType: string,
): Promise<{ success: boolean; data?: string; error?: string }> {
  syncStatus = { ...syncStatus, status: 'syncing' }
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('user_sync')
      .select('encrypted_data')
      .eq('user_id', userId)
      .eq('data_type', dataType)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No data found — not an error
        syncStatus = { ...syncStatus, status: 'idle' }
        return { success: true }
      }
      syncStatus = { ...syncStatus, status: 'error', error: error.message }
      return { success: false, error: error.message }
    }

    const decrypted = decrypt(data.encrypted_data, userId)

    syncStatus = { ...syncStatus, status: 'idle', lastSynced: Date.now() }
    return { success: true, data: decrypted }
  } catch (err) {
    const msg = (err as Error).message
    syncStatus = { ...syncStatus, status: 'error', error: msg }
    return { success: false, error: msg }
  }
}

/** Validate that the provided userId matches the current authenticated session */
export async function validateSyncUser(userId: string): Promise<string | null> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session?.user) return '인증되지 않은 사용자입니다'
    if (data.session.user.id !== userId) return '사용자 ID가 현재 세션과 일치하지 않습니다'
    return null // OK
  } catch {
    return '세션 확인 중 오류가 발생했습니다'
  }
}

export function getSyncStatus(): SyncStatus {
  return { ...syncStatus }
}
