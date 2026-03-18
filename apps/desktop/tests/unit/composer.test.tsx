// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React, { useState } from 'react'

import { Composer } from '../../src/renderer/src/components/composer'
import { setLocale } from '../../src/renderer/src/i18n'
import { useSettingsStore } from '../../src/renderer/src/stores/settings.store'

interface ComposerHarnessProps {
  onSubmit?: (payload: unknown) => Promise<void> | void
  isStreaming?: boolean
}

function ComposerHarness({ onSubmit = vi.fn(), isStreaming = false }: ComposerHarnessProps) {
  const [value, setValue] = useState('')

  return (
    <Composer
      value={value}
      onValueChange={setValue}
      onSubmit={onSubmit}
      isStreaming={isStreaming}
    />
  )
}

describe('Composer', () => {
  beforeEach(() => {
    setLocale('en')
    window.localStorage.clear()

    useSettingsStore.setState((state) => ({
      ...state,
      loaded: true,
      settings: {
        ...state.settings,
        enterToSend: true,
        locale: 'en',
      },
    }))

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

    Object.defineProperty(window, 'usan', {
      configurable: true,
      value: {
        fs: {
          pick: vi.fn().mockResolvedValue({
            canceled: false,
            paths: ['C:\\Users\\admin\\Desktop\\brief.txt'],
          }),
        },
        computer: {
          screenshot: vi.fn().mockResolvedValue({
            image: 'base64-image',
            width: 1280,
            height: 720,
          }),
        },
        clipboardManager: {
          history: vi.fn().mockResolvedValue([]),
        },
      },
    })

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        readText: vi.fn().mockResolvedValue('clipboard text'),
      },
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('cycles composer modes with Ctrl+K', () => {
    render(<ComposerHarness />)

    const textarea = screen.getByTestId('composer-textarea')
    fireEvent.keyDown(textarea, { key: 'k', ctrlKey: true })

    expect(screen.getByTestId('composer-mode-deep-research')).toHaveAttribute('aria-pressed', 'true')
  })

  it('submits the current message with Ctrl+Enter', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<ComposerHarness onSubmit={onSubmit} />)

    const textarea = screen.getByTestId('composer-textarea')
    fireEvent.change(textarea, { target: { value: 'Draft a customer reply' } })
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true })

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        text: 'Draft a customer reply',
        mode: 'search',
        attachments: [],
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('composer-textarea')).toHaveValue('')
    })
  })

  it('attaches a file and allows attachment-only submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<ComposerHarness onSubmit={onSubmit} />)

    fireEvent.click(screen.getByTestId('composer-attach-button'))
    fireEvent.click(screen.getByTestId('composer-attach-file'))

    await screen.findByTestId('composer-attachment-file')
    expect(screen.getByTestId('composer-send-button')).toBeEnabled()

    fireEvent.click(screen.getByTestId('composer-send-button'))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        text: '',
        mode: 'search',
        attachments: [
          expect.objectContaining({
            kind: 'file',
            value: 'C:\\Users\\admin\\Desktop\\brief.txt',
          }),
        ],
      })
    })
  })
})
