import type { ChatMessage } from '@shared/types/ipc'
import { t } from '../../i18n'
import type {
  TimelineStep,
  TimelineApprovalRequest,
  TimelineStreamState,
} from './types'

const MAX_PREVIEW_LENGTH = 280

function stringifyValue(value: unknown): string {
  try {
    return JSON.stringify(
      value,
      (_, current) => {
        if (typeof current === 'bigint') return current.toString()
        if (typeof current === 'function') return '[function]'
        if (current instanceof Error) return current.message
        return current
      },
      2,
    )
  } catch {
    return String(value)
  }
}

function truncateText(value: string): string {
  const normalized = value.trim()
  if (normalized.length <= MAX_PREVIEW_LENGTH) return normalized
  return `${normalized.slice(0, MAX_PREVIEW_LENGTH)}...`
}

export function compactTimelineValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return truncateText(value)
  return truncateText(stringifyValue(value))
}

function getToolTitle(name: string): string {
  const localized = t(`tool.${name}`)
  return localized !== `tool.${name}` ? localized : name
}

function findLastPendingToolIndex(steps: TimelineStep[]): number {
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps[index]
    if (step?.kind === 'tool' && step.status === 'pending') {
      return index
    }
  }

  return -1
}

function createApprovalStep(request: TimelineApprovalRequest): TimelineStep {
  return {
    id: request.id,
    kind: 'approval',
    status: 'awaiting',
    title: request.title,
    description: request.description,
    approval: request,
  }
}

function applyStreamingState(steps: TimelineStep[], streamState: TimelineStreamState): void {
  if (!streamState.isStreaming) return

  if (streamState.streamingPhase === 'tool') {
    const pendingToolIndex = findLastPendingToolIndex(steps)
    if (pendingToolIndex >= 0) {
      const pendingStep = steps[pendingToolIndex]
      steps[pendingToolIndex] = {
        ...pendingStep,
        status: 'running',
        description: streamState.activeToolName
          ? `${streamState.activeToolName} ${t('tool.running')}`
          : t('agent.step.toolRunning'),
      }
      return
    }

    if (streamState.activeToolName) {
      steps.push({
        id: 'streaming-tool',
        kind: 'tool',
        status: 'running',
        title: streamState.activeToolName,
        description: t('agent.step.toolRunning'),
      })
      return
    }
  }

  if (streamState.streamingPhase === 'generating' || streamState.streamingText) {
    steps.push({
      id: 'streaming-response',
      kind: 'response',
      status: 'running',
      title: t('agent.step.writing'),
      description: streamState.streamingText?.trim() || t('agent.step.generatingHint'),
    })
    return
  }

  if (streamState.streamingPhase === 'waiting') {
    steps.push({
      id: 'streaming-waiting',
      kind: 'thinking',
      status: 'pending',
      title: t('agent.step.waiting'),
      description: t('agent.step.waitingDescription'),
    })
    return
  }

  steps.push({
    id: 'streaming-thinking',
    kind: 'thinking',
    status: 'running',
    title: t('agent.step.thinking'),
    description: t('agent.step.thinkingDescription'),
  })
}

export function messagesToTimelineSteps(
  messages: ChatMessage[],
  streamState: TimelineStreamState = {},
): TimelineStep[] {
  const steps: TimelineStep[] = []
  const indexByToolId = new Map<string, number>()

  for (const message of messages) {
    if (message.role === 'user') continue

    if (message.toolCalls?.length) {
      for (const toolCall of message.toolCalls) {
        const toolStep: TimelineStep = {
          id: toolCall.id,
          kind: 'tool',
          status: 'pending',
          title: getToolTitle(toolCall.name),
          description: t('agent.step.toolQueued'),
          argsPreview: compactTimelineValue(toolCall.args),
          timestamp: message.timestamp,
        }

        indexByToolId.set(toolCall.id, steps.length)
        steps.push(toolStep)
      }
      continue
    }

    if (message.role === 'tool' && message.toolResults?.length) {
      for (const toolResult of message.toolResults) {
        const nextStep: TimelineStep = {
          id: toolResult.id,
          kind: 'tool',
          status: toolResult.error ? 'failed' : 'completed',
          title: getToolTitle(toolResult.name),
          description: toolResult.error ? t('agent.step.toolFailed') : t('agent.step.toolDone'),
          resultPreview: compactTimelineValue(toolResult.result),
          error: toolResult.error,
          durationMs: toolResult.duration,
          timestamp: message.timestamp,
        }

        const existingIndex = indexByToolId.get(toolResult.id)
        if (existingIndex == null) {
          indexByToolId.set(toolResult.id, steps.length)
          steps.push(nextStep)
          continue
        }

        steps[existingIndex] = {
          ...steps[existingIndex],
          ...nextStep,
        }
      }
      continue
    }

    if (message.role === 'assistant' && message.content.trim()) {
      steps.push({
        id: message.id,
        kind: message.isError ? 'error' : 'response',
        status: message.isError ? 'failed' : 'completed',
        title: message.isError ? t('agent.step.error') : t('agent.step.response'),
        description: message.content,
        error: message.isError ? message.content : undefined,
        timestamp: message.timestamp,
      })
    }
  }

  applyStreamingState(steps, streamState)

  if (streamState.pendingApproval) {
    steps.push(createApprovalStep(streamState.pendingApproval))
  }

  return steps
}
