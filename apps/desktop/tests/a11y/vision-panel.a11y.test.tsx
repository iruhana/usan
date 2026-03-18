// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import axe from 'axe-core'
import React from 'react'
import type { UiAnalysisResult } from '../../src/shared/types/infrastructure'
import VisionPanel from '../../src/renderer/src/components/vision/VisionPanel'
import { setLocale } from '../../src/renderer/src/i18n'

const analyzeUiMock = vi.fn<() => Promise<UiAnalysisResult>>()
const ocrMock = vi.fn()
const findElementMock = vi.fn()

const ANALYSIS_FIXTURE: UiAnalysisResult = {
  screenshot: 'ZmFrZS1pbWFnZQ==',
  elements: [
    {
      label: 'Search',
      type: 'input',
      bounds: { x: 90, y: 42, width: 280, height: 34 },
      confidence: 0.96,
    },
  ],
  ocr: {
    text: 'Search',
    confidence: 0.91,
    regions: [
      {
        text: 'Search',
        bounds: { x: 90, y: 42, width: 280, height: 34 },
      },
    ],
  },
  accessibilityTree: {
    id: '0',
    label: 'Search Window',
    role: 'Window',
    bounds: { x: 0, y: 0, width: 900, height: 640 },
    isEnabled: true,
    isOffscreen: false,
    hasKeyboardFocus: false,
    children: [
      {
        id: '0.0',
        label: 'Search',
        role: 'Edit',
        bounds: { x: 90, y: 42, width: 280, height: 34 },
        isEnabled: true,
        isOffscreen: false,
        hasKeyboardFocus: true,
        children: [],
      },
    ],
  },
  summary: {
    scope: 'active-window',
    nodeCount: 2,
    maxDepth: 1,
    truncated: false,
    rootLabel: 'Search Window',
    rootRole: 'Window',
  },
}

describe('VisionPanel accessibility', () => {
  beforeEach(() => {
    setLocale('en')
    analyzeUiMock.mockReset()
    ocrMock.mockReset()
    findElementMock.mockReset()

    ;(window as Window & { usan?: unknown }).usan = {
      vision: {
        analyzeUI: analyzeUiMock,
        ocr: ocrMock,
        findElement: findElementMock,
      },
    }

    ;(globalThis as typeof globalThis & { ResizeObserver?: typeof ResizeObserver }).ResizeObserver = class {
      observe() {}
      disconnect() {}
      unobserve() {}
    } as typeof ResizeObserver
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('has no serious or critical axe violations after loading accessibility data', async () => {
    analyzeUiMock.mockResolvedValue(ANALYSIS_FIXTURE)

    const { container } = render(<VisionPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Check screen' }))

    await screen.findByTestId('vision-accessibility-tree')

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
