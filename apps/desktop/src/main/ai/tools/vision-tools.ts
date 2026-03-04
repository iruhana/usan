/**
 * Vision tools: screen_ocr, screen_analyze_ui, screen_region_capture
 */
import type { ProviderTool } from '../providers/base'
import type { ToolHandler } from './types'
import { captureScreen, captureRegion, imageToBase64 } from '../../vision/screen-analyzer'

export const definitions: ProviderTool[] = [
  {
    name: 'screen_ocr',
    description: '현재 화면에서 텍스트를 추출합니다 (OCR). 화면에 보이는 모든 텍스트를 읽어옵니다.',
    parameters: {
      type: 'object',
      properties: {
        region: {
          type: 'object',
          description: '캡처할 영역 (생략 시 전체 화면)',
          properties: {
            x: { type: 'number' }, y: { type: 'number' },
            width: { type: 'number' }, height: { type: 'number' },
          },
        },
      },
    },
  },
  {
    name: 'screen_analyze_ui',
    description: '현재 화면의 UI 요소(버튼, 입력필드, 텍스트 등)를 분석합니다.',
    parameters: {
      type: 'object',
      properties: {
        description: { type: 'string', description: '분석할 내용 설명 (예: "로그인 버튼 찾기")' },
      },
    },
  },
  {
    name: 'screen_region_capture',
    description: '화면의 특정 영역을 캡처하여 이미지로 반환합니다.',
    parameters: {
      type: 'object',
      properties: {
        x: { type: 'number', description: '시작 X 좌표' },
        y: { type: 'number', description: '시작 Y 좌표' },
        width: { type: 'number', description: '영역 너비' },
        height: { type: 'number', description: '영역 높이' },
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
    // Return image for AI vision model to extract text
    return {
      screenshot: base64,
      instruction: 'AI가 이 스크린샷에서 텍스트를 추출합니다. 화면에 보이는 모든 텍스트를 읽어주세요.',
    }
  },

  async screen_analyze_ui(args) {
    const buffer = await captureScreen()
    const base64 = await imageToBase64(buffer)
    return {
      screenshot: base64,
      description: args.description || '',
      instruction: 'AI가 이 스크린샷의 UI 요소를 분석합니다. 버튼, 입력필드, 메뉴, 텍스트 등의 위치와 내용을 파악해주세요.',
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
