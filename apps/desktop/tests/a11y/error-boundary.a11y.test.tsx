// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import axe from 'axe-core'
import React from 'react'
import ErrorBoundary from '../../src/renderer/src/components/ErrorBoundary'
import { setLocale } from '../../src/renderer/src/i18n'
import { useSettingsStore } from '../../src/renderer/src/stores/settings.store'

function Thrower() {
  throw new Error('Forced render failure for test')
}

describe('ErrorBoundary accessibility', () => {
  beforeEach(() => {
    document.documentElement.lang = 'en'
    setLocale('en')
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        theme: 'light',
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

    ;(window as any).usan = {
      window: {
        minimize: vi.fn(),
        maximize: vi.fn(),
        close: vi.fn(),
      },
    }
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('has no serious or critical axe violations in the recovery screen', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const { container } = render(
      <ErrorBoundary>
        <Thrower />
      </ErrorBoundary>,
    )

    await screen.findByRole('alert')

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
    expect(screen.getByRole('button', { name: 'Open again' })).toBeInTheDocument()

    consoleSpy.mockRestore()
  })
})