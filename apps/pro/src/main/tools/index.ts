import { execSync } from 'child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, isAbsolute } from 'path'
import type { ApprovalCapability, ApprovalRisk } from '@shared/types'

export const TOOL_DEFS = [
  {
    name: 'bash',
    description: 'Execute a shell command and return stdout/stderr. Use for file operations, running scripts, checking system state.',
    input_schema: {
      type: 'object' as const,
      properties: {
        command: { type: 'string', description: 'Shell command to execute' },
      },
      required: ['command'],
    },
  },
  {
    name: 'web_fetch',
    description: 'Fetch the text content of a URL (HTML stripped to readable text).',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
        max_chars: { type: 'number', description: 'Max characters to return (default 8000)' },
      },
      required: ['url'],
    },
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file by absolute path.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Absolute file path' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write text content to an absolute file path. Creates parent directories if needed.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Absolute file path' },
        content: { type: 'string', description: 'Text content to write' },
      },
      required: ['path', 'content'],
    },
  },
]

export interface ToolExecutionPolicy {
  capability: ApprovalCapability
  risk: ApprovalRisk
  requiresApproval: boolean
  fallback?: string
}

const DEFAULT_TOOL_POLICY: ToolExecutionPolicy = {
  capability: 'integration:read',
  risk: 'low',
  requiresApproval: false,
}

const TOOL_EXECUTION_POLICIES: Record<string, ToolExecutionPolicy> = {
  bash: {
    capability: 'shell:execute',
    risk: 'high',
    requiresApproval: true,
    fallback: 'Skip shell execution and continue without local command output.',
  },
  web_fetch: {
    capability: 'network:fetch',
    risk: 'low',
    requiresApproval: false,
  },
  read_file: {
    capability: 'filesystem:read',
    risk: 'low',
    requiresApproval: false,
  },
  write_file: {
    capability: 'filesystem:write',
    risk: 'high',
    requiresApproval: true,
    fallback: 'Skip file write and continue without modifying local files.',
  },
}

export function getToolExecutionPolicy(name: string): ToolExecutionPolicy {
  return TOOL_EXECUTION_POLICIES[name] ?? DEFAULT_TOOL_POLICY
}

export async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'bash': {
      try {
        const out = execSync(String(input.command), {
          encoding: 'utf8',
          timeout: 30_000,
          windowsHide: true,
        })
        return out.trim() || '(no output)'
      } catch (e: unknown) {
        const err = e as { stderr?: string; message?: string }
        return `Error: ${err.stderr || err.message}`
      }
    }

    case 'web_fetch': {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 15_000)
        const res = await fetch(String(input.url), { signal: controller.signal })
        clearTimeout(timeout)
        const html = await res.text()
        // Strip tags → plain text
        const text = html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim()
        const max = Math.min((input.max_chars as number) ?? 8000, 20_000)
        return text.slice(0, max)
      } catch (e: unknown) {
        return `Error: ${(e as Error).message}`
      }
    }

    case 'read_file': {
      try {
        return readFileSync(String(input.path), 'utf8')
      } catch (e: unknown) {
        return `Error: ${(e as Error).message}`
      }
    }

    case 'write_file': {
      try {
        const path = String(input.path)
        if (!isAbsolute(path)) {
          return 'Error: write_file requires an absolute path'
        }

        const content = String(input.content ?? '')
        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, content, 'utf8')
        return `Wrote ${Buffer.byteLength(content, 'utf8')} bytes to ${path}`
      } catch (e: unknown) {
        return `Error: ${(e as Error).message}`
      }
    }

    default:
      return `Unknown tool: ${name}`
  }
}
