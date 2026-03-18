// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import axe from 'axe-core'
import React from 'react'
import TasksPage from '../../src/renderer/src/pages/TasksPage'
import { useChatStore } from '../../src/renderer/src/stores/chat.store'
import { useSettingsStore } from '../../src/renderer/src/stores/settings.store'
import { setLocale } from '../../src/renderer/src/i18n'

function createUsanMock() {
  return {
    ai: {
      onChatStream: vi.fn().mockReturnValue(() => {}),
      chat: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    },
    conversations: {
      load: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
      softDelete: vi.fn().mockResolvedValue(undefined),
      restore: vi.fn().mockResolvedValue(null),
      trashList: vi.fn().mockResolvedValue([]),
      trashPermanentDelete: vi.fn().mockResolvedValue(undefined),
    },
  }
}

describe('TasksPage accessibility', () => {
  beforeEach(() => {
    ;(window as any).usan = createUsanMock()

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    useSettingsStore.setState((state) => ({
      ...state,
      loaded: true,
      settings: {
        ...state.settings,
        locale: 'en',
      },
    }))

    useChatStore.setState((state) => ({
      ...state,
      conversations: [
        {
          id: 'done-1',
          title: 'Write summary',
          createdAt: 1200,
          messages: [
            { id: 'u2', role: 'user', content: 'Write summary', timestamp: 1200 },
            { id: 'a2', role: 'assistant', content: 'Summary complete', timestamp: 1400 },
          ],
        },
      ],
      activeConversationId: 'done-1',
      streamingConversationId: null,
      isStreaming: false,
      streamingPhase: 'idle',
      streamingText: '',
      activeToolName: null,
      loaded: true,
    }))

    setLocale('en')
    document.documentElement.lang = 'en'
    HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('has no serious or critical axe violations', async () => {
    const { container } = render(<TasksPage />)

    await screen.findByTestId('tasks-page')

    const result = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
      rules: {
        'color-contrast': { enabled: false },
      },
    })

    const importantViolations = result.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    )

    expect(
      importantViolations,
      JSON.stringify(
        importantViolations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          description: violation.description,
          help: violation.help,
          nodeCount: violation.nodes.length,
        })),
        null,
        2,
      ),
    ).toHaveLength(0)
  })
})
