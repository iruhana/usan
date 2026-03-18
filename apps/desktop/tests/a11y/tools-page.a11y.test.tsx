// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import axe from 'axe-core'
import React from 'react'
import ToolsPage from '../../src/renderer/src/pages/ToolsPage'
import { useSettingsStore } from '../../src/renderer/src/stores/settings.store'
import { setLocale, t } from '../../src/renderer/src/i18n'

describe('ToolsPage accessibility', () => {
  beforeEach(() => {
    useSettingsStore.setState((state) => ({
      ...state,
      loaded: true,
      settings: {
        ...state.settings,
        locale: 'en',
        beginnerMode: true,
      },
    }))
    setLocale('en')
    document.documentElement.lang = 'en'
  })

  afterEach(() => {
    cleanup()
  })

  it('has no serious or critical axe violations', async () => {
    const { container } = render(<ToolsPage />)
    await screen.findByRole('heading', { name: 'Tools' })

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

  it('shows beginner-safe section labels', async () => {
    render(<ToolsPage />)
    expect((await screen.findAllByText(t('tools.safeToolsSimple'))).length).toBeGreaterThan(0)
    expect((await screen.findAllByText(t('tools.dangerZoneSimple'))).length).toBeGreaterThan(0)
  })
})
