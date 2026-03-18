import { describe, expect, it } from 'vitest'
import type { StoredConversation } from '../../src/shared/types/ipc'
import { setLocale } from '../../src/renderer/src/i18n'
import { countTasks, deriveTaskEntries, filterTaskEntries } from '../../src/renderer/src/pages/tasks-page-state'

function createConversation(
  id: string,
  title: string,
  messages: StoredConversation['messages'],
  createdAt = 1000,
): StoredConversation {
  return {
    id,
    title,
    messages,
    createdAt,
  }
}

describe('tasks-page-state', () => {
  it('derives task status for streaming, approval, failed, and completed work', () => {
    setLocale('en')

    const conversations: StoredConversation[] = [
      createConversation(
        'completed',
        'Write report',
        [
          { id: 'u1', role: 'user', content: 'Write a report', timestamp: 1000 },
          { id: 'a1', role: 'assistant', content: 'Report ready', timestamp: 1200 },
        ],
        900,
      ),
      createConversation(
        'failed',
        'Send email',
        [
          { id: 'u2', role: 'user', content: 'Send the email', timestamp: 1300 },
          { id: 'a2', role: 'assistant', content: 'Could not send', timestamp: 1400, isError: true },
        ],
        1250,
      ),
      createConversation(
        'streaming',
        'Research market',
        [{ id: 'u3', role: 'user', content: 'Research the market', timestamp: 1500 }],
        1450,
      ),
      createConversation(
        'approval',
        'Delete file',
        [{ id: 'u4', role: 'user', content: 'Delete that file', timestamp: 1600 }],
        1550,
      ),
    ]

    const entries = deriveTaskEntries(conversations, {
      streamingConversationId: 'streaming',
      isStreaming: true,
      streamingPhase: 'tool',
      streamingText: '',
      activeToolName: 'Search',
      pendingApprovalConversationId: 'approval',
      pendingApproval: {
        id: 'approval-step',
        title: 'Delete file',
        description: 'Needs approval',
      },
    })

    expect(entries.map((entry) => [entry.id, entry.status])).toEqual([
      ['approval', 'approval'],
      ['streaming', 'in_progress'],
      ['failed', 'failed'],
      ['completed', 'completed'],
    ])

    expect(countTasks(entries)).toEqual({
      all: 4,
      in_progress: 1,
      approval: 1,
      completed: 1,
      failed: 1,
    })
  })

  it('filters tasks by status and query', () => {
    setLocale('en')

    const entries = deriveTaskEntries(
      [
        createConversation(
          'weather',
          'Weather check',
          [
            { id: 'u1', role: 'user', content: 'Weather today', timestamp: 1000 },
            { id: 'a1', role: 'assistant', content: 'Sunny today', timestamp: 1100 },
          ],
        ),
        createConversation(
          'travel',
          'Travel booking',
          [{ id: 'u2', role: 'user', content: 'Book my trip', timestamp: 1200 }],
          1150,
        ),
      ],
      {
        streamingConversationId: 'travel',
        isStreaming: true,
        streamingPhase: 'generating',
        streamingText: 'Looking for flights',
        activeToolName: null,
      },
    )

    expect(filterTaskEntries(entries, 'completed', '')).toHaveLength(1)
    expect(filterTaskEntries(entries, 'in_progress', '')).toHaveLength(1)
    expect(filterTaskEntries(entries, 'all', 'flight')).toHaveLength(1)
    expect(filterTaskEntries(entries, 'all', 'weather')).toHaveLength(1)
    expect(filterTaskEntries(entries, 'failed', 'weather')).toHaveLength(0)
  })
})
