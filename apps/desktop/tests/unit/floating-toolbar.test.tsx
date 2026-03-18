// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'

import FloatingToolbar from '../../src/renderer/src/components/ambient/FloatingToolbar'
import { consumeFloatingToolbarComposerDraft } from '../../src/renderer/src/components/ambient/floating-toolbar-events'
import { setLocale } from '../../src/renderer/src/i18n'
import { useChatStore } from '../../src/renderer/src/stores/chat.store'

const originalChatState = useChatStore.getState()

function createSelectedTextarea(text = 'A selected block of draft text') {
  document.body.innerHTML = '<textarea data-testid="draft-input"></textarea>'
  const textarea = document.querySelector('textarea')
  if (!textarea) throw new Error('textarea missing')

  textarea.value = text
  textarea.focus()

  Object.defineProperty(textarea, 'selectionStart', { configurable: true, value: 0 })
  Object.defineProperty(textarea, 'selectionEnd', { configurable: true, value: text.length })
  Object.defineProperty(textarea, 'getBoundingClientRect', {
    configurable: true,
    value: () =>
      ({
        left: 120,
        top: 220,
        right: 540,
        bottom: 272,
        width: 420,
        height: 52,
      }) as DOMRect,
  })

  return textarea
}

describe('FloatingToolbar', () => {
  beforeEach(() => {
    setLocale('en')

    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        callback(0)
        return 1
      },
    })
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      value: vi.fn(),
    })

    useChatStore.setState({
      ...useChatStore.getState(),
      conversations: [],
      activeConversationId: null,
      streamingConversationId: null,
      isStreaming: false,
      streamingPhase: 'idle',
      streamingText: '',
      activeToolName: null,
      loaded: true,
    })
  })

  afterEach(() => {
    cleanup()
    useChatStore.setState(originalChatState)
    consumeFloatingToolbarComposerDraft()
    vi.restoreAllMocks()
  })

  it('appears for a meaningful textarea selection', async () => {
    createSelectedTextarea()

    render(<FloatingToolbar onNavigate={vi.fn()} />)
    fireEvent.keyUp(document, { key: 'Shift' })

    expect(await screen.findByTestId('floating-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('floating-toolbar-preview')).toHaveTextContent(
      'A selected block of draft text',
    )
  })

  it('starts a new task from the selection', async () => {
    const onNavigate = vi.fn()
    const newConversation = vi.fn(() => 'conversation-floating')
    const sendMessage = vi.fn().mockResolvedValue(undefined)

    createSelectedTextarea('Important selected draft')
    useChatStore.setState({
      ...useChatStore.getState(),
      newConversation,
      sendMessage,
    })

    render(<FloatingToolbar onNavigate={onNavigate} />)
    fireEvent.keyUp(document, { key: 'Shift' })

    fireEvent.click(await screen.findByTestId('floating-toolbar-action-ask'))

    await waitFor(() => {
      expect(newConversation).toHaveBeenCalledTimes(1)
      expect(sendMessage).toHaveBeenCalledTimes(1)
    })

    expect(onNavigate).toHaveBeenCalledWith('home')
    expect(sendMessage.mock.calls[0]?.[0]).toContain('Important selected draft')
  })

  it('queues the selection for the composer', async () => {
    const onNavigate = vi.fn()

    createSelectedTextarea('Draft for composer')

    render(<FloatingToolbar onNavigate={onNavigate} />)
    fireEvent.keyUp(document, { key: 'Shift' })

    fireEvent.click(await screen.findByTestId('floating-toolbar-action-compose'))

    expect(onNavigate).toHaveBeenCalledWith('home')
    expect(consumeFloatingToolbarComposerDraft()).toEqual({ text: 'Draft for composer' })
  })
})
