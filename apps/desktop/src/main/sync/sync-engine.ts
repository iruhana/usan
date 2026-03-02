/**
 * Cloud sync engine — local-first with Supabase push/pull.
 *
 * Strategy:
 * - All data stored locally first (existing JSON files)
 * - When online + authenticated: push/pull to Supabase
 * - Conflict resolution: last-write-wins (timestamp)
 * - Data encrypted with AES-256-GCM before upload
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import { getSupabaseClient } from '../auth/supabase-client'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const SCRYPT_SALT = 'usan-sync-v1' // Static salt (key uniqueness comes from userId)

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

/** Derive a sync encryption key from the user ID using scrypt */
function deriveKey(userId: string): Buffer {
  return scryptSync(userId, SCRYPT_SALT, KEY_LENGTH, { N: 16384, r: 8, p: 1 })
}

function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, 'utf-8', 'base64')
  encrypted += cipher.final('base64')
  const tag = cipher.getAuthTag()
  // Format: iv:tag:ciphertext (all base64)
  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted}`
}

function decrypt(data: string, key: Buffer): string {
  const parts = data.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted data format')
  const iv = Buffer.from(parts[0], 'base64')
  const tag = Buffer.from(parts[1], 'base64')
  const ciphertext = parts[2]
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
    const key = deriveKey(userId)
    const encrypted = encrypt(localData, key)

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

    const key = deriveKey(userId)
    const decrypted = decrypt(data.encrypted_data, key)

    syncStatus = { ...syncStatus, status: 'idle', lastSynced: Date.now() }
    return { success: true, data: decrypted }
  } catch (err) {
    const msg = (err as Error).message
    syncStatus = { ...syncStatus, status: 'error', error: msg }
    return { success: false, error: msg }
  }
}

export function getSyncStatus(): SyncStatus {
  return { ...syncStatus }
}
