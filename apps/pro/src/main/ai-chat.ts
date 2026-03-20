/**
 * AI Chat Engine with main-process-owned shell state lifecycle.
 */

import {
  AI_MODELS,
  type ApprovalDecision,
  type ChatPayload,
  type ShellAttachment,
  type ShellArtifact,
  type ShellSnapshot,
  type StreamChunk,
} from '@shared/types'
import type { WebContents } from 'electron'
import { getAttachmentDeliveryMode, getModelNativeFileMode } from '@shared/attachment-routing'
import {
  appendShellApproval,
  appendShellArtifact,
  appendShellLog,
  appendShellMessage,
  appendShellRunStep,
  getShellSnapshot,
  resolveShellApproval,
  updateShellRunStep,
  updateShellSession,
} from './platform/shell-state'
import { TOOL_DEFS, executeTool, getToolExecutionPolicy, type ToolExecutionPolicy } from './tools/index'
import {
  getChatProviderAdapter,
  type ApprovalResolution,
  type ChatRuntime,
  type ProviderToolRuntime,
  type RecordToolResultOptions,
} from './providers/chat'

const activeStreams = new Map<string, AbortController>()
const pendingApprovals = new Map<string, { requestId: string; resolve: (decision: ApprovalResolution) => void }>()

type BroadcastShellSnapshot = (snapshot: ShellSnapshot) => void

function send(sender: WebContents, chunk: StreamChunk) {
  if (!sender.isDestroyed()) {
    sender.send('ai:chunk', chunk)
  }
}

function getProvider(modelId: string) {
  return AI_MODELS.find((model) => model.id === modelId)?.provider ?? 'anthropic'
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return String(error)
}

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

function describeToolInput(name: string, input: Record<string, unknown>): string {
  if (name === 'bash') {
    return String(input.command ?? '').trim() || 'Shell command'
  }

  if (name === 'web_fetch') {
    return String(input.url ?? '').trim() || 'Web fetch'
  }

  if (name === 'read_file') {
    return String(input.path ?? '').trim() || 'File read'
  }

  if (name === 'write_file') {
    return String(input.path ?? '').trim() || 'File write'
  }

  return summarizeValue(input)
}

function createApprovalAction(name: string, input: Record<string, unknown>): string {
  if (name === 'bash') {
    return `Run shell command: ${describeToolInput(name, input)}`
  }

  if (name === 'write_file') {
    return `Write file: ${describeToolInput(name, input)}`
  }

  return `Run tool: ${name}`
}

function createApprovalDetail(name: string, input: Record<string, unknown>): string {
  if (name === 'bash') {
    return `Command: ${describeToolInput(name, input)}`
  }

  if (name === 'write_file') {
    return `Path: ${describeToolInput(name, input)}\nContent: ${summarizeValue(input.content ?? '')}`
  }

  return summarizeValue(input)
}

function createApprovalDeniedResult(name: string, policy: ToolExecutionPolicy): string {
  if (policy.fallback) {
    return `Execution skipped: approval denied for ${name}. ${policy.fallback}`
  }

  return `Execution skipped: approval denied for ${name}.`
}

function createArtifactTitle(sessionArtifactCount: number): string {
  return `assistant-response-${String(sessionArtifactCount + 1).padStart(3, '0')}.md`
}

function listRequestAttachments(payload: ChatPayload): ShellAttachment[] {
  const attachmentById = new Map<string, ShellAttachment>()
  const lastMessageIndex = payload.messages.length - 1

  payload.messages.forEach((message, index) => {
    const currentAttachments = message.attachments ?? (
      index === lastMessageIndex ? payload.attachments ?? [] : []
    )

    for (const attachment of currentAttachments) {
      if (!attachmentById.has(attachment.id)) {
        attachmentById.set(attachment.id, attachment)
      }
    }
  })

  return [...attachmentById.values()]
}

function appendAttachmentRoutingLogs(
  payload: ChatPayload,
  runtime: ChatRuntime,
  broadcastShellSnapshot: BroadcastShellSnapshot,
): void {
  const nativeFileMode = getModelNativeFileMode(payload.model)
  const attachments = listRequestAttachments(payload)

  attachments.forEach((attachment, index) => {
    const attachmentDeliveryMode = getAttachmentDeliveryMode(attachment, nativeFileMode)

    broadcastShellSnapshot(appendShellLog({
      id: `log-${payload.requestId}-attachment-${index + 1}`,
      sessionId: payload.sessionId,
      ts: createTimeLabel(),
      level: 'info',
      message: `Attachment route: ${attachment.name} -> ${attachmentDeliveryMode}`,
      kind: 'attachment',
      status: 'success',
      stepId: runtime.requestStepId,
      attachmentName: attachment.name,
      attachmentDeliveryMode,
      modelId: payload.model,
    }))
  })
}

