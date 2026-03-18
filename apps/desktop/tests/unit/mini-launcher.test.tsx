// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'

import MiniLauncher from '../../src/renderer/src/components/ambient/MiniLauncher'
import { setLocale } from '../../src/renderer/src/i18n'
import { useChatStore } from '../../src/renderer/src/stores/chat.store'

const originalChatState = useChatStore.getState()

function seedChatStore(overrides: Partial<ReturnType<typeof useChatStore.getState>> = {}) {
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
          {
            id: 'm2',
            role: 'assistant',
            content: 'Here is the current summary for March sales.',
            timestamp: Date.now() - 45_000,
          },
        ],
      },
      {
        id: 'conversation-2',
        title: 'Reply to customer',
        createdAt: Date.now() - 120_000,
        messages: [
          {
            id: 'm3',
            role: 'user',
            content: 'Draft a reply to the support email',
            timestamp: Date.now() - 120_000,
          },
        ],
      },
    ],
    activeConversationId: null,
    isStreaming: false,
    ...overrides,
  })
}

describe('MiniLauncher', () => {
  beforeEach(() => {
    setLocale('en')
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

    seedChatStore()
  })

  afterEach(() => {
    cleanup()
    useChatStore.setState(originalChatState)
    vi.restoreAllMocks()
  })

  it('renders quick actions and recent tasks', async () => {
    render(<MiniLauncher open onNavigate={vi.fn()} onOpenChange={vi.fn()} />)

    expect(screen.getByTestId('mini-launcher')).toBeInTheDocument()
    expect(screen.getByTestId('mini-launcher-chip-recent')).toBeInTheDocument()
    expect(screen.getByTestId('mini-launcher-chip-files')).toBeInTheDocument()
    expect(screen.getByTestId('mini-launcher-recent-conversation-1')).toBeInTheDocument()
    expect(screen.getByText('March sales report')).toBeInTheDocument()
  })

  it('submits a new prompt from the input and closes the overlay', async () => {
    const newConversation = vi.fn(() => 'fresh-conversation')
    const sendMessage = vi.fn().mockResolvedValue(undefined)
    const onNavigate = vi.fn()
    const onOpenChange = vi.fn()

    seedChatStore({ newConversation, sendMessage })

    render(<MiniLauncher open onNavigate={onNavigate} onOpenChange={onOpenChange} />)

    fireEvent.change(screen.getByTestId('mini-launcher-input'), {
      target: { value: 'Plan tomorrow morning' },
    })
    fireEvent.submit(screen.getByTestId('mini-launcher-form'))

    await waitFor(() => {
      expect(newConversation).toHaveBeenCalledTimes(1)
      expect(sendMessage).toHaveBeenCalledWith('Plan tomorrow morning')
    })

    expect(onNavigate).toHaveBeenCalledWith('home')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('opens the task list from the Recent quick action', () => {
    const onNavigate = vi.fn()
    const onOpenChange = vi.fn()

    render(<MiniLauncher open onNavigate={onNavigate} onOpenChange={onOpenChange} />)

    fireEvent.click(screen.getByTestId('mini-launcher-chip-recent'))

    expect(onNavigate).toHaveBeenCalledWith('tasks')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('resumes a recent task from the recent list', () => {
    const setActiveConversation = vi.fn()
    const onNavigate = vi.fn()
    const onOpenChange = vi.fn()

    seedChatStore({ setActiveConversation })

    render(<MiniLauncher open onNavigate={onNavigate} onOpenChange={onOpenChange} />)

    fireEvent.click(screen.getByTestId('mini-launcher-recent-conversation-1'))

    expect(setActiveConversation).toHaveBeenCalledWith('conversation-1')
    expect(onNavigate).toHaveBeenCalledWith('home')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
