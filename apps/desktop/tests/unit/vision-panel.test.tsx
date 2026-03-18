// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import React from 'react'
import type { UiAnalysisResult, UiElement } from '../../src/shared/types/infrastructure'
import VisionPanel from '../../src/renderer/src/components/vision/VisionPanel'
import { setLocale } from '../../src/renderer/src/i18n'

const analyzeUiMock = vi.fn<() => Promise<UiAnalysisResult>>()
const ocrMock = vi.fn()
const findElementMock = vi.fn<(_: string) => Promise<UiElement | null>>()

const ANALYSIS_FIXTURE: UiAnalysisResult = {
  screenshot: 'ZmFrZS1pbWFnZQ==',
  elements: [
    {
      label: 'Sign in',
      type: 'button',
      bounds: { x: 120, y: 88, width: 140, height: 36 },
      confidence: 0.95,
    },
  ],
  ocr: {
    text: 'Sign in',
    confidence: 0.92,
    regions: [
      {
        text: 'Sign in',
        bounds: { x: 120, y: 88, width: 140, height: 36 },
      },
    ],
  },
  accessibilityTree: {
    id: '0',
    label: 'Demo App',
    role: 'Window',
    bounds: { x: 0, y: 0, width: 800, height: 600 },
    isEnabled: true,
    isOffscreen: false,
    hasKeyboardFocus: false,
    children: [
      {
        id: '0.0',
        label: 'Sign in',
        role: 'Button',
        automationId: 'login-submit',
        bounds: { x: 120, y: 88, width: 140, height: 36 },
        isEnabled: true,
        isOffscreen: false,
        hasKeyboardFocus: true,
        children: [],
      },
    ],
  },
  summary: {
    scope: 'focused-window',
    nodeCount: 2,
    maxDepth: 1,
    truncated: false,
    rootLabel: 'Demo App',
    rootRole: 'Window',
  },
}

describe('VisionPanel', () => {
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

  it('renders accessibility data from analyzeUI without a duplicate OCR call', async () => {
    analyzeUiMock.mockResolvedValue(ANALYSIS_FIXTURE)
    ocrMock.mockResolvedValue(ANALYSIS_FIXTURE.ocr)

    render(<VisionPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Check screen' }))

    expect(await screen.findByTestId('vision-accessibility-tree')).toBeInTheDocument()
    expect(screen.getByText('Focused window')).toBeInTheDocument()
    const childNode = await screen.findByTestId('vision-tree-node-0.0')
    expect(childNode).toHaveTextContent('Sign in')
    fireEvent.click(childNode)
    expect(screen.getByTestId('vision-accessibility-details')).toHaveTextContent('login-submit')
    expect(screen.getAllByText('Sign in').length).toBeGreaterThan(0)
    expect(analyzeUiMock).toHaveBeenCalledTimes(1)
    expect(ocrMock).not.toHaveBeenCalled()
  })

  it('loads analysis on demand when finding an element first', async () => {
    analyzeUiMock.mockResolvedValue(ANALYSIS_FIXTURE)
    findElementMock.mockResolvedValue(ANALYSIS_FIXTURE.elements[0] ?? null)

    render(<VisionPanel />)

    fireEvent.change(screen.getByPlaceholderText('Find element'), {
      target: { value: 'Sign in' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Find element' }))

    await waitFor(() => {
      expect(findElementMock).toHaveBeenCalledWith('Sign in')
      expect(analyzeUiMock).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByText(/Find element:/)).toBeInTheDocument()
    expect(screen.getByTestId('vision-accessibility-tree')).toBeInTheDocument()
  })
})
