/**
 * IPC Channel type contracts — Main ↔ Renderer communication
 * All IPC goes through typed contextBridge, never raw ipcRenderer
 */

import type { PermissionGrant } from './permissions'
import type { ToolResult } from './tools'

export type Locale = 'ko' | 'en' | 'ja'

// ─── AI ──────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolCalls?: Array<{ id: string; name: string; args: Record<string, unknown> }>
  toolResults?: ToolResult[]
  modelId?: string
  timestamp: number
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
  provider: 'openrouter'
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
  fontScale: number
  highContrast: boolean
  voiceEnabled: boolean
  voiceSpeed: number
  locale: Locale
  theme: 'light' | 'dark' | 'system'
  cloudApiKey?: string
}

// ─── Permissions ─────────────────────────────────

// All granted at install, no per-action prompts

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

  // Permissions
  'permissions:get': { request: void; response: PermissionGrant }
  'permissions:grant': { request: void; response: PermissionGrant }

  // Conversations
  'conversations:load': { request: void; response: StoredConversation[] }
  'conversations:save': { request: StoredConversation[]; response: void }

  // Notes
  'notes:load': { request: void; response: Note[] }
  'notes:save': { request: Note[]; response: void }

  // AI validation
  'ai:validate-key': { request: string; response: { valid: boolean; error?: string } }

  // File system extras
  'fs:open-path': { request: string; response: void }

  // System
  'system:desktop-path': { request: void; response: string }
  'locale:detect': { request: void; response: Locale }

  // Memory
  'memory:load': { request: void; response: unknown }
  'memory:save': { request: unknown; response: void }

  // Notification (renderer event, not handle)
  'notification': { event: { title: string; body: string; level: string } }
}
