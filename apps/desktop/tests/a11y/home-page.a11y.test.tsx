// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import axe from 'axe-core'
import React from 'react'
import { buildComposerPrompt } from '../../src/renderer/src/components/composer'
import HomePage from '../../src/renderer/src/pages/HomePage'
import { useSettingsStore } from '../../src/renderer/src/stores/settings.store'
import { useChatStore } from '../../src/renderer/src/stores/chat.store'
import { useProactiveStore } from '../../src/renderer/src/stores/proactive.store'
import { setLocale, t } from '../../src/renderer/src/i18n'

function createUsanMock() {
  return {
    ai: {
      onChatStream: vi.fn().mockReturnValue(() => {}),
      chat: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    },
    fs: {
      pick: vi.fn().mockResolvedValue({ canceled: true, paths: [] }),
    },
    computer: {
      screenshot: vi.fn().mockResolvedValue(null),
    },
    clipboardManager: {
      history: vi.fn().mockResolvedValue([]),
    },
    proactive: {
      list: vi.fn().mockResolvedValue([]),
      dismiss: vi.fn().mockResolvedValue(undefined),
      onSuggestion: vi.fn().mockReturnValue(() => {}),
    },
    context: {
      getSnapshot: vi.fn().mockResolvedValue({
        activeWindow: null,
        activeApp: 'explorer',
        timeOfDay: 'afternoon',
        idleTimeMs: 120000,
        monitors: [],
        timestamp: Date.now(),
      }),
      onChanged: vi.fn().mockReturnValue(() => {}),
    },
    voice: {
      onStatus: vi.fn().mockReturnValue(() => {}),
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

describe('HomePage accessibility', () => {
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

    Object.defineProperty(window, 'speechSynthesis', {
      writable: true,
      value: {
        speak: vi.fn(),
        cancel: vi.fn(),
      },
    })

    useSettingsStore.setState((state) => ({
      ...state,
      loaded: true,
      settings: {
        ...state.settings,
        locale: 'en',
        beginnerMode: true,
        voiceEnabled: false,
      },
    }))

    useChatStore.setState((state) => ({
      ...state,
      conversations: [],
      activeConversationId: null,
      streamingConversationId: null,
      isStreaming: false,
      streamingPhase: 'idle',
      streamingText: '',
      loaded: true,
    }))

    useProactiveStore.setState((state) => ({
      ...state,
      suggestions: [],
      contextSnapshot: null,
      loading: false,
      initialized: false,
    }))

    setLocale('en')
    document.documentElement.lang = 'en'
    HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('has no serious or critical axe violations on empty state', async () => {
    const { container } = render(<HomePage />)

    await screen.findByText(t('home.quickLaunchTitle'))

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

  it('supports sending by keyboard Enter when enabled', async () => {
    render(<HomePage />)

    const input = await screen.findByPlaceholderText(t('composer.placeholder'))
    fireEvent.change(input, { target: { value: 'hello usan' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })

    await waitFor(() => {
      const state = useChatStore.getState()
      expect(state.conversations.length).toBe(1)
      expect(state.conversations[0]?.messages[0]?.content).toBe(
        buildComposerPrompt({
          text: 'hello usan',
          mode: 'search',
          attachments: [],
        }),
      )
    })
  })

  it('shows the timeline shell, quick launch, proactive tray, recent work, and composer on first load', async () => {
    render(<HomePage />)

    expect(await screen.findByTestId('agent-timeline')).toBeInTheDocument()
    expect(screen.getByTestId('home-quick-launch')).toBeInTheDocument()
    expect(screen.getByTestId('proactive-tray')).toBeInTheDocument()
    expect(screen.getByTestId('home-recent-work')).toBeInTheDocument()
    expect(screen.getAllByText(t('chat.resumeHint')).length).toBeGreaterThan(0)
    expect(screen.getByText(t('chat.noSavedConversations'))).toBeInTheDocument()
    expect(screen.getByTestId('composer')).toBeInTheDocument()
  })

  it('starts a new conversation from the header action', async () => {
    render(<HomePage />)

    fireEvent.click(await screen.findByTestId('home-new-task-button'))

    await waitFor(() => {
      const state = useChatStore.getState()
      expect(state.conversations.length).toBe(1)
      expect(state.activeConversationId).toBe(state.conversations[0]?.id ?? null)
    })
  })
})
