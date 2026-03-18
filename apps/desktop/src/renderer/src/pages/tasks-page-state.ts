import type { StoredConversation } from '@shared/types/ipc'
import { messagesToTimelineSteps } from '../components/agent/timeline-state'
import type { TimelineApprovalRequest, TimelineStep, TimelineStreamState } from '../components/agent/types'

export type TaskStatus = 'in_progress' | 'approval' | 'completed' | 'failed'
export type TaskFilter = 'all' | TaskStatus

export interface TaskRuntimeState {
  streamingConversationId: string | null
  isStreaming: boolean
  streamingPhase: TimelineStreamState['streamingPhase']
  streamingText: string
  activeToolName: string | null
  pendingApprovalConversationId?: string | null
  pendingApproval?: TimelineApprovalRequest | null
}

export interface TaskEntry {
  id: string
  title: string
  preview: string
  status: TaskStatus
  createdAt: number
  lastUpdatedAt: number
  messageCount: number
  stepCount: number
  completedStepCount: number
  activeToolName: string | null
  isStreaming: boolean
  steps: TimelineStep[]
  conversation: StoredConversation
}

export interface TaskCounts {
  all: number
  in_progress: number
  approval: number
  completed: number
  failed: number
}

const STATUS_ORDER: Record<TaskStatus, number> = {
  approval: 0,
  in_progress: 1,
  failed: 2,
  completed: 3,
}

function getLastUpdatedAt(conversation: StoredConversation): number {
  const lastMessage = conversation.messages[conversation.messages.length - 1]
  return lastMessage?.timestamp ?? conversation.createdAt
}

function getStreamStateForConversation(
  conversationId: string,
  runtime: TaskRuntimeState,
): TimelineStreamState {
  const isActiveStream = runtime.isStreaming && runtime.streamingConversationId === conversationId
  const hasPendingApproval = runtime.pendingApprovalConversationId === conversationId

  return {
    isStreaming: isActiveStream,
    streamingPhase: isActiveStream ? runtime.streamingPhase : 'idle',
    streamingText: isActiveStream ? runtime.streamingText : '',
    activeToolName: isActiveStream ? runtime.activeToolName : null,
    pendingApproval: hasPendingApproval ? runtime.pendingApproval ?? null : null,
  }
}

function getLastMeaningfulStep(steps: TimelineStep[]): TimelineStep | null {
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps[index]
    if (step) {
      return step
    }
  }

  return null
}

function deriveTaskStatus(
  conversation: StoredConversation,
  steps: TimelineStep[],
  streamState: TimelineStreamState,
): TaskStatus {
  const lastStep = getLastMeaningfulStep(steps)
  const lastMessage = conversation.messages[conversation.messages.length - 1]

  if (lastStep?.status === 'awaiting') return 'approval'
  if (streamState.isStreaming || lastStep?.status === 'running' || lastStep?.status === 'pending') {
    return 'in_progress'
  }
  if (lastStep?.status === 'failed') return 'failed'
  if (lastMessage?.role === 'user') return 'in_progress'
  return 'completed'
}

function getPreview(conversation: StoredConversation, streamState: TimelineStreamState): string {
  const streamingText = streamState.streamingText ?? ''

  if (streamingText.trim()) {
    return streamingText.trim()
  }

  for (let index = conversation.messages.length - 1; index >= 0; index -= 1) {
    const message = conversation.messages[index]
    const content = message?.content?.trim()
    if (content) {
      return content
    }
  }

  return ''
}

export function deriveTaskEntries(
  conversations: StoredConversation[],
  runtime: TaskRuntimeState,
): TaskEntry[] {
  return conversations
    .filter((conversation) => conversation.messages.length > 0)
    .map((conversation) => {
      const streamState = getStreamStateForConversation(conversation.id, runtime)
      const steps = messagesToTimelineSteps(conversation.messages, streamState)
      const status = deriveTaskStatus(conversation, steps, streamState)
      const completedStepCount = steps.filter((step) => step.status === 'completed').length

      return {
        id: conversation.id,
        title: conversation.title,
        preview: getPreview(conversation, streamState),
        status,
        createdAt: conversation.createdAt,
        lastUpdatedAt: getLastUpdatedAt(conversation),
        messageCount: conversation.messages.length,
        stepCount: steps.length,
        completedStepCount,
        activeToolName: streamState.activeToolName ?? null,
        isStreaming: Boolean(streamState.isStreaming),
        steps,
        conversation,
      }
    })
    .sort((left, right) => {
      const statusDiff = STATUS_ORDER[left.status] - STATUS_ORDER[right.status]
      if (statusDiff !== 0) return statusDiff
      return right.lastUpdatedAt - left.lastUpdatedAt
    })
}

export function countTasks(entries: TaskEntry[]): TaskCounts {
  return entries.reduce<TaskCounts>(
    (counts, entry) => {
      counts.all += 1
      counts[entry.status] += 1
      return counts
    },
    {
      all: 0,
      in_progress: 0,
      approval: 0,
      completed: 0,
      failed: 0,
    },
  )
}

export function filterTaskEntries(
  entries: TaskEntry[],
  filter: TaskFilter,
  query: string,
): TaskEntry[] {
  const normalizedQuery = query.trim().toLowerCase()

  return entries.filter((entry) => {
    if (filter !== 'all' && entry.status !== filter) {
      return false
    }

    if (!normalizedQuery) {
      return true
    }

    const haystack = `${entry.title} ${entry.preview}`.toLowerCase()
    return haystack.includes(normalizedQuery)
  })
}
