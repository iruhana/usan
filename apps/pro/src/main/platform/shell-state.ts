import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type {
  ApprovalDecision,
  BranchShellSessionSeed,
  CreateShellSessionSeed,
  ShellApproval,
  ShellAttachment,
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
import {
  getShellSnapshotDatabasePath,
  persistShellSnapshotToDatabase,
  readShellSnapshotFromDatabase,
  resetShellSnapshotDatabaseForTests,
} from './storage/shell-db'

let shellSnapshot: ShellSnapshot | null = null
let shellSnapshotFilePath: string | null = null
let shellSnapshotDatabasePath: string | null = null
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
    && (candidate.attachments === undefined || Array.isArray(candidate.attachments))
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
  if (shellSnapshotDatabasePath) {
    persistShellSnapshotToDatabase(shellSnapshotDatabasePath, snapshot)
  }

  if (!shellSnapshotFilePath) {
    return
  }

  writeShellSnapshotToDisk(shellSnapshotFilePath, snapshot)
}

function readLegacyShellSnapshot(filePath: string): ShellSnapshot {
  if (!existsSync(filePath)) {
    return createDefaultSnapshot()
  }

  try {
    const raw = readFileSync(filePath, 'utf8')
    const parsed = raw ? JSON.parse(raw) : null
    if (!isShellSnapshot(parsed)) {
      throw new Error('Persisted shell snapshot shape is invalid')
    }
    return cloneSnapshot({
      ...parsed,
      attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
    })
  } catch {
    archiveCorruptSnapshot(filePath)
    return createDefaultSnapshot()
  }
}

function readPersistedShellSnapshot(filePath: string, dbPath: string): ShellSnapshot {
  const snapshotFromDatabase = readShellSnapshotFromDatabase(dbPath)
  if (snapshotFromDatabase) {
    return snapshotFromDatabase
  }

  const legacySnapshot = readLegacyShellSnapshot(filePath)
  persistShellSnapshotToDatabase(dbPath, legacySnapshot)
  writeShellSnapshotToDisk(filePath, legacySnapshot)
  return legacySnapshot
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

function createTimeLabel(): string {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date())
}

