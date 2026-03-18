// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'

vi.mock('../../src/renderer/src/pages/HomePage', () => ({
  default: () => (
    <div data-testid="home-page">
      home
      <input aria-label="home-input" data-testid="home-input" type="text" />
    </div>
  ),
}))

vi.mock('../../src/renderer/src/pages/TasksPage', () => ({
  default: () => <div data-testid="tasks-page">tasks</div>,
}))

vi.mock('../../src/renderer/src/pages/FilesPage', () => ({
  default: () => <div data-testid="files-page">files</div>,
}))

vi.mock('../../src/renderer/src/pages/ToolsPage', () => ({
  default: () => <div data-testid="tools-page">tools</div>,
}))

vi.mock('../../src/renderer/src/pages/SettingsPage', () => ({
  default: ({ requestedTab }: { requestedTab?: string }) => (
    <div data-testid="settings-page">{requestedTab ?? 'settings'}</div>
  ),
}))

vi.mock('../../src/renderer/src/components/shell/Sidebar', () => ({
  default: ({
    activePage,
    onNavigate,
  }: {
    activePage: string
    onNavigate: (page: 'home' | 'tasks' | 'files' | 'tools' | 'settings') => void
  }) => (
    <div data-testid="sidebar">
      <span data-testid="active-page">{activePage}</span>
      <button type="button" onClick={() => onNavigate('tasks')}>
        tasks
      </button>
    </div>
  ),
}))

vi.mock('../../src/renderer/src/components/layout/CommandPalette', () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="command-palette">palette</div> : null,
}))

vi.mock('../../src/renderer/src/components/ambient/MiniLauncher', () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="mini-launcher">launcher</div> : null,
}))

vi.mock('../../src/renderer/src/components/ambient/FloatingToolbar', () => ({
  default: () => null,
}))

vi.mock('../../src/renderer/src/components/NotificationToast', () => ({
  default: () => <div data-testid="notification-toast">toast</div>,
}))

vi.mock('../../src/renderer/src/components/UndoToast', () => ({
  default: () => <div data-testid="undo-toast">undo</div>,
}))

vi.mock('../../src/renderer/src/components/skill/SkillRunner', () => ({
  default: () => <div data-testid="skill-runner">skill</div>,
}))

vi.mock('../../src/renderer/src/components/voice/VoiceOverlay', () => ({
  default: () => <div data-testid="voice-overlay">voice</div>,
}))

vi.mock('../../src/renderer/src/components/modal/SafetyConfirmationModal', () => ({
  default: () => <div data-testid="safety-modal">safety</div>,
}))

import AppShell from '../../src/renderer/src/components/shell/AppShell'
import { dispatchNavigate } from '../../src/renderer/src/lib/navigation-events'
import { useNotificationStore } from '../../src/renderer/src/stores/notification.store'
import { useSafetyStore } from '../../src/renderer/src/stores/safety.store'
import { useSkillStore } from '../../src/renderer/src/stores/skill.store'
import { useUndoStore } from '../../src/renderer/src/stores/undo.store'
import { useVoiceStore } from '../../src/renderer/src/stores/voice.store'

describe('AppShell', () => {
  beforeEach(() => {
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

    ;(window as typeof window & { usan?: unknown }).usan = {
      notifications: {
        onNotification: vi.fn().mockReturnValue(undefined),
      },
      voice: {
        onStatus: vi.fn().mockReturnValue(undefined),
      },
      window: {
        minimize: vi.fn(),
        maximize: vi.fn(),
        close: vi.fn(),
      },
    }

    useNotificationStore.setState({ toasts: [], listening: false })
    useUndoStore.setState({ visible: false, message: '', undoFn: null, timerId: null })
    useVoiceStore.setState({
      status: { status: 'idle' },
      lastText: '',
      hidden: false,
      listening: false,
      eventVersion: 0,
    })
    useSkillStore.setState({ currentRun: null })
    useSafetyStore.setState({ open: false, prompt: null, resolve: null })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders the shell frame and home page by default', async () => {
    render(<AppShell />)

    expect(screen.getByTestId('app-shell')).toBeInTheDocument()
    await screen.findByTestId('home-page')
    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
  })

  it('opens and closes the command palette with keyboard shortcuts', async () => {
    render(<AppShell />)
    await screen.findByTestId('home-page')

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    })

    expect(await screen.findByTestId('command-palette')).toBeInTheDocument()

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    await waitFor(() => {
      expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument()
    })
  })

  it('opens and closes the mini launcher with global shortcuts', async () => {
    render(<AppShell />)
    await screen.findByTestId('home-page')

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', ctrlKey: true }))
    })

    expect(await screen.findByTestId('mini-launcher')).toBeInTheDocument()

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    await waitFor(() => {
      expect(screen.queryByTestId('mini-launcher')).not.toBeInTheDocument()
    })

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'u', altKey: true }))
    })

    expect(await screen.findByTestId('mini-launcher')).toBeInTheDocument()
  })

  it('does not open the mini launcher while typing in an input field', async () => {
    render(<AppShell />)
    const input = await screen.findByTestId('home-input')

    input.focus()

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', ctrlKey: true, bubbles: true }))
    })

    await waitFor(() => {
      expect(screen.queryByTestId('mini-launcher')).not.toBeInTheDocument()
    })
  })

  it('navigates via keyboard and app-level navigation events', async () => {
    render(<AppShell />)
    await screen.findByTestId('home-page')

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', ctrlKey: true }))
    })

    expect(await screen.findByTestId('tasks-page')).toBeInTheDocument()

    await act(async () => {
      dispatchNavigate({ page: 'settings' })
    })

    expect(await screen.findByTestId('settings-page')).toBeInTheDocument()
  })
})
