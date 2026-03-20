/**
 * AI Chat Engine with main-process-owned shell state lifecycle.
 */

import Anthropic from '@anthropic-ai/sdk'
import { AI_MODELS, type ChatPayload, type ShellSnapshot, type StreamChunk } from '@shared/types'
import type { WebContents } from 'electron'
import {
  appendShellArtifact,
  appendShellLog,
  appendShellMessage,
  appendShellRunStep,
  getShellSnapshot,
  updateShellRunStep,
  updateShellSession,
} from './platform/shell-state'
import { TOOL_DEFS, executeTool } from './tools/index'

const activeStreams = new Map<string, AbortController>()

type BroadcastShellSnapshot = (snapshot: ShellSnapshot) => void

interface ChatRuntime {
  requestId: string
  sessionId: string
  streamedText: string
  requestStepId: string
  toolStepCount: number
  pendingToolSteps: Map<string, string>
  assistantCommitted: boolean
}

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

function createArtifactTitle(sessionArtifactCount: number): string {
  return `assistant-response-${String(sessionArtifactCount + 1).padStart(3, '0')}.md`
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
  }))
}

function appendStreamText(sender: WebContents, runtime: ChatRuntime, text: string): void {
  runtime.streamedText += text
  send(sender, { requestId: runtime.requestId, text, done: false })
}

function persistAssistantResponse(
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
  broadcastShellSnapshot(appendShellArtifact({
    id: `artifact-${runtime.requestId}`,
    sessionId: runtime.sessionId,
    title: createArtifactTitle(session?.artifactCount ?? 0),
    kind: 'markdown',
    createdAt: 'Just now',
    size: `${Math.max(1, Math.ceil(runtime.streamedText.length / 1024))} KB`,
    version: 1,
    content: runtime.streamedText,
  }))

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

function finalizeSuccess(
  runtime: ChatRuntime,
  broadcastShellSnapshot: BroadcastShellSnapshot,
): void {
  persistAssistantResponse(runtime, broadcastShellSnapshot)
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
  }))
  broadcastShellSnapshot(updateShellSession(runtime.sessionId, { status: 'active' }))
}

function finalizeError(
  runtime: ChatRuntime,
  errorMessage: string,
  broadcastShellSnapshot: BroadcastShellSnapshot,
): void {
  finalizePendingToolSteps(runtime, 'failed', errorMessage, broadcastShellSnapshot)
  persistAssistantResponse(runtime, broadcastShellSnapshot)
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
  }))
  broadcastShellSnapshot(updateShellSession(runtime.sessionId, { status: 'failed' }))
}

function finalizeAborted(
  runtime: ChatRuntime,
  broadcastShellSnapshot: BroadcastShellSnapshot,
): void {
  finalizePendingToolSteps(runtime, 'skipped', 'Generation stopped by user', broadcastShellSnapshot)
  persistAssistantResponse(runtime, broadcastShellSnapshot)
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
): void {
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
  }))
  send(sender, {
    requestId: runtime.requestId,
    toolCall: { name, input },
    done: false,
  })
}

function recordToolResult(
  sender: WebContents,
  runtime: ChatRuntime,
  toolId: string,
  result: string,
  broadcastShellSnapshot: BroadcastShellSnapshot,
): void {
  const stepId = runtime.pendingToolSteps.get(toolId)
  if (stepId) {
    broadcastShellSnapshot(updateShellRunStep(stepId, {
      status: 'success',
      detail: summarizeValue(result),
    }))
    runtime.pendingToolSteps.delete(toolId)
  }

  broadcastShellSnapshot(appendShellLog({
    id: `log-${runtime.requestId}-tool-result-${Date.now()}`,
    sessionId: runtime.sessionId,
    ts: createTimeLabel(),
    level: 'info',
    message: `Tool result: ${summarizeValue(result)}`,
  }))
  send(sender, {
    requestId: runtime.requestId,
    toolResult: { id: toolId, result },
    done: false,
  })
}

function recordToolFailure(
  runtime: ChatRuntime,
  toolId: string,
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
  }))
}

export async function handleChat(
  sender: WebContents,
  payload: ChatPayload,
  broadcastShellSnapshot: BroadcastShellSnapshot,
): Promise<void> {
  const { requestId } = payload
  const abort = new AbortController()
  const runtime = createRuntime(payload)
  activeStreams.set(requestId, abort)
  broadcastRequestStarted(payload, runtime, broadcastShellSnapshot)

  try {
    const provider = getProvider(payload.model)
    switch (provider) {
      case 'anthropic':
        await handleAnthropic(sender, payload, runtime, abort, broadcastShellSnapshot)
        break
      case 'openai':
        await handleOpenAI(sender, payload, runtime, abort)
        break
      case 'google':
        await handleGoogle(sender, payload, runtime, abort)
        break
    }

    if (abort.signal.aborted) {
      finalizeAborted(runtime, broadcastShellSnapshot)
      send(sender, { requestId, done: true })
      return
    }

    finalizeSuccess(runtime, broadcastShellSnapshot)
    send(sender, { requestId, done: true })
  } catch (error) {
    if (abort.signal.aborted) {
      finalizeAborted(runtime, broadcastShellSnapshot)
      send(sender, { requestId, done: true })
      return
    }

    const message = getErrorMessage(error)
    finalizeError(runtime, message, broadcastShellSnapshot)
    send(sender, { requestId, error: message, done: true })
  } finally {
    activeStreams.delete(requestId)
  }
}

