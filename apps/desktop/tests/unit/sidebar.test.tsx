// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'

import Sidebar from '../../src/renderer/src/components/shell/Sidebar'
import { useSettingsStore } from '../../src/renderer/src/stores/settings.store'

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  })
}

describe('Sidebar', () => {
  beforeEach(() => {
    setViewportWidth(1280)

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
      settings: {
        set: vi.fn().mockResolvedValue(undefined),
      },
    }

    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        sidebarCollapsed: false,
      },
    }))
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders the 64px desktop rail on wide screens', () => {
    render(<Sidebar activePage="home" onNavigate={vi.fn()} />)

    const rail = screen.getByTestId('sidebar-rail')
    expect(rail).toHaveAttribute('data-sidebar-stage', 'default')
    expect(screen.getByLabelText('홈')).toBeInTheDocument()
  })

  it('switches to compact icon rail on mid-sized screens', () => {
    setViewportWidth(820)
    render(<Sidebar activePage="tasks" onNavigate={vi.fn()} />)

    expect(screen.getByTestId('sidebar-rail')).toHaveAttribute('data-sidebar-stage', 'compact')
  })

  it('shows a mobile drawer below 680px and closes after navigation', () => {
    setViewportWidth(640)
    const onNavigate = vi.fn()

    render(<Sidebar activePage="home" onNavigate={onNavigate} />)

    fireEvent.click(screen.getByTestId('sidebar-mobile-trigger'))
    fireEvent.click(screen.getByRole('button', { name: '작업' }))

    expect(onNavigate).toHaveBeenCalledWith('tasks')
    expect(screen.queryByRole('dialog', { name: '탐색' })).not.toBeInTheDocument()
  })
})
