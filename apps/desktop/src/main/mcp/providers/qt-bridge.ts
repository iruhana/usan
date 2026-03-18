import { execFile } from 'child_process'
import { access } from 'fs/promises'
import { createConnection, type Socket } from 'net'
import { join } from 'path'
import { promisify } from 'util'
import { app } from 'electron'
import { eventBus } from '../../infrastructure/event-bus'
import { logObsInfo, logObsWarn } from '../../observability'
import {
  detectAutomationTarget,
  listAutomationTargets,
  type AppDetectionResult,
} from '../app-detector'

const execFileAsync = promisify(execFile)
const PIPE_CONNECT_RETRY_MS = 350
const PIPE_CONNECT_ATTEMPTS = 30
const REQUEST_TIMEOUT_MS = 10000
const DEFAULT_SLOW_REQUEST_THRESHOLD_MS = 120
const SLOW_REQUEST_THRESHOLD_MS: Readonly<Record<string, number>> = {
  getObjectTree: 250,
  findObject: 180,
  getProperty: 120,
  setProperty: 150,
  invokeMethod: 180,
  screenshot: 400,
}

export interface QtObject {
  className: string
  objectName: string
  path?: string
  properties?: Record<string, unknown>
  children?: QtObject[]
}

export interface QtObjectTree {
  roots: QtObject[]
}

interface QtBridgePendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
  method: string
  paramsSummary: Record<string, unknown>
  requestBytes: number
  startedAtNs: bigint
}

interface QtBridgeConnection {
  pid: number
  pipeName: string
  socket: Socket
  buffer: string
  nextId: number
  pending: Map<number, QtBridgePendingRequest>
  connectedAt: number
  helperPath?: string
}

interface QtBridgeRpcResponse {
  id?: number
  result?: unknown
  error?: {
    code?: number
    message?: string
  }
  meta?: Record<string, unknown>
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function buildPipeName(pid: number): string {
  return `\\\\.\\pipe\\ubridge-qt-${pid}`
}

function nowNs(): bigint {
  return process.hrtime.bigint()
}

function elapsedMs(startedAtNs: bigint): number {
  return Number(process.hrtime.bigint() - startedAtNs) / 1_000_000
}

function roundDurationMs(durationMs: number): number {
  return Math.round(durationMs * 100) / 100
}

function getSlowRequestThreshold(method: string): number {
  return SLOW_REQUEST_THRESHOLD_MS[method] ?? DEFAULT_SLOW_REQUEST_THRESHOLD_MS
}

function normalizeTarget(target: AppDetectionResult): AppDetectionResult {
  if (target.framework !== 'qt') {
    throw new Error(`Target is not a Qt app: ${target.processName} (${target.framework})`)
  }
  return target
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function uniqueCandidates(candidates: Array<string | undefined>): string[] {
  const deduped = new Set<string>()
  for (const candidate of candidates) {
    if (!candidate) continue
    deduped.add(candidate)
  }
  return [...deduped]
}

function buildInjectorCandidates(): string[] {
  const envPath = process.env['USAN_QT_INJECTOR_PATH']
  const appPath = app.getAppPath()
  return uniqueCandidates([
    envPath,
    join(process.cwd(), 'native', 'qt-bridge', 'build', 'qt-injector.exe'),
    join(process.cwd(), 'apps', 'desktop', 'native', 'qt-bridge', 'build', 'qt-injector.exe'),
    join(appPath, 'native', 'qt-bridge', 'build', 'qt-injector.exe'),
    join(appPath, '..', 'native', 'qt-bridge', 'build', 'qt-injector.exe'),
    join(process.resourcesPath, 'native', 'qt-bridge', 'qt-injector.exe'),
  ])
}

function summarizeObjectPath(objectPath: unknown): number | null {
  if (typeof objectPath !== 'string') return null
  const depth = objectPath.split('/').filter(Boolean).length
  return depth > 0 ? depth : null
}

function summarizeParams(method: string, params: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {}

  if (typeof params['maxDepth'] === 'number') {
    summary.maxDepth = params['maxDepth']
  }

  if (typeof params['query'] === 'string') {
    summary.queryLength = params['query'].length
  }

  if (typeof params['property'] === 'string') {
    summary.property = params['property']
  }

  if (method === 'invokeMethod' && typeof params['method'] === 'string') {
    summary.targetMethod = params['method']
  }

  if (Array.isArray(params['args'])) {
    summary.argCount = params['args'].length
  }

  const objectPathDepth = summarizeObjectPath(params['objectPath'])
  if (objectPathDepth !== null) {
    summary.objectPathDepth = objectPathDepth
  }

  return summary
}

function summarizeNativeMeta(meta: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!meta) return {}

  const summary: Record<string, unknown> = {}
  const allowedKeys = [
    'nativeDurationMs',
    'rootCount',
    'nodeCount',
    'matchCount',
    'overloadCount',
    'selectedSignature',
    'queryLength',
    'argCount',
    'property',
    'width',
    'height',
    'pngBytes',
    'base64Bytes',
    'maxDepth',
  ] as const

  for (const key of allowedKeys) {
    if (meta[key] !== undefined) {
      summary[key] = meta[key]
    }
  }

  return summary
}

class QtBridgeProvider {
  private connections = new Map<number, QtBridgeConnection>()

