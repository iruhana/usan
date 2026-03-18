import type { ProviderTool } from '../providers/base'
import type { ToolHandler } from './types'
import {
  callRoutedAutomationTool,
  listAutomationProviders,
  listToolsForAutomationProvider,
} from '../../mcp'
import type { AutomationProvider } from '../../mcp/app-detector'

function normalizeProvider(value: unknown): AutomationProvider | undefined {
  if (typeof value !== 'string') return undefined
  if (value === 'playwright' || value === 'chrome-devtools' || value === 'windows-mcp' || value === 'qt-bridge') {
    return value
  }
  return undefined
}

export const definitions: ProviderTool[] = [
  {
    name: 'app_list_providers',
    description: '자동화 제공자(playwright, chrome-devtools, windows-mcp, qt-bridge)의 현재 연결 상태와 준비 상태를 보여줍니다.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'app_list_provider_tools',
    description: '대상 앱에 맞는 자동화 제공자를 확인하고, 현재 사용 가능한 provider tool 목록을 보여줍니다.',
    parameters: {
      type: 'object',
      properties: {
        provider: { type: 'string', description: '명시적 provider 이름 (선택)' },
        pid: { type: 'number', description: '대상 프로세스 ID (선택)' },
        target: { type: 'string', description: '창 제목 또는 프로세스명 (선택)' },
      },
    },
  },
  {
    name: 'app_call_provider_tool',
    description: '감지된 자동화 제공자 또는 명시한 provider를 통해 provider tool을 직접 호출합니다.',
    parameters: {
      type: 'object',
      properties: {
        provider: { type: 'string', description: '명시적 provider 이름 (선택)' },
        pid: { type: 'number', description: '대상 프로세스 ID (선택)' },
        target: { type: 'string', description: '창 제목 또는 프로세스명 (선택)' },
        toolName: { type: 'string', description: 'provider tool 이름' },
        args: {
          type: 'object',
          description: 'provider tool 인자 객체',
          additionalProperties: true,
        },
      },
      required: ['toolName'],
    },
  },
]

export const handlers: Record<string, ToolHandler> = {
  async app_list_providers() {
    const providers = await listAutomationProviders()
    return { providers, count: providers.length }
  },

  async app_list_provider_tools(args) {
    try {
      const result = await listToolsForAutomationProvider({
        provider: normalizeProvider(args.provider),
        pid: typeof args.pid === 'number' ? Math.floor(args.pid) : undefined,
        target: typeof args.target === 'string' ? args.target.trim() : undefined,
      })

      return {
        provider: result.provider,
        route: result.route,
        tools: result.tools,
        count: result.tools.length,
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  },

  async app_call_provider_tool(args) {
    const toolName = typeof args.toolName === 'string' ? args.toolName.trim() : ''
    if (!toolName) {
      return { error: 'toolName is required.' }
    }

    try {
      const result = await callRoutedAutomationTool({
        provider: normalizeProvider(args.provider),
        pid: typeof args.pid === 'number' ? Math.floor(args.pid) : undefined,
        target: typeof args.target === 'string' ? args.target.trim() : undefined,
        toolName,
        args: args.args && typeof args.args === 'object' && !Array.isArray(args.args)
          ? args.args as Record<string, unknown>
          : {},
      })

      return result
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  },
}
