/**
 * Marketplace tools: marketplace_search, marketplace_install
 */
import type { ProviderTool } from '../providers/base'
import type { ToolHandler } from './types'
import { pluginManager } from '../../infrastructure/plugin-manager'
import { marketplaceClient } from '../../marketplace/marketplace-client'

export const definitions: ProviderTool[] = [
  {
    name: 'marketplace_search',
    description: 'Search the plugin and extension marketplace.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
      },
      required: ['query'],
    },
  },
  {
    name: 'plugin_list_installed',
    description: 'List installed plugins and bundled extensions.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'plugin_install',
    description: 'Install a plugin from a marketplace id or a local source path.',
    parameters: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Marketplace plugin id or local plugin path' },
      },
      required: ['source'],
    },
  },
]

export const handlers: Record<string, ToolHandler> = {
  async marketplace_search(args) {
    const results = await marketplaceClient.search(args.query as string)
    return {
      results,
      message: results.length === 0 ? 'The marketplace catalog is currently empty.' : undefined,
    }
  },

  async plugin_list_installed() {
    const plugins = pluginManager.listInstalled()
    return {
      plugins: plugins.map((plugin) => ({
        id: plugin.manifest.id,
        name: plugin.manifest.name,
        version: plugin.manifest.version,
        enabled: plugin.enabled,
        author: plugin.manifest.author,
        mcpServerCount: plugin.manifest.mcpServers?.length ?? 0,
      })),
    }
  },

  async plugin_install(args) {
    const plugin = await marketplaceClient.install(args.source as string)
    return {
      success: true,
      id: plugin.manifest.id,
      name: plugin.manifest.name,
      version: plugin.manifest.version,
      mcpServerCount: plugin.manifest.mcpServers?.length ?? 0,
    }
  },
}