  async listTargets(): Promise<AppDetectionResult[]> {
    const targets = await listAutomationTargets({ limit: 50 })
    return targets.filter((target) => target.framework === 'qt')
  }

  getConnectionStatus(): Array<{ pid: number; pipeName: string; connectedAt: number; helperPath?: string }> {
    return [...this.connections.values()].map((connection) => ({
      pid: connection.pid,
      pipeName: connection.pipeName,
      connectedAt: connection.connectedAt,
      helperPath: connection.helperPath,
    }))
  }

  isConnected(pid: number): boolean {
    return this.connections.has(pid)
  }

  async getAvailability(): Promise<{ available: boolean; helperPath?: string; reason?: string }> {
    try {
      const helperPath = await this.resolveInjectorPath()
      return { available: true, helperPath }
    } catch (error) {
      return {
        available: false,
        reason: error instanceof Error ? error.message : String(error),
      }
    }
  }

  async inject(pid: number): Promise<void> {
    const startedAtNs = nowNs()
    const target = await detectAutomationTarget({ pid })
    if (!target) {
      throw new Error(`Unable to find target process for PID ${pid}.`)
    }
    normalizeTarget(target)

    if (this.connections.has(pid)) return

    const pipeName = buildPipeName(pid)
    try {
      const existingConnectStartedAtNs = nowNs()
      const existing = await this.connectSocket(pid, pipeName)
      this.connections.set(pid, existing)
      eventBus.emit('qtbridge.connected', {
        pid,
        processName: target.processName,
        pipeName,
      }, 'qt-bridge')
      logObsInfo('qtbridge.inject_completed', {
        pid,
        pipeName,
        mode: 'reuse',
        connectDurationMs: roundDurationMs(elapsedMs(existingConnectStartedAtNs)),
        totalDurationMs: roundDurationMs(elapsedMs(startedAtNs)),
      })
      return
    } catch {
      // Continue to injector flow when the pipe is not up yet.
    }

    const helperPath = await this.resolveInjectorPath()
    const helperStartedAtNs = nowNs()
    await execFileAsync(helperPath, ['inject', '--pid', String(pid)], {
      timeout: 20000,
      windowsHide: true,
    })
    const injectorDurationMs = roundDurationMs(elapsedMs(helperStartedAtNs))

    const connectStartedAtNs = nowNs()
    const connection = await this.connectSocket(pid, pipeName, helperPath)
    this.connections.set(pid, connection)

    eventBus.emit('qtbridge.connected', {
      pid,
      processName: target.processName,
      pipeName,
    }, 'qt-bridge')
    logObsInfo('qtbridge.connected', { pid, pipeName })

    const payload = {
      pid,
      pipeName,
      helperPath,
      mode: 'injector',
      injectorDurationMs,
      connectDurationMs: roundDurationMs(elapsedMs(connectStartedAtNs)),
      totalDurationMs: roundDurationMs(elapsedMs(startedAtNs)),
    }
    logObsInfo('qtbridge.inject_completed', payload)
    if (payload.totalDurationMs >= 1000) {
      logObsWarn('qtbridge.inject_slow', payload)
    }
  }

