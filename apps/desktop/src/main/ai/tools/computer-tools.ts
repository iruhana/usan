/**
 * Computer use tools: screenshot, mouse, keyboard, windows, clipboard
 */
import type { ProviderTool } from '../providers/base'
import type { ToolHandler } from './types'
import { desktopCapturer, clipboard } from 'electron'
import { mouseClick, mouseDoubleClick, keyboardType, keyboardHotkey, listWindows, focusWindow } from '../../computer/control'

export const definitions: ProviderTool[] = [
  {
    name: 'screenshot',
    description: '현재 화면을 캡처하여 스크린샷을 찍습니다. 화면에 무엇이 있는지 확인할 때 사용합니다.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'mouse_click',
    description: '화면의 지정된 좌표를 마우스로 클릭합니다. 스크린샷으로 좌표를 확인한 후 사용하세요.',
    parameters: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X 좌표 (픽셀)' },
        y: { type: 'number', description: 'Y 좌표 (픽셀)' },
        button: { type: 'string', enum: ['left', 'right'], description: '마우스 버튼 (기본: left)' },
        double: { type: 'boolean', description: '더블 클릭 여부 (기본: false)' },
      },
      required: ['x', 'y'],
    },
  },
  {
    name: 'keyboard_type',
    description: '키보드로 텍스트를 입력합니다. 현재 활성화된 입력 필드에 타이핑합니다.',
    parameters: {
      type: 'object',
      properties: { text: { type: 'string', description: '입력할 텍스트' } },
      required: ['text'],
    },
  },
  {
    name: 'keyboard_hotkey',
    description: '키보드 단축키를 누릅니다. 예: Ctrl+C, Alt+Tab, Ctrl+S',
    parameters: {
      type: 'object',
      properties: {
        keys: { type: 'array', items: { type: 'string' }, description: '키 조합 배열. 예: ["ctrl", "c"], ["alt", "tab"]' },
      },
      required: ['keys'],
    },
  },
  {
    name: 'list_windows',
    description: '현재 열려 있는 모든 창의 목록을 보여줍니다.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'focus_window',
    description: '특정 창을 앞으로 가져옵니다. 창 제목이나 프로세스 이름으로 찾습니다.',
    parameters: {
      type: 'object',
      properties: { target: { type: 'string', description: '찾을 창 제목 또는 프로세스 이름 (부분 일치)' } },
      required: ['target'],
    },
  },
  {
    name: 'clipboard_read',
    description: '클립보드의 내용을 읽습니다.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'clipboard_write',
    description: '클립보드에 텍스트를 복사합니다.',
    parameters: {
      type: 'object',
      properties: { text: { type: 'string', description: '복사할 텍스트' } },
      required: ['text'],
    },
  },
]

export const handlers: Record<string, ToolHandler> = {
  async screenshot() {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    })
    const primary = sources[0]
    if (!primary) return { error: 'No screen source found' }
    const image = primary.thumbnail.toPNG().toString('base64')
    const size = primary.thumbnail.getSize()
    return { image, width: size.width, height: size.height }
  },

  async mouse_click(args) {
    const x = Math.round(args.x as number)
    const y = Math.round(args.y as number)
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > 7680 || y > 4320) {
      return { error: '좌표가 화면 범위를 벗어났습니다' }
    }
    const rawButton = String(args.button || 'left').toLowerCase()
    if (rawButton !== 'left' && rawButton !== 'right') {
      return { error: '마우스 버튼은 left 또는 right만 가능합니다' }
    }
    const button: 'left' | 'right' = rawButton
    if (args.double) {
      await mouseDoubleClick(x, y)
    } else {
      await mouseClick(x, y, button)
    }
    return { success: true, x, y, button }
  },

  async keyboard_type(args) {
    const text = args.text as string
    if (!text) return { error: '입력할 텍스트를 지정해주세요' }
    await keyboardType(text)
    return { success: true, typed: text.length }
  },

  async keyboard_hotkey(args) {
    const keys = args.keys as string[]
    if (!keys?.length) return { error: '키 조합을 지정해주세요' }
    await keyboardHotkey(keys)
    return { success: true, keys }
  },

  async list_windows() {
    const windows = await listWindows()
    return { windows, count: windows.length }
  },

  async focus_window(args) {
    const target = args.target as string
    if (!target) return { error: '창 제목 또는 프로세스 이름을 지정해주세요' }
    const found = await focusWindow(target)
    if (found) return { success: true, target }
    return { error: `'${target}' 창을 찾을 수 없습니다. list_windows로 열린 창 목록을 확인해보세요.` }
  },

  async clipboard_read() {
    return { text: clipboard.readText() }
  },

  async clipboard_write(args) {
    clipboard.writeText(args.text as string)
    return { success: true }
  },
}
