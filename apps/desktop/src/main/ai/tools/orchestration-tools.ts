/**
 * App orchestration tools: app_launch, app_close, app_send_keys, app_list_running, app_com_invoke
 */
import type { ProviderTool } from '../providers/base'
import type { ToolHandler } from './types'
import { launchApp, closeApp, sendKeys, listRunningApps, comInvoke } from '../../orchestration/app-launcher'

export const definitions: ProviderTool[] = [
  {
    name: 'app_launch',
    description: '앱을 실행합니다 (예: notepad, calc, chrome).',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '실행할 프로그램 이름 또는 경로' },
        args: { type: 'string', description: '실행 인자 (선택)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'app_close',
    description: '실행 중인 앱을 종료합니다.',
    parameters: {
      type: 'object',
      properties: {
        processName: { type: 'string', description: '프로세스 이름 (확장자 제외, 예: notepad)' },
      },
      required: ['processName'],
    },
  },
  {
    name: 'app_send_keys',
    description: '특정 앱에 키 입력을 보냅니다 (SendKeys 형식).',
    parameters: {
      type: 'object',
      properties: {
        processName: { type: 'string', description: '프로세스 이름' },
        keys: { type: 'string', description: 'SendKeys 형식의 키 입력 (예: ^s = Ctrl+S)' },
      },
      required: ['processName', 'keys'],
    },
  },
  {
    name: 'app_list_running',
    description: '현재 실행 중인 앱 목록을 조회합니다 (창이 있는 앱만).',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'app_com_invoke',
    description: 'Windows COM 객체의 메서드를 호출합니다 (Excel, Word 등 Office 자동화).',
    parameters: {
      type: 'object',
      properties: {
        comClass: { type: 'string', description: 'COM 클래스 (예: Excel.Application)' },
        method: { type: 'string', description: '호출할 메서드' },
        args: {
          type: 'array',
          items: { type: 'string' },
          description: '메서드 인자 (선택)',
        },
      },
      required: ['comClass', 'method'],
    },
  },
]

export const handlers: Record<string, ToolHandler> = {
  async app_launch(args) {
    const result = await launchApp(args.name as string, args.args as string | undefined)
    return { success: true, pid: result.pid }
  },

  async app_close(args) {
    const result = await closeApp(args.processName as string)
    return { success: true, closed: result.closed }
  },

  async app_send_keys(args) {
    await sendKeys(args.processName as string, args.keys as string)
    return { success: true }
  },

  async app_list_running() {
    const apps = await listRunningApps()
    return { apps, count: apps.length }
  },

  async app_com_invoke(args) {
    const result = await comInvoke(
      args.comClass as string,
      args.method as string,
      args.args as string[] | undefined,
    )
    return { success: true, result }
  },
}
