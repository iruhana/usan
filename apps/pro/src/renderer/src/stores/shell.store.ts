import { create } from 'zustand'
import type {
  ShellArtifact,
  ShellChatMessage,
  ShellLog,
  ShellRunStep,
  ShellSession,
  ShellSnapshot,
} from '@shared/types'
import { useUiStore } from './ui.store'

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

interface ShellState extends ShellSnapshot {
  hydrated: boolean
  hydrate: () => Promise<void>
  appendMessage: (sessionId: string, message: ShellChatMessage) => void
  updateSession: (sessionId: string, patch: Partial<ShellSession>) => void
  appendRunStep: (step: ShellRunStep) => void
  updateRunStep: (stepId: string, patch: Partial<ShellRunStep>) => void
  appendLog: (log: ShellLog) => void
  appendArtifact: (artifact: ShellArtifact) => void
}

function touchSession(session: ShellSession): ShellSession {
  return {
    ...session,
    updatedAt: '방금',
  }
}

export const useShellStore = create<ShellState>((set) => ({
  ...EMPTY_SNAPSHOT,
  hydrated: false,
  hydrate: async () => {
    const snapshot = await window.usan?.shell?.getSnapshot?.() ?? EMPTY_SNAPSHOT
    if (snapshot.activeSessionId) {
      useUiStore.getState().setActiveSession(snapshot.activeSessionId)
    }
    set({
      ...snapshot,
      hydrated: true,
    })
  },
  appendMessage: (sessionId, message) => {
    set((state) => ({
      activeSessionId: sessionId,
      messages: [...state.messages, message],
      sessions: state.sessions.map((session) => (
        session.id === sessionId
          ? touchSession({
            ...session,
            messageCount: session.messageCount + 1,
          })
          : session
      )),
    }))
  },
  updateSession: (sessionId, patch) => {
    set((state) => ({
      sessions: state.sessions.map((session) => (
        session.id === sessionId
          ? { ...session, ...patch }
          : session
      )),
    }))
  },
  appendRunStep: (step) => {
    set((state) => ({
      runSteps: [...state.runSteps, step],
      sessions: state.sessions.map((session) => (
        session.id === step.sessionId
          ? touchSession(session)
          : session
      )),
    }))
  },
  updateRunStep: (stepId, patch) => {
    set((state) => ({
      runSteps: state.runSteps.map((step) => (
        step.id === stepId
          ? { ...step, ...patch }
          : step
      )),
    }))
  },
  appendLog: (log) => {
    set((state) => ({
      logs: [...state.logs, log],
      sessions: state.sessions.map((session) => (
        session.id === log.sessionId
          ? touchSession(session)
          : session
      )),
    }))
  },
  appendArtifact: (artifact) => {
    set((state) => ({
      artifacts: [...state.artifacts, artifact],
      sessions: state.sessions.map((session) => (
        session.id === artifact.sessionId
          ? touchSession({
            ...session,
            artifactCount: session.artifactCount + 1,
          })
          : session
      )),
    }))
  },
}))
