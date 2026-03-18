import type { ProviderTool } from '../providers/base'
import type { ToolHandler } from './types'
import { detectAutomationTarget } from '../../mcp/app-detector'
import { listAutomationRoutes, resolveAutomationRoute } from '../../mcp/router'
import { qtBridgeProvider } from '../../mcp/providers/qt-bridge'

async function resolveQtPid(args: Record<string, unknown>): Promise<number> {
  const pid = typeof args.pid === 'number' ? Math.floor(args.pid) : undefined
  const target = typeof args.target === 'string' ? args.target.trim() : undefined

  const detected = await detectAutomationTarget({ pid, target })
  if (!detected) {
    throw new Error('대상 앱을 찾을 수 없습니다.')
  }
  if (detected.framework !== 'qt') {
    throw new Error(`Qt 앱이 아닙니다: ${detected.processName} (${detected.framework})`)
  }
  return detected.pid
}

export const definitions: ProviderTool[] = [
  {
    name: 'app_list_targets',
    description: '실행 중인 앱을 감지하고 어떤 자동화 제공자(playwright, chrome-devtools, qt-bridge, windows-mcp)로 연결할지 보여줍니다.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: '최대 결과 수 (기본 30)' },
      },
    },
  },
  {
    name: 'app_detect_target',
    description: '특정 PID 또는 이름으로 실행 중인 앱의 자동화 라우팅 결과를 확인합니다.',
    parameters: {
      type: 'object',
      properties: {
        pid: { type: 'number', description: '프로세스 ID' },
        target: { type: 'string', description: '창 제목 또는 프로세스 이름 일부' },
      },
    },
  },
  {
    name: 'qt_bridge_connect',
    description: '실행 중인 Qt 앱에 ubridge-qt를 주입하고 연결합니다.',
    parameters: {
      type: 'object',
      properties: {
        pid: { type: 'number', description: 'Qt 앱 프로세스 ID' },
        target: { type: 'string', description: 'Qt 앱 창 제목 또는 프로세스 이름 일부' },
      },
    },
  },
  {
    name: 'qt_get_object_tree',
    description: 'Qt 앱의 QObject 트리를 가져옵니다.',
    parameters: {
      type: 'object',
      properties: {
        pid: { type: 'number', description: 'Qt 앱 프로세스 ID' },
        target: { type: 'string', description: 'Qt 앱 창 제목 또는 프로세스 이름 일부' },
        maxDepth: { type: 'number', description: '최대 탐색 깊이 (기본 4)' },
      },
    },
  },
  {
    name: 'qt_get_property',
    description: 'Qt 객체의 프로퍼티 값을 읽습니다.',
    parameters: {
      type: 'object',
      properties: {
        pid: { type: 'number', description: 'Qt 앱 프로세스 ID' },
        target: { type: 'string', description: 'Qt 앱 창 제목 또는 프로세스 이름 일부' },
        objectPath: { type: 'string', description: '객체 경로. 예: MainWindow/centralWidget/pushButton_1' },
        property: { type: 'string', description: '프로퍼티 이름' },
      },
      required: ['objectPath', 'property'],
    },
  },
  {
    name: 'qt_find_object',
    description: 'Qt 객체를 objectName 또는 클래스 이름으로 검색합니다.',
    parameters: {
      type: 'object',
      properties: {
        pid: { type: 'number', description: 'Qt 앱 프로세스 ID' },
        target: { type: 'string', description: 'Qt 앱 창 제목 또는 프로세스 이름 일부' },
        query: { type: 'string', description: '검색어' },
      },
      required: ['query'],
    },
  },
  {
    name: 'qt_set_property',
    description: 'Qt 객체의 프로퍼티 값을 씁니다.',
    parameters: {
      type: 'object',
      properties: {
        pid: { type: 'number', description: 'Qt 앱 프로세스 ID' },
        target: { type: 'string', description: 'Qt 앱 창 제목 또는 프로세스 이름 일부' },
        objectPath: { type: 'string', description: '객체 경로' },
        property: { type: 'string', description: '프로퍼티 이름' },
        value: { description: '설정할 값' },
      },
      required: ['objectPath', 'property', 'value'],
    },
  },
  {
    name: 'qt_invoke_method',
    description: 'Qt 객체의 메서드 또는 슬롯을 호출합니다.',
    parameters: {
      type: 'object',
      properties: {
        pid: { type: 'number', description: 'Qt 앱 프로세스 ID' },
        target: { type: 'string', description: 'Qt 앱 창 제목 또는 프로세스 이름 일부' },
        objectPath: { type: 'string', description: '객체 경로' },
        method: { type: 'string', description: '호출할 메서드 이름' },
        args: {
          type: 'array',
          description: '메서드 인자 배열',
          items: {},
        },
      },
      required: ['objectPath', 'method'],
    },
  },
  {
    name: 'qt_screenshot',
    description: 'Qt 위젯 스크린샷을 base64 PNG로 가져옵니다.',
    parameters: {
      type: 'object',
      properties: {
        pid: { type: 'number', description: 'Qt 앱 프로세스 ID' },
        target: { type: 'string', description: 'Qt 앱 창 제목 또는 프로세스 이름 일부' },
        objectPath: { type: 'string', description: '위젯 객체 경로. 비우면 루트 전체 캡처 시도' },
      },
    },
  },
]

