// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import HomePage from '../../src/renderer/src/pages/HomePage'
import { useChatStore } from '../../src/renderer/src/stores/chat.store'
import { useSettingsStore } from '../../src/renderer/src/stores/settings.store'
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
    voice: {
      onStatus: vi.fn().mockReturnValue(() => {}),
      listenStart: vi.fn().mockResolvedValue({ text: 'voice draft' }),
      listenStop: vi.fn().mockResolvedValue({ text: 'voice draft' }),
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

describe('HomePage', () => {
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
      activeToolName: null,
      loaded: true,
    }))

    setLocale('en')
    HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders timeline, quick launch, and recent work panels', async () => {
    render(<HomePage />)

    expect(await screen.findByTestId('agent-timeline')).toBeInTheDocument()
    expect(screen.getByTestId('home-artifact-workspace')).toBeInTheDocument()
    expect(screen.getByTestId('home-quick-launch')).toBeInTheDocument()
    expect(screen.getByTestId('home-recent-work')).toBeInTheDocument()
  })

  it('starts a fresh task from quick launch', async () => {
    render(<HomePage />)

    fireEvent.click(await screen.findByTestId('home-quick-action-screen-error'))

    await waitFor(() => {
      const state = useChatStore.getState()
      expect(state.conversations).toHaveLength(1)
      expect(state.activeConversationId).toBe(state.conversations[0]?.id ?? null)
      expect(state.conversations[0]?.messages[0]?.content).toBe(t('home.quickAction.screenErrorPrompt'))
    })
  })

  it('routes composer voice input through the preload voice bridge first', async () => {
    render(<HomePage />)

    fireEvent.click(await screen.findByTestId('composer-attach-button'))
    fireEvent.click(await screen.findByTestId('composer-attach-voice'))

    await waitFor(() => {
      expect((window as any).usan.voice.listenStart).toHaveBeenCalledTimes(1)
    })
  })
})
