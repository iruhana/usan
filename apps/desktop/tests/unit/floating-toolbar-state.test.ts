// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import {
  getFloatingToolbarPosition,
  resolveFloatingSelection,
} from '../../src/renderer/src/components/ambient/floating-toolbar-state'

describe('floating-toolbar-state', () => {
  it('resolves selected text from an active textarea', () => {
    document.body.innerHTML = '<textarea data-testid="editor">Selected toolbar text</textarea>'
    const textarea = document.querySelector('textarea')
    if (!textarea) throw new Error('textarea missing')

    Object.defineProperty(textarea, 'selectionStart', { configurable: true, value: 0 })
    Object.defineProperty(textarea, 'selectionEnd', { configurable: true, value: 8 })
    textarea.focus()

    const snapshot = resolveFloatingSelection(document)

    expect(snapshot?.text).toBe('Selected')
    expect(snapshot?.source).toBe('editable')
  })

  it('positions above the selection when there is room', () => {
    const position = getFloatingToolbarPosition(
      {
        left: 200,
        top: 240,
        right: 320,
        bottom: 270,
        width: 120,
        height: 30,
      },
      { width: 240, height: 120 },
      { width: 1200, height: 800 },
    )

    expect(position.placement).toBe('above')
    expect(position.top).toBeLessThan(240)
  })

  it('flips below the selection when there is no room above', () => {
    const position = getFloatingToolbarPosition(
      {
        left: 40,
        top: 20,
        right: 140,
        bottom: 44,
        width: 100,
        height: 24,
      },
      { width: 260, height: 140 },
      { width: 480, height: 320 },
    )

    expect(position.placement).toBe('below')
    expect(position.top).toBeGreaterThanOrEqual(44)
  })
})
