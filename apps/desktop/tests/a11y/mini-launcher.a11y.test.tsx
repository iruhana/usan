// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import axe from 'axe-core'
import React from 'react'

import MiniLauncher from '../../src/renderer/src/components/ambient/MiniLauncher'
import { setLocale } from '../../src/renderer/src/i18n'
import { useChatStore } from '../../src/renderer/src/stores/chat.store'

const originalChatState = useChatStore.getState()

describe('MiniLauncher accessibility', () => {
  beforeEach(() => {
    setLocale('en')
    document.documentElement.lang = 'en'
    window.localStorage.clear()

    Object.defineProperty(window, 'usan', {
      configurable: true,
      value: {
        ai: {
          chat: vi.fn(),
          stop: vi.fn(),
          onChatStream: vi.fn(() => () => undefined),
        },
        conversations: {
          load: vi.fn().mockResolvedValue([]),
          save: vi.fn(),
        },
      },
    })

    useChatStore.setState({
      ...useChatStore.getState(),
      conversations: [
        {
          id: 'conversation-1',
          title: 'March sales report',
          createdAt: Date.now() - 60_000,
          messages: [
            {
              id: 'm1',
              role: 'user',
              content: 'Summarize the March numbers',
              timestamp: Date.now() - 60_000,
            },
          ],
        },
      ],
      activeConversationId: null,
      isStreaming: false,
    })
  })

  afterEach(() => {
    cleanup()
    useChatStore.setState(originalChatState)
    vi.restoreAllMocks()
  })

  it('has no serious or critical axe violations', async () => {
    const { container } = render(<MiniLauncher open onNavigate={vi.fn()} onOpenChange={vi.fn()} />)

    await screen.findByTestId('mini-launcher')

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
