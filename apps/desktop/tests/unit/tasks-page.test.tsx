// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import TasksPage from '../../src/renderer/src/pages/TasksPage'
import { useChatStore } from '../../src/renderer/src/stores/chat.store'
import { useSettingsStore } from '../../src/renderer/src/stores/settings.store'
import { setLocale, t } from '../../src/renderer/src/i18n'
import { USAN_NAVIGATE_EVENT } from '../../src/renderer/src/lib/navigation-events'

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

describe('TasksPage', () => {
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
          id: 'run-1',
          title: 'Research market',
          createdAt: 1000,
          messages: [{ id: 'u1', role: 'user', content: 'Research market', timestamp: 1100 }],
        },
        {
          id: 'done-1',
          title: 'Write summary',
          createdAt: 1200,
          messages: [
            { id: 'u2', role: 'user', content: 'Write summary', timestamp: 1200 },
            { id: 'a2', role: 'assistant', content: 'Summary complete', timestamp: 1400 },
          ],
        },
        {
          id: 'fail-1',
          title: 'Send invoice',
          createdAt: 1500,
          messages: [
            { id: 'u3', role: 'user', content: 'Send invoice', timestamp: 1500 },
            { id: 'a3', role: 'assistant', content: 'Could not send invoice', timestamp: 1600, isError: true },
          ],
        },
      ],
      activeConversationId: 'done-1',
      streamingConversationId: 'run-1',
      isStreaming: true,
      streamingPhase: 'generating',
      streamingText: 'Collecting sources',
      activeToolName: 'Web search',
      loaded: true,
    }))

    setLocale('en')
    HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders task counts, list rows, and selected task detail', async () => {
    render(<TasksPage />)

    expect(await screen.findByTestId('tasks-page')).toBeInTheDocument()
    expect(screen.getByText(t('tasks.summaryTitle'))).toBeInTheDocument()
    expect(screen.getByTestId('tasks-row-run-1')).toBeInTheDocument()
    expect(screen.getByTestId('tasks-row-done-1')).toBeInTheDocument()
    expect(screen.getByTestId('tasks-row-fail-1')).toBeInTheDocument()
    expect(screen.getByTestId('tasks-detail-summary')).toBeInTheDocument()
    expect(screen.getByTestId('tasks-artifact-workspace')).toBeInTheDocument()
    expect(screen.getAllByText('Write summary').length).toBeGreaterThan(0)
  })

  it('filters the list by failed status', async () => {
    render(<TasksPage />)

    fireEvent.click(await screen.findByTestId('tasks-filter-failed'))

    expect(screen.queryByTestId('tasks-row-run-1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('tasks-row-done-1')).not.toBeInTheDocument()
    expect(screen.getByTestId('tasks-row-fail-1')).toBeInTheDocument()
  })

  it('navigates home when resuming a task', async () => {
    const listener = vi.fn()
    window.addEventListener(USAN_NAVIGATE_EVENT, listener as EventListener)

    render(<TasksPage />)
    fireEvent.click(await screen.findByTestId('tasks-row-run-1'))
    fireEvent.click(screen.getByTestId('tasks-resume-button'))

    await waitFor(() => {
      expect(useChatStore.getState().activeConversationId).toBe('run-1')
      expect(listener).toHaveBeenCalledTimes(1)
    })

    window.removeEventListener(USAN_NAVIGATE_EVENT, listener as EventListener)
  })
})
