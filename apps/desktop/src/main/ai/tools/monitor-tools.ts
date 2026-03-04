/**
 * System monitor & multi-monitor tools
 */
import type { ProviderTool } from '../providers/base'
import type { ToolHandler } from './types'
import { systemMonitor, getProcesses } from '../../infrastructure/system-monitor'
import { contextManager } from '../../infrastructure/context-manager'
import { captureScreen, captureRegion, imageToBase64 } from '../../vision/screen-analyzer'
import { getContextSummary } from '../../context/context-injector'

export const definitions: ProviderTool[] = [
  {
    name: 'system_health',
    description: '시스템 상태를 확인합니다 (CPU, 메모리, 디스크, 배터리, 네트워크).',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'system_processes',
    description: '실행 중인 프로세스 목록을 확인합니다 (CPU 사용량 순).',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: '표시할 프로세스 수 (기본: 15)' },
      },
    },
  },
  {
    name: 'get_context',
    description: '현재 사용자 컨텍스트를 조회합니다 (활성 앱, 시간대, 시스템 상태).',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'list_monitors',
    description: '연결된 모니터 목록을 조회합니다.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'screenshot_monitor',
    description: '특정 모니터의 스크린샷을 촬영합니다.',
    parameters: {
      type: 'object',
      properties: {
        displayId: { type: 'number', description: '모니터 ID (생략 시 주 모니터)' },
      },
    },
  },
  {
    name: 'screenshot_region',
    description: '화면의 특정 영역을 캡처합니다.',
    parameters: {
      type: 'object',
      properties: {
        x: { type: 'number' }, y: { type: 'number' },
        width: { type: 'number' }, height: { type: 'number' },
        displayId: { type: 'number', description: '모니터 ID (선택)' },
      },
      required: ['x', 'y', 'width', 'height'],
    },
  },
]

export const handlers: Record<string, ToolHandler> = {
  async system_health() {
    const metrics = systemMonitor.getLatest()
    if (!metrics) return { error: '시스템 모니터링이 시작되지 않았습니다' }
    return metrics
  },

  async system_processes(args) {
    const limit = (args.limit as number) || 15
    const processes = await getProcesses(limit)
    return { processes }
  },

  async get_context() {
    return getContextSummary()
  },

  async list_monitors() {
    const snapshot = contextManager.getSnapshot()
    return { monitors: snapshot.monitors }
  },

  async screenshot_monitor(args) {
    const buffer = await captureScreen(args.displayId as number | undefined)
    const base64 = await imageToBase64(buffer)
    return { screenshot: base64 }
  },

  async screenshot_region(args) {
    const buffer = await captureRegion({
      x: args.x as number,
      y: args.y as number,
      width: args.width as number,
      height: args.height as number,
    }, args.displayId as number | undefined)
    const base64 = await imageToBase64(buffer)
    return { screenshot: base64 }
  },
}