function reconcileApprovalStatus(
  session: ShellSession,
  approvals: ShellApproval[],
): ShellSession {
  const hasPendingApproval = approvals.some((approval) => (
    approval.sessionId === session.id && approval.status === 'pending'
  ))

  if (hasPendingApproval) {
    return touchSession({
      ...session,
      status: 'approval_pending',
    })
  }

  if (session.status === 'approval_pending') {
    return touchSession({
      ...session,
      status: 'active',
    })
  }

  return session
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

function getSessionMessagesForBranch(
  messages: ShellChatMessage[],
  sourceSessionId: string,
  sourceMessageId?: string,
): ShellChatMessage[] | null {
  const sourceMessages = messages.filter((message) => message.sessionId === sourceSessionId)
  if (!sourceMessageId) {
    return sourceMessages
  }

  const sourceMessageIndex = sourceMessages.findIndex((message) => message.id === sourceMessageId)
  if (sourceMessageIndex === -1) {
    return null
  }

  return sourceMessages.slice(0, sourceMessageIndex + 1)
}

function cloneSessionMessages(
  messages: ShellChatMessage[],
  targetSessionId: string,
): ShellChatMessage[] {
  return messages.map((message, index) => ({
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

function cloneSessionAttachments(
  attachments: ShellAttachment[],
  sourceSessionId: string,
  targetSessionId: string,
  messageIdMap: ReadonlyMap<string, string>,
  includeUnbound: boolean,
): ShellAttachment[] {
  return attachments
    .filter((attachment) => {
      if (attachment.sessionId !== sourceSessionId) {
        return false
      }

      if (!attachment.messageId) {
        return includeUnbound
      }

      return messageIdMap.has(attachment.messageId)
    })
    .map((attachment, index) => ({
      ...attachment,
      id: `attachment-${targetSessionId}-${index + 1}`,
      sessionId: targetSessionId,
      messageId: attachment.messageId ? messageIdMap.get(attachment.messageId) : undefined,
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

function rebaseSessionAttachments(
  attachments: ShellAttachment[],
  targetSessionId: string,
  messageIdMap: ReadonlyMap<string, string>,
): ShellAttachment[] {
  return attachments.map((attachment, index) => ({
    ...attachment,
    id: `attachment-${targetSessionId}-promoted-${index + 1}`,
    sessionId: targetSessionId,
    messageId: attachment.messageId ? messageIdMap.get(attachment.messageId) : undefined,
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
  shellSnapshotDatabasePath = getShellSnapshotDatabasePath(filePath)
  shellSnapshot = readPersistedShellSnapshot(filePath, shellSnapshotDatabasePath)
  persistShellSnapshot(shellSnapshot)
  return getShellSnapshot()
}

export function getShellSnapshot(): ShellSnapshot {
  return cloneSnapshot(ensureShellSnapshot())
}

export function replaceShellSnapshot(nextSnapshot: ShellSnapshot): ShellSnapshot {
  return commitShellSnapshot(cloneSnapshot(nextSnapshot))
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
  const sourceBranchMessages = getSessionMessagesForBranch(
    current.messages,
    sourceSession.id,
    seed.sourceMessageId,
  )
  if (!sourceBranchMessages) {
    return getShellSnapshot()
  }
  const clonedMessages = cloneSessionMessages(sourceBranchMessages, branchedSessionId)
  const messageIdMap = new Map(
    sourceBranchMessages.map((message, index) => [message.id, clonedMessages[index]?.id ?? message.id]),
  )

  const cloneSessionOutputs = !seed.sourceMessageId
  const clonedAttachments = cloneSessionAttachments(
    current.attachments,
    sourceSession.id,
    branchedSessionId,
    messageIdMap,
    cloneSessionOutputs,
  )
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
    attachments: [
      ...current.attachments,
      ...clonedAttachments,
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
  const promotedMessageIdMap = new Map(
    branchedMessages
      .map((message, index) => [message.id, promotedMessages[index]?.id])
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
  const promotedAttachments = rebaseSessionAttachments(
    current.attachments.filter((attachment) => attachment.sessionId === branchSession.id),
    sourceSession.id,
    promotedMessageIdMap,
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
    attachments: [
      ...current.attachments.filter((attachment) => attachment.sessionId !== sourceSession.id),
      ...promotedAttachments,
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

export function appendShellAttachment(attachment: ShellAttachment): ShellSnapshot {
  const current = ensureShellSnapshot()
  return commitShellSnapshot({
    ...current,
    attachments: [...current.attachments, attachment],
    sessions: current.sessions.map((session) => (
      session.id === attachment.sessionId
        ? touchSession(session)
        : session
    )),
  })
}

export function removeShellAttachment(attachmentId: string): ShellSnapshot {
  const current = ensureShellSnapshot()
  const targetAttachment = current.attachments.find((attachment) => attachment.id === attachmentId)
  if (!targetAttachment) {
    return getShellSnapshot()
  }

  return commitShellSnapshot({
    ...current,
    attachments: current.attachments.filter((attachment) => attachment.id !== attachmentId),
    sessions: current.sessions.map((session) => (
      session.id === targetAttachment.sessionId
        ? touchSession(session)
        : session
    )),
  })
}

export function commitShellAttachments(
  sessionId: string,
  attachmentIds: string[],
  messageId: string,
): ShellSnapshot {
  if (attachmentIds.length === 0) {
    return getShellSnapshot()
  }

  const current = ensureShellSnapshot()
  const attachmentIdSet = new Set(attachmentIds)
  let changed = false
  const nextAttachments: ShellAttachment[] = current.attachments.map((attachment) => {
    if (
      attachment.sessionId !== sessionId
      || !attachmentIdSet.has(attachment.id)
      || attachment.status !== 'staged'
    ) {
      return attachment
    }

    changed = true
    return {
      ...attachment,
      status: 'sent' as const,
      messageId,
    }
  })

  if (!changed) {
    return getShellSnapshot()
  }

  return commitShellSnapshot({
    ...current,
    attachments: nextAttachments,
    sessions: current.sessions.map((session) => (
      session.id === sessionId
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

export function appendShellApproval(approval: ShellApproval): ShellSnapshot {
  const current = ensureShellSnapshot()
  const nextApprovals = [...current.approvals, approval]

  return commitShellSnapshot({
    ...current,
    approvals: nextApprovals,
    runSteps: approval.stepId
      ? current.runSteps.map((step) => (
        step.id === approval.stepId
          ? { ...step, status: 'approval_needed', detail: approval.detail }
          : step
      ))
      : current.runSteps,
    sessions: current.sessions.map((session) => (
      session.id === approval.sessionId
        ? reconcileApprovalStatus(session, nextApprovals)
        : session
    )),
  })
}

export function resolveShellApproval(
  approvalId: string,
  decision: ApprovalDecision,
): ShellSnapshot {
  const current = ensureShellSnapshot()
  const approval = current.approvals.find((item) => item.id === approvalId)
  if (!approval || approval.status !== 'pending') {
    return getShellSnapshot()
  }

  const nextApprovals = current.approvals.map((item) => (
    item.id === approvalId
      ? {
        ...item,
        status: decision,
      }
      : item
  ))
  const resolutionDetail = decision === 'approved'
    ? `Approval granted: ${approval.capability}`
    : `Approval denied: ${approval.capability}`

  return commitShellSnapshot({
    ...current,
    approvals: nextApprovals,
    runSteps: approval.stepId
      ? current.runSteps.map((step) => (
        step.id === approval.stepId
          ? {
            ...step,
            status: decision === 'approved' ? 'running' : 'skipped',
            detail: decision === 'denied' && approval.fallback
              ? `${resolutionDetail}. ${approval.fallback}`
              : resolutionDetail,
          }
          : step
      ))
      : current.runSteps,
    logs: [
      ...current.logs,
      {
        id: `log-${approvalId}-${decision}`,
        sessionId: approval.sessionId,
        ts: createTimeLabel(),
        level: decision === 'approved' ? 'info' : 'warn',
        message: `${decision === 'approved' ? 'Approval approved' : 'Approval denied'}: ${approval.action}`,
        kind: 'approval',
        status: decision,
        capability: approval.capability,
        stepId: approval.stepId,
        approvalId,
      },
    ],
    sessions: current.sessions.map((session) => (
      session.id === approval.sessionId
        ? reconcileApprovalStatus(session, nextApprovals)
        : session
    )),
  })
}

export function resetShellStateForTests(): void {
  shellSnapshot = null
  shellSnapshotFilePath = null
  shellSnapshotDatabasePath = null
  resetShellSnapshotDatabaseForTests()
}
