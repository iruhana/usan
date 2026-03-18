// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import axe from 'axe-core'
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
      models: vi.fn().mockResolvedValue([{ id: 'local/basic', name: 'Local Basic Model', provider: 'openrouter', isLocal: true }]),
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
      checkNow: vi.fn().mockResolvedValue({
        enabled: true,
        channel: 'stable',
        autoDownload: false,
        checking: false,
        updateAvailableVersion: null,
        downloadedVersion: null,
        lastCheckAt: Date.now(),
        lastError: null,
        crashStreak: 0,
      }),
      download: vi.fn().mockResolvedValue({
        enabled: true,
        channel: 'stable',
        autoDownload: false,
        checking: false,
        updateAvailableVersion: null,
        downloadedVersion: '1.0.0',
        lastCheckAt: Date.now(),
        lastError: null,
        crashStreak: 0,
      }),
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
    naverOAuth: {
      status: vi.fn().mockResolvedValue({
        provider: 'naver',
        configured: true,
        authenticated: false,
        expiresAt: null,
        scopes: [],
      }),
      start: vi.fn().mockResolvedValue({ success: true }),
      logout: vi.fn().mockResolvedValue({ success: true }),
    },
    kakaoOAuth: {
      status: vi.fn().mockResolvedValue({
        provider: 'kakao',
        configured: false,
        authenticated: false,
        expiresAt: null,
        scopes: [],
      }),
      start: vi.fn().mockResolvedValue({ success: true }),
      logout: vi.fn().mockResolvedValue({ success: true }),
    },
    email: {
      status: vi.fn().mockResolvedValue({
        provider: 'none',
        configured: false,
        hasStoredPassword: false,
        lastVerifiedAt: null,
      }),
      saveConfig: vi.fn().mockResolvedValue({
        provider: 'imap-smtp',
        configured: true,
        emailAddress: 'team@example.com',
        username: 'team@example.com',
        preset: 'gmail',
        imap: { host: 'imap.gmail.com', port: 993, secure: true },
        smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
        hasStoredPassword: true,
        lastVerifiedAt: 1742342400000,
      }),
      clearConfig: vi.fn().mockResolvedValue({
        provider: 'none',
        configured: false,
        hasStoredPassword: false,
        lastVerifiedAt: null,
      }),
      list: vi.fn().mockResolvedValue([]),
      read: vi.fn().mockResolvedValue(null),
      send: vi.fn().mockResolvedValue({ success: true }),
      isConfigured: vi.fn().mockResolvedValue(false),
    },
    calendar: {
      status: vi.fn().mockResolvedValue({
        provider: 'none',
        configured: false,
        hasStoredPassword: false,
        lastVerifiedAt: null,
      }),
      saveConfig: vi.fn().mockResolvedValue({
        provider: 'caldav',
        configured: true,
        preset: 'icloud',
        username: 'calendar@example.com',
        serverUrl: 'https://caldav.icloud.com',
        calendarUrl: 'https://caldav.icloud.com/root/default/',
        calendarName: 'Personal',
        hasStoredPassword: true,
        lastVerifiedAt: 1742342400000,
      }),
      clearConfig: vi.fn().mockResolvedValue({
        provider: 'none',
        configured: false,
        hasStoredPassword: false,
        lastVerifiedAt: null,
      }),
      listEvents: vi.fn().mockResolvedValue([]),
      createEvent: vi.fn().mockResolvedValue({ success: true, eventId: 'evt-1' }),
      deleteEvent: vi.fn().mockResolvedValue({ success: true }),
      findFreeTime: vi.fn().mockResolvedValue([]),
    },
    finance: {
      status: vi.fn().mockResolvedValue({
        provider: 'none',
        configured: false,
        hasStoredAccessToken: false,
        hasStoredRefreshToken: false,
        hasStoredClientSecret: false,
        lastVerifiedAt: null,
      }),
      saveConfig: vi.fn().mockResolvedValue({
        provider: 'open-banking',
        configured: true,
        preset: 'openbanking-testbed',
        apiBaseUrl: 'https://testapi.openbanking.or.kr',
        clientId: 'client-id',
        fintechUseNum: '199003B123456789012345',
        providerLabel: 'KFTC Open Banking Testbed',
        hasStoredAccessToken: true,
        hasStoredRefreshToken: true,
        hasStoredClientSecret: true,
        lastVerifiedAt: 1742342400000,
      }),
      clearConfig: vi.fn().mockResolvedValue({
        provider: 'none',
        configured: false,
        hasStoredAccessToken: false,
        hasStoredRefreshToken: false,
        hasStoredClientSecret: false,
        lastVerifiedAt: null,
      }),
      accountSummary: vi.fn().mockResolvedValue(null),
      transactions: vi.fn().mockResolvedValue([]),
      transfer: vi.fn().mockResolvedValue({ success: true }),
    },
  }
}

