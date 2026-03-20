import { create } from 'zustand'
import type {
  BranchShellSessionSeed,
  CreateShellSessionSeed,
  ShellArtifact,
  ShellChatMessage,
  ShellLog,
  ShellRunStep,
  ShellSession,
  ShellSnapshot,
} from '@shared/types'

const EMPTY_SNAPSHOT: ShellSnapshot = {
  activeSessionId: null,
  sessions: [],
  runSteps: [],
  artifacts: [],
  approvals: [],
  logs: [],
  templates: [],
  messages: [],
  references: [],
  previews: [],
}

let unsubscribeShellSnapshot: (() => void) | null = null

function applySnapshot(snapshot: ShellSnapshot): Pick<ShellState, keyof ShellSnapshot | 'hydrated'> {
  return {
    ...snapshot,
    hydrated: true,
  }
}

interface ShellState extends ShellSnapshot {
  hydrated: boolean
  hydrate: () => Promise<void>
  setActiveSession: (sessionId: string) => Promise<void>
  createSession: (seed?: CreateShellSessionSeed) => Promise<void>
  branchSession: (sessionId: string, seed?: BranchShellSessionSeed) => Promise<void>
  promoteSession: (sessionId: string) => Promise<void>
  archiveSession: (sessionId: string) => Promise<void>
  restoreSession: (sessionId: string) => Promise<void>
  appendMessage: (sessionId: string, message: ShellChatMessage) => Promise<void>
  updateSession: (sessionId: string, patch: Partial<ShellSession>) => Promise<void>
  appendRunStep: (step: ShellRunStep) => Promise<void>
  updateRunStep: (stepId: string, patch: Partial<ShellRunStep>) => Promise<void>
  appendLog: (log: ShellLog) => Promise<void>
  appendArtifact: (artifact: ShellArtifact) => Promise<void>
}

export const useShellStore = create<ShellState>((set) => ({
  ...EMPTY_SNAPSHOT,
  hydrated: false,
  hydrate: async () => {
    const snapshot = await window.usan?.shell?.getSnapshot?.() ?? EMPTY_SNAPSHOT
    unsubscribeShellSnapshot?.()
    unsubscribeShellSnapshot = window.usan?.shell?.onSnapshot?.((nextSnapshot) => {
      set(applySnapshot(nextSnapshot))
    }) ?? null
    set(applySnapshot(snapshot))
  },
  setActiveSession: async (sessionId) => {
    const snapshot = await window.usan?.shell?.setActiveSession?.(sessionId)
    if (snapshot) {
      set(applySnapshot(snapshot))
    }
  },
  createSession: async (seed) => {
    const snapshot = await window.usan?.shell?.createSession?.(seed)
    if (snapshot) {
      set(applySnapshot(snapshot))
    }
  },
  branchSession: async (sessionId, seed) => {
    const snapshot = await window.usan?.shell?.branchSession?.(sessionId, seed)
    if (snapshot) {
      set(applySnapshot(snapshot))
    }
  },
  promoteSession: async (sessionId) => {
    const snapshot = await window.usan?.shell?.promoteSession?.(sessionId)
    if (snapshot) {
      set(applySnapshot(snapshot))
    }
  },
  archiveSession: async (sessionId) => {
    const snapshot = await window.usan?.shell?.archiveSession?.(sessionId)
    if (snapshot) {
      set(applySnapshot(snapshot))
    }
  },
  restoreSession: async (sessionId) => {
    const snapshot = await window.usan?.shell?.restoreSession?.(sessionId)
    if (snapshot) {
      set(applySnapshot(snapshot))
    }
  },
  appendMessage: async (sessionId, message) => {
    const snapshot = await window.usan?.shell?.appendMessage?.(sessionId, message)
    if (snapshot) {
      set(applySnapshot(snapshot))
    }
  },
  updateSession: async (sessionId, patch) => {
    const snapshot = await window.usan?.shell?.updateSession?.(sessionId, patch)
    if (snapshot) {
      set(applySnapshot(snapshot))
    }
  },
  appendRunStep: async (step) => {
    const snapshot = await window.usan?.shell?.appendRunStep?.(step)
    if (snapshot) {
      set(applySnapshot(snapshot))
    }
  },
  updateRunStep: async (stepId, patch) => {
    const snapshot = await window.usan?.shell?.updateRunStep?.(stepId, patch)
    if (snapshot) {
      set(applySnapshot(snapshot))
    }
  },
  appendLog: async (log) => {
    const snapshot = await window.usan?.shell?.appendLog?.(log)
    if (snapshot) {
      set(applySnapshot(snapshot))
    }
  },
  appendArtifact: async (artifact) => {
    const snapshot = await window.usan?.shell?.appendArtifact?.(artifact)
    if (snapshot) {
      set(applySnapshot(snapshot))
    }
  },
}))
