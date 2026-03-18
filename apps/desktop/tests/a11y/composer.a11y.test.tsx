// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import axe from 'axe-core'
import React, { useState } from 'react'

import { Composer } from '../../src/renderer/src/components/composer'
import { setLocale } from '../../src/renderer/src/i18n'
import { useSettingsStore } from '../../src/renderer/src/stores/settings.store'

function ComposerHarness() {
  const [value, setValue] = useState('')

  return (
    <Composer
      value={value}
      onValueChange={setValue}
      onSubmit={vi.fn()}
    />
  )
}

describe('Composer accessibility', () => {
  beforeEach(() => {
    setLocale('en')
    document.documentElement.lang = 'en'
    window.localStorage.clear()

    useSettingsStore.setState((state) => ({
      ...state,
      loaded: true,
      settings: {
        ...state.settings,
        enterToSend: true,
        locale: 'en',
      },
    }))

    Object.defineProperty(window, 'usan', {
      configurable: true,
      value: {
        fs: {
          pick: vi.fn().mockResolvedValue({ canceled: true, paths: [] }),
        },
        computer: {
          screenshot: vi.fn().mockResolvedValue(null),
        },
        clipboardManager: {
          history: vi.fn().mockResolvedValue([]),
        },
      },
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('has no serious or critical axe violations', async () => {
    const { container } = render(<ComposerHarness />)

    await screen.findByTestId('composer')

    const result = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
      rules: {
        'color-contrast': { enabled: false },
      },
    })

    const importantViolations = result.violations.filter(
      (violation) => violation.impact === 'serious' || violation.impact === 'critical',
    )

    expect(
      importantViolations,
      JSON.stringify(
        importantViolations.map((violation) => ({
          id: violation.id,
          impact: violation.impact,
          description: violation.description,
          help: violation.help,
          nodeCount: violation.nodes.length,
        })),
        null,
        2,
      ),
    ).toHaveLength(0)
  })
})
