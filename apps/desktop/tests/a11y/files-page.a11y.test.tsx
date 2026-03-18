// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import axe from 'axe-core'
import React from 'react'
import FilesPage from '../../src/renderer/src/pages/FilesPage'
import { setLocale } from '../../src/renderer/src/i18n'
import { useChatStore } from '../../src/renderer/src/stores/chat.store'
import { useFilesStore } from '../../src/renderer/src/stores/files.store'

function createUsanMock() {
  return {
    ai: {
      onChatStream: vi.fn().mockReturnValue(() => {}),
      chat: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    },
    fs: {
      list: vi.fn().mockResolvedValue([
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
      ]),
      pick: vi.fn().mockResolvedValue({ canceled: true, paths: [] }),
      delete: vi.fn().mockResolvedValue(undefined),
      secureDelete: vi.fn().mockResolvedValue({ success: true }),
    },
    fsExtras: {
      openPath: vi.fn().mockResolvedValue(undefined),
    },
    system: {
      desktopPath: vi.fn().mockResolvedValue('C:\\Users\\admin\\Desktop'),
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

describe('FilesPage accessibility', () => {
  beforeEach(() => {
    ;(window as typeof window & { usan: ReturnType<typeof createUsanMock> }).usan = createUsanMock()
    setLocale('en')
    document.documentElement.lang = 'en'

    Object.defineProperty(window, 'ResizeObserver', {
      writable: true,
      value: class {
        observe() {}
        disconnect() {}
        unobserve() {}
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

  it('has no serious or critical axe violations', async () => {
    const { container } = render(<FilesPage />)

    await screen.findByTestId('files-explorer')

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
          help: violation.help,
          nodeCount: violation.nodes.length,
        })),
        null,
        2,
      ),
    ).toHaveLength(0)
  })
})