function createRuntime(payload: ChatPayload): ChatRuntime {
  return {
    requestId: payload.requestId,
    sessionId: payload.sessionId,
    streamedText: '',
    requestStepId: `step-${payload.requestId}`,
    toolStepCount: 0,
    pendingToolSteps: new Map(),
    assistantCommitted: false,
  }
}

function broadcastRequestStarted(
  payload: ChatPayload,
  runtime: ChatRuntime,
  broadcastShellSnapshot: BroadcastShellSnapshot,
): void {
  broadcastShellSnapshot(appendShellMessage(payload.sessionId, {
    id: payload.userMessage.id,
    sessionId: payload.sessionId,
    role: 'user',
    content: payload.userMessage.content,
    ts: payload.userMessage.ts,
  }))
  broadcastShellSnapshot(updateShellSession(payload.sessionId, {
    status: 'running',
    model: payload.model,
  }))
  broadcastShellSnapshot(appendShellRunStep({
    id: runtime.requestStepId,
    sessionId: payload.sessionId,
    label: 'Generate AI response',
    status: 'running',
    detail: `${payload.model} response started`,
  }))
  broadcastShellSnapshot(appendShellLog({
    id: `log-${payload.requestId}-start`,
    sessionId: payload.sessionId,
    ts: createTimeLabel(),
    level: 'info',
    message: `Request started with ${payload.model}`,
    kind: 'session',
    status: 'running',
  }))
  appendAttachmentRoutingLogs(payload, runtime, broadcastShellSnapshot)
}

function appendStreamText(sender: WebContents, runtime: ChatRuntime, text: string): void {
  runtime.streamedText += text
  send(sender, { requestId: runtime.requestId, type: 'text_delta', text })
}

function persistAssistantResponse(
  sender: WebContents,
  runtime: ChatRuntime,
  broadcastShellSnapshot: BroadcastShellSnapshot,
): void {
  if (runtime.assistantCommitted || !runtime.streamedText.trim()) {
    return
  }

  broadcastShellSnapshot(appendShellMessage(runtime.sessionId, {
    id: `msg-${runtime.requestId}-assistant`,
    sessionId: runtime.sessionId,
    role: 'assistant',
    content: runtime.streamedText,
    ts: Date.now(),
  }))

  const session = getShellSnapshot().sessions.find((item) => item.id === runtime.sessionId)
  const artifact: ShellArtifact = {
    id: `artifact-${runtime.requestId}`,
    sessionId: runtime.sessionId,
    title: createArtifactTitle(session?.artifactCount ?? 0),
    kind: 'markdown',
    createdAt: 'Just now',
    size: `${Math.max(1, Math.ceil(runtime.streamedText.length / 1024))} KB`,
    version: 1,
    content: runtime.streamedText,
  }
  broadcastShellSnapshot(appendShellArtifact(artifact))
  send(sender, {
    requestId: runtime.requestId,
    type: 'artifact',
    artifact,
  })

  runtime.assistantCommitted = true
}

function finalizePendingToolSteps(
  runtime: ChatRuntime,
  status: 'failed' | 'skipped',
  detail: string,
  broadcastShellSnapshot: BroadcastShellSnapshot,
): void {
  for (const stepId of runtime.pendingToolSteps.values()) {
    broadcastShellSnapshot(updateShellRunStep(stepId, {
      status,
      detail,
    }))
  }
  runtime.pendingToolSteps.clear()
}

async function requestToolApproval(
  runtime: ChatRuntime,
  name: string,
  input: Record<string, unknown>,
  stepId: string,
  policy: ToolExecutionPolicy,
  abort: AbortController,
  broadcastShellSnapshot: BroadcastShellSnapshot,
): Promise<ApprovalResolution> {
  const approvalId = `approval-${runtime.requestId}-${runtime.toolStepCount}`
  const approvalAction = createApprovalAction(name, input)

  broadcastShellSnapshot(appendShellApproval({
    id: approvalId,
    sessionId: runtime.sessionId,
    action: approvalAction,
    detail: createApprovalDetail(name, input),
    capability: policy.capability,
    risk: policy.risk,
    status: 'pending',
    retryable: true,
    fallback: policy.fallback,
    stepId,
  }))
  broadcastShellSnapshot(appendShellLog({
    id: `log-${approvalId}-requested`,
    sessionId: runtime.sessionId,
    ts: createTimeLabel(),
    level: 'warn',
    message: `Approval requested: ${approvalAction}`,
    kind: 'approval',
    status: 'pending',
    capability: policy.capability,
    stepId,
    approvalId,
  }))

  return await new Promise<ApprovalResolution>((resolve) => {
    let settled = false

    const finish = (decision: ApprovalResolution) => {
      if (settled) {
        return
      }

      settled = true
      pendingApprovals.delete(approvalId)
      abort.signal.removeEventListener('abort', handleAbort)
      resolve(decision)
    }

    const handleAbort = () => {
      broadcastShellSnapshot(resolveShellApproval(approvalId, 'denied'))
      finish('aborted')
    }

    pendingApprovals.set(approvalId, {
      requestId: runtime.requestId,
      resolve: finish,
    })
    abort.signal.addEventListener('abort', handleAbort, { once: true })
  })
}

