// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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
        accountAlias: '주거래 통장',
        providerLabel: 'KFTC Open Banking Testbed',
        lastBalance: '1250000',
        currency: 'KRW',
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
    publicData: {
      status: vi.fn().mockResolvedValue({
        provider: 'none',
        configured: false,
        hasStoredServiceKey: false,
        lastVerifiedAt: null,
      }),
      saveConfig: vi.fn().mockResolvedValue({
        provider: 'odcloud',
        configured: true,
        preset: 'odcloud',
        apiBaseUrl: 'https://api.odcloud.kr',
        authMode: 'query',
        providerLabel: 'data.go.kr odcloud',
        serviceName: 'NTS business status',
        defaultPath: '/api/nts-businessman/v1/status',
        defaultFormat: 'json',
        hasStoredServiceKey: true,
        lastVerifiedAt: 1742342400000,
      }),
      clearConfig: vi.fn().mockResolvedValue({
        provider: 'none',
        configured: false,
        hasStoredServiceKey: false,
        lastVerifiedAt: null,
      }),
      query: vi.fn().mockResolvedValue(null),
      businessStatus: vi.fn().mockResolvedValue([]),
    },
    tax: {
      status: vi.fn().mockResolvedValue({
        provider: 'none',
        configured: false,
        hasStoredApiKey: false,
        lastVerifiedAt: null,
      }),
      saveConfig: vi.fn().mockResolvedValue({
        provider: 'barobill',
        configured: true,
        preset: 'barobill',
        apiBaseUrl: 'https://api.barobill.co.kr',
        authMode: 'header',
        providerLabel: 'Barobill',
        corporationNumber: '1234567890',
        businessStatePath: '/corp-state',
        hometaxPath: '/hometax',
        hasStoredApiKey: true,
        lastVerifiedAt: 1742342400000,
      }),
      clearConfig: vi.fn().mockResolvedValue({
        provider: 'none',
        configured: false,
        hasStoredApiKey: false,
        lastVerifiedAt: null,
      }),
      businessStatus: vi.fn().mockResolvedValue([]),
      hometaxEvidence: vi.fn().mockResolvedValue([]),
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

  it('shows Naver and Kakao connector cards', async () => {
    render(<SettingsPage requestedTab="connectors" />)

    const platformsCard = document.querySelector('[data-settings-card="korean-platforms"]')
    expect(platformsCard).not.toBeNull()

    const scoped = within(platformsCard!)
    expect(await scoped.findByText('Naver')).toBeInTheDocument()
    expect(scoped.getByText('Kakao')).toBeInTheDocument()
    expect(scoped.getAllByRole('button', { name: 'Connect' }).length).toBeGreaterThan(0)
  })

  it('saves an IMAP/SMTP email account from connectors settings', async () => {
    render(<SettingsPage requestedTab="connectors" />)

    const emailCard = document.querySelector('[data-settings-card="email-account"]')
    expect(emailCard).not.toBeNull()
    const scoped = within(emailCard!)

    fireEvent.change(await scoped.findByLabelText('Email address'), {
      target: { value: 'team@example.com' },
    })
    fireEvent.change(scoped.getByLabelText('Login username'), {
      target: { value: 'team@example.com' },
    })
    fireEvent.change(scoped.getByLabelText('Password or app password'), {
      target: { value: 'app-password-1234' },
    })
    fireEvent.click(scoped.getByRole('button', { name: 'Save and verify' }))

    expect((window as any).usan.email.saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        emailAddress: 'team@example.com',
        username: 'team@example.com',
        password: 'app-password-1234',
      }),
    )
  })

  it('saves a CalDAV calendar account from connectors settings', async () => {
    render(<SettingsPage requestedTab="connectors" />)

    const calendarCard = document.querySelector('[data-settings-card="calendar-account"]')
    expect(calendarCard).not.toBeNull()
    const scoped = within(calendarCard!)

    fireEvent.change(await scoped.findByLabelText('Login username'), {
      target: { value: 'calendar@example.com' },
    })
    fireEvent.change(scoped.getByLabelText('CalDAV server URL'), {
      target: { value: 'https://caldav.icloud.com' },
    })
    fireEvent.change(scoped.getByLabelText('Password or app password'), {
      target: { value: 'calendar-app-password' },
    })
    fireEvent.change(scoped.getByLabelText('Calendar URL'), {
      target: { value: 'https://caldav.icloud.com/root/default/' },
    })
    fireEvent.click(scoped.getByRole('button', { name: 'Save and verify' }))

    expect((window as any).usan.calendar.saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'calendar@example.com',
        serverUrl: 'https://caldav.icloud.com',
        password: 'calendar-app-password',
        calendarUrl: 'https://caldav.icloud.com/root/default/',
      }),
    )
  })

  it('saves an Open Banking account from connectors settings', async () => {
    render(<SettingsPage requestedTab="connectors" />)

    const financeCard = document.querySelector('[data-settings-card="finance-account"]')
    expect(financeCard).not.toBeNull()
    const scoped = within(financeCard!)

    fireEvent.change(await scoped.findByLabelText('Provider name'), {
      target: { value: 'KFTC Open Banking Testbed' },
    })
    fireEvent.change(scoped.getByLabelText('Client ID'), {
      target: { value: 'client-id' },
    })
    fireEvent.change(scoped.getByLabelText('Fintech use number'), {
      target: { value: '199003B123456789012345' },
    })
    fireEvent.change(scoped.getByLabelText('Access token'), {
      target: { value: 'access-token-123' },
    })
    fireEvent.click(scoped.getByRole('button', { name: 'Save and verify' }))

    expect((window as any).usan.finance.saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        providerLabel: 'KFTC Open Banking Testbed',
        clientId: 'client-id',
        fintechUseNum: '199003B123456789012345',
        accessToken: 'access-token-123',
      }),
    )
  })

  it('saves a Government24 public-data route from connectors settings', async () => {
    render(<SettingsPage requestedTab="connectors" />)

    const publicDataCard = document.querySelector('[data-settings-card="government-public-data"]')
    expect(publicDataCard).not.toBeNull()
    const scoped = within(publicDataCard!)

    fireEvent.change(await scoped.findByLabelText('Provider name'), {
      target: { value: 'Government24 / data.go.kr' },
    })
    fireEvent.change(scoped.getByLabelText('API base URL'), {
      target: { value: 'https://api.odcloud.kr' },
    })
    fireEvent.change(scoped.getByLabelText('Service key'), {
      target: { value: 'service-key-123' },
    })
    fireEvent.click(scoped.getByRole('button', { name: 'Save route' }))

    expect((window as any).usan.publicData.saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        providerLabel: 'Government24 / data.go.kr',
        apiBaseUrl: 'https://api.odcloud.kr',
        serviceKey: 'service-key-123',
      }),
    )
  })

  it('saves a Barobill-compatible tax route from connectors settings', async () => {
    render(<SettingsPage requestedTab="connectors" />)

    const taxCard = document.querySelector('[data-settings-card="tax-service"]')
    expect(taxCard).not.toBeNull()
    const scoped = within(taxCard!)

    fireEvent.change(await scoped.findByLabelText('Provider name'), {
      target: { value: 'Barobill' },
    })
    fireEvent.change(scoped.getByLabelText('API base URL'), {
      target: { value: 'https://api.barobill.co.kr' },
    })
    fireEvent.change(scoped.getByLabelText('API key'), {
      target: { value: 'barobill-key-123' },
    })
    fireEvent.change(scoped.getByLabelText('Business state path'), {
      target: { value: '/corp-state' },
    })
    fireEvent.click(scoped.getByRole('button', { name: 'Save route' }))

    expect((window as any).usan.tax.saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        providerLabel: 'Barobill',
        apiBaseUrl: 'https://api.barobill.co.kr',
        apiKey: 'barobill-key-123',
        businessStatePath: '/corp-state',
      }),
    )
  })
})