  disconnect(pid: number): void {
    const connection = this.connections.get(pid)
    if (!connection) return
    this.teardownConnection(connection, 'disconnect')
  }

  destroy(): void {
    for (const connection of [...this.connections.values()]) {
      this.teardownConnection(connection, 'destroy')
    }
  }

  async getObjectTree(pid: number, maxDepth = 4): Promise<QtObjectTree> {
    return this.sendRequest(pid, 'getObjectTree', { maxDepth }) as Promise<QtObjectTree>
  }

  async findObject(pid: number, query: string): Promise<QtObject[]> {
    if (!query.trim()) throw new Error('query is required')
    return this.sendRequest(pid, 'findObject', { query }) as Promise<QtObject[]>
  }

  async getProperty(pid: number, objectPath: string, property: string): Promise<unknown> {
    return this.sendRequest(pid, 'getProperty', { objectPath, property })
  }

  async setProperty(pid: number, objectPath: string, property: string, value: unknown): Promise<void> {
    await this.sendRequest(pid, 'setProperty', { objectPath, property, value })
  }

  async invokeMethod(pid: number, objectPath: string, method: string, args?: unknown[]): Promise<unknown> {
    return this.sendRequest(pid, 'invokeMethod', { objectPath, method, args: args ?? [] })
  }

  async screenshot(pid: number, objectPath?: string): Promise<string> {
    return this.sendRequest(pid, 'screenshot', { objectPath }) as Promise<string>
  }

  private async resolveInjectorPath(): Promise<string> {
    for (const candidate of buildInjectorCandidates()) {
      if (await fileExists(candidate)) {
        return candidate
      }
    }

    throw new Error(
      'Unable to find qt-injector.exe. Build native/qt-bridge first or set USAN_QT_INJECTOR_PATH.',
    )
  }

  private async connectSocket(pid: number, pipeName: string, helperPath?: string): Promise<QtBridgeConnection> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < PIPE_CONNECT_ATTEMPTS; attempt += 1) {
      try {
        const connection = await new Promise<QtBridgeConnection>((resolve, reject) => {
          const socket = createConnection(pipeName)
          socket.setEncoding('utf8')

          const onError = (error: Error) => {
            socket.removeAllListeners()
            socket.destroy()
            reject(error)
          }

          socket.once('error', onError)
          socket.once('connect', () => {
            socket.removeListener('error', onError)

            const connection: QtBridgeConnection = {
              pid,
              pipeName,
              socket,
              buffer: '',
              nextId: 1,
              pending: new Map(),
              connectedAt: Date.now(),
              helperPath,
            }

            socket.on('data', (chunk: string) => {
              connection.buffer += chunk
              this.processBuffer(connection)
            })

            socket.on('close', () => {
              this.teardownConnection(connection, 'socket_closed')
            })

            socket.on('error', (error) => {
              logObsWarn('qtbridge.socket_error', { pid, error: error.message })
            })

            resolve(connection)
          })
        })

        return connection
      } catch (error) {
        lastError = error as Error
        await sleep(PIPE_CONNECT_RETRY_MS)
      }
    }

