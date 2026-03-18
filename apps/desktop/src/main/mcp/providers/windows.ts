import { mcpRegistry } from '../mcp-registry'
import type { AutomationCallContext, AutomationProviderAdapter, AutomationProviderStatus, AutomationToolDescriptor } from './base'

const SERVER_MATCHERS = ['windows-mcp', 'windows_mcp', 'windows mcp']

function matchesServer(idOrName: string): boolean {
  const lower = idOrName.toLowerCase()
  return SERVER_MATCHERS.some((token) => lower.includes(token))
}

function resolveServer() {
  const configs = mcpRegistry.getAllConfigs().filter((config) =>
    matchesServer(config.id) || matchesServer(config.name),
  )

  if (configs.length === 0) {
    return {
      configured: false,
      connected: false,
      toolCount: 0,
      reason: 'No windows-mcp server is configured.',
    }
  }

  const connected = configs.find((config) => mcpRegistry.getClient(config.id)?.isConnected)
  if (connected) {
    const client = mcpRegistry.getClient(connected.id)
    return {
      configured: true,
      connected: true,
      toolCount: client?.getTools().length ?? 0,
      serverId: connected.id,
      serverName: connected.name,
      client,
    }
  }

  return {
    configured: true,
    connected: false,
    toolCount: 0,
    serverId: configs[0]?.id,
    serverName: configs[0]?.name,
    reason: 'windows-mcp server is configured but not connected.',
  }
}

class WindowsMcpProvider implements AutomationProviderAdapter {
  readonly provider = 'windows-mcp' as const
  readonly transport = 'mcp' as const

  async getStatus(): Promise<AutomationProviderStatus> {
    const resolved = resolveServer()
    return {
      provider: this.provider,
      transport: this.transport,
      available: resolved.connected,
      configured: resolved.configured,
      connected: resolved.connected,
      toolCount: resolved.toolCount,
      serverId: resolved.serverId,
      serverName: resolved.serverName,
      reason: resolved.reason,
    }
  }

  async listTools(): Promise<AutomationToolDescriptor[]> {
    const resolved = resolveServer()
    if (!resolved.connected || !resolved.client) return []
    return resolved.client.getTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
    }))
  }

  async callTool(toolName: string, args: Record<string, unknown>, _context?: AutomationCallContext): Promise<unknown> {
    const resolved = resolveServer()
    if (!resolved.connected || !resolved.serverId) {
      throw new Error(resolved.reason ?? 'windows-mcp server is not available.')
    }

    return mcpRegistry.callTool(resolved.serverId, toolName, args)
  }
}

export const windowsMcpProvider = new WindowsMcpProvider()
