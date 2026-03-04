/**
 * MCP Registry — manages connections to multiple MCP servers.
 * Stores server configs in user data and manages lifecycle.
 */
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import { McpClient, type McpServerConfig, type McpTool } from './mcp-client'
import { eventBus } from '../infrastructure/event-bus'

const CONFIG_FILE = 'mcp-servers.json'

export interface McpServerStatus {
  id: string
  name: string
  connected: boolean
  toolCount: number
  error?: string
}

export class McpRegistry {
  private servers: Map<string, McpClient> = new Map()
  private configs: McpServerConfig[] = []

  async loadConfigs(): Promise<void> {
    try {
      const configPath = this.getConfigPath()
      const data = await readFile(configPath, 'utf-8')
      this.configs = JSON.parse(data) as McpServerConfig[]
    } catch {
      this.configs = []
    }
  }

  async saveConfigs(): Promise<void> {
    const configPath = this.getConfigPath()
    const dir = join(app.getPath('userData'))
    await mkdir(dir, { recursive: true }).catch(() => {})
    await writeFile(configPath, JSON.stringify(this.configs, null, 2), 'utf-8')
  }

  async addServer(config: McpServerConfig): Promise<void> {
    // Prevent duplicate IDs
    if (this.configs.find((c) => c.id === config.id)) {
      throw new Error(`서버 ID "${config.id}"가 이미 존재합니다`)
    }

    this.configs.push(config)
    await this.saveConfigs()

    eventBus.emit('mcp.server.added', {
      serverId: config.id,
      serverName: config.name,
    }, 'mcp-registry')
  }

  async removeServer(id: string): Promise<void> {
    // Disconnect if connected
    const client = this.servers.get(id)
    if (client) {
      client.destroy()
      this.servers.delete(id)
    }

    this.configs = this.configs.filter((c) => c.id !== id)
    await this.saveConfigs()

    eventBus.emit('mcp.server.removed', { serverId: id }, 'mcp-registry')
  }

  async connect(id: string): Promise<void> {
    const config = this.configs.find((c) => c.id === id)
    if (!config) throw new Error(`서버 "${id}"를 찾을 수 없습니다`)

    // Disconnect existing if any
    const existing = this.servers.get(id)
    if (existing) {
      existing.destroy()
    }

    const client = new McpClient(config)
    this.servers.set(id, client)
    client.enableAutoReconnect()

    await client.connect()
  }

  disconnect(id: string): void {
    const client = this.servers.get(id)
    if (client) {
      client.destroy()
      this.servers.delete(id)
    }
  }

  async connectAll(): Promise<void> {
    await this.loadConfigs()
    const results = await Promise.allSettled(
      this.configs.map((config) => this.connect(config.id)),
    )

    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'rejected') {
        const err = (results[i] as PromiseRejectedResult).reason
        eventBus.emit('mcp.error', {
          serverId: this.configs[i].id,
          error: (err as Error).message,
        }, 'mcp-registry')
      }
    }
  }

  disconnectAll(): void {
    for (const [, client] of this.servers) {
      client.destroy()
    }
    this.servers.clear()
  }

  getClient(id: string): McpClient | undefined {
    return this.servers.get(id)
  }

  getAllConfigs(): McpServerConfig[] {
    return [...this.configs]
  }

  getStatus(): McpServerStatus[] {
    return this.configs.map((config) => {
      const client = this.servers.get(config.id)
      return {
        id: config.id,
        name: config.name,
        connected: client?.isConnected ?? false,
        toolCount: client?.getTools().length ?? 0,
      }
    })
  }

  /** Get all tools from all connected servers, prefixed with server name */
  getAllTools(): Array<McpTool & { serverId: string; serverName: string }> {
    const tools: Array<McpTool & { serverId: string; serverName: string }> = []
    for (const [, client] of this.servers) {
      if (!client.isConnected) continue
      for (const tool of client.getTools()) {
        tools.push({
          ...tool,
          serverId: client.id,
          serverName: client.name,
        })
      }
    }
    return tools
  }

  async callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const client = this.servers.get(serverId)
    if (!client) throw new Error(`서버 "${serverId}"에 연결되어 있지 않습니다`)
    return client.callTool(toolName, args)
  }

  private getConfigPath(): string {
    return join(app.getPath('userData'), CONFIG_FILE)
  }

  destroy(): void {
    this.disconnectAll()
  }
}

export const mcpRegistry = new McpRegistry()
