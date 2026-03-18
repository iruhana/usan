/**
 * Tool Catalog - unified tool registry for the AI agent loop.
 * Delegates to modular tool modules in ./tools/ directory.
 */
import type { ProviderTool } from './providers/base'
import type { ToolResult } from '@shared/types/tools'
import { getAllDefinitions, getAllHandlers } from './tools'
import type { ToolHandler } from './tools/types'
import { loadPermissions } from '../store'
import { getToolSecurityProfile, securityRuntime, type ToolExecutionContext } from '../security/index'

const ERROR_MESSAGES_KO: Record<string, string> = {
  ENOENT: '파일을 찾을 수 없습니다',
  EACCES: '접근 권한이 없습니다',
  EPERM: '이 작업을 수행할 권한이 없습니다',
  EISDIR: '파일이 아니라 폴더입니다',
  ENOTDIR: '폴더가 아니라 파일입니다',
  ENOTEMPTY: '폴더가 비어 있지 않습니다',
  ENOSPC: '디스크 공간이 부족합니다',
  EMFILE: '열린 파일이 너무 많습니다. 잠시 후 다시 시도해 주세요',
  ETIMEDOUT: '시간이 너무 오래 걸렸습니다. 다시 시도해 주세요',
  ECONNREFUSED: '연결이 거부되었습니다',
  ECONNRESET: '연결이 끊어졌습니다',
  EAI_AGAIN: '네트워크 연결을 확인해 주세요',
}

function toKoreanError(err: unknown): string {
  if (!(err instanceof Error)) return String(err)
  const code = (err as NodeJS.ErrnoException).code
  if (code && ERROR_MESSAGES_KO[code]) return ERROR_MESSAGES_KO[code]
  if (err.message.includes('ENOENT')) return ERROR_MESSAGES_KO.ENOENT
  if (err.message.includes('EACCES')) return ERROR_MESSAGES_KO.EACCES
  if (err.message.includes('EPERM')) return ERROR_MESSAGES_KO.EPERM
  return err.message
}

function extractStructuredResultError(result: unknown): string | null {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return null
  const error = (result as Record<string, unknown>).error
  return typeof error === 'string' && error.trim() ? error : null
}

// 5-second TTL cache for loadPermissions to avoid repeated disk reads.
let permissionCache: ReturnType<typeof loadPermissions> | null = null
let permissionCacheTs = 0
const PERM_CACHE_TTL = 5_000

function getCachedPermissions() {
  const now = Date.now()
  if (!permissionCache || now - permissionCacheTs > PERM_CACHE_TTL) {
    permissionCache = loadPermissions()
    permissionCacheTs = now
  }
  return permissionCache
}

export class ToolCatalog {
  private definitions: ProviderTool[]
  private handlers: Record<string, ToolHandler>

  constructor() {
    this.definitions = getAllDefinitions()
    this.handlers = getAllHandlers()
  }

  getTools(): ProviderTool[] {
    return this.definitions
  }

  /** Register additional tools at runtime (e.g., from plugins or MCP). */
  registerTool(definition: ProviderTool, handler: ToolHandler): void {
    if (!this.definitions.find((item) => item.name === definition.name)) {
      this.definitions.push(definition)
    }
    this.handlers[definition.name] = handler
  }

  /** Unregister a dynamically added tool. */
  unregisterTool(name: string): void {
    this.definitions = this.definitions.filter((item) => item.name !== name)
    delete this.handlers[name]
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext = { actorType: 'system', source: 'tool-catalog' },
  ): Promise<ToolResult> {
    const start = Date.now()
    const handler = this.handlers[name]
    const effectiveContext: ToolExecutionContext = {
      ...context,
      permissionGrant: context.permissionGrant ?? getCachedPermissions(),
    }
    const authorization = securityRuntime.authorizeToolExecution(name, args, effectiveContext)

    if (!handler) {
      securityRuntime.recordToolAudit(
        effectiveContext,
        {
          ...authorization,
          profile: getToolSecurityProfile(name),
        },
        'failed',
        {
          reason: 'unknown_tool',
          request: args,
        },
      )
      return {
        id: crypto.randomUUID(),
        name,
        result: null,
        error: `알 수 없는 도구입니다: ${name}`,
        duration: Date.now() - start,
      }
    }

    if (!authorization.allowed) {
      const error = securityRuntime.explainBlockedTool(authorization)
      securityRuntime.recordToolAudit(effectiveContext, authorization, 'blocked', {
        reason: authorization.reason,
        request: args,
        guardKind: 'tool_args',
        guard: authorization.requestGuard,
      })
      return {
        id: crypto.randomUUID(),
        name,
        result: null,
        error,
        duration: Date.now() - start,
      }
    }

    try {
      const rawResult = await handler(args)
      const protectedOutput = securityRuntime.protectToolOutput(name, args, rawResult, effectiveContext)
      const structuredError = extractStructuredResultError(protectedOutput.result)

      securityRuntime.recordToolAudit(
        effectiveContext,
        authorization,
        protectedOutput.sanitized
          ? 'sanitized'
          : structuredError
            ? 'failed'
            : 'completed',
        {
          reason: protectedOutput.reason ?? structuredError ?? undefined,
          request: args,
          response: protectedOutput.result,
          guardKind: protectedOutput.guard ? 'tool_output' : 'tool_args',
          guard: protectedOutput.guard ?? authorization.requestGuard,
        },
      )

      if (structuredError) {
        return {
          id: crypto.randomUUID(),
          name,
          result: null,
          error: structuredError,
          duration: Date.now() - start,
        }
      }

      return {
        id: crypto.randomUUID(),
        name,
        result: protectedOutput.result,
        duration: Date.now() - start,
      }
    } catch (err: unknown) {
      const error = toKoreanError(err)
      securityRuntime.recordToolAudit(effectiveContext, authorization, 'failed', {
        reason: error,
        request: args,
      })
      return {
        id: crypto.randomUUID(),
        name,
        result: null,
        error,
        duration: Date.now() - start,
      }
    }
  }

  getToolNames(): string[] {
    return this.definitions.map((tool) => tool.name)
  }

  invalidatePermissionCache(): void {
    permissionCache = null
    permissionCacheTs = 0
  }
}

export const toolCatalog = new ToolCatalog()
