// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import HomePage from '../../src/renderer/src/pages/HomePage'
import { queueFloatingToolbarComposerDraft } from '../../src/renderer/src/components/ambient/floating-toolbar-events'
import { useChatStore } from '../../src/renderer/src/stores/chat.store'
import { useProactiveStore } from '../../src/renderer/src/stores/proactive.store'
import { useSettingsStore } from '../../src/renderer/src/stores/settings.store'
import { setLocale, t } from '../../src/renderer/src/i18n'
import { useCollaborationStore } from '../../src/renderer/src/stores/collaboration.store'

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
    collaboration: {
      status: vi.fn().mockResolvedValue({
        connected: false,
        topic: null,
        shareCode: null,
        role: null,
        conversationId: null,
        authenticated: false,
        self: null,
        participants: [],
        lastSyncedAt: null,
        lastError: null,
      }),
      start: vi.fn().mockResolvedValue({
        connected: true,
        topic: 'usan-collab:TEST',
        shareCode: 'TEST-CODE-1234',
        role: 'host',
        conversationId: 'shared-conv',
        authenticated: false,
        self: null,
        participants: [],
        lastSyncedAt: Date.now(),
        lastError: null,
      }),
      join: vi.fn().mockResolvedValue(undefined),
      leave: vi.fn().mockResolvedValue(undefined),
      syncConversation: vi.fn().mockResolvedValue(undefined),
      syncDraft: vi.fn().mockResolvedValue(undefined),
      onStatusChanged: vi.fn().mockReturnValue(() => {}),
      onRemoteConversation: vi.fn().mockReturnValue(() => {}),
      onRemoteDraft: vi.fn().mockReturnValue(() => {}),
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

    useProactiveStore.setState((state) => ({
      ...state,
      suggestions: [],
      contextSnapshot: null,
      loading: false,
      initialized: false,
    }))

    useCollaborationStore.setState((state) => ({
      ...state,
      initialized: false,
      status: {
        connected: false,
        topic: null,
        shareCode: null,
        role: null,
        conversationId: null,
        authenticated: false,
        self: null,
        participants: [],
        lastSyncedAt: null,
        lastError: null,
      },
      remoteDraft: null,
      lastRemoteConversation: null,
      loading: false,
      error: null,
    }))

    setLocale('en')
    HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders timeline, quick launch, proactive tray, and recent work panels', async () => {
    render(<HomePage />)

    expect(await screen.findByTestId('agent-timeline')).toBeInTheDocument()
    expect(screen.getByTestId('home-artifact-workspace')).toBeInTheDocument()
    expect(screen.getByTestId('home-quick-launch')).toBeInTheDocument()
    expect(screen.getByTestId('collaboration-panel')).toBeInTheDocument()
    expect(screen.getByTestId('proactive-tray')).toBeInTheDocument()
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

  it('accepts pending floating toolbar text into the composer', async () => {
    queueFloatingToolbarComposerDraft({ text: 'Selected sentence from toolbar' })

    render(<HomePage />)

    await waitFor(() => {
      expect(screen.getByTestId('composer-textarea')).toHaveValue('Selected sentence from toolbar')
    })
  })

  it('starts a shared collaboration room from Home', async () => {
    render(<HomePage />)

    fireEvent.click(await screen.findByTestId('collaboration-start-button'))

    await waitFor(() => {
      expect((window as any).usan.collaboration.start).toHaveBeenCalledTimes(1)
    })

    expect((window as any).usan.collaboration.start.mock.calls[0][0].conversationId).toBeTruthy()
  })
})
