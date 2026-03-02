import { contextBridge, ipcRenderer } from 'electron'
import type { ChatRequest, AppSettings, ScreenCaptureResult, FileEntry, ChatChunk, StoredConversation, Note } from '@shared/types/ipc'
import type { PermissionGrant } from '@shared/types/permissions'
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
    grant: () => ipcRenderer.invoke(IPC.PERMISSIONS_GRANT) as Promise<PermissionGrant>,
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
  },

  // ─── Memory (long-term preferences) ────────────
  memory: {
    load: () => ipcRenderer.invoke(IPC.MEMORY_LOAD) as Promise<{ facts: Array<{ key: string; value: string; learnedAt: number; source: string }>; preferences: Array<{ key: string; value: string; learnedAt: number; source: string }> }>,
    save: (memory: { facts: Array<{ key: string; value: string; learnedAt: number; source: string }>; preferences: Array<{ key: string; value: string; learnedAt: number; source: string }> }) => ipcRenderer.invoke(IPC.MEMORY_SAVE, memory),
  },
}

contextBridge.exposeInMainWorld('usan', api)

export type UsanAPI = typeof api
