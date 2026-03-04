/**
 * Hotkey tools: list_hotkeys, set_hotkey, remove_hotkey
 */
import type { ProviderTool } from '../providers/base'
import type { ToolHandler } from './types'
import { hotkeyManager } from '../../infrastructure/hotkey-manager'

export const definitions: ProviderTool[] = [
  {
    name: 'list_hotkeys',
    description: '등록된 글로벌 단축키 목록을 조회합니다.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'set_hotkey',
    description: '글로벌 단축키를 등록합니다.',
    parameters: {
      type: 'object',
      properties: {
        label: { type: 'string', description: '단축키 이름' },
        accelerator: { type: 'string', description: 'Electron 단축키 형식 (예: "Ctrl+Shift+S")' },
        action: { type: 'string', description: '실행할 동작' },
      },
      required: ['label', 'accelerator', 'action'],
    },
  },
  {
    name: 'remove_hotkey',
    description: '등록된 글로벌 단축키를 제거합니다.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string', description: '단축키 ID' } },
      required: ['id'],
    },
  },
]

export const handlers: Record<string, ToolHandler> = {
  async list_hotkeys() {
    return { hotkeys: hotkeyManager.getAll() }
  },

  async set_hotkey(args) {
    const binding = {
      id: crypto.randomUUID(),
      label: args.label as string,
      accelerator: args.accelerator as string,
      action: args.action as string,
      enabled: true,
    }
    const success = hotkeyManager.register(binding)
    if (success) await hotkeyManager.saveUserBindings()
    return { success, id: binding.id, conflict: !success }
  },

  async remove_hotkey(args) {
    hotkeyManager.unregister(args.id as string)
    await hotkeyManager.saveUserBindings()
    return { success: true }
  },
}
