import { vi } from 'vitest'
import type {
  AppSettings,
  BranchShellSessionSeed,
  ChatPayload,
  CreateShellSessionSeed,
  ProviderSecretsSnapshot,
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
  StreamChunk,
} from '@shared/types'
import { DEFAULT_APP_SETTINGS } from '@shared/types'

interface RequestRuntime {
  sessionId: string
  streamedText: string
  toolStepCount: number
  pendingToolSteps: Map<string, string>
  completed: boolean
}

const DEFAULT_SESSION_TITLE = '새 세션'
const BRANCH_SESSION_SUFFIX = '분기본'

function createTimeLabel(): string {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date())
}

function summarizeValue(value: unknown): string {
  if (typeof value === 'string') {
    return value.length > 120 ? `${value.slice(0, 117)}...` : value
  }

  try {
    const serialized = JSON.stringify(value)
    return serialized.length > 120 ? `${serialized.slice(0, 117)}...` : serialized
  } catch {
    return 'Value is not serializable'
  }
}

function createArtifactTitle(sessionArtifactCount: number): string {
  return `assistant-response-${String(sessionArtifactCount + 1).padStart(3, '0')}.md`
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

function createNextSession(sessions: ShellSession[], seed?: CreateShellSessionSeed): ShellSession {
  return {
    id: createSessionId(sessions),
    title: seed?.title?.trim() || DEFAULT_SESSION_TITLE,
    status: 'active',
    model: seed?.model ?? 'claude-sonnet-4-6',
    updatedAt: 'Just now',
    archivedAt: null,
    pinned: seed?.pinned ?? false,
    messageCount: 0,
    artifactCount: 0,
  }
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

function createBranchedSessionTitle(sourceTitle: string, seed?: BranchShellSessionSeed): string {
  const explicitTitle = seed?.title?.trim()
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

function createShellSnapshot(): ShellSnapshot {
  return {
    activeSessionId: 'sess-001',
    sessions: [
      {
        id: 'sess-001',
        title: 'Cafe landing page build',
        status: 'active',
        model: 'claude-sonnet-4-6',
        updatedAt: '2m ago',
        pinned: true,
        messageCount: 4,
        artifactCount: 1,
      },
    ],
    runSteps: [
      { id: 'step-1', sessionId: 'sess-001', label: 'Project analysis', status: 'success', durationMs: 1000 },
    ],
    attachments: [],
    artifacts: [
      {
        id: 'art-001',
        title: 'Hero.tsx',
        kind: 'code',
        sessionId: 'sess-001',
        createdAt: '5m ago',
        size: '2.4 KB',
        version: 3,
        content: 'export default function Hero() { return null }',
      },
    ],
    approvals: [],
    logs: [
      {
        id: 'log-001',
        sessionId: 'sess-001',
        ts: '14:32:01',
        level: 'info',
        message: 'Session started',
      },
    ],
    templates: [
      {
        id: 'tmpl-001',
        emoji: 'P',
        title: 'Landing page',
        description: 'Build a polished product landing page quickly',
        category: 'page',
      },
    ],
    messages: [
      {
        id: 'msg-001',
        sessionId: 'sess-001',
        role: 'user',
        content: 'Build a landing page for our cafe.',
        ts: Date.now(),
      },
    ],
    references: [
      {
        id: 'ref-001',
        sessionId: 'sess-001',
        type: 'file',
        title: 'src/App.tsx',
        detail: '42 lines - root component',
      },
    ],
    previews: [
      {
        sessionId: 'sess-001',
        title: 'page-preview',
        status: 'healthy',
        version: 3,
      },
    ],
  }
}

export function installMockUsan(options?: {
  snapshot?: ShellSnapshot
  settings?: AppSettings
  secrets?: ProviderSecretsSnapshot
}) {
  let snapshot = structuredClone({
    ...(options?.snapshot ?? createShellSnapshot()),
    attachments: options?.snapshot?.attachments ?? [],
  })
  const chunkListeners = new Set<(chunk: StreamChunk) => void>()
  const shellListeners = new Set<(shellSnapshot: ShellSnapshot) => void>()
  const runtimes = new Map<string, RequestRuntime>()
  let settings = {
    ...DEFAULT_APP_SETTINGS,
    onboardingDismissed: true,
    ...(options?.settings ?? {}),
  }
  let secrets = structuredClone(options?.secrets ?? {
    encryptionAvailable: true,
    providers: [
      { provider: 'anthropic', configured: true, source: 'secure_store' },
      { provider: 'openai', configured: true, source: 'secure_store' },
      { provider: 'google', configured: true, source: 'secure_store' },
    ],
  })

  function notifyShellSnapshot(): void {
    const nextSnapshot = structuredClone(snapshot)
    for (const listener of shellListeners) {
      listener(nextSnapshot)
    }
  }

  function notifyChunk(chunk: StreamChunk): void {
    for (const listener of chunkListeners) {
      listener(chunk)
    }
  }

  function touchSession(session: ShellSession): ShellSession {
    return {
      ...session,
      updatedAt: 'Just now',
    }
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

  function updateSnapshot(mutator: (current: ShellSnapshot) => ShellSnapshot): ShellSnapshot {
    snapshot = mutator(snapshot)
    notifyShellSnapshot()
    return structuredClone(snapshot)
  }

  function appendAssistantResponse(requestId: string, runtime: RequestRuntime): void {
    if (!runtime.streamedText.trim()) {
      return
    }

    updateSnapshot((current) => ({
      ...current,
      messages: [
        ...current.messages,
        {
          id: `msg-${requestId}-assistant`,
          sessionId: runtime.sessionId,
          role: 'assistant',
          content: runtime.streamedText,
          ts: Date.now(),
        },
      ],
      sessions: current.sessions.map((session) => (
        session.id === runtime.sessionId
          ? touchSession({
            ...session,
            messageCount: session.messageCount + 1,
          })
          : session
      )),
    }))

    const session = snapshot.sessions.find((item) => item.id === runtime.sessionId)
    const artifact: ShellArtifact = {
      id: `artifact-${requestId}`,
      sessionId: runtime.sessionId,
      title: createArtifactTitle(session?.artifactCount ?? 0),
      kind: 'markdown',
      createdAt: 'Just now',
      size: `${Math.max(1, Math.ceil(runtime.streamedText.length / 1024))} KB`,
      version: 1,
      content: runtime.streamedText,
    }

    updateSnapshot((current) => ({
      ...current,
      artifacts: [...current.artifacts, artifact],
      sessions: current.sessions.map((item) => (
        item.id === runtime.sessionId
          ? touchSession({
            ...item,
            artifactCount: item.artifactCount + 1,
          })
          : item
      )),
    }))
    notifyChunk({ requestId, type: 'artifact', artifact })
  }

  function finalizeRequest(
    requestId: string,
    patch: { status: ShellRunStep['status']; detail?: string },
    log: ShellLog,
    sessionPatch: Partial<ShellSession>,
    commitAssistant: boolean,
  ): void {
    const runtime = runtimes.get(requestId)
    if (!runtime || runtime.completed) {
      return
    }

    if (commitAssistant) {
      appendAssistantResponse(requestId, runtime)
    }

    for (const stepId of runtime.pendingToolSteps.values()) {
      updateSnapshot((current) => ({
        ...current,
        runSteps: current.runSteps.map((step) => (
          step.id === stepId
            ? { ...step, status: patch.status, detail: patch.detail }
            : step
        )),
      }))
    }

    updateSnapshot((current) => ({
      ...current,
      runSteps: current.runSteps.map((step) => (
        step.id === `step-${requestId}`
          ? { ...step, ...patch }
          : step
      )),
    }))
    updateSnapshot((current) => ({
      ...current,
      logs: [...current.logs, log],
      sessions: current.sessions.map((session) => (
        session.id === runtime.sessionId
          ? touchSession({
            ...session,
            ...sessionPatch,
          })
          : session
      )),
    }))

    runtime.completed = true
    runtimes.delete(requestId)
  }

  function beginRequest(payload: ChatPayload): void {
    runtimes.set(payload.requestId, {
      sessionId: payload.sessionId,
      streamedText: '',
      toolStepCount: 0,
      pendingToolSteps: new Map(),
      completed: false,
    })

    updateSnapshot((current) => ({
      ...current,
      activeSessionId: payload.sessionId,
      messages: [
        ...current.messages,
        {
          id: payload.userMessage.id,
          sessionId: payload.sessionId,
          role: 'user',
          content: payload.userMessage.content,
          ts: payload.userMessage.ts,
        },
      ],
      sessions: current.sessions.map((session) => (
        session.id === payload.sessionId
          ? touchSession({
            ...session,
            title:
              session.messageCount === 0 || session.title === DEFAULT_SESSION_TITLE
                ? deriveSessionTitle(payload.userMessage.content)
                : session.title,
            status: 'running',
            model: payload.model,
            messageCount: session.messageCount + 1,
          })
          : session
      )),
      runSteps: [
        ...current.runSteps,
        {
          id: `step-${payload.requestId}`,
          sessionId: payload.sessionId,
          label: 'Generate AI response',
          status: 'running',
          detail: `${payload.model} response started`,
        },
      ],
      logs: [
        ...current.logs,
        {
          id: `log-${payload.requestId}-start`,
          sessionId: payload.sessionId,
          ts: createTimeLabel(),
          level: 'info',
          message: `Request started with ${payload.model}`,
          kind: 'session',
          status: 'running',
        },
      ],
    }))
  }

  const api = {
    tabs: {
      switch: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
    },
    ai: {
      chat: vi.fn().mockImplementation(async (payload: ChatPayload) => {
        beginRequest(payload)
        return null
      }),
      stop: vi.fn().mockImplementation(async (requestId: string) => {
        const runtime = runtimes.get(requestId)
        if (!runtime || runtime.completed) {
          return
        }

        finalizeRequest(
          requestId,
          {
            status: 'skipped',
            detail: 'Generation stopped by user',
          },
          {
            id: `log-${requestId}-stopped`,
            sessionId: runtime.sessionId,
            ts: createTimeLabel(),
            level: 'warn',
            message: 'Generation stopped by user',
            kind: 'session',
            status: 'skipped',
          },
          { status: 'active' },
          true,
        )
        notifyChunk({ requestId, type: 'done' })
      }),
      onChunk: vi.fn().mockImplementation((cb: (chunk: StreamChunk) => void) => {
        chunkListeners.add(cb)
        return () => {
          chunkListeners.delete(cb)
        }
      }),
    },
    skills: {
      list: vi.fn().mockResolvedValue([]),
      read: vi.fn().mockResolvedValue(''),
      reindex: vi.fn().mockResolvedValue({ count: 0 }),
    },
    shell: {
      getSnapshot: vi.fn().mockImplementation(async () => structuredClone(snapshot)),
      setActiveSession: vi.fn().mockImplementation(async (sessionId: string) => updateSnapshot((current) => {
        if (!current.sessions.some((session) => session.id === sessionId && !session.archivedAt)) {
          return current
        }

        return {
          ...current,
          activeSessionId: sessionId,
          sessions: reconcileSessionSelection(current.sessions, current.activeSessionId, sessionId),
        }
      })),
      createSession: vi.fn().mockImplementation(async (seed?: CreateShellSessionSeed) => updateSnapshot((current) => {
        const nextSession = createNextSession(current.sessions, seed)
        const nextSessionId = nextSession.id

        return {
          ...current,
          activeSessionId: nextSessionId,
          sessions: [
            nextSession,
            ...reconcileSessionSelection(current.sessions, current.activeSessionId, nextSessionId),
          ],
        }
      })),
      branchSession: vi.fn().mockImplementation(async (sessionId: string, seed?: BranchShellSessionSeed) => updateSnapshot((current) => {
        const sourceSession = current.sessions.find((session) => session.id === sessionId)
        if (!sourceSession) {
          return current
        }

        const branchedSessionId = createSessionId(current.sessions)
        const clonedMessages = cloneSessionMessages(
          current.messages,
          sourceSession.id,
          branchedSessionId,
          seed?.sourceMessageId,
        )
        if (!clonedMessages) {
          return current
        }

        const messageIdMap = new Map(
          current.messages
            .filter((message) => message.sessionId === sourceSession.id)
            .slice(0, clonedMessages.length)
            .map((message, index) => [message.id, clonedMessages[index]?.id ?? message.id]),
        )
        const cloneSessionOutputs = !seed?.sourceMessageId
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
          model: seed?.model ?? sourceSession.model,
          updatedAt: 'Just now',
          archivedAt: null,
          branchedFromSessionId: sourceSession.id,
          branchedFromMessageId: seed?.sourceMessageId ?? null,
          pinned: seed?.pinned ?? sourceSession.pinned,
          messageCount: clonedMessages.length,
          artifactCount: clonedArtifacts.length,
          preview: clonedPreviews.length > 0 ? sourceSession.preview : undefined,
        }

        return {
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
        }
      })),
      promoteSession: vi.fn().mockImplementation(async (sessionId: string) => updateSnapshot((current) => {
        const branchSession = current.sessions.find((session) => session.id === sessionId)
        if (!branchSession?.branchedFromSessionId || branchSession.status === 'running') {
          return current
        }

        const sourceSession = current.sessions.find((session) => session.id === branchSession.branchedFromSessionId)
        if (!sourceSession) {
          return current
        }

        const sourceMessages = current.messages.filter((message) => message.sessionId === sourceSession.id)
        const branchedMessages = current.messages.filter((message) => message.sessionId === branchSession.id)
        const sharedMessageCount = getBranchSharedMessageCount(
          sourceMessages,
          branchedMessages,
          branchSession.branchedFromMessageId,
        )
        if (sharedMessageCount === null) {
          return current
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

        return {
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
        }
      })),
      archiveSession: vi.fn().mockImplementation(async (sessionId: string) => updateSnapshot((current) => {
        const target = current.sessions.find((session) => session.id === sessionId)
        if (!target || target.archivedAt) {
          return current
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
          ? nextSessions.find((session) => !session.archivedAt)?.id ?? null
          : current.activeSessionId

        if (!nextActiveSessionId) {
          const fallbackSession = createNextSession(nextSessions)
          nextSessions = [fallbackSession, ...nextSessions]
          nextActiveSessionId = fallbackSession.id
        }

        return {
          ...current,
          activeSessionId: nextActiveSessionId,
          sessions:
            nextActiveSessionId === current.activeSessionId
              ? nextSessions
              : reconcileSessionSelection(nextSessions, current.activeSessionId, nextActiveSessionId),
        }
      })),
      restoreSession: vi.fn().mockImplementation(async (sessionId: string) => updateSnapshot((current) => ({
        ...current,
        sessions: current.sessions.map((session) => (
          session.id === sessionId && session.archivedAt
            ? touchSession({
              ...session,
              archivedAt: null,
            })
            : session
        )),
      }))),
      appendMessage: vi.fn().mockImplementation(async (sessionId: string, message: ShellChatMessage) => updateSnapshot((current) => ({
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
      }))),
      updateSession: vi.fn().mockImplementation(async (sessionId: string, patch: Partial<ShellSession>) => updateSnapshot((current) => ({
        ...current,
        sessions: current.sessions.map((session) => (
          session.id === sessionId
            ? { ...session, ...patch }
            : session
        )),
      }))),
      appendRunStep: vi.fn().mockImplementation(async (step: ShellRunStep) => updateSnapshot((current) => ({
        ...current,
        runSteps: [...current.runSteps, step],
        sessions: current.sessions.map((session) => (
          session.id === step.sessionId
            ? touchSession(session)
            : session
        )),
      }))),
      updateRunStep: vi.fn().mockImplementation(async (stepId: string, patch: Partial<ShellRunStep>) => updateSnapshot((current) => ({
        ...current,
        runSteps: current.runSteps.map((step) => (
          step.id === stepId
            ? { ...step, ...patch }
            : step
        )),
      }))),
      appendLog: vi.fn().mockImplementation(async (log: ShellLog) => updateSnapshot((current) => ({
        ...current,
        logs: [...current.logs, log],
        sessions: current.sessions.map((session) => (
          session.id === log.sessionId
            ? touchSession(session)
            : session
        )),
      }))),
      appendAttachment: vi.fn().mockImplementation(async (attachment: ShellAttachment) => updateSnapshot((current) => ({
        ...current,
        attachments: [...current.attachments, attachment],
        sessions: current.sessions.map((session) => (
          session.id === attachment.sessionId
            ? touchSession(session)
            : session
        )),
      }))),
      removeAttachment: vi.fn().mockImplementation(async (attachmentId: string) => updateSnapshot((current) => {
        const targetAttachment = current.attachments.find((attachment) => attachment.id === attachmentId)
        if (!targetAttachment) {
          return current
        }

        return {
          ...current,
          attachments: current.attachments.filter((attachment) => attachment.id !== attachmentId),
          sessions: current.sessions.map((session) => (
            session.id === targetAttachment.sessionId
              ? touchSession(session)
              : session
          )),
        }
      })),
      commitAttachments: vi.fn().mockImplementation(async (sessionId: string, attachmentIds: string[], messageId: string) => updateSnapshot((current) => ({
        ...current,
        attachments: current.attachments.map((attachment) => (
          attachment.sessionId === sessionId
          && attachment.status === 'staged'
          && attachmentIds.includes(attachment.id)
            ? {
              ...attachment,
              status: 'sent',
              messageId,
            }
            : attachment
        )),
        sessions: current.sessions.map((session) => (
          session.id === sessionId
            ? touchSession(session)
            : session
        )),
      }))),
      appendArtifact: vi.fn().mockImplementation(async (artifact: ShellArtifact) => updateSnapshot((current) => ({
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
      }))),
      appendApproval: vi.fn().mockImplementation(async (approval: ShellApproval) => updateSnapshot((current) => {
        const nextApprovals = [...current.approvals, approval]

        return {
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
        }
      })),
      resolveApproval: vi.fn().mockImplementation(async (approvalId: string, decision: 'approved' | 'denied') => updateSnapshot((current) => {
        const approval = current.approvals.find((item) => item.id === approvalId)
        if (!approval || approval.status !== 'pending') {
          return current
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

        return {
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
        }
      })),
      onSnapshot: vi.fn().mockImplementation((cb: (shellSnapshot: ShellSnapshot) => void) => {
        shellListeners.add(cb)
        return () => {
          shellListeners.delete(cb)
        }
      }),
    },
    settings: {
      get: vi.fn().mockImplementation(async () => settings),
      update: vi.fn().mockImplementation(async (patch: Partial<AppSettings>) => {
        settings = {
          ...settings,
          ...patch,
        }
        return settings
      }),
    },
    secrets: {
      getStatus: vi.fn().mockImplementation(async () => structuredClone(secrets)),
      setProviderKey: vi.fn().mockImplementation(async (provider: 'anthropic' | 'openai' | 'google', value: string) => {
        if (!secrets.encryptionAvailable) {
          throw new Error('Secure local secret storage is unavailable on this system.')
        }

        if (!value.trim()) {
          return structuredClone(secrets)
        }

        secrets = {
          ...secrets,
          providers: secrets.providers.map((item) => (
            item.provider === provider
              ? { ...item, configured: true, source: 'secure_store' }
              : item
          )),
        }
        return structuredClone(secrets)
      }),
      deleteProviderKey: vi.fn().mockImplementation(async (provider: 'anthropic' | 'openai' | 'google') => {
        secrets = {
          ...secrets,
          providers: secrets.providers.map((item) => (
            item.provider === provider
              ? { ...item, configured: false, source: 'none' }
              : item
          )),
        }
        return structuredClone(secrets)
      }),
    },
    data: {
      resetWorkspace: vi.fn().mockImplementation(async () => {
        const previousSnapshot = structuredClone(snapshot)
        const nextSnapshot: ShellSnapshot = {
          activeSessionId: 'sess-001',
          sessions: [
            {
              id: 'sess-001',
              title: '새 세션',
              status: 'active',
              model: settings.defaultModel,
              updatedAt: '방금',
              archivedAt: null,
              pinned: false,
              messageCount: 0,
              artifactCount: 0,
            },
          ],
          runSteps: [],
          attachments: [],
          artifacts: [],
          approvals: [],
          logs: [],
          templates: previousSnapshot.templates,
          messages: [],
          references: [],
          previews: [],
        }

        snapshot = nextSnapshot
        notifyShellSnapshot()

        return {
          backupDir: 'C:\\mock\\usan-pro\\backups\\workspace-reset',
          clearedSessionCount: previousSnapshot.sessions.length,
          clearedMessageCount: previousSnapshot.messages.length,
          clearedArtifactCount: previousSnapshot.artifacts.length,
          snapshot: structuredClone(nextSnapshot),
        }
      }),
      clearCache: vi.fn().mockResolvedValue({
        backupDir: 'C:\\mock\\usan-pro\\backups\\cache-clear',
        clearedPaths: [
          'C:\\mock\\usan-pro\\shell-state.json',
          'C:\\mock\\usan-pro\\skills.db',
        ],
        reindexedSkillCount: 0,
        browserCacheCleared: true,
      }),
    },
    window: {
      minimize: vi.fn().mockResolvedValue(undefined),
      maximize: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      isMaximized: vi.fn().mockResolvedValue(false),
    },
    emitChunk: (chunk: StreamChunk) => {
      const runtime = runtimes.get(chunk.requestId)
      if (runtime && !runtime.completed) {
        switch (chunk.type) {
          case 'text_delta':
            runtime.streamedText += chunk.text
            break
          case 'tool_call': {
            const toolCall = chunk.toolCall
            runtime.toolStepCount += 1
            const stepId = `step-${chunk.requestId}-tool-${runtime.toolStepCount}`
            runtime.pendingToolSteps.set(toolCall.id, stepId)
            updateSnapshot((current) => ({
              ...current,
              runSteps: [
                ...current.runSteps,
                {
                  id: stepId,
                  sessionId: runtime.sessionId,
                  label: `Run tool: ${toolCall.name}`,
                  status: 'running',
                  detail: summarizeValue(toolCall.input),
                },
              ],
              sessions: current.sessions.map((session) => (
                session.id === runtime.sessionId
                  ? touchSession(session)
                  : session
              )),
              logs: [
                ...current.logs,
                {
                  id: `log-${stepId}`,
                  sessionId: runtime.sessionId,
                  ts: createTimeLabel(),
                  level: 'debug',
                  message: `Tool call: ${toolCall.name}(${summarizeValue(toolCall.input)})`,
                  kind: 'tool',
                  status: 'running',
                  stepId,
                  toolName: toolCall.name,
                },
              ],
            }))
            break
          }
          case 'tool_result': {
            const toolResult = chunk.toolResult
            const stepId = runtime.pendingToolSteps.get(toolResult.id)
            if (stepId) {
              updateSnapshot((current) => ({
                ...current,
                runSteps: current.runSteps.map((step) => (
                  step.id === stepId
                    ? { ...step, status: 'success', detail: summarizeValue(toolResult.result) }
                    : step
                )),
                logs: [
                  ...current.logs,
                  {
                    id: `log-${chunk.requestId}-tool-result-${Date.now()}`,
                    sessionId: runtime.sessionId,
                    ts: createTimeLabel(),
                    level: 'info',
                    message: `Tool result: ${summarizeValue(toolResult.result)}`,
                    kind: 'tool',
                    status: 'success',
                    stepId,
                    toolName: current.runSteps.find((step) => step.id === stepId)?.label?.replace(/^Run tool: /, ''),
                  },
                ],
              }))
              runtime.pendingToolSteps.delete(toolResult.id)
            }
            break
          }
          case 'error':
            finalizeRequest(
              chunk.requestId,
              {
                status: 'failed',
                detail: chunk.error,
              },
              {
                id: `log-${chunk.requestId}-failed`,
                sessionId: runtime.sessionId,
                ts: createTimeLabel(),
                level: 'error',
                message: chunk.error,
                kind: 'session',
                status: 'failed',
              },
              { status: 'failed' },
              true,
            )
            break
          case 'done':
            finalizeRequest(
              chunk.requestId,
              {
                status: 'success',
                detail: 'Response completed',
              },
              {
                id: `log-${chunk.requestId}-done`,
                sessionId: runtime.sessionId,
                ts: createTimeLabel(),
                level: 'info',
                message: 'Response completed',
                kind: 'session',
                status: 'success',
              },
              { status: 'active' },
              true,
            )
            break
          default:
            break
        }
      }

      notifyChunk(chunk)
    },
  }

  Object.defineProperty(window, 'usan', {
    configurable: true,
    value: api,
  })

  return api
}
