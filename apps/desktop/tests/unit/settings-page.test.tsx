// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import SettingsPage from '../../src/renderer/src/pages/SettingsPage'
import { setLocale } from '../../src/renderer/src/i18n'
import { useSettingsStore } from '../../src/renderer/src/stores/settings.store'

function createUsanMock() {
  return {
    auth: {
      session: vi.fn().mockResolvedValue({ success: false, user: null }),
      login: vi.fn().mockResolvedValue({ success: false, error: 'invalid_credentials' }),
      signup: vi.fn().mockResolvedValue({ success: false, error: 'invalid_credentials' }),
      logout: vi.fn().mockResolvedValue({ success: true }),
    },
    ai: {
      models: vi.fn().mockResolvedValue([{ id: 'openrouter/gpt-5', name: 'GPT-5', provider: 'openrouter', isLocal: false }]),
    },
    updates: {
      status: vi.fn().mockResolvedValue({
        enabled: true,
        channel: 'stable',
        autoDownload: false,
        checking: false,
        updateAvailableVersion: null,
        downloadedVersion: null,
        lastCheckAt: null,
        lastError: null,
        crashStreak: 0,
      }),
      checkNow: vi.fn().mockResolvedValue(null),
      download: vi.fn().mockResolvedValue(null),
      install: vi.fn().mockResolvedValue({ queued: true }),
    },
    credentials: {
      getSummary: vi.fn().mockResolvedValue({
        totalCount: 0,
        lastImportedAt: null,
        preview: [],
      }),
      importBrowserCsv: vi.fn().mockResolvedValue({
        importedCount: 0,
        skippedCount: 0,
        totalCount: 0,
        sourcePath: '',
      }),
      clear: vi.fn().mockResolvedValue({ success: true }),
    },
    settings: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    },
  }
}

describe('SettingsPage', () => {
  beforeEach(() => {
    ;(window as any).usan = createUsanMock()
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

    useSettingsStore.setState((state) => ({
      ...state,
      loaded: true,
      settings: {
        ...state.settings,
        locale: 'en',
        beginnerMode: true,
      },
    }))
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders the account section inside settings', async () => {
    render(<SettingsPage requestedTab="account" />)

    expect((await screen.findAllByRole('heading', { name: 'Account' })).length).toBeGreaterThan(0)
    expect(document.querySelector('[data-account-mode="login"]')).not.toBeNull()
    expect(document.querySelector('[data-account-mode="signup"]')).not.toBeNull()
  })

  it('maps the legacy advanced tab to the security section', async () => {
    render(<SettingsPage requestedTab="advanced" />)

    expect(await screen.findByText('How much control to allow')).toBeInTheDocument()
    expect(screen.getByText('Bring in browser passwords')).toBeInTheDocument()
  })

  it('navigates to the about section from the left nav', async () => {
    render(<SettingsPage />)

    fireEvent.click(await screen.findByRole('tab', { name: /About & Legal/i }))
    expect(await screen.findByText('App updates')).toBeInTheDocument()
    expect(screen.getByText('About Usan')).toBeInTheDocument()
  })
})
