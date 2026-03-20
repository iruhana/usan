import { contextBridge, ipcRenderer } from 'electron'
import type { AIProvider, AppSettings, ChatPayload, ShellSnapshot, SkillMeta, StreamChunk } from '@shared/types'

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
