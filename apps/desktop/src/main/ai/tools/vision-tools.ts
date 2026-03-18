/**
 * Vision tools: screen_ocr, screen_analyze_ui, screen_region_capture
 */
import type { ProviderTool } from '../providers/base'
import type { ToolHandler } from './types'
import { captureScreen, captureRegion, imageToBase64 } from '../../vision/screen-analyzer'
import { analyzeUiFromScreen } from '../../vision/ui-detector'

export const definitions: ProviderTool[] = [
  {
    name: 'screen_ocr',
    description: 'Extract text from the current screen or a specific region using OCR.',
    parameters: {
      type: 'object',
      properties: {
        region: {
          type: 'object',
          description: 'Optional capture region. When omitted, the full screen is used.',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            width: { type: 'number' },
            height: { type: 'number' },
          },
        },
      },
    },
  },
  {
    name: 'screen_analyze_ui',
    description: 'Analyze the current screen UI with OCR, visible elements, and accessibility tree data.',
    parameters: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'Optional task hint, for example "find the login button".',
        },
      },
    },
  },
  {
    name: 'screen_region_capture',
    description: 'Capture a specific screen region and return it as an image.',
    parameters: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'Start X coordinate.' },
        y: { type: 'number', description: 'Start Y coordinate.' },
        width: { type: 'number', description: 'Region width.' },
        height: { type: 'number', description: 'Region height.' },
      },
      required: ['x', 'y', 'width', 'height'],
    },
  },
]

export const handlers: Record<string, ToolHandler> = {
  async screen_ocr(args) {
    const region = args.region as { x: number; y: number; width: number; height: number } | undefined
    const buffer = region
      ? await captureRegion(region)
      : await captureScreen()
    const base64 = await imageToBase64(buffer)

    return {
      screenshot: base64,
      instruction: 'Extract all readable text from this screenshot.',
    }
  },

  async screen_analyze_ui(args) {
    const analysis = await analyzeUiFromScreen()

    return {
      screenshot: analysis.screenshot,
      description: args.description || '',
      elements: analysis.elements,
      accessibilityTree: analysis.accessibilityTree,
      summary: analysis.summary,
      instruction: 'Use the structured UI data first, then inspect the screenshot for anything the accessibility tree missed.',
    }
  },

  async screen_region_capture(args) {
    const region = {
      x: args.x as number,
      y: args.y as number,
      width: args.width as number,
      height: args.height as number,
    }
    const buffer = await captureRegion(region)
    const base64 = await imageToBase64(buffer)
    return { screenshot: base64, region }
  },
}
