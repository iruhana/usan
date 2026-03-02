import { contextBridge, ipcRenderer } from 'electron'
import type { ChatRequest, AppSettings, ScreenCaptureResult, FileEntry, ChatChunk, StoredConversation, Note } from '@shared/types/ipc'
import type { PermissionGrant, PermissionGrantRequest, PermissionRevokeRequest } from '@shared/types/permissions'
import { IPC } from '@shared/constants/channels'

const api = {
  // ─── Window Controls ───────────────────────────
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },

  // ─── AI ────────────────────────────────────────
  ai: {
    chat: (req: ChatRequest) => ipcRenderer.invoke(IPC.AI_CHAT, req),
    onChatStream: (callback: (chunk: ChatChunk) => void) => {
      const handler = (_: unknown, chunk: ChatChunk) => callback(chunk)
      ipcRenderer.on(IPC.AI_CHAT_STREAM, handler)
      return () => ipcRenderer.removeListener(IPC.AI_CHAT_STREAM, handler)
    },
    models: () => ipcRenderer.invoke(IPC.AI_MODELS) as Promise<Array<{ id: string; name: string; provider: string; isLocal: boolean }>>,
    stop: (conversationId: string) => ipcRenderer.invoke(IPC.AI_STOP, conversationId),
  },

  // ─── Computer Use ─────────────────────────────
  computer: {
    screenshot: () => ipcRenderer.invoke(IPC.COMPUTER_SCREENSHOT) as Promise<ScreenCaptureResult>,
  },

  // ─── File System ──────────────────────────────
  fs: {
    read: (path: string) => ipcRenderer.invoke(IPC.FS_READ, { path }) as Promise<string>,
    write: (path: string, content: string) => ipcRenderer.invoke(IPC.FS_WRITE, { path, content }),
    delete: (path: string) => ipcRenderer.invoke(IPC.FS_DELETE, { path }),
    list: (dir: string) => ipcRenderer.invoke(IPC.FS_LIST, { dir }) as Promise<FileEntry[]>,
    secureDelete: (path: string) => ipcRenderer.invoke(IPC.FS_SECURE_DELETE, path) as Promise<{ success: boolean; path: string; size: number; error?: string }>,
  },

  // ─── Shell ────────────────────────────────────
  shell: {
    exec: (command: string, cwd?: string) =>
      ipcRenderer.invoke(IPC.SHELL_EXEC, { command, cwd }) as Promise<{
        stdout: string
        stderr: string
        exitCode: number
      }>,
  },

  // ─── Settings ─────────────────────────────────
  settings: {
    get: () => ipcRenderer.invoke(IPC.SETTINGS_GET) as Promise<AppSettings>,
    set: (partial: Partial<AppSettings>) => ipcRenderer.invoke(IPC.SETTINGS_SET, partial),
  },

  // ─── Permissions ──────────────────────────────
  permissions: {
    get: () => ipcRenderer.invoke(IPC.PERMISSIONS_GET) as Promise<PermissionGrant>,
    grant: (request?: PermissionGrantRequest) =>
      ipcRenderer.invoke(IPC.PERMISSIONS_GRANT, request) as Promise<PermissionGrant>,
    revoke: (request?: PermissionRevokeRequest) =>
      ipcRenderer.invoke(IPC.PERMISSIONS_REVOKE, request) as Promise<PermissionGrant>,
  },

  // ─── Conversations ──────────────────────────────
  conversations: {
    load: () => ipcRenderer.invoke(IPC.CONVERSATIONS_LOAD) as Promise<StoredConversation[]>,
    save: (conversations: StoredConversation[]) => ipcRenderer.invoke(IPC.CONVERSATIONS_SAVE, conversations),
  },

  // ─── Notes ──────────────────────────────────────
  notes: {
    load: () => ipcRenderer.invoke(IPC.NOTES_LOAD) as Promise<Note[]>,
    save: (notes: Note[]) => ipcRenderer.invoke(IPC.NOTES_SAVE, notes),
  },

  // ─── AI Extras ──────────────────────────────────
  aiExtras: {
    validateKey: (apiKey: string) => ipcRenderer.invoke(IPC.AI_VALIDATE_KEY, apiKey) as Promise<{ valid: boolean; error?: string }>,
  },

  // ─── File Extras ────────────────────────────────
  fsExtras: {
    openPath: (filePath: string) => ipcRenderer.invoke(IPC.FS_OPEN_PATH, filePath),
  },

  // ─── Notifications ─────────────────────────────
  notifications: {
    onNotification: (callback: (data: { title: string; body: string; level: string }) => void) => {
      const handler = (_: unknown, data: { title: string; body: string; level: string }) => callback(data)
      ipcRenderer.on(IPC.NOTIFICATION, handler)
      return () => ipcRenderer.removeListener(IPC.NOTIFICATION, handler)
    },
  },

  // ─── System ──────────────────────────────────────
  system: {
    desktopPath: () => ipcRenderer.invoke(IPC.SYSTEM_DESKTOP_PATH) as Promise<string>,
    detectLocale: () => ipcRenderer.invoke(IPC.LOCALE_DETECT) as Promise<'ko' | 'en' | 'ja'>,
    cleanTemp: () => ipcRenderer.invoke(IPC.SYSTEM_CLEAN_TEMP) as Promise<{ deletedCount: number; freedBytes: number; errors: string[] }>,
    startupList: () => ipcRenderer.invoke(IPC.SYSTEM_STARTUP_LIST) as Promise<Array<{ name: string; command: string; source: string; enabled: boolean; protected: boolean }>>,
    startupToggle: (name: string, source: string, enabled: boolean) => ipcRenderer.invoke(IPC.SYSTEM_STARTUP_TOGGLE, { name, source, enabled }) as Promise<{ success: boolean; error?: string }>,
  },

  // ─── Auth ────────────────────────────────────────
  auth: {
    login: (email: string, password: string) => ipcRenderer.invoke(IPC.AUTH_LOGIN, { email, password }) as Promise<{ success: boolean; user?: { id: string; email?: string; displayName?: string }; error?: string }>,
    signup: (email: string, password: string, displayName?: string) => ipcRenderer.invoke(IPC.AUTH_SIGNUP, { email, password, displayName }) as Promise<{ success: boolean; user?: { id: string; email?: string; displayName?: string }; error?: string }>,
    logout: () => ipcRenderer.invoke(IPC.AUTH_LOGOUT) as Promise<{ success: boolean; error?: string }>,
    session: () => ipcRenderer.invoke(IPC.AUTH_SESSION) as Promise<{ success: boolean; user?: { id: string; email?: string; displayName?: string }; error?: string }>,
    loginOtp: (phone: string) => ipcRenderer.invoke(IPC.AUTH_LOGIN_OTP, { phone }) as Promise<{ success: boolean; error?: string }>,
    verifyOtp: (phone: string, token: string) => ipcRenderer.invoke(IPC.AUTH_VERIFY_OTP, { phone, token }) as Promise<{ success: boolean; user?: { id: string; email?: string; displayName?: string }; error?: string }>,
  },

  // ─── Sync ───────────────────────────────────────
  sync: {
    push: (userId: string, dataType: string, data: string) => ipcRenderer.invoke(IPC.SYNC_PUSH, { userId, dataType, data }) as Promise<{ success: boolean; error?: string }>,
    pull: (userId: string, dataType: string) => ipcRenderer.invoke(IPC.SYNC_PULL, { userId, dataType }) as Promise<{ success: boolean; data?: string; error?: string }>,
    status: () => ipcRenderer.invoke(IPC.SYNC_STATUS) as Promise<{ lastSynced: number; pending: number; status: string; error?: string }>,
  },

  // ─── Memory (long-term preferences) ────────────
  memory: {
    load: () => ipcRenderer.invoke(IPC.MEMORY_LOAD) as Promise<{ facts: Array<{ key: string; value: string; learnedAt: number; source: string }>; preferences: Array<{ key: string; value: string; learnedAt: number; source: string }> }>,
    save: (memory: { facts: Array<{ key: string; value: string; learnedAt: number; source: string }>; preferences: Array<{ key: string; value: string; learnedAt: number; source: string }> }) => ipcRenderer.invoke(IPC.MEMORY_SAVE, memory),
  },
}

contextBridge.exposeInMainWorld('usan', api)

export type UsanAPI = typeof api