export const handlers: Record<string, ToolHandler> = {
  async app_list_targets(args) {
    const limit = typeof args.limit === 'number' ? args.limit : 30
    const routes = await listAutomationRoutes({ limit })
    return { targets: routes, count: routes.length }
  },

  async app_detect_target(args) {
    const route = await resolveAutomationRoute({
      pid: typeof args.pid === 'number' ? Math.floor(args.pid) : undefined,
      target: typeof args.target === 'string' ? args.target : undefined,
    })
    if (!route) {
      return { error: '대상 앱을 찾을 수 없습니다.' }
    }
    return route
  },

  async qt_bridge_connect(args) {
    const pid = await resolveQtPid(args)
    await qtBridgeProvider.inject(pid)
    return {
      success: true,
      pid,
      connections: qtBridgeProvider.getConnectionStatus(),
    }
  },

  async qt_get_object_tree(args) {
    const pid = await resolveQtPid(args)
    const maxDepth = typeof args.maxDepth === 'number' ? Math.max(1, Math.floor(args.maxDepth)) : 4
    const tree = await qtBridgeProvider.getObjectTree(pid, maxDepth)
    return { pid, tree }
  },

  async qt_get_property(args) {
    const pid = await resolveQtPid(args)
    const objectPath = String(args.objectPath ?? '').trim()
    const property = String(args.property ?? '').trim()
    if (!objectPath || !property) {
      return { error: 'objectPath와 property가 필요합니다.' }
    }
    const value = await qtBridgeProvider.getProperty(pid, objectPath, property)
    return { pid, objectPath, property, value }
  },

  async qt_find_object(args) {
    const pid = await resolveQtPid(args)
    const query = String(args.query ?? '').trim()
    if (!query) {
      return { error: 'query가 필요합니다.' }
    }
    const matches = await qtBridgeProvider.findObject(pid, query)
    return { pid, query, matches, count: matches.length }
  },

  async qt_set_property(args) {
    const pid = await resolveQtPid(args)
    const objectPath = String(args.objectPath ?? '').trim()
    const property = String(args.property ?? '').trim()
    if (!objectPath || !property) {
      return { error: 'objectPath와 property가 필요합니다.' }
    }
    await qtBridgeProvider.setProperty(pid, objectPath, property, args.value)
    return { success: true, pid, objectPath, property }
  },

  async qt_invoke_method(args) {
    const pid = await resolveQtPid(args)
    const objectPath = String(args.objectPath ?? '').trim()
    const method = String(args.method ?? '').trim()
    if (!objectPath || !method) {
      return { error: 'objectPath와 method가 필요합니다.' }
    }
    const result = await qtBridgeProvider.invokeMethod(
      pid,
      objectPath,
      method,
      Array.isArray(args.args) ? args.args : undefined,
    )
    return { pid, objectPath, method, result }
  },

  async qt_screenshot(args) {
    const pid = await resolveQtPid(args)
    const objectPath = typeof args.objectPath === 'string' && args.objectPath.trim()
      ? args.objectPath.trim()
      : undefined
    const image = await qtBridgeProvider.screenshot(pid, objectPath)
    return { pid, objectPath: objectPath ?? null, image }
  },
}
