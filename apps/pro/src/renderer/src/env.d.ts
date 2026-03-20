/// <reference types="vite/client" />

 import type { AIProvider, AppSettings, ChatPayload, ShellSnapshot, SkillMeta, StreamChunk } from '@shared/types'

declare global {
  interface Window {
    usan: {
      tabs: {
        switch: (providerId: string) => Promise<void>
        list: () => Promise<AIProvider[]>
      }
      ai: {
        chat: (payload: ChatPayload) => Promise<null>
        stop: (requestId: string) => Promise<void>
        onChunk: (cb: (chunk: StreamChunk) => void) => () => void
      }
      skills: {
        list: (query?: string) => Promise<SkillMeta[]>
        read: (skillPath: string) => Promise<string>
        reindex: () => Promise<{ count: number }>
      }
      shell: {
        getSnapshot: () => Promise<ShellSnapshot>
      }
      settings: {
        get: () => Promise<AppSettings>
        update: (patch: Partial<AppSettings>) => Promise<AppSettings>
      }
      window: {
        minimize: () => Promise<void>
        maximize: () => Promise<void>
        close: () => Promise<void>
        isMaximized: () => Promise<boolean>
      }
    }
  }
}
