/// <reference types="vite/client" />

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
        setActiveSession: (sessionId: string) => Promise<ShellSnapshot>
        createSession: (seed?: CreateShellSessionSeed) => Promise<ShellSnapshot>
        branchSession: (sessionId: string, seed?: BranchShellSessionSeed) => Promise<ShellSnapshot>
        promoteSession: (sessionId: string) => Promise<ShellSnapshot>
        archiveSession: (sessionId: string) => Promise<ShellSnapshot>
        restoreSession: (sessionId: string) => Promise<ShellSnapshot>
        appendMessage: (sessionId: string, message: ShellChatMessage) => Promise<ShellSnapshot>
        updateSession: (sessionId: string, patch: Partial<ShellSession>) => Promise<ShellSnapshot>
        appendRunStep: (step: ShellRunStep) => Promise<ShellSnapshot>
        updateRunStep: (stepId: string, patch: Partial<ShellRunStep>) => Promise<ShellSnapshot>
        appendLog: (log: ShellLog) => Promise<ShellSnapshot>
        appendArtifact: (artifact: ShellArtifact) => Promise<ShellSnapshot>
        onSnapshot: (cb: (snapshot: ShellSnapshot) => void) => () => void
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