function finalizeSuccess(
  sender: WebContents,
  runtime: ChatRuntime,
  broadcastShellSnapshot: BroadcastShellSnapshot,
): void {
  persistAssistantResponse(sender, runtime, broadcastShellSnapshot)
  broadcastShellSnapshot(updateShellRunStep(runtime.requestStepId, {
    status: 'success',
    detail: 'Response completed',
  }))
  broadcastShellSnapshot(appendShellLog({
    id: `log-${runtime.requestId}-done`,
    sessionId: runtime.sessionId,
    ts: createTimeLabel(),
    level: 'info',
    message: 'Response completed',
    kind: 'session',
    status: 'success',
  }))
  broadcastShellSnapshot(updateShellSession(runtime.sessionId, { status: 'active' }))
}

function finalizeError(
  sender: WebContents,
  runtime: ChatRuntime,
  errorMessage: string,
  broadcastShellSnapshot: BroadcastShellSnapshot,
): void {
  finalizePendingToolSteps(runtime, 'failed', errorMessage, broadcastShellSnapshot)
  persistAssistantResponse(sender, runtime, broadcastShellSnapshot)
  broadcastShellSnapshot(updateShellRunStep(runtime.requestStepId, {
    status: 'failed',
    detail: errorMessage,
  }))
  broadcastShellSnapshot(appendShellLog({
    id: `log-${runtime.requestId}-failed`,
    sessionId: runtime.sessionId,
    ts: createTimeLabel(),
    level: 'error',
    message: errorMessage,
    kind: 'session',
    status: 'failed',
  }))
  broadcastShellSnapshot(updateShellSession(runtime.sessionId, { status: 'failed' }))
}

function finalizeAborted(
  sender: WebContents,
  runtime: ChatRuntime,
  broadcastShellSnapshot: BroadcastShellSnapshot,
): void {
  finalizePendingToolSteps(runtime, 'skipped', 'Generation stopped by user', broadcastShellSnapshot)
  persistAssistantResponse(sender, runtime, broadcastShellSnapshot)
  broadcastShellSnapshot(updateShellRunStep(runtime.requestStepId, {
    status: 'skipped',
    detail: 'Generation stopped by user',
  }))
  broadcastShellSnapshot(appendShellLog({
    id: `log-${runtime.requestId}-stopped`,
    sessionId: runtime.sessionId,
    ts: createTimeLabel(),
    level: 'warn',
    message: 'Generation stopped by user',
    kind: 'session',
    status: 'skipped',
  }))
  broadcastShellSnapshot(updateShellSession(runtime.sessionId, { status: 'active' }))
}

function recordToolCall(
  sender: WebContents,
  runtime: ChatRuntime,
  toolId: string,
  name: string,
  input: unknown,
  broadcastShellSnapshot: BroadcastShellSnapshot,
): string {
  runtime.toolStepCount += 1
  const stepId = `step-${runtime.requestId}-tool-${runtime.toolStepCount}`
  runtime.pendingToolSteps.set(toolId, stepId)

  broadcastShellSnapshot(appendShellRunStep({
    id: stepId,
    sessionId: runtime.sessionId,
    label: `Run tool: ${name}`,
    status: 'running',
    detail: summarizeValue(input),
  }))
  broadcastShellSnapshot(appendShellLog({
    id: `log-${stepId}`,
    sessionId: runtime.sessionId,
    ts: createTimeLabel(),
    level: 'debug',
    message: `Tool call: ${name}(${summarizeValue(input)})`,
    kind: 'tool',
    status: 'running',
    stepId,
    toolName: name,
  }))
  send(sender, {
    requestId: runtime.requestId,
    type: 'tool_call',
    toolCall: { id: toolId, name, input },
  })

  return stepId
}

