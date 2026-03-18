import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UiAnalysisResult } from '../../src/shared/types/infrastructure'

const analyzeUiFromScreenMock = vi.fn<() => Promise<UiAnalysisResult>>()

vi.mock('../../src/main/vision/ui-detector', () => ({
  analyzeUiFromScreen: () => analyzeUiFromScreenMock(),
}))

describe('vision-tools', () => {
  beforeEach(() => {
    analyzeUiFromScreenMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns structured accessibility data from screen_analyze_ui', async () => {
    analyzeUiFromScreenMock.mockResolvedValue({
      screenshot: 'base64-image',
      elements: [
        {
          label: 'Sign in',
          type: 'button',
          bounds: { x: 100, y: 80, width: 120, height: 32 },
          confidence: 0.95,
        },
      ],
      ocr: {
        text: 'Sign in',
        confidence: 0.9,
        regions: [],
      },
      accessibilityTree: {
        id: '0',
        label: 'Demo App',
        role: 'Window',
        bounds: { x: 0, y: 0, width: 800, height: 600 },
        isEnabled: true,
        isOffscreen: false,
        hasKeyboardFocus: false,
        children: [],
      },
      summary: {
        scope: 'active-window',
        nodeCount: 1,
        maxDepth: 0,
        truncated: false,
        rootLabel: 'Demo App',
        rootRole: 'Window',
      },
    })

    const { handlers } = await import('../../src/main/ai/tools/vision-tools')
    const result = await handlers.screen_analyze_ui({ description: 'find the login button' })

    expect(analyzeUiFromScreenMock).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      screenshot: 'base64-image',
      description: 'find the login button',
      elements: [
        expect.objectContaining({
          label: 'Sign in',
        }),
      ],
      summary: {
        scope: 'active-window',
        nodeCount: 1,
      },
      accessibilityTree: {
        label: 'Demo App',
      },
    })
  })
})
