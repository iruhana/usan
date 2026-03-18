// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import FilesPage from '../../src/renderer/src/pages/FilesPage'
import { setLocale } from '../../src/renderer/src/i18n'
import { USAN_NAVIGATE_EVENT, type NavigateEventDetail } from '../../src/renderer/src/lib/navigation-events'
import { useChatStore } from '../../src/renderer/src/stores/chat.store'
import { useFilesStore } from '../../src/renderer/src/stores/files.store'

const DESKTOP_PATH = 'C:\\Users\\admin\\Desktop'

const DESKTOP_ENTRIES = [
  {
    name: 'Projects',
    path: 'C:\\Users\\admin\\Desktop\\Projects',
    isDirectory: true,
    size: 0,
    modifiedAt: Date.now() - 60_000,
  },
  {
    name: 'notes.md',
    path: 'C:\\Users\\admin\\Desktop\\notes.md',
    isDirectory: false,
    size: 2048,
    modifiedAt: Date.now() - 5_000,
  },
]

const PROJECT_ENTRIES = [
  {
    name: 'design-spec.docx',
    path: 'C:\\Users\\admin\\Desktop\\Projects\\design-spec.docx',
    isDirectory: false,
    size: 4096,
    modifiedAt: Date.now() - 1_000,
  },
]

function createUsanMock() {
  return {
    ai: {
      onChatStream: vi.fn().mockReturnValue(() => {}),
      chat: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    },
    fs: {
      list: vi.fn(async (dir: string) => {
        if (dir === DESKTOP_PATH) return DESKTOP_ENTRIES
        if (dir === 'C:\\Users\\admin\\Desktop\\Projects') return PROJECT_ENTRIES
        return []
      }),
      pick: vi.fn().mockResolvedValue({ canceled: false, paths: ['C:\\Users\\admin\\Desktop\\Projects'] }),
      delete: vi.fn().mockResolvedValue(undefined),
      secureDelete: vi.fn().mockResolvedValue({ success: true }),
    },
    fsExtras: {
      openPath: vi.fn().mockResolvedValue(undefined),
    },
    system: {
      desktopPath: vi.fn().mockResolvedValue(DESKTOP_PATH),
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

describe('FilesPage', () => {
  beforeEach(() => {
    ;(window as typeof window & { usan: ReturnType<typeof createUsanMock> }).usan = createUsanMock()
    setLocale('en')
    document.documentElement.lang = 'en'

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

    Object.defineProperty(window, 'ResizeObserver', {
      writable: true,
      value: class {
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    })

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })

    useFilesStore.setState({
      currentPath: '',
      entries: [],
      loading: false,
      error: null,
    })

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
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders the enhanced file explorer with action bar and view switches', async () => {
    render(<FilesPage />)

    expect(await screen.findByTestId('files-explorer')).toBeInTheDocument()
    expect(await screen.findByTestId('files-action-bar')).toBeInTheDocument()
    expect(screen.getByTestId('files-view-list')).toBeInTheDocument()
    expect(screen.getByTestId('files-view-grid')).toBeInTheDocument()
    expect(screen.getByTestId('files-view-column')).toBeInTheDocument()
    expect(screen.getByTestId('files-virtual-list')).toBeInTheDocument()
  })

  it('switches to column view and shows inspector details', async () => {
    render(<FilesPage />)

    await screen.findByTestId('files-action-bar')
    fireEvent.click(screen.getByTestId('files-view-column'))

    expect(await screen.findByTestId('files-column-inspector')).toBeInTheDocument()
    expect(screen.getByText('Selection details')).toBeInTheDocument()
  })

  it('copies the selected path and sends a file task to Home', async () => {
    render(<FilesPage />)

    await screen.findByTestId('files-action-bar')
    fireEvent.click(screen.getByTestId('files-entry-1'))

    fireEvent.click(await screen.findByRole('button', { name: 'Copy path' }))
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('C:\\Users\\admin\\Desktop\\notes.md')
    })

    let navigateDetail: NavigateEventDetail | null = null
    const handleNavigate = (event: Event) => {
      navigateDetail = (event as CustomEvent<NavigateEventDetail>).detail
    }
    window.addEventListener(USAN_NAVIGATE_EVENT, handleNavigate)

    fireEvent.click(screen.getByRole('button', { name: 'Ask Usan' }))

    await waitFor(() => {
      expect(window.usan.ai.chat).toHaveBeenCalledTimes(1)
    })

    expect(window.usan.ai.chat.mock.calls[0]?.[0]?.message).toContain('notes.md')
    expect(navigateDetail).toEqual({ page: 'home' })
    expect(useChatStore.getState().conversations).toHaveLength(1)

    window.removeEventListener(USAN_NAVIGATE_EVENT, handleNavigate)
  })
})
