/**
 * MCP Client ??connects to Model Context Protocol servers via stdio or SSE.
 */
import { spawn, type ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { eventBus } from '../infrastructure/event-bus'


export interface McpTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface McpResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

export type McpTransport = 'stdio' | 'sse'

export interface McpServerConfig {
  id: string
  name: string
  transport: McpTransport
  command?: string        // for stdio
  args?: string[]         // for stdio
  url?: string            // for SSE
  env?: Record<string, string>
}

interface SseToolsListResponse {
  result?: {
    tools?: McpTool[]
  }
}

interface SseToolCallResponse {
  error?: {
    message?: string
  }
  result?: unknown
}

const MAX_RECONNECT_DELAY = 60_000
const BASE_RECONNECT_DELAY = 1_000

export class McpClient extends EventEmitter {
  private config: McpServerConfig
  private process: ChildProcess | null = null
  private connected = false
  private tools: McpTool[] = []
  private resources: McpResource[] = []
  private pendingRequests: Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }> = new Map()
  private nextId = 1
  private buffer = ''
  private autoReconnect = false
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private destroyed = false

  constructor(config: McpServerConfig) {
    super()
    this.config = config
  }

  get id(): string { return this.config.id }
  get name(): string { return this.config.name }
  get isConnected(): boolean { return this.connected }
  getTools(): McpTool[] { return this.tools }
  getResources(): McpResource[] { return this.resources }

  enableAutoReconnect(): void { this.autoReconnect = true }
  disableAutoReconnect(): void {
    this.autoReconnect = false
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  async connect(): Promise<void> {
    if (this.connected) return

    if (this.config.transport === 'stdio') {
      await this.connectStdio()
    } else if (this.config.transport === 'sse') {
      await this.connectSSE()
    }
  }

  private async connectStdio(): Promise<void> {
    const { command, args = [], env } = this.config
    if (!command) throw new Error('stdio transport requires command')

    return new Promise((resolve, reject) => {
      const childEnv = { ...process.env, ...env }
      this.process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: childEnv,
        windowsHide: true,
      })

      this.process.stdout?.on('data', (data: Buffer) => {
        this.buffer += data.toString()
        this.processBuffer()
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        const msg = data.toString().trim()
        if (msg) this.emit('log', msg)
      })

      this.process.on('error', (err) => {
        this.connected = false
        this.emit('error', err)
        reject(err)
      })

      this.process.on('close', (code) => {
        this.connected = false
        this.emit('close', code)
        this.scheduleReconnect()
      })

      // Send initialize request
      this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'usan-desktop', version: '0.1.0' },
      }).then(async () => {
        // Send initialized notification
        this.sendNotification('notifications/initialized', {})
        this.connected = true

        // Discover tools
        try {
          const toolsResult = await this.sendRequest('tools/list', {}) as { tools?: McpTool[] }
          this.tools = toolsResult?.tools || []
        } catch { this.tools = [] }

        // Discover resources
        try {
          const resourcesResult = await this.sendRequest('resources/list', {}) as { resources?: McpResource[] }
          this.resources = resourcesResult?.resources || []
        } catch { this.resources = [] }

        eventBus.emit('mcp.connected', {
          serverId: this.config.id,
          serverName: this.config.name,
          toolCount: this.tools.length,
        }, 'mcp-client')

        this.emit('connected')
        resolve()
      }).catch(reject)
    })
  }

  private async connectSSE(): Promise<void> {
    const { url } = this.config
    if (!url) throw new Error('SSE transport requires url')

    // SSE transport: POST for requests, GET for events
    try {
      const initResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: this.nextId++,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'usan-desktop', version: '0.1.0' },
          },
        }),
      })

      if (!initResponse.ok) {
        throw new Error(`SSE 초기화 실패: ${initResponse.status}`)
      }

      this.connected = true

      // Discover tools via POST
      const toolsResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: this.nextId++,
          method: 'tools/list',
          params: {},
        }),
      })

      if (toolsResponse.ok) {
        const data = await toolsResponse.json() as SseToolsListResponse
        this.tools = data?.result?.tools || []
      }

      eventBus.emit('mcp.connected', {
        serverId: this.config.id,
        serverName: this.config.name,
        toolCount: this.tools.length,
      }, 'mcp-client')

      this.emit('connected')
    } catch (err) {
      this.connected = false
      throw err
    }
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.connected) throw new Error('MCP 서버에 연결되어 있지 않습니다')

    if (this.config.transport === 'stdio') {
      const result = await this.sendRequest('tools/call', { name: toolName, arguments: args })
      return result
    }

    // SSE transport
    const response = await fetch(this.config.url!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: this.nextId++,
        method: 'tools/call',
        params: { name: toolName, arguments: args },
      }),
    })

    if (!response.ok) throw new Error(`MCP 도구 호출 실패: ${response.status}`)
    const data = await response.json() as SseToolCallResponse
    if (data.error) throw new Error(data.error.message || 'MCP 도구 오류')
    return data.result
  }

  async readResource(uri: string): Promise<{ contents: Array<{ uri: string; text?: string; blob?: string }> }> {
    if (!this.connected) throw new Error('MCP 서버에 연결되어 있지 않습니다')

    const result = await this.sendRequest('resources/read', { uri }) as {
      contents: Array<{ uri: string; text?: string; blob?: string }>
    }
    return result
  }

  disconnect(): void {
    this.disableAutoReconnect()
    this.cleanupConnection()
  }

  private cleanupConnection(): void {
    this.connected = false
    this.tools = []
    this.resources = []

    if (this.process) {
      try { this.process.kill() } catch { /* ignore */ }
      this.process = null
    }

    // Reject pending requests
    for (const [, req] of this.pendingRequests) {
      req.reject(new Error('Connection closed'))
    }
    this.pendingRequests.clear()

    eventBus.emit('mcp.disconnected', {
      serverId: this.config.id,
      serverName: this.config.name,
    }, 'mcp-client')

    this.emit('disconnected')
  }

  private scheduleReconnect(): void {
    if (!this.autoReconnect || this.destroyed) return

    const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempt), MAX_RECONNECT_DELAY)
    this.reconnectAttempt++

    eventBus.emit('mcp.reconnecting', {
      serverId: this.config.id,
      serverName: this.config.name,
      attempt: this.reconnectAttempt,
      delayMs: delay,
    }, 'mcp-client')

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null
      if (!this.autoReconnect || this.destroyed) return

      try {
        this.buffer = ''
        await this.connect()
        this.reconnectAttempt = 0
        eventBus.emit('mcp.reconnected', {
          serverId: this.config.id,
          serverName: this.config.name,
          toolCount: this.tools.length,
        }, 'mcp-client')
      } catch {
        this.scheduleReconnect()
      }
    }, delay)
  }

  private sendRequest(method: string, params: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++
      this.pendingRequests.set(id, { resolve, reject })

      const message = JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params,
      })

      if (this.process?.stdin?.writable) {
        this.process.stdin.write(message + '\n')
      } else {
        this.pendingRequests.delete(id)
        reject(new Error('프로세스를 찾을 수 없습니다'))
      }

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error('MCP 요청 시간 초과'))
        }
      }, 30000)
    })
  }

  private sendNotification(method: string, params: Record<string, unknown>): void {
    const message = JSON.stringify({ jsonrpc: '2.0', method, params })
    if (this.process?.stdin?.writable) {
      this.process.stdin.write(message + '\n')
    }
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const msg = JSON.parse(trimmed)
        if ('id' in msg && this.pendingRequests.has(msg.id)) {
          const req = this.pendingRequests.get(msg.id)!
          this.pendingRequests.delete(msg.id)
          if (msg.error) {
            req.reject(new Error('Connection closed'))
          } else {
            req.resolve(msg.result)
          }
        } else if (msg.method) {
          // Server notification
          this.emit('notification', msg)
        }
      } catch {
        // Invalid JSON, skip
      }
    }
  }

  destroy(): void {
    this.destroyed = true
    this.disconnect()
    this.removeAllListeners()
  }
}
