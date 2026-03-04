/**
 * Marketplace tools: marketplace_search, marketplace_install
 */
import type { ProviderTool } from '../providers/base'
import type { ToolHandler } from './types'
import { pluginManager } from '../../infrastructure/plugin-manager'

export const definitions: ProviderTool[] = [
  {
    name: 'marketplace_search',
    description: '플러그인 마켓플레이스에서 검색합니다.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '검색어' },
      },
      required: ['query'],
    },
  },
  {
    name: 'plugin_list_installed',
    description: '설치된 플러그인 목록을 조회합니다.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'plugin_install',
    description: '플러그인을 설치합니다 (로컬 경로).',
    parameters: {
      type: 'object',
      properties: {
        source: { type: 'string', description: '플러그인 소스 (로컬 경로)' },
      },
      required: ['source'],
    },
  },
]

export const handlers: Record<string, ToolHandler> = {
  async marketplace_search(args) {
    const results = await pluginManager.searchMarketplace(args.query as string)
    return { results, message: results.length === 0 ? '마켓플레이스가 아직 준비 중입니다.' : undefined }
  },

  async plugin_list_installed() {
    const plugins = pluginManager.listInstalled()
    return {
      plugins: plugins.map((p) => ({
        id: p.manifest.id,
        name: p.manifest.name,
        version: p.manifest.version,
        enabled: p.enabled,
        author: p.manifest.author,
      })),
    }
  },

  async plugin_install(args) {
    const plugin = await pluginManager.install(args.source as string)
    return {
      success: true,
      id: plugin.manifest.id,
      name: plugin.manifest.name,
      version: plugin.manifest.version,
    }
  },
}
