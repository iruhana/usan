import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type {
  BranchShellSessionSeed,
  CreateShellSessionSeed,
  ShellApproval,
  ShellArtifact,
  ShellChatMessage,
  ShellLog,
  ShellPreview,
  ShellReference,
  ShellRunStep,
  ShellSession,
  ShellSnapshot,
} from '@shared/types'
import { createShellSnapshot } from './shell-snapshot'

let shellSnapshot: ShellSnapshot | null = null
let shellSnapshotFilePath: string | null = null
const DEFAULT_SESSION_TITLE = '새 세션'
const DEFAULT_SESSION_MODEL = 'claude-sonnet-4-6'
const BRANCH_SESSION_SUFFIX = '분기본'

function cloneSnapshot(snapshot: ShellSnapshot): ShellSnapshot {
  return structuredClone(snapshot)
}

function createDefaultSnapshot(): ShellSnapshot {
  return cloneSnapshot(createShellSnapshot())
}

function isShellSnapshot(value: unknown): value is ShellSnapshot {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Partial<ShellSnapshot>
  return (
    (typeof candidate.activeSessionId === 'string' || candidate.activeSessionId === null)
    && Array.isArray(candidate.sessions)
    && Array.isArray(candidate.runSteps)
    && Array.isArray(candidate.artifacts)
    && Array.isArray(candidate.approvals)
    && Array.isArray(candidate.logs)
    && Array.isArray(candidate.templates)
    && Array.isArray(candidate.messages)
    && Array.isArray(candidate.references)
    && Array.isArray(candidate.previews)
  )
}

function archiveCorruptSnapshot(filePath: string): void {
  if (!existsSync(filePath)) {
    return
  }

  const archivedPath = `${filePath}.corrupt-${Date.now()}`
  try {
    renameSync(filePath, archivedPath)
  } catch {
    // Ignore archival failure and continue with a fresh snapshot.
  }
}

