/**
 * Macro tools: macro_record_start, macro_record_stop, macro_play, macro_list
 */
import type { ProviderTool } from '../providers/base'
import type { ToolHandler } from './types'
import { macroRecorder } from '../../macro/macro-recorder'

export const definitions: ProviderTool[] = [
  {
    name: 'macro_record_start',
    description: '매크로 녹화를 시작합니다. 마우스/키보드 동작을 기록합니다.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'macro_record_stop',
    description: '매크로 녹화를 중지하고 저장합니다.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '매크로 이름' },
      },
      required: ['name'],
    },
  },
  {
    name: 'macro_play',
    description: '저장된 매크로를 재생합니다.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string', description: '매크로 ID' } },
      required: ['id'],
    },
  },
  {
    name: 'macro_list',
    description: '저장된 매크로 목록을 조회합니다.',
    parameters: { type: 'object', properties: {} },
  },
]

export const handlers: Record<string, ToolHandler> = {
  async macro_record_start() {
    macroRecorder.startRecording()
    return { success: true, message: '매크로 녹화가 시작되었습니다.' }
  },

  async macro_record_stop(args) {
    const macro = macroRecorder.stopRecording(args.name as string)
    return { success: true, id: macro.id, name: macro.name, events: macro.events.length }
  },

  async macro_play(args) {
    await macroRecorder.play(args.id as string)
    return { success: true }
  },

  async macro_list() {
    const macros = macroRecorder.list()
    return {
      macros: macros.map((m) => ({
        id: m.id,
        name: m.name,
        events: m.events.length,
        createdAt: m.createdAt,
      })),
    }
  },
}
