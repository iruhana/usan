/**
 * MCP Tool Bridge — registers MCP server tools into the ToolCatalog at runtime.
 * Each MCP tool is exposed as `mcp_{serverId}_{toolName}` in the agent loop.
 */
import type { ProviderTool } from '../ai/providers/base'
import type { ToolHandler } from '../ai/tools/types'
import { mcpRegistry } from './mcp-registry'
import { eventBus } from '../infrastructure/event-bus'

/** Sanitize server/tool names for use as tool identifiers */
function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()
}

/** Convert MCP inputSchema to a ProviderTool definition */
function mcpToolToProviderTool(
  serverId: string,
  serverName: string,
  tool: { name: string; description: string; inputSchema: Record<string, unknown> },
): ProviderTool {
  const safeSid = sanitizeName(serverId)
  const safeName = sanitizeName(tool.name)
  return {
    name: `mcp_${safeSid}_${safeName}`,
    description: `[MCP: ${serverName}] ${tool.description}`,
    parameters: tool.inputSchema || { type: 'object', properties: {} },
  }
}

/** Create a handler that proxies the call to the MCP server */
function createMcpHandler(serverId: string, toolName: string): ToolHandler {
  return async (args: Record<string, unknown>) => {
    try {
      const result = await mcpRegistry.callTool(serverId, toolName, args)

      // Normalize MCP result to text for the agent loop
      if (result && typeof result === 'object' && 'content' in (result as Record<string, unknown>)) {
        const content = (result as { content: Array<{ type: string; text?: string }> }).content
        if (Array.isArray(content)) {
          const texts = content
            .filter((c) => c.type === 'text' && c.text)
            .map((c) => c.text)
          if (texts.length > 0) return { result: texts.join('\n') }
        }
      }

      return { result: typeof result === 'string' ? result : JSON.stringify(result) }
    } catch (err) {
      return { error: (err as Error).message }
    }
  }
}

export interface McpToolBridge {
  /**
   * Sync all connected MCP server tools into the ToolCatalog.
   * Returns definitions and handlers to register.
   */
  syncTools(): { definitions: ProviderTool[]; handlers: Record<string, ToolHandler> }

  /**
   * Register tools from a specific server into the catalog.
   * Called after a server connects.
   */
  registerServer(serverId: string): { definitions: ProviderTool[]; handlers: Record<string, ToolHandler> }

  /**
   * Get tool names registered for a specific server.
   */
  getServerToolNames(serverId: string): string[]

  /**
   * Remove all tools from a specific server.
   * Returns the tool names that were removed.
   */
  unregisterServer(serverId: string): string[]
}

// Track which tools belong to which server
const serverToolMap = new Map<string, string[]>()

export const mcpToolBridge: McpToolBridge = {
  syncTools() {
    const allTools = mcpRegistry.getAllTools()
    const definitions: ProviderTool[] = []
    const handlers: Record<string, ToolHandler> = {}

    // Clear existing mappings
    serverToolMap.clear()

    for (const tool of allTools) {
      const def = mcpToolToProviderTool(tool.serverId, tool.serverName, tool)
      definitions.push(def)
      handlers[def.name] = createMcpHandler(tool.serverId, tool.name)

      const existing = serverToolMap.get(tool.serverId) || []
      existing.push(def.name)
      serverToolMap.set(tool.serverId, existing)
    }

    eventBus.emit('mcp.tools.synced', {
      totalTools: definitions.length,
      serverCount: serverToolMap.size,
    }, 'mcp-tool-bridge')

    return { definitions, handlers }
  },

  registerServer(serverId: string) {
    const client = mcpRegistry.getClient(serverId)
    if (!client || !client.isConnected) {
      return { definitions: [], handlers: {} }
    }

    const definitions: ProviderTool[] = []
    const handlers: Record<string, ToolHandler> = {}
    const toolNames: string[] = []

    for (const tool of client.getTools()) {
      const def = mcpToolToProviderTool(serverId, client.name, tool)
      definitions.push(def)
      handlers[def.name] = createMcpHandler(serverId, tool.name)
      toolNames.push(def.name)
    }

    serverToolMap.set(serverId, toolNames)

    return { definitions, handlers }
  },

  getServerToolNames(serverId: string): string[] {
    return serverToolMap.get(serverId) || []
  },

  unregisterServer(serverId: string): string[] {
    const toolNames = serverToolMap.get(serverId) || []
    serverToolMap.delete(serverId)
    return toolNames
  },
}
