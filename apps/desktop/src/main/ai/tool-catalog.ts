/**
 * Tool Catalog — unified tool registry for the AI agent loop.
 * Delegates to modular tool modules in ./tools/ directory.
 */
import type { ProviderTool } from './providers/base'
import type { ToolResult } from '@shared/types/tools'
import { getAllDefinitions, getAllHandlers } from './tools'
import type { ToolHandler } from './tools/types'
import { loadPermissions } from '../store'
import { isPermissionGranted, isTimedGrantActive } from '@shared/types/permissions'
import { logObsWarn } from '../observability'

const ERROR_MESSAGES_KO: Record<string, string> = {
  ENOENT: '파일을 찾을 수 없습니다',
  EACCES: '접근 권한이 없습니다',
  EPERM: '이 작업을 수행할 권한이 없습니다',
  EISDIR: '파일이 아닌 폴더입니다',
  ENOTDIR: '폴더가 아닌 파일입니다',
  ENOTEMPTY: '폴더가 비어있지 않습니다',
  ENOSPC: '디스크 공간이 부족합니다',
  EMFILE: '열린 파일이 너무 많습니다. 잠시 후 다시 시도해주세요',
  ETIMEDOUT: '시간이 너무 오래 걸렸습니다. 다시 시도해주세요',
  ECONNREFUSED: '연결이 거부되었습니다',
  ECONNRESET: '연결이 끊어졌습니다',
  EAI_AGAIN: '네트워크 연결을 확인해주세요',
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

// 5-second TTL cache for loadPermissions to avoid repeated disk reads
let _permCache: ReturnType<typeof loadPermissions> | null = null
let _permCacheTs = 0
const PERM_CACHE_TTL = 5_000

function getCachedPermissions() {
  const now = Date.now()
  if (!_permCache || now - _permCacheTs > PERM_CACHE_TTL) {
    _permCache = loadPermissions()
    _permCacheTs = now
  }
  return _permCache
}

const PRIVILEGED_TOOLS = new Set([
  'screenshot', 'read_file', 'write_file', 'list_directory', 'delete_file',
  'run_command', 'mouse_click', 'keyboard_type', 'keyboard_hotkey',
  'list_windows', 'focus_window',
  'browser_open', 'browser_click', 'browser_type', 'browser_read', 'browser_screenshot',
  'run_skill_script', 'secure_delete', 'clean_temp_files',
  'list_startup_programs', 'toggle_startup_program',
])

function getPrivilegeError(name: string, args?: Record<string, unknown>): string | null {
  if (!PRIVILEGED_TOOLS.has(name)) return null
  const grant = getCachedPermissions()
  const skillId = typeof args?.skill_id === 'string' ? args.skill_id : undefined
  if (isPermissionGranted(grant, { toolName: name, skillId })) return null
  const toolGrant = grant.toolGrants?.[name]
  const skillGrant = skillId ? grant.skillGrants?.[skillId] : undefined
  const reason =
    (toolGrant && !isTimedGrantActive(toolGrant)) || (skillGrant && !isTimedGrantActive(skillGrant))
      ? 'expired_grant'
      : 'missing_grant'
  logObsWarn('permission_denied', {
    scope: 'tools', item: name, skillId: skillId ?? null, reason,
    toolExpiresAt: toolGrant?.expiresAt ?? null, skillExpiresAt: skillGrant?.expiresAt ?? null,
  })
  return `권한 동의가 필요한 기능입니다: ${name}`
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

  /** Register additional tools at runtime (e.g., from plugins or MCP) */
  registerTool(definition: ProviderTool, handler: ToolHandler): void {
    // Avoid duplicates
    if (!this.definitions.find((d) => d.name === definition.name)) {
      this.definitions.push(definition)
    }
    this.handlers[definition.name] = handler
  }

  /** Unregister a dynamically added tool */
  unregisterTool(name: string): void {
    this.definitions = this.definitions.filter((d) => d.name !== name)
    delete this.handlers[name]
  }

  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const start = Date.now()
    const handler = this.handlers[name]

    if (!handler) {
      return {
        id: crypto.randomUUID(), name, result: null,
        error: `알 수 없는 도구입니다: ${name}`,
        duration: Date.now() - start,
      }
    }

    const privilegeError = getPrivilegeError(name, args)
    if (privilegeError) {
      return {
        id: crypto.randomUUID(), name, result: null,
        error: privilegeError,
        duration: Date.now() - start,
      }
    }

    try {
      const result = await handler(args)
      return { id: crypto.randomUUID(), name, result, duration: Date.now() - start }
    } catch (err: unknown) {
      return {
        id: crypto.randomUUID(), name, result: null,
        error: toKoreanError(err),
        duration: Date.now() - start,
      }
    }
  }

  getToolNames(): string[] {
    return this.definitions.map((t) => t.name)
  }
}

export const toolCatalog = new ToolCatalog()