function recordToolResult(
  sender: WebContents,
  runtime: ChatRuntime,
  toolId: string,
  name: string,
  result: string,
  broadcastShellSnapshot: BroadcastShellSnapshot,
  options?: {
    finalizeStep?: boolean
    stepStatus?: 'success' | 'skipped'
    logLevel?: 'info' | 'warn' | 'error' | 'debug'
  },
): void {
  const stepId = runtime.pendingToolSteps.get(toolId)
  if (stepId && options?.finalizeStep !== false) {
    broadcastShellSnapshot(updateShellRunStep(stepId, {
      status: options?.stepStatus ?? 'success',
      detail: summarizeValue(result),
    }))
  }
  runtime.pendingToolSteps.delete(toolId)

  broadcastShellSnapshot(appendShellLog({
    id: `log-${runtime.requestId}-tool-result-${Date.now()}`,
    sessionId: runtime.sessionId,
    ts: createTimeLabel(),
    level: options?.logLevel ?? 'info',
    message: `Tool result: ${summarizeValue(result)}`,
    kind: 'tool',
    status: options?.stepStatus ?? 'success',
    stepId,
    toolName: name,
  }))
  send(sender, {
    requestId: runtime.requestId,
    type: 'tool_result',
    toolResult: { id: toolId, result },
  })
}

function recordToolFailure(
  runtime: ChatRuntime,
  toolId: string,
  name: string,
  errorMessage: string,
  broadcastShellSnapshot: BroadcastShellSnapshot,
): void {
  const stepId = runtime.pendingToolSteps.get(toolId)
  if (stepId) {
    broadcastShellSnapshot(updateShellRunStep(stepId, {
      status: 'failed',
      detail: errorMessage,
    }))
    runtime.pendingToolSteps.delete(toolId)
  }

  broadcastShellSnapshot(appendShellLog({
    id: `log-${runtime.requestId}-tool-error-${Date.now()}`,
    sessionId: runtime.sessionId,
    ts: createTimeLabel(),
    level: 'error',
    message: errorMessage,
    kind: 'tool',
    status: 'failed',
    stepId,
    toolName: name,
  }))
}

function createProviderToolRuntime(
  sender: WebContents,
  runtime: ChatRuntime,
  abort: AbortController,
  broadcastShellSnapshot: BroadcastShellSnapshot,
): ProviderToolRuntime {
  return {
    toolDefs: TOOL_DEFS,
    appendText(text) {
      if (!abort.signal.aborted) {
        appendStreamText(sender, runtime, text)
      }
    },
    recordToolCall(toolId, name, input) {
      return recordToolCall(sender, runtime, toolId, name, input, broadcastShellSnapshot)
    },
    recordToolResult(toolId, name, result, options?: RecordToolResultOptions) {
      recordToolResult(sender, runtime, toolId, name, result, broadcastShellSnapshot, options)
    },
    recordToolFailure(toolId, name, errorMessage) {
      recordToolFailure(runtime, toolId, name, errorMessage, broadcastShellSnapshot)
    },
    requestApproval(name, input, stepId, policy) {
      return requestToolApproval(runtime, name, input, stepId, policy, abort, broadcastShellSnapshot)
    },
    getExecutionPolicy(name) {
      return getToolExecutionPolicy(name)
    },
    executeTool(name, input) {
      return executeTool(name, input)
    },
    createApprovalDeniedResult(name, policy) {
      return createApprovalDeniedResult(name, policy)
    },
    markSessionRunning() {
      broadcastShellSnapshot(updateShellSession(runtime.sessionId, { status: 'running' }))
    },
    isAborted() {
      return abort.signal.aborted
    },
  }
}

export async function handleChat(
  sender: WebContents,
  payload: ChatPayload,
  broadcastShellSnapshot: BroadcastShellSnapshot,
): Promise<void> {
  const { requestId } = payload
  const abort = new AbortController()
  const runtime = createRuntime(payload)
  const providerTools = createProviderToolRuntime(sender, runtime, abort, broadcastShellSnapshot)
  activeStreams.set(requestId, abort)
  broadcastRequestStarted(payload, runtime, broadcastShellSnapshot)

  try {
    const provider = getProvider(payload.model)
    await getChatProviderAdapter(provider).run({
      payload,
      runtime,
      abort,
      tools: providerTools,
    })

    if (abort.signal.aborted) {
      finalizeAborted(sender, runtime, broadcastShellSnapshot)
      send(sender, { requestId, type: 'done' })
      return
    }

    finalizeSuccess(sender, runtime, broadcastShellSnapshot)
    send(sender, { requestId, type: 'done' })
  } catch (error) {
    if (abort.signal.aborted) {
      finalizeAborted(sender, runtime, broadcastShellSnapshot)
      send(sender, { requestId, type: 'done' })
      return
    }

    const message = getErrorMessage(error)
    finalizeError(sender, runtime, message, broadcastShellSnapshot)
    send(sender, { requestId, type: 'error', error: message })
  } finally {
    activeStreams.delete(requestId)
  }
}

export function stopStream(requestId: string): void {
  activeStreams.get(requestId)?.abort()
}

export function resolveToolApproval(approvalId: string, decision: ApprovalDecision): void {
  pendingApprovals.get(approvalId)?.resolve(decision)
}
