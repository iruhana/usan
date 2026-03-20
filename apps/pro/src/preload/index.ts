import { contextBridge, ipcRenderer } from 'electron'
import type {
  AIProvider,
  AppSettings,
  BranchShellSessionSeed,
  ChatPayload,
  CreateShellSessionSeed,
  ShellArtifact,
  ShellChatMessage,
  ShellLog,
  ShellRunStep,
  ShellSession,
  ShellSnapshot,
  SkillMeta,
  StreamChunk,
} from '@shared/types'

const api = {
  // AI tabs
  tabs: {
    switch: (providerId: string) => ipcRenderer.invoke('tabs:switch', providerId),
    list: (): Promise<AIProvider[]> => ipcRenderer.invoke('tabs:list'),
  },

  // AI chat (streaming via events)
  ai: {
    chat: (payload: ChatPayload): Promise<null> => ipcRenderer.invoke('ai:chat', payload),
    stop: (requestId: string): Promise<void> => ipcRenderer.invoke('ai:stop', requestId),
    onChunk: (cb: (chunk: StreamChunk) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, chunk: StreamChunk) => cb(chunk)
      ipcRenderer.on('ai:chunk', handler)
      return () => ipcRenderer.off('ai:chunk', handler)
    },
  },

  // Skills
  skills: {
    list: (query?: string): Promise<SkillMeta[]> => ipcRenderer.invoke('skills:list', query),
    read: (skillPath: string): Promise<string> => ipcRenderer.invoke('skills:read', skillPath),
    reindex: (): Promise<{ count: number }> => ipcRenderer.invoke('skills:reindex'),
  },

  shell: {
    getSnapshot: (): Promise<ShellSnapshot> => ipcRenderer.invoke('shell:get-snapshot'),
    setActiveSession: (sessionId: string): Promise<ShellSnapshot> => ipcRenderer.invoke('shell:set-active-session', sessionId),
    createSession: (seed?: CreateShellSessionSeed): Promise<ShellSnapshot> => ipcRenderer.invoke('shell:create-session', seed),
    branchSession: (sessionId: string, seed?: BranchShellSessionSeed): Promise<ShellSnapshot> => ipcRenderer.invoke('shell:branch-session', sessionId, seed),
    promoteSession: (sessionId: string): Promise<ShellSnapshot> => ipcRenderer.invoke('shell:promote-session', sessionId),
    archiveSession: (sessionId: string): Promise<ShellSnapshot> => ipcRenderer.invoke('shell:archive-session', sessionId),
    restoreSession: (sessionId: string): Promise<ShellSnapshot> => ipcRenderer.invoke('shell:restore-session', sessionId),
    appendMessage: (sessionId: string, message: ShellChatMessage): Promise<ShellSnapshot> => ipcRenderer.invoke('shell:append-message', sessionId, message),
    updateSession: (sessionId: string, patch: Partial<ShellSession>): Promise<ShellSnapshot> => ipcRenderer.invoke('shell:update-session', sessionId, patch),
    appendRunStep: (step: ShellRunStep): Promise<ShellSnapshot> => ipcRenderer.invoke('shell:append-run-step', step),
    updateRunStep: (stepId: string, patch: Partial<ShellRunStep>): Promise<ShellSnapshot> => ipcRenderer.invoke('shell:update-run-step', stepId, patch),
    appendLog: (log: ShellLog): Promise<ShellSnapshot> => ipcRenderer.invoke('shell:append-log', log),
    appendArtifact: (artifact: ShellArtifact): Promise<ShellSnapshot> => ipcRenderer.invoke('shell:append-artifact', artifact),
    onSnapshot: (cb: (snapshot: ShellSnapshot) => void): (() => void) => {
      const handler = (_: Electron.IpcRendererEvent, snapshot: ShellSnapshot) => cb(snapshot)
      ipcRenderer.on('shell:snapshot', handler)
      return () => ipcRenderer.off('shell:snapshot', handler)
    },
  },

  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    update: (patch: Partial<AppSettings>): Promise<AppSettings> => ipcRenderer.invoke('settings:update', patch),
  },

  // Window controls
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:is-maximized'),
  },
}

contextBridge.exposeInMainWorld('usan', api)

declare global {
  interface Window {
    usan: typeof api
  }
}