function writeShellSnapshotToDisk(filePath: string, snapshot: ShellSnapshot): void {
  mkdirSync(dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.tmp`
  writeFileSync(tempPath, JSON.stringify(snapshot, null, 2), 'utf8')
  renameSync(tempPath, filePath)
}

function persistShellSnapshot(snapshot: ShellSnapshot): void {
  if (!shellSnapshotFilePath) {
    return
  }

  writeShellSnapshotToDisk(shellSnapshotFilePath, snapshot)
}

function readPersistedShellSnapshot(filePath: string): ShellSnapshot {
  if (!existsSync(filePath)) {
    return createDefaultSnapshot()
  }

  try {
    const raw = readFileSync(filePath, 'utf8')
    const parsed = raw ? JSON.parse(raw) : null
    if (!isShellSnapshot(parsed)) {
      throw new Error('Persisted shell snapshot shape is invalid')
    }
    return cloneSnapshot(parsed)
  } catch {
    archiveCorruptSnapshot(filePath)
    return createDefaultSnapshot()
  }
}

function ensureShellSnapshot(): ShellSnapshot {
  if (!shellSnapshot) {
    shellSnapshot = createDefaultSnapshot()
  }

  return shellSnapshot
}

function commitShellSnapshot(nextSnapshot: ShellSnapshot): ShellSnapshot {
  shellSnapshot = nextSnapshot
  persistShellSnapshot(nextSnapshot)
  return getShellSnapshot()
}

function touchSession(session: ShellSession): ShellSession {
  return {
    ...session,
    updatedAt: '방금',
  }
}

function createSessionId(sessions: ShellSession[]): string {
  const maxNumericId = sessions.reduce((maxId, session) => {
    const match = /^sess-(\d+)$/.exec(session.id)
    if (!match) {
      return maxId
    }

    return Math.max(maxId, Number(match[1]))
  }, 0)

  return `sess-${String(maxNumericId + 1).padStart(3, '0')}`
}

function deriveSessionTitle(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return DEFAULT_SESSION_TITLE
  }

  return normalized.length > 40
    ? `${normalized.slice(0, 40).trimEnd()}…`
    : normalized
}

function reconcileSessionSelection(
  sessions: ShellSession[],
  previousActiveSessionId: string | null,
  nextActiveSessionId: string | null,
): ShellSession[] {
  if (previousActiveSessionId === nextActiveSessionId) {
    return sessions
  }

  return sessions.map((session) => {
    if (
      previousActiveSessionId
      && previousActiveSessionId !== nextActiveSessionId
      && session.id === previousActiveSessionId
      && session.status === 'active'
    ) {
      return touchSession({
        ...session,
        status: 'idle',
      })
    }

    if (nextActiveSessionId && session.id === nextActiveSessionId && !session.archivedAt) {
      if (session.status === 'idle') {
        return touchSession({
          ...session,
          status: 'active',
        })
      }

      return touchSession(session)
    }

    return session
  })
}

function createNextSession(sessions: ShellSession[], seed: CreateShellSessionSeed = {}): ShellSession {
  return {
    id: createSessionId(sessions),
    title: seed.title?.trim() || DEFAULT_SESSION_TITLE,
    status: 'active',
    model: seed.model ?? DEFAULT_SESSION_MODEL,
    updatedAt: '방금',
    archivedAt: null,
    pinned: seed.pinned ?? false,
    messageCount: 0,
    artifactCount: 0,
  }
}

function getFirstVisibleSessionId(sessions: ShellSession[]): string | null {
  return sessions.find((session) => !session.archivedAt)?.id ?? null
}

function createBranchedSessionTitle(sourceTitle: string, seed: BranchShellSessionSeed = {}): string {
  const explicitTitle = seed.title?.trim()
  if (explicitTitle) {
    return explicitTitle
  }

  const candidate = `${sourceTitle} ${BRANCH_SESSION_SUFFIX}`.trim()
  return candidate.length > 48
    ? `${candidate.slice(0, 48).trimEnd()}…`
    : candidate
}

function cloneSessionMessages(
  messages: ShellChatMessage[],
  sourceSessionId: string,
  targetSessionId: string,
  sourceMessageId?: string,
): ShellChatMessage[] | null {
  const sourceMessages = messages.filter((message) => message.sessionId === sourceSessionId)
  const slicedMessages = sourceMessageId
    ? (() => {
      const sourceMessageIndex = sourceMessages.findIndex((message) => message.id === sourceMessageId)
      if (sourceMessageIndex === -1) {
        return null
      }
      return sourceMessages.slice(0, sourceMessageIndex + 1)
    })()
    : sourceMessages

  if (!slicedMessages) {
    return null
  }

  return slicedMessages
    .map((message, index) => ({
      ...message,
      id: `msg-${targetSessionId}-${index + 1}`,
      sessionId: targetSessionId,
    }))
}

function cloneSessionArtifacts(
  artifacts: ShellArtifact[],
  sourceSessionId: string,
  targetSessionId: string,
): ShellArtifact[] {
  return artifacts
    .filter((artifact) => artifact.sessionId === sourceSessionId)
    .map((artifact, index) => ({
      ...artifact,
      id: `artifact-${targetSessionId}-${index + 1}`,
      sessionId: targetSessionId,
    }))
}

function cloneSessionReferences(
  references: ShellReference[],
  sourceSessionId: string,
  targetSessionId: string,
): ShellReference[] {
  return references
    .filter((reference) => reference.sessionId === sourceSessionId)
    .map((reference, index) => ({
      ...reference,
      id: `reference-${targetSessionId}-${index + 1}`,
      sessionId: targetSessionId,
    }))
}

function cloneSessionPreviews(
  previews: ShellPreview[],
  sourceSessionId: string,
  targetSessionId: string,
): ShellPreview[] {
  return previews
    .filter((preview) => preview.sessionId === sourceSessionId)
    .map((preview) => ({
      ...preview,
      sessionId: targetSessionId,
    }))
}

function getBranchSharedMessageCount(
  sourceMessages: ShellChatMessage[],
  branchedMessages: ShellChatMessage[],
  sourceMessageId?: string | null,
): number | null {
  if (sourceMessageId) {
    const sourceMessageIndex = sourceMessages.findIndex((message) => message.id === sourceMessageId)
    return sourceMessageIndex === -1 ? null : sourceMessageIndex + 1
  }

  let sharedCount = 0
  while (sharedCount < sourceMessages.length && sharedCount < branchedMessages.length) {
    const sourceMessage = sourceMessages[sharedCount]
    const branchedMessage = branchedMessages[sharedCount]
    if (!sourceMessage || !branchedMessage) {
      break
    }

    if (
      sourceMessage.role !== branchedMessage.role
      || sourceMessage.content !== branchedMessage.content
    ) {
      break
    }

    sharedCount += 1
  }

  return sharedCount
}

function rebaseSessionMessages(
  messages: ShellChatMessage[],
  targetSessionId: string,
  preservedIds: string[] = [],
): ShellChatMessage[] {
  return messages.map((message, index) => ({
    ...message,
    id: preservedIds[index] ?? `msg-${targetSessionId}-promoted-${index + 1}`,
    sessionId: targetSessionId,
  }))
}

function rebaseSessionArtifacts(
  artifacts: ShellArtifact[],
  targetSessionId: string,
): ShellArtifact[] {
  return artifacts.map((artifact, index) => ({
    ...artifact,
    id: `artifact-${targetSessionId}-promoted-${index + 1}`,
    sessionId: targetSessionId,
  }))
}

function rebaseSessionApprovals(
  approvals: ShellApproval[],
  targetSessionId: string,
): ShellApproval[] {
  return approvals.map((approval, index) => ({
    ...approval,
    id: `approval-${targetSessionId}-promoted-${index + 1}`,
    sessionId: targetSessionId,
  }))
}

function rebaseSessionReferences(
  references: ShellReference[],
  targetSessionId: string,
): ShellReference[] {
  return references.map((reference, index) => ({
    ...reference,
    id: `reference-${targetSessionId}-promoted-${index + 1}`,
    sessionId: targetSessionId,
  }))
}

function rebaseSessionPreviews(
  previews: ShellPreview[],
  targetSessionId: string,
): ShellPreview[] {
  return previews.map((preview) => ({
    ...preview,
    sessionId: targetSessionId,
  }))
}

function rebaseSessionRunSteps(
  runSteps: ShellRunStep[],
  targetSessionId: string,
): ShellRunStep[] {
  return runSteps.map((step, index) => ({
    ...step,
    id: `run-step-${targetSessionId}-promoted-${index + 1}`,
    sessionId: targetSessionId,
  }))
}

function rebaseSessionLogs(
  logs: ShellLog[],
  targetSessionId: string,
): ShellLog[] {
  return logs.map((log, index) => ({
    ...log,
    id: `log-${targetSessionId}-promoted-${index + 1}`,
    sessionId: targetSessionId,
  }))
}

export function initializeShellState(filePath: string): ShellSnapshot {
  shellSnapshotFilePath = filePath
  shellSnapshot = readPersistedShellSnapshot(filePath)
  persistShellSnapshot(shellSnapshot)
  return getShellSnapshot()
}

export function getShellSnapshot(): ShellSnapshot {
  return cloneSnapshot(ensureShellSnapshot())
}

export function setActiveShellSession(sessionId: string): ShellSnapshot {
  const current = ensureShellSnapshot()
  if (!current.sessions.some((session) => session.id === sessionId && !session.archivedAt)) {
    return getShellSnapshot()
  }

  return commitShellSnapshot({
    ...current,
    activeSessionId: sessionId,
    sessions: reconcileSessionSelection(current.sessions, current.activeSessionId, sessionId),
  })
}

export function createShellSession(seed: CreateShellSessionSeed = {}): ShellSnapshot {
  const current = ensureShellSnapshot()
  const nextSession = createNextSession(current.sessions, seed)
  const nextSessionId = nextSession.id

  return commitShellSnapshot({
    ...current,
    activeSessionId: nextSessionId,
    sessions: [
      nextSession,
      ...reconcileSessionSelection(current.sessions, current.activeSessionId, nextSessionId),
    ],
  })
}

export function branchShellSession(sessionId: string, seed: BranchShellSessionSeed = {}): ShellSnapshot {
  const current = ensureShellSnapshot()
  const sourceSession = current.sessions.find((session) => session.id === sessionId)
  if (!sourceSession) {
    return getShellSnapshot()
  }

  const branchedSessionId = createSessionId(current.sessions)
  const clonedMessages = cloneSessionMessages(
    current.messages,
    sourceSession.id,
    branchedSessionId,
    seed.sourceMessageId,
  )
  if (!clonedMessages) {
    return getShellSnapshot()
  }

  const cloneSessionOutputs = !seed.sourceMessageId
  const clonedArtifacts = cloneSessionOutputs
    ? cloneSessionArtifacts(current.artifacts, sourceSession.id, branchedSessionId)
    : []
  const clonedReferences = cloneSessionReferences(current.references, sourceSession.id, branchedSessionId)
  const clonedPreviews = cloneSessionOutputs
    ? cloneSessionPreviews(current.previews, sourceSession.id, branchedSessionId)
    : []
  const branchedSession: ShellSession = {
    ...sourceSession,
    id: branchedSessionId,
    title: createBranchedSessionTitle(sourceSession.title, seed),
    status: 'active',
    model: seed.model ?? sourceSession.model,
    updatedAt: '방금',
    archivedAt: null,
    branchedFromSessionId: sourceSession.id,
    branchedFromMessageId: seed.sourceMessageId ?? null,
    pinned: seed.pinned ?? sourceSession.pinned,
    messageCount: clonedMessages.length,
    artifactCount: clonedArtifacts.length,
    preview: clonedPreviews.length > 0 ? sourceSession.preview : undefined,
  }

  return commitShellSnapshot({
    ...current,
    activeSessionId: branchedSessionId,
    sessions: [
      branchedSession,
      ...reconcileSessionSelection(current.sessions, current.activeSessionId, branchedSessionId),
    ],
    messages: [
      ...current.messages,
      ...clonedMessages,
    ],
    artifacts: [
      ...current.artifacts,
      ...clonedArtifacts,
    ],
    references: [
      ...current.references,
      ...clonedReferences,
    ],
    previews: [
      ...current.previews,
      ...clonedPreviews,
    ],
  })
}

export function promoteShellSession(sessionId: string): ShellSnapshot {
  const current = ensureShellSnapshot()
  const branchSession = current.sessions.find((session) => session.id === sessionId)
  if (!branchSession?.branchedFromSessionId || branchSession.status === 'running') {
    return getShellSnapshot()
  }

  const sourceSession = current.sessions.find((session) => session.id === branchSession.branchedFromSessionId)
  if (!sourceSession) {
    return getShellSnapshot()
  }

  const sourceMessages = current.messages.filter((message) => message.sessionId === sourceSession.id)
  const branchedMessages = current.messages.filter((message) => message.sessionId === branchSession.id)
  const sharedMessageCount = getBranchSharedMessageCount(
    sourceMessages,
    branchedMessages,
    branchSession.branchedFromMessageId,
  )
  if (sharedMessageCount === null) {
    return getShellSnapshot()
  }

  const promotedMessages = rebaseSessionMessages(
    branchedMessages,
    sourceSession.id,
    sourceMessages.slice(0, sharedMessageCount).map((message) => message.id),
  )
  const promotedArtifacts = rebaseSessionArtifacts(
    current.artifacts.filter((artifact) => artifact.sessionId === branchSession.id),
    sourceSession.id,
  )
  const promotedApprovals = rebaseSessionApprovals(
    current.approvals.filter((approval) => approval.sessionId === branchSession.id),
    sourceSession.id,
  )
  const promotedReferences = rebaseSessionReferences(
    current.references.filter((reference) => reference.sessionId === branchSession.id),
    sourceSession.id,
  )
  const promotedPreviews = rebaseSessionPreviews(
    current.previews.filter((preview) => preview.sessionId === branchSession.id),
    sourceSession.id,
  )
  const promotedRunSteps = rebaseSessionRunSteps(
    current.runSteps.filter((step) => step.sessionId === branchSession.id),
    sourceSession.id,
  )
  const promotedLogs = [
    ...rebaseSessionLogs(
      current.logs.filter((log) => log.sessionId === branchSession.id),
      sourceSession.id,
    ),
    {
      id: `log-${sourceSession.id}-promoted-audit`,
      sessionId: sourceSession.id,
      ts: '방금',
      level: 'info' as const,
      message: `분기본 승격: ${branchSession.title}`,
    },
  ]
  const promotedSourceStatus = branchSession.status === 'failed' || branchSession.status === 'approval_pending'
    ? branchSession.status
    : 'active'

  return commitShellSnapshot({
    ...current,
    activeSessionId: sourceSession.id,
    sessions: current.sessions.map((session) => {
      if (session.id === sourceSession.id) {
        return touchSession({
          ...sourceSession,
          status: promotedSourceStatus,
          model: branchSession.model,
          archivedAt: null,
          messageCount: promotedMessages.length,
          artifactCount: promotedArtifacts.length,
          preview: promotedPreviews.length > 0 ? branchSession.preview : undefined,
        })
      }

      if (session.id === branchSession.id) {
        return touchSession({
          ...branchSession,
          status: 'idle',
        })
      }

      if (
        current.activeSessionId
        && session.id === current.activeSessionId
        && session.status === 'active'
      ) {
        return touchSession({
          ...session,
          status: 'idle',
        })
      }

      return session
    }),
    runSteps: [
      ...current.runSteps.filter((step) => step.sessionId !== sourceSession.id),
      ...promotedRunSteps,
    ],
    artifacts: [
      ...current.artifacts.filter((artifact) => artifact.sessionId !== sourceSession.id),
      ...promotedArtifacts,
    ],
    approvals: [
      ...current.approvals.filter((approval) => approval.sessionId !== sourceSession.id),
      ...promotedApprovals,
    ],
    logs: [
      ...current.logs.filter((log) => log.sessionId !== sourceSession.id),
      ...promotedLogs,
    ],
    messages: [
      ...current.messages.filter((message) => message.sessionId !== sourceSession.id),
      ...promotedMessages,
    ],
    references: [
      ...current.references.filter((reference) => reference.sessionId !== sourceSession.id),
      ...promotedReferences,
    ],
    previews: [
      ...current.previews.filter((preview) => preview.sessionId !== sourceSession.id),
      ...promotedPreviews,
    ],
  })
}

export function archiveShellSession(sessionId: string): ShellSnapshot {
  const current = ensureShellSnapshot()
  const target = current.sessions.find((session) => session.id === sessionId)
  if (!target || target.archivedAt) {
    return getShellSnapshot()
  }

  let nextSessions = current.sessions.map((session) => (
    session.id === sessionId
      ? touchSession({
        ...session,
        archivedAt: '방금',
        status: 'idle',
      })
      : session
  ))

  let nextActiveSessionId = current.activeSessionId === sessionId
    ? getFirstVisibleSessionId(nextSessions)
    : current.activeSessionId

  if (!nextActiveSessionId) {
    const fallbackSession = createNextSession(nextSessions)
    nextSessions = [fallbackSession, ...nextSessions]
    nextActiveSessionId = fallbackSession.id
  }

  return commitShellSnapshot({
    ...current,
    activeSessionId: nextActiveSessionId,
    sessions:
      nextActiveSessionId === current.activeSessionId
        ? nextSessions
        : reconcileSessionSelection(nextSessions, current.activeSessionId, nextActiveSessionId),
  })
}

export function restoreShellSession(sessionId: string): ShellSnapshot {
  const current = ensureShellSnapshot()
  if (!current.sessions.some((session) => session.id === sessionId && session.archivedAt)) {
    return getShellSnapshot()
  }

  return commitShellSnapshot({
    ...current,
    sessions: current.sessions.map((session) => (
      session.id === sessionId
        ? touchSession({
          ...session,
          archivedAt: null,
        })
        : session
    )),
  })
}

export function appendShellMessage(sessionId: string, message: ShellChatMessage): ShellSnapshot {
  const current = ensureShellSnapshot()
  return commitShellSnapshot({
    ...current,
    activeSessionId: sessionId,
    messages: [...current.messages, message],
    sessions: current.sessions.map((session) => (
      session.id === sessionId
        ? touchSession({
          ...session,
          title:
            message.role === 'user' && (session.messageCount === 0 || session.title === DEFAULT_SESSION_TITLE)
              ? deriveSessionTitle(message.content)
              : session.title,
          status:
            message.role === 'user' && session.status === 'idle'
              ? 'active'
              : session.status,
          messageCount: session.messageCount + 1,
        })
        : session
    )),
  })
}

export function updateShellSession(sessionId: string, patch: Partial<ShellSession>): ShellSnapshot {
  const current = ensureShellSnapshot()
  return commitShellSnapshot({
    ...current,
    sessions: current.sessions.map((session) => (
      session.id === sessionId
        ? { ...session, ...patch }
        : session
    )),
  })
}

export function appendShellRunStep(step: ShellRunStep): ShellSnapshot {
  const current = ensureShellSnapshot()
  return commitShellSnapshot({
    ...current,
    runSteps: [...current.runSteps, step],
    sessions: current.sessions.map((session) => (
      session.id === step.sessionId
        ? touchSession(session)
        : session
    )),
  })
}

export function updateShellRunStep(stepId: string, patch: Partial<ShellRunStep>): ShellSnapshot {
  const current = ensureShellSnapshot()
  return commitShellSnapshot({
    ...current,
    runSteps: current.runSteps.map((step) => (
      step.id === stepId
        ? { ...step, ...patch }
        : step
    )),
  })
}

export function appendShellLog(log: ShellLog): ShellSnapshot {
  const current = ensureShellSnapshot()
  return commitShellSnapshot({
    ...current,
    logs: [...current.logs, log],
    sessions: current.sessions.map((session) => (
      session.id === log.sessionId
        ? touchSession(session)
        : session
    )),
  })
}

export function appendShellArtifact(artifact: ShellArtifact): ShellSnapshot {
  const current = ensureShellSnapshot()
  return commitShellSnapshot({
    ...current,
    artifacts: [...current.artifacts, artifact],
    sessions: current.sessions.map((session) => (
      session.id === artifact.sessionId
        ? touchSession({
          ...session,
          artifactCount: session.artifactCount + 1,
        })
        : session
    )),
  })
}

export function resetShellStateForTests(): void {
  shellSnapshot = null
  shellSnapshotFilePath = null
}