export function stopStream(requestId: string): void {
  activeStreams.get(requestId)?.abort()
}

async function handleAnthropic(
  sender: WebContents,
  payload: ChatPayload,
  runtime: ChatRuntime,
  abort: AbortController,
  broadcastShellSnapshot: BroadcastShellSnapshot,
) {
  const { messages, model, systemPrompt, useTools = false } = payload
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured')
  }

  const client = new Anthropic({ apiKey })
  const history: Anthropic.Messages.MessageParam[] = messages.map((message) => ({
    role: message.role,
    content: message.content,
  }))

  for (let iteration = 0; iteration < 8; iteration += 1) {
    if (abort.signal.aborted) {
      return
    }

    const params: Anthropic.Messages.MessageCreateParamsStreaming = {
      model,
      max_tokens: 8096,
      messages: history,
      stream: true,
    }

    if (systemPrompt) {
      params.system = systemPrompt
    }
    if (useTools) {
      ;(params as Anthropic.Messages.MessageCreateParamsStreaming & { tools: unknown }).tools = TOOL_DEFS
    }

    const stream = client.messages.stream(params)
    stream.on('text', (text) => {
      if (!abort.signal.aborted) {
        appendStreamText(sender, runtime, text)
      }
    })

    const finalMessage = await stream.finalMessage()
    if (abort.signal.aborted) {
      return
    }

    const toolUseBlocks = finalMessage.content.filter(
      (block): block is Anthropic.Messages.ToolUseBlock => block.type === 'tool_use',
    )
    if (finalMessage.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
      break
    }

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []
    for (const tool of toolUseBlocks) {
      if (abort.signal.aborted) {
        return
      }

      recordToolCall(sender, runtime, tool.id, tool.name, tool.input, broadcastShellSnapshot)

      try {
        const result = await executeTool(tool.name, tool.input as Record<string, unknown>)
        if (abort.signal.aborted) {
          return
        }

        recordToolResult(sender, runtime, tool.id, result, broadcastShellSnapshot)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: result,
        })
      } catch (error) {
        recordToolFailure(runtime, tool.id, getErrorMessage(error), broadcastShellSnapshot)
        throw error
      }
    }

    history.push({ role: 'assistant', content: finalMessage.content })
    history.push({ role: 'user', content: toolResults })
  }
}

async function handleOpenAI(
  sender: WebContents,
  payload: ChatPayload,
  runtime: ChatRuntime,
  abort: AbortController,
) {
  const { messages, model, systemPrompt } = payload
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  const openaiMessages: Array<{ role: string; content: string }> = []
  if (systemPrompt) {
    openaiMessages.push({ role: 'system', content: systemPrompt })
  }
  for (const message of messages) {
    openaiMessages.push({ role: message.role, content: message.content })
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages: openaiMessages, stream: true }),
    signal: abort.signal,
  })

  if (!response.ok) {
    throw new Error(`OpenAI error ${response.status}: ${await response.text()}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('OpenAI response body is empty')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done || abort.signal.aborted) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') {
        continue
      }

      try {
        const json = JSON.parse(line.slice(6))
        const delta = json.choices?.[0]?.delta?.content
        if (delta) {
          appendStreamText(sender, runtime, delta)
        }
      } catch {
        // Ignore malformed SSE frames.
      }
    }
  }
}

async function handleGoogle(
  sender: WebContents,
  payload: ChatPayload,
  runtime: ChatRuntime,
  abort: AbortController,
) {
  const { messages, model, systemPrompt } = payload
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured')
  }

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = []
  for (const message of messages) {
    contents.push({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    })
  }

  const body: Record<string, unknown> = { contents }
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] }
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: abort.signal,
    },
  )

  if (!response.ok) {
    throw new Error(`Gemini error ${response.status}: ${await response.text()}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Gemini response body is empty')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done || abort.signal.aborted) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) {
        continue
      }

      try {
        const json = JSON.parse(line.slice(6))
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) {
          appendStreamText(sender, runtime, text)
        }
      } catch {
        // Ignore malformed SSE frames.
      }
    }
  }
}
