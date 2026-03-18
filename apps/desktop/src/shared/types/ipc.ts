/**
 * IPC Channel type contracts — Main ↔ Renderer communication
 * All IPC goes through typed contextBridge, never raw ipcRenderer
 */

import type {
  CapabilityGrantRequest,
  CapabilityGrantResponse,
  PermissionGrant,
  PermissionGrantRequest,
  PermissionRevokeRequest,
} from './permissions'
import type { ToolResult } from './tools'

export type Locale = 'ko' | 'en' | 'ja'
export type UpdateChannel = 'stable' | 'beta'
export type PermissionProfile = 'full' | 'balanced' | 'strict'

// ─── AI ──────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolCalls?: Array<{ id: string; name: string; args: Record<string, unknown> }>
  toolResults?: ToolResult[]
  modelId?: string
  timestamp: number
  isError?: boolean
}

export interface ChatRequest {
  conversationId: string
  message: string
  modelId?: string
}

export interface ChatChunk {
  type: 'text' | 'tool_call' | 'tool_result' | 'done' | 'error'
  content: string
  toolCall?: { id: string; name: string; args: Record<string, unknown> }
  toolResult?: ToolResult
}

export interface ModelInfo {
  id: string
  name: string
  provider: 'openrouter' | 'ollama' | 'node-llama-cpp'
  isLocal: boolean
  size?: number
}

// ─── File System ─────────────────────────────────

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedAt: number
}

export interface FilePickRequest {
  mode: 'file' | 'directory'
  multi?: boolean
  title?: string
}

export interface FilePickResult {
  canceled: boolean
  paths: string[]
}

// ─── Computer Use ────────────────────────────────

export interface ScreenCaptureResult {
  /** Base64 PNG image data */
  image: string
  width: number
  height: number
}

// ─── Conversations (persistence) ─────────────────

export interface StoredConversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
}

// ─── Notes ───────────────────────────────────────

export interface Note {
  id: string
  title: string
  content: string
  updatedAt: number
}

// ─── Settings ────────────────────────────────────

export interface AppSettings {
  schemaVersion: number
  fontScale: number
  highContrast: boolean
  voiceEnabled: boolean
  voiceOverlayEnabled: boolean
  voiceSpeed: number
  locale: Locale
  localeConfigured: boolean
  theme: 'light' | 'dark' | 'system'
  openAtLogin: boolean
  updateChannel: UpdateChannel
  autoDownloadUpdates: boolean
  permissionProfile: PermissionProfile
  beginnerMode: boolean
  browserCredentialAutoImportEnabled: boolean
  browserCredentialAutoImportDone: boolean
  sidebarCollapsed: boolean
  enterToSend: boolean
  cloudApiKey?: string
}

export interface CredentialSummaryItem {
  id: string
  site: string
  usernameMasked: string
  importedAt: number
}

export interface CredentialVaultSummary {
  totalCount: number
  lastImportedAt: number | null
  preview: CredentialSummaryItem[]
}

export interface CredentialImportResult {
  importedCount: number
  skippedCount: number
  totalCount: number
  sourcePath: string
}

export interface UpdaterStatus {
  enabled: boolean
  channel: UpdateChannel
  autoDownload: boolean
  checking: boolean
  updateAvailableVersion: string | null
  downloadedVersion: string | null
  lastCheckAt: number | null
  lastError: string | null
  crashStreak: number
}

export interface ExternalOAuthProfile {
  id: string
  name?: string
  nickname?: string
  email?: string
  avatarUrl?: string
}

export interface ExternalOAuthStatus {
  provider: 'google' | 'naver' | 'kakao'
  configured: boolean
  authenticated: boolean
  expiresAt: number | null
  scopes: string[]
  profile?: ExternalOAuthProfile
}

// ─── Permissions ─────────────────────────────────

// Permissions are granted explicitly and may be time-bound.

// ─── IPC Channel Map ─────────────────────────────

export interface IPCChannels {
  // AI
  'ai:chat': { request: ChatRequest; response: void }
  'ai:chat-stream': { event: ChatChunk }
  'ai:models': { request: void; response: ModelInfo[] }
  'ai:stop': { request: string; response: void }

  // Computer Use
  'computer:screenshot': { request: void; response: ScreenCaptureResult }

  // File System
  'fs:read': { request: { path: string }; response: string }
  'fs:write': { request: { path: string; content: string }; response: void }
  'fs:delete': { request: { path: string }; response: void }
  'fs:list': { request: { dir: string }; response: FileEntry[] }

  // Shell
  'shell:exec': { request: { command: string; cwd?: string }; response: { stdout: string; stderr: string; exitCode: number } }

  // Settings
  'settings:get': { request: void; response: AppSettings }
  'settings:set': { request: Partial<AppSettings>; response: void }

  // Updater
  'updater:status': { request: void; response: UpdaterStatus }
  'updater:check-now': { request: void; response: UpdaterStatus }
  'updater:download': { request: void; response: UpdaterStatus }
  'updater:install': { request: void; response: { queued: boolean } }

  // Permissions
  'permissions:get': { request: void; response: PermissionGrant }
  'permissions:grant': { request: PermissionGrantRequest | void; response: PermissionGrant }
  'permissions:revoke': { request: PermissionRevokeRequest | void; response: PermissionGrant }
  'permissions:issue-capability': { request: CapabilityGrantRequest; response: CapabilityGrantResponse }

  // Conversations
  'conversations:load': { request: void; response: StoredConversation[] }
  'conversations:save': { request: StoredConversation[]; response: void }

  // Notes
  'notes:load': { request: void; response: Note[] }
  'notes:save': { request: Note[]; response: void }

  // AI validation
  'ai:validate-key': { request: string; response: { valid: boolean; error?: string } }

  // File system extras
  'fs:pick': { request: FilePickRequest; response: FilePickResult }
  'fs:open-path': { request: string; response: void }

  // Browser credentials (CSV import)
  'credentials:get-summary': { request: void; response: CredentialVaultSummary }
  'credentials:import-browser-csv': { request: void; response: CredentialImportResult }
  'credentials:clear': { request: void; response: { success: boolean } }

  // System
  'system:desktop-path': { request: void; response: string }
  'locale:detect': { request: void; response: Locale }

  // Memory
  'memory:load': { request: void; response: unknown }
  'memory:save': { request: unknown; response: void }

  // Notification (renderer event, not handle)
  'notification': { event: { title: string; body: string; level: string } }

  // OAuth integrations
  'google:oauth-start': { request: string | void; response: { success: boolean; error?: string } }
  'google:oauth-status': { request: void; response: { authenticated: boolean } }
  'google:oauth-logout': { request: void; response: { success: boolean } }
  'naver:oauth-start': { request: void; response: { success: boolean; error?: string } }
  'naver:oauth-status': { request: void; response: ExternalOAuthStatus }
  'naver:oauth-logout': { request: void; response: { success: boolean } }
  'kakao:oauth-start': { request: void; response: { success: boolean; error?: string } }
  'kakao:oauth-status': { request: void; response: ExternalOAuthStatus }
  'kakao:oauth-logout': { request: void; response: { success: boolean } }
}
