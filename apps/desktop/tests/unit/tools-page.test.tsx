// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import ToolsPage from '../../src/renderer/src/pages/ToolsPage'
import { useMarketplaceStore } from '../../src/renderer/src/stores/marketplace.store'
import { useSettingsStore } from '../../src/renderer/src/stores/settings.store'
import { setLocale, t } from '../../src/renderer/src/i18n'

describe('ToolsPage marketplace integration', () => {
  beforeEach(() => {
    useSettingsStore.setState((state) => ({
      ...state,
      loaded: true,
      settings: {
        ...state.settings,
        locale: 'en',
        beginnerMode: false,
      },
    }))
    useMarketplaceStore.setState({
      query: '',
      entries: [],
      installed: [],
      selectedEntryId: null,
      loading: false,
      error: null,
    })
    setLocale('en')
    document.documentElement.lang = 'en'

    ;(window as typeof window & { usan?: unknown }).usan = {
      marketplace: {
        search: vi.fn().mockResolvedValue([
          {
            id: 'remote-helper',
            name: 'Remote Helper',
            version: '1.0.0',
            description: 'Adds a remote browser bridge.',
            author: 'Usan',
            downloads: 42,
            rating: 4.8,
            tags: ['automation', 'browser'],
            mcpServerCount: 1,
          },
        ]),
        install: vi.fn().mockResolvedValue({
          manifest: {
            id: 'remote-helper',
            name: 'Remote Helper',
            version: '1.0.0',
            description: 'Adds a remote browser bridge.',
            author: 'Usan',
            skills: ['automation', 'browser'],
            mcpServers: [
              {
                id: 'bridge',
                name: 'Remote Bridge',
                transport: 'sse',
                url: 'https://example.com/mcp',
              },
            ],
          },
          path: 'C:\\Users\\admin\\AppData\\Roaming\\Usan\\plugins\\remote-helper',
          enabled: true,
          installedAt: 1742342400000,
          managedMcpServerIds: ['remote-helper--bridge'],
        }),
        update: vi.fn().mockResolvedValue(undefined),
      },
      plugin: {
        list: vi.fn().mockResolvedValue([]),
        uninstall: vi.fn().mockResolvedValue(undefined),
        enable: vi.fn().mockResolvedValue(undefined),
        disable: vi.fn().mockResolvedValue(undefined),
      },
      mcp: {
        listServers: vi.fn().mockResolvedValue([
          {
            id: 'remote-helper--bridge',
            name: 'Remote Bridge',
            connected: true,
            toolCount: 3,
          },
        ]),
        addServer: vi.fn().mockResolvedValue(undefined),
        removeServer: vi.fn().mockResolvedValue(undefined),
        connectServer: vi.fn().mockResolvedValue(undefined),
        disconnectServer: vi.fn().mockResolvedValue(undefined),
        listTools: vi.fn().mockResolvedValue([]),
        callTool: vi.fn().mockResolvedValue({}),
      },
    }
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders extra tools and MCP connections inside ToolsPage', async () => {
    render(<ToolsPage />)

    expect(await screen.findByRole('heading', { name: 'Tools' })).toBeInTheDocument()
    expect((await screen.findAllByText(t('marketplace.title'))).length).toBeGreaterThan(0)
    expect(await screen.findByText('Remote Helper')).toBeInTheDocument()
    expect(await screen.findByText('Remote Bridge')).toBeInTheDocument()
  })

  it('installs marketplace plugins directly from the integrated workspace', async () => {
    render(<ToolsPage />)

    const installButton = await screen.findByRole('button', { name: t('marketplace.install') })
    fireEvent.click(installButton)

    await waitFor(() => {
      expect(window.usan?.marketplace.install).toHaveBeenCalledWith('remote-helper')
    })
  })
})
