import { describe, expect, it } from 'vitest'
import { messagesToTimelineSteps } from '../../src/renderer/src/components/agent'
import { setLocale } from '../../src/renderer/src/i18n'
import type { ChatMessage } from '../../src/shared/types/ipc'

describe('messagesToTimelineSteps', () => {
  it('maps tool calls, tool results, and assistant replies into timeline steps', () => {
    setLocale('en')

    const messages: ChatMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        content: 'summarize this',
        timestamp: 1,
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'tool-1',
            name: 'browser_read',
            args: { url: 'https://usan.ai' },
          },
          {
            id: 'tool-2',
            name: 'browser_type',
            args: { selector: '#email' },
          },
        ],
        timestamp: 2,
      },
      {
        id: 'tool-message-1',
        role: 'tool',
        content: '',
        toolResults: [
          {
            id: 'tool-1',
            name: 'browser_read',
            result: { ok: true },
            duration: 2100,
          },
          {
            id: 'tool-2',
            name: 'browser_type',
            result: null,
            error: 'Field not found',
            duration: 500,
          },
        ],
        timestamp: 3,
      },
      {
        id: 'assistant-2',
        role: 'assistant',
        content: 'Summary complete.',
        timestamp: 4,
      },
    ]

    const steps = messagesToTimelineSteps(messages)

    expect(steps).toHaveLength(3)
    expect(steps[0]).toMatchObject({
      id: 'tool-1',
      kind: 'tool',
      status: 'completed',
      title: 'Read page',
      description: 'Tool finished successfully.',
    })
    expect(steps[0]?.durationMs).toBe(2100)
    expect(steps[1]).toMatchObject({
      id: 'tool-2',
      kind: 'tool',
      status: 'failed',
      title: 'Type on page',
      description: 'Tool finished with an error.',
      error: 'Field not found',
    })
    expect(steps[2]).toMatchObject({
      id: 'assistant-2',
      kind: 'response',
      status: 'completed',
      title: 'Response ready',
      description: 'Summary complete.',
    })
  })

  it('adds running, pending, and awaiting approval states from stream state', () => {
    setLocale('en')

    const messages: ChatMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        content: '',
        toolCalls: [
          {
            id: 'tool-1',
            name: 'browser_click',
            args: { selector: '#submit' },
          },
        ],
        timestamp: 2,
      },
    ]

    const steps = messagesToTimelineSteps(messages, {
      isStreaming: true,
      streamingPhase: 'tool',
      activeToolName: 'Browser action',
      pendingApproval: {
        id: 'approval-1',
        title: 'Send email now?',
        description: 'This will send a message to the selected recipient.',
      },
    })

    expect(steps[0]).toMatchObject({
      id: 'tool-1',
      kind: 'tool',
      status: 'running',
    })
    expect(steps[1]).toMatchObject({
      id: 'approval-1',
      kind: 'approval',
      status: 'awaiting',
      title: 'Send email now?',
    })

    const waitingOnly = messagesToTimelineSteps([], {
      isStreaming: true,
      streamingPhase: 'waiting',
    })

    expect(waitingOnly[0]).toMatchObject({
      kind: 'thinking',
      status: 'pending',
      title: 'Waiting for the next step',
    })
  })
})