    throw lastError ?? new Error(`Failed to connect Qt bridge pipe: ${pipeName}`)
  }

  private processBuffer(connection: QtBridgeConnection): void {
    while (true) {
      const separatorIndex = connection.buffer.indexOf('\n')
      if (separatorIndex < 0) return

      const line = connection.buffer.slice(0, separatorIndex).trim()
      connection.buffer = connection.buffer.slice(separatorIndex + 1)
      if (!line) continue

      let message: QtBridgeRpcResponse
      try {
        message = JSON.parse(line) as QtBridgeRpcResponse
      } catch (error) {
        logObsWarn('qtbridge.invalid_json', {
          pid: connection.pid,
          error: error instanceof Error ? error.message : String(error),
        })
        continue
      }

      if (!Number.isFinite(message.id)) continue
      const pending = connection.pending.get(message.id as number)
      if (!pending) continue

      clearTimeout(pending.timeout)
      connection.pending.delete(message.id as number)

      const durationMs = roundDurationMs(elapsedMs(pending.startedAtNs))
      const responseBytes = Buffer.byteLength(line, 'utf8')
      const nativeMeta = summarizeNativeMeta(message.meta)
      const nativeDurationMs =
        typeof nativeMeta.nativeDurationMs === 'number' ? nativeMeta.nativeDurationMs : undefined
      const payload: Record<string, unknown> = {
        pid: connection.pid,
        method: pending.method,
        durationMs,
        requestBytes: pending.requestBytes,
        responseBytes,
        ...pending.paramsSummary,
        ...nativeMeta,
      }

      if (typeof nativeDurationMs === 'number') {
        payload.bridgeOverheadMs = roundDurationMs(Math.max(0, durationMs - nativeDurationMs))
      }

      if (message.error?.message) {
        payload.error = message.error.message
        eventBus.emit('qtbridge.request.completed', payload, 'qt-bridge')
        logObsWarn('qtbridge.request_failed', payload)
        pending.reject(new Error(message.error.message))
        continue
      }

      eventBus.emit('qtbridge.request.completed', payload, 'qt-bridge')
      if (durationMs >= getSlowRequestThreshold(pending.method)) {
        logObsWarn('qtbridge.request_slow', payload)
      } else {
        logObsInfo('qtbridge.request_completed', payload)
      }

      pending.resolve(message.result)
    }
  }

  private teardownConnection(connection: QtBridgeConnection, reason: string): void {
    if (this.connections.get(connection.pid) === connection) {
      this.connections.delete(connection.pid)
    }

    for (const pending of connection.pending.values()) {
      clearTimeout(pending.timeout)
      pending.reject(new Error(`Qt bridge connection closed: ${reason}`))
    }
    connection.pending.clear()

    connection.socket.removeAllListeners()
    if (!connection.socket.destroyed) {
      connection.socket.destroy()
    }

    eventBus.emit('qtbridge.disconnected', {
      pid: connection.pid,
      pipeName: connection.pipeName,
      reason,
    }, 'qt-bridge')
  }

  private async ensureConnection(pid: number): Promise<QtBridgeConnection> {
    const connection = this.connections.get(pid)
    if (connection) return connection
    await this.inject(pid)
    const connected = this.connections.get(pid)
    if (!connected) {
      throw new Error(`Unable to establish a Qt bridge connection for PID ${pid}.`)
    }
    return connected
  }

  private async sendRequest(pid: number, method: string, params: Record<string, unknown>): Promise<unknown> {
    const connection = await this.ensureConnection(pid)
    const id = connection.nextId++
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params,
    })
    const requestBytes = Buffer.byteLength(payload, 'utf8')
    const paramsSummary = summarizeParams(method, params)
    const startedAtNs = nowNs()

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        connection.pending.delete(id)
        const timeoutPayload = {
          pid,
          method,
          durationMs: roundDurationMs(elapsedMs(startedAtNs)),
          requestBytes,
          ...paramsSummary,
        }
        eventBus.emit('qtbridge.request.timeout', timeoutPayload, 'qt-bridge')
        logObsWarn('qtbridge.request_timeout', timeoutPayload)
        reject(new Error(`Qt bridge request timed out: ${method}`))
      }, REQUEST_TIMEOUT_MS)

      connection.pending.set(id, {
        resolve,
        reject,
        timeout,
        method,
        paramsSummary,
        requestBytes,
        startedAtNs,
      })

      connection.socket.write(`${payload}\n`, (error) => {
        if (!error) return
        clearTimeout(timeout)
        connection.pending.delete(id)
        logObsWarn('qtbridge.request_write_failed', {
          pid,
          method,
          requestBytes,
          ...paramsSummary,
          error: error.message,
        })
        reject(error)
      })
    })
  }
}

export const qtBridgeProvider = new QtBridgeProvider()
