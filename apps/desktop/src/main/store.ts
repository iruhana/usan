/**
 * Persistent store — JSON file-based settings + permissions
 * API keys are encrypted via Electron safeStorage
 *
 * Load functions are synchronous (called once at startup before window).
 * Save functions are asynchronous (called during user interaction).
 */

import { app } from 'electron'
import { join } from 'path'
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'fs'
import { writeFile as writeFileAsync, rename as renameAsync } from 'fs/promises'
import type { AppSettings, StoredConversation, Note } from '@shared/types/ipc'
import { normalizePermissionGrant, type PermissionGrant } from '@shared/types/permissions'
import { encryptString, decryptString } from './security'

const DATA_DIR = join(app.getPath('userData'), 'data')
const SETTINGS_PATH = join(DATA_DIR, 'settings.json')
const PERMISSIONS_PATH = join(DATA_DIR, 'permissions.json')
const APIKEY_PATH = join(DATA_DIR, 'apikey.bin')
const CONVERSATIONS_PATH = join(DATA_DIR, 'conversations.json')
const NOTES_PATH = join(DATA_DIR, 'notes.json')
const MAX_CONVERSATIONS = 100

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }
}

// Atomic write: write to temp file then rename to prevent corruption on crash
const writeQueues = new Map<string, Promise<void>>()

async function atomicWriteFile(filePath: string, data: string): Promise<void> {
  const prev = writeQueues.get(filePath) ?? Promise.resolve()
  let writeError: Error | null = null
  const next = prev.then(async () => {
    const tmp = filePath + '.tmp'
    await writeFileAsync(tmp, data, 'utf-8')
    await renameAsync(tmp, filePath)
  }).catch((err) => { writeError = err instanceof Error ? err : new Error(String(err)) })
    .finally(() => {
      if (writeQueues.get(filePath) === next) writeQueues.delete(filePath)
    })
  writeQueues.set(filePath, next)
  await next
  if (writeError) throw writeError
}

// ─── Settings ───────────────────────────────────────

const DEFAULT_SETTINGS: AppSettings = {
  fontScale: 1.0,
  highContrast: false,
  voiceEnabled: true,
  voiceSpeed: 1.0,
  locale: 'ko',
  theme: 'light',
  openAtLogin: true,
}

