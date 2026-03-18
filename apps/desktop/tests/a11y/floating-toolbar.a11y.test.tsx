// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import axe from 'axe-core'
import React from 'react'

import FloatingToolbar from '../../src/renderer/src/components/ambient/FloatingToolbar'
import { setLocale } from '../../src/renderer/src/i18n'

function mountSelectedTextarea() {
  document.body.innerHTML = '<textarea data-testid="draft-input"></textarea>'
  const textarea = document.querySelector('textarea')
  if (!textarea) throw new Error('textarea missing')

  textarea.value = 'Accessible selected draft text'
  textarea.focus()

  Object.defineProperty(textarea, 'selectionStart', { configurable: true, value: 0 })
  Object.defineProperty(textarea, 'selectionEnd', { configurable: true, value: textarea.value.length })
  Object.defineProperty(textarea, 'getBoundingClientRect', {
    configurable: true,
    value: () =>
      ({
        left: 120,
        top: 220,
        right: 540,
        bottom: 272,
        width: 420,
        height: 52,
      }) as DOMRect,
  })
}

describe('FloatingToolbar accessibility', () => {
  beforeEach(() => {
    setLocale('en')
    document.documentElement.lang = 'en'

    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => {
        callback(0)
        return 1
      },
    })
    Object.defineProperty(window, 'cancelAnimationFrame', {
      configurable: true,
      value: vi.fn(),
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('has no serious or critical axe violations', async () => {
    mountSelectedTextarea()

    const { container } = render(<FloatingToolbar onNavigate={vi.fn()} />)
    fireEvent.keyUp(document, { key: 'Shift' })

    await screen.findByTestId('floating-toolbar')

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
