// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'

vi.mock('../../src/renderer/src/components/shell/AppShell', () => ({
  default: () => <div data-testid="app-shell">shell</div>,
}))

vi.mock('../../src/renderer/src/components/onboarding/OnboardingWizard', () => ({
  default: () => <div data-testid="onboarding">onboarding</div>,
}))

vi.mock('../../src/renderer/src/components/OfflineBanner', () => ({
  default: () => null,
}))

import App from '../../src/renderer/src/App'
import { setLocale } from '../../src/renderer/src/i18n'
import { useSettingsStore } from '../../src/renderer/src/stores/settings.store'

function createUsanMock(localeConfigured: boolean, locale: 'ko' | 'en' | 'ja' = 'ko') {
  return {
    settings: {
      get: vi.fn().mockResolvedValue({
        ...useSettingsStore.getState().settings,
        schemaVersion: 7,
        locale,
        localeConfigured,
      }),
      set: vi.fn().mockResolvedValue(undefined),
    },
    system: {
      detectLocale: vi.fn().mockResolvedValue('en'),
    },
    permissions: {
      get: vi.fn().mockResolvedValue(null),
    },
  }
}

describe('App locale behavior', () => {
  beforeEach(() => {
    setLocale('ko')
    useSettingsStore.setState((state) => ({
      ...state,
      loaded: false,
      settings: {
        ...state.settings,
        schemaVersion: 7,
        locale: 'ko',
        localeConfigured: false,
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
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('does not override a user-configured Korean locale on startup', async () => {
    ;(window as any).usan = createUsanMock(true, 'ko')

    render(<App />)

    await screen.findByTestId('app-shell')

    expect((window as any).usan.system.detectLocale).not.toHaveBeenCalled()
    expect((window as any).usan.settings.set).not.toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'en' }),
    )
    expect(document.documentElement.lang).toBe('ko')
  })

  it('re-renders global UI when the locale changes in settings', async () => {
    ;(window as any).usan = createUsanMock(true, 'en')

    render(<App />)

    await screen.findByTestId('app-shell')
    expect(document.documentElement.lang).toBe('en')

    await act(async () => {
      await useSettingsStore.getState().update({ locale: 'ko' })
    })

    await waitFor(() => {
      expect(document.documentElement.lang).toBe('ko')
    })
  })
})