export function loadSettings(): AppSettings {
  ensureDataDir()
  try {
    const raw = readFileSync(SETTINGS_PATH, 'utf-8')
    const s = JSON.parse(raw)
    // Pick only known fields with type validation to prevent key injection
    const settings: AppSettings = {
      fontScale: typeof s.fontScale === 'number' && s.fontScale >= 0.5 && s.fontScale <= 3 ? s.fontScale : DEFAULT_SETTINGS.fontScale,
      highContrast: typeof s.highContrast === 'boolean' ? s.highContrast : DEFAULT_SETTINGS.highContrast,
      voiceEnabled: typeof s.voiceEnabled === 'boolean' ? s.voiceEnabled : DEFAULT_SETTINGS.voiceEnabled,
      voiceSpeed: typeof s.voiceSpeed === 'number' && s.voiceSpeed >= 0.1 && s.voiceSpeed <= 3 ? s.voiceSpeed : DEFAULT_SETTINGS.voiceSpeed,
      locale: ['ko', 'en', 'ja'].includes(s.locale) ? s.locale : DEFAULT_SETTINGS.locale,
      theme: ['light', 'dark', 'system'].includes(s.theme) ? s.theme : DEFAULT_SETTINGS.theme,
      openAtLogin: typeof s.openAtLogin === 'boolean' ? s.openAtLogin : DEFAULT_SETTINGS.openAtLogin,
    }
    settings.cloudApiKey = loadApiKey()
    return settings
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  ensureDataDir()
  // Save API key separately (encrypted)
  if (settings.cloudApiKey && settings.cloudApiKey !== '••••••••') {
    await saveApiKey(settings.cloudApiKey)
  }
  // Don't persist the raw API key in the JSON file
  const toSave = { ...settings }
  delete toSave.cloudApiKey
  await atomicWriteFile(SETTINGS_PATH, JSON.stringify(toSave, null, 2))
}

// ─── API Key (encrypted) ────────────────────────────

async function saveApiKey(key: string): Promise<void> {
  ensureDataDir()
  const encrypted = encryptString(key)
  await writeFileAsync(APIKEY_PATH, encrypted)
}

function loadApiKey(): string {
  try {
    const encrypted = readFileSync(APIKEY_PATH)
    return decryptString(encrypted)
  } catch {
    return ''
  }
}

// ─── Permissions ────────────────────────────────────

const DEFAULT_PERMISSIONS: PermissionGrant = normalizePermissionGrant()

export function loadPermissions(): PermissionGrant {
  ensureDataDir()
  try {
    const raw = readFileSync(PERMISSIONS_PATH, 'utf-8')
    const p = JSON.parse(raw)
    return normalizePermissionGrant(p)
  } catch {
    return { ...DEFAULT_PERMISSIONS }
  }
}

export async function savePermissions(grant: PermissionGrant): Promise<void> {
  ensureDataDir()
  await atomicWriteFile(PERMISSIONS_PATH, JSON.stringify(normalizePermissionGrant(grant), null, 2))
}

// ─── Conversations ──────────────────────────────────

function isValidConversation(c: unknown): c is StoredConversation {
  return !!c && typeof c === 'object' &&
    typeof (c as Record<string, unknown>).id === 'string' &&
    typeof (c as Record<string, unknown>).title === 'string' &&
    Array.isArray((c as Record<string, unknown>).messages)
}

export function loadConversations(): StoredConversation[] {
  ensureDataDir()
  try {
    const raw = readFileSync(CONVERSATIONS_PATH, 'utf-8')
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data.filter(isValidConversation).slice(0, MAX_CONVERSATIONS)
  } catch {
    return []
  }
}

export async function saveConversations(conversations: StoredConversation[]): Promise<void> {
  ensureDataDir()
  const trimmed = conversations.slice(0, MAX_CONVERSATIONS)
  await atomicWriteFile(CONVERSATIONS_PATH, JSON.stringify(trimmed))
}

// ─── Notes ──────────────────────────────────────────

function isValidNote(n: unknown): n is Note {
  return !!n && typeof n === 'object' &&
    typeof (n as Record<string, unknown>).id === 'string' &&
    typeof (n as Record<string, unknown>).title === 'string' &&
    typeof (n as Record<string, unknown>).content === 'string'
}

export function loadNotes(): Note[] {
  ensureDataDir()
  try {
    const raw = readFileSync(NOTES_PATH, 'utf-8')
    const data = JSON.parse(raw)
    if (!Array.isArray(data)) return []
    return data.filter(isValidNote)
  } catch {
    return []
  }
}

export async function saveNotes(notes: Note[]): Promise<void> {
  ensureDataDir()
  await atomicWriteFile(NOTES_PATH, JSON.stringify(notes, null, 2))
}

// ─── User Memory (long-term preferences) ──────────

export interface UserMemory {
  facts: MemoryEntry[]
  preferences: MemoryEntry[]
}

export interface MemoryEntry {
  key: string
  value: string
  learnedAt: number
  source: 'explicit' | 'inferred'
}

const MEMORY_PATH = join(DATA_DIR, 'memory.json')
const MAX_MEMORY_ENTRIES = 200

function isValidMemoryEntry(e: unknown): e is MemoryEntry {
  return !!e && typeof e === 'object' &&
    typeof (e as Record<string, unknown>).key === 'string' &&
    typeof (e as Record<string, unknown>).value === 'string'
}

export function loadMemory(): UserMemory {
  ensureDataDir()
  try {
    const raw = readFileSync(MEMORY_PATH, 'utf-8')
    const data = JSON.parse(raw)
    return {
      facts: Array.isArray(data?.facts) ? data.facts.filter(isValidMemoryEntry) : [],
      preferences: Array.isArray(data?.preferences) ? data.preferences.filter(isValidMemoryEntry) : [],
    }
  } catch {
    return { facts: [], preferences: [] }
  }
}

export async function saveMemory(memory: UserMemory): Promise<void> {
  ensureDataDir()
  const trimmed: UserMemory = {
    facts: memory.facts.slice(0, MAX_MEMORY_ENTRIES),
    preferences: memory.preferences.slice(0, MAX_MEMORY_ENTRIES),
  }
  await atomicWriteFile(MEMORY_PATH, JSON.stringify(trimmed, null, 2))
}
