// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import DashboardPage from '../../src/renderer/src/pages/DashboardPage'
import KnowledgePage from '../../src/renderer/src/pages/KnowledgePage'
import SettingsPage from '../../src/renderer/src/pages/SettingsPage'
import { setLocale } from '../../src/renderer/src/i18n'
import { useDashboardStore } from '../../src/renderer/src/stores/dashboard.store'
import { useKnowledgeStore } from '../../src/renderer/src/stores/knowledge.store'
import { useSettingsStore } from '../../src/renderer/src/stores/settings.store'

function createSettingsUsanMock() {
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

describe('beginner guidance copy', () => {
  beforeEach(() => {
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

  it('shows a quick reading guide on the beginner dashboard', async () => {
    useDashboardStore.setState((state) => ({
      ...state,
      metrics: {
        cpu: { usage: 28, cores: 8, temp: 0 },
        memory: { total: 16 * 1024 ** 3, used: 8 * 1024 ** 3, free: 8 * 1024 ** 3, percent: 50 },
        disk: [{ drive: 'C:', total: 512 * 1024 ** 3, used: 220 * 1024 ** 3, free: 292 * 1024 ** 3, percent: 43 }],
        network: { bytesIn: 2048, bytesOut: 1024, latency: 10 },
        battery: { percent: 82, charging: false },
      },
      metricsHistory: [],
      processes: [],
      suggestions: [],
      contextSnapshot: null,
      loading: false,
      error: null,
      monitorRunning: true,
      initialize: () => {},
      startMonitoring: async () => {},
      stopMonitoring: async () => {},
      loadProcesses: async () => {},
      refreshSuggestions: async () => {},
      dismissSuggestion: async () => {},
      configureProactive: async () => {},
    }))

    render(<DashboardPage />)

    expect((await screen.findAllByText('How to read this')).length).toBeGreaterThan(0)
    expect(
      screen.getAllByText('This is a quick summary. If something says Check soon, press Refresh and look again.').length,
    ).toBeGreaterThan(0)
  })

  it('keeps detailed system info and extra tools collapsed by default in advanced dashboard mode', async () => {
    useSettingsStore.setState((state) => ({
      ...state,
      loaded: true,
      settings: {
        ...state.settings,
        locale: 'en',
        beginnerMode: false,
      },
    }))

    useDashboardStore.setState((state) => ({
      ...state,
      metrics: {
        cpu: { usage: 22, cores: 8, temp: 0 },
        memory: { total: 16 * 1024 ** 3, used: 6 * 1024 ** 3, free: 10 * 1024 ** 3, percent: 38 },
        disk: [{ drive: 'C:', total: 512 * 1024 ** 3, used: 210 * 1024 ** 3, free: 302 * 1024 ** 3, percent: 41 }],
        network: { bytesIn: 2048, bytesOut: 1024, latency: 10 },
        battery: { percent: 82, charging: false },
      },
      metricsHistory: [],
      processes: [
        {
          pid: 42,
          name: 'Browser Helper',
          cpu: 12.4,
          memory: 256,
          windowTitle: 'Preview window',
        },
      ],
      suggestions: [],
      contextSnapshot: null,
      loading: false,
      error: null,
      monitorRunning: true,
      initialize: () => {},
      startMonitoring: async () => {},
      stopMonitoring: async () => {},
      loadProcesses: async () => {},
      refreshSuggestions: async () => {},
      dismissSuggestion: async () => {},
      configureProactive: async () => {},
    }))

    render(<DashboardPage />)

    expect(screen.getByText('Detailed process and monitor information is hidden for now.')).toBeInTheDocument()
    expect(screen.getByText('Extra tools are hidden for now to keep this page simple.')).toBeInTheDocument()
    expect(screen.queryByText('Browser Helper')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Show details' }))
    expect(await screen.findByText('Browser Helper')).toBeInTheDocument()
  })

  it('shows a quick usage guide on the beginner knowledge page', async () => {
    useKnowledgeStore.setState((state) => ({
      ...state,
      documents: [],
      searchResults: [],
      indexingProgress: null,
      indexSummary: null,
      loading: false,
      error: null,
      initialize: () => {},
      load: async () => {},
      indexFile: async () => {},
      indexFolder: async () => {},
      removeDocument: async () => {},
      search: async () => {},
      clearSearch: () => {},
      clearIndexSummary: () => {},
    }))

    render(<KnowledgePage />)

    expect(await screen.findByText('How to use saved info')).toBeInTheDocument()
    expect(screen.getByText('Add one file with Add file, or many files with Add folder. To find something later, type a word above and press Find.')).toBeInTheDocument()
  })

  it('shows plain-language helper text in developer settings sections', async () => {
    ;(window as any).usan = createSettingsUsanMock()

    useSettingsStore.setState((state) => ({
      ...state,
      loaded: true,
      settings: {
        ...state.settings,
        locale: 'en',
        beginnerMode: false,
      },
    }))

    render(<SettingsPage requestedTab="security" />)

    expect(await screen.findByText('Change this only if a feature cannot work on your computer.')).toBeInTheDocument()
    expect(screen.getByText('Bring in or delete saved sign-in info on this PC.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /About & Legal/i }))

    expect(await screen.findByText('Change this only when update problems happen. Most people can leave it as is.')).toBeInTheDocument()
    expect(screen.getByText('Open this only when something is not working.')).toBeInTheDocument()
  })
})
