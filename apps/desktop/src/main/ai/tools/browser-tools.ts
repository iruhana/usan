/**
 * Browser automation tools: open, click, type, read, screenshot
 */
import type { ProviderTool } from '../providers/base'
import type { ToolHandler } from './types'
import { browserOpen, browserClick, browserType, browserRead, browserScreenshot } from '../../browser/browser-manager'

export const definitions: ProviderTool[] = [
  {
    name: 'browser_open',
    description: '브라우저에서 웹 페이지를 엽니다. URL을 입력하면 해당 페이지로 이동합니다.',
    parameters: {
      type: 'object',
      properties: { url: { type: 'string', description: '열 웹 주소 (예: https://naver.com)' } },
      required: ['url'],
    },
  },
  {
    name: 'browser_click',
    description: '브라우저 페이지에서 요소를 클릭합니다. CSS 선택자로 요소를 지정합니다.',
    parameters: {
      type: 'object',
      properties: { selector: { type: 'string', description: 'CSS 선택자 (예: button.submit, #search-input)' } },
      required: ['selector'],
    },
  },
  {
    name: 'browser_type',
    description: '브라우저 페이지의 입력 필드에 텍스트를 입력합니다.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '입력할 텍스트' },
        selector: { type: 'string', description: 'CSS 선택자 (선택, 없으면 현재 포커스된 요소)' },
      },
      required: ['text'],
    },
  },
  {
    name: 'browser_read',
    description: '현재 브라우저 페이지의 텍스트 내용을 읽습니다.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'browser_screenshot',
    description: '현재 브라우저 페이지의 스크린샷을 찍습니다.',
    parameters: { type: 'object', properties: {} },
  },
]

export const handlers: Record<string, ToolHandler> = {
  async browser_open(args) {
    const url = args.url as string
    if (!url) return { error: '웹 주소를 입력해주세요' }
    return browserOpen(url)
  },

  async browser_click(args) {
    const selector = args.selector as string
    if (!selector) return { error: 'CSS 선택자를 지정해주세요' }
    return browserClick(selector)
  },

  async browser_type(args) {
    const text = args.text as string
    if (!text) return { error: '입력할 텍스트를 지정해주세요' }
    return browserType(text, args.selector as string | undefined)
  },

  async browser_read() {
    return browserRead()
  },

  async browser_screenshot() {
    return browserScreenshot()
  },
}
