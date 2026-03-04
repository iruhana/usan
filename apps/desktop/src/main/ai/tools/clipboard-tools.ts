/**
 * Clipboard tools: clipboard_history, clipboard_search, clipboard_pin, clipboard_transform
 */
import type { ProviderTool } from '../providers/base'
import type { ToolHandler } from './types'
import { clipboardManager } from '../../infrastructure/clipboard-manager'

export const definitions: ProviderTool[] = [
  {
    name: 'clipboard_history',
    description: '클립보드 히스토리를 조회합니다. 최근 복사한 텍스트 목록을 볼 수 있습니다.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: '표시할 항목 수 (기본: 20)' },
      },
    },
  },
  {
    name: 'clipboard_pin',
    description: '클립보드 항목을 고정합니다. 고정된 항목은 삭제되지 않습니다.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string', description: '항목 ID' } },
      required: ['id'],
    },
  },
  {
    name: 'clipboard_transform',
    description: '클립보드 항목의 형식을 변환합니다 (JSON 정리, URL 디코드, Base64 디코드, 마크다운→텍스트).',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '항목 ID' },
        format: { type: 'string', enum: ['json_pretty', 'url_decode', 'base64_decode', 'md_to_text'] },
      },
      required: ['id', 'format'],
    },
  },
]

export const handlers: Record<string, ToolHandler> = {
  async clipboard_history(args) {
    const limit = (args.limit as number) || 20
    const history = clipboardManager.getHistory().slice(0, limit)
    return {
      items: history.map((e) => ({
        id: e.id,
        text: e.text.slice(0, 200) + (e.text.length > 200 ? '...' : ''),
        pinned: e.pinned,
        timestamp: e.timestamp,
      })),
      total: clipboardManager.getHistory().length,
    }
  },

  async clipboard_pin(args) {
    clipboardManager.pin(args.id as string)
    return { success: true }
  },

  async clipboard_transform(args) {
    const result = clipboardManager.transform(
      args.id as string,
      args.format as 'json_pretty' | 'url_decode' | 'base64_decode' | 'md_to_text',
    )
    return { transformed: result }
  },
}