describe('SettingsPage accessibility', () => {
  beforeEach(() => {
    ;(window as any).usan = createUsanMock()

    useSettingsStore.setState((state) => ({
      ...state,
      loaded: true,
      settings: {
        ...state.settings,
        locale: 'en',
        beginnerMode: true,
        voiceOverlayEnabled: true,
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

    document.documentElement.lang = 'en'
    setLocale('en')
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('has no serious or critical axe violations in simple mode', async () => {
    const { container } = render(<SettingsPage />)

    await screen.findByRole('heading', { name: 'Settings' })

    const result = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
      rules: {
        'color-contrast': { enabled: false },
      },
    })

    const importantViolations = result.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    )

    expect(importantViolations).toHaveLength(0)
  })

  it('supports keyboard tab navigation', async () => {
    render(<SettingsPage />)

    const tabs = await screen.findAllByRole('tab')
    expect(tabs.length).toBeGreaterThan(1)

    tabs[0]?.focus()
    fireEvent.keyDown(tabs[0]!, { key: 'ArrowDown' })

    await waitFor(() => {
      expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
    })
  })

  it('keeps advanced controls separated by section', async () => {
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        beginnerMode: false,
      },
    }))

    const { container } = render(<SettingsPage />)

    const generalTab = container.querySelector<HTMLButtonElement>('[data-settings-tab="general"]')
    expect(generalTab).not.toBeNull()
    fireEvent.click(generalTab!)

    await waitFor(() => {
      const generalPanel = container.querySelector('[data-settings-panel="general"]')
      expect(generalPanel).not.toBeNull()
      expect(generalPanel?.querySelector('[data-settings-card="permission-profile"]')).toBeNull()
      expect(generalPanel?.querySelector('[data-settings-card="ai-models"]')).toBeNull()
      expect(generalPanel?.querySelector('[data-settings-card="update-policy"]')).toBeNull()
    })

    fireEvent.click(container.querySelector<HTMLButtonElement>('[data-settings-tab="security"]')!)

    await waitFor(() => {
      const securityPanel = container.querySelector('[data-settings-panel="security"]')
      expect(securityPanel).not.toBeNull()
      expect(securityPanel?.querySelector('[data-settings-card="permission-profile"]')).not.toBeNull()
      expect(securityPanel?.querySelector('[data-settings-card="password-vault"]')).not.toBeNull()
      expect(securityPanel?.querySelector('[data-settings-card="ai-models"]')).toBeNull()
    })

    fireEvent.click(container.querySelector<HTMLButtonElement>('[data-settings-tab="models"]')!)

    await waitFor(() => {
      const modelsPanel = container.querySelector('[data-settings-panel="models"]')
      expect(modelsPanel).not.toBeNull()
      expect(modelsPanel?.querySelector('[data-settings-card="ai-models"]')).not.toBeNull()
      expect(modelsPanel?.querySelector('[data-settings-card="permission-profile"]')).toBeNull()
    })

    fireEvent.click(container.querySelector<HTMLButtonElement>('[data-settings-tab="about"]')!)

    await waitFor(() => {
      const aboutPanel = container.querySelector('[data-settings-panel="about"]')
      expect(aboutPanel).not.toBeNull()
      expect(aboutPanel?.querySelector('[data-settings-card="update-policy"]')).not.toBeNull()
    })
  })

  it('lets the user toggle the voice helper box in general settings', async () => {
    render(<SettingsPage />)

    const toggle = await screen.findByRole('switch', { name: 'Voice helper box' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(toggle)

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.voiceOverlayEnabled).toBe(false)
      expect((window as any).usan.settings.set).toHaveBeenCalledWith({ voiceOverlayEnabled: false })
    })
  })

  it('lets the user toggle advanced menus in general settings', async () => {
    render(<SettingsPage />)

    const toggle = await screen.findByRole('switch', { name: 'Show advanced menus' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(toggle)

    await waitFor(() => {
      expect(useSettingsStore.getState().settings.beginnerMode).toBe(false)
      expect((window as any).usan.settings.set).toHaveBeenCalledWith({ beginnerMode: false })
    })
  })

  it('localizes the language picker labels for Korean UI', async () => {
    useSettingsStore.setState((state) => ({
      ...state,
      loaded: true,
      settings: {
        ...state.settings,
        locale: 'ko',
        localeConfigured: true,
      },
    }))
    document.documentElement.lang = 'ko'
    setLocale('ko')

    render(<SettingsPage />)

    await screen.findByRole('heading', { name: '설정' })

    expect(screen.getByText('한국어')).toBeInTheDocument()
    expect(screen.getByText('영어')).toBeInTheDocument()
    expect(screen.getByText('일본어')).toBeInTheDocument()
  })
})
