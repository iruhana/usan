import type { ModelInfo } from '@shared/types/ipc'
import type { ProviderMessage, ProviderTool, StreamChunk } from '../providers/base'

const DEFAULT_OLLAMA_BASE_URL = process.env['USAN_OLLAMA_BASE_URL']?.trim() || 'http://127.0.0.1:11434'
const OLLAMA_DISCOVERY_TIMEOUT_MS = 1200
const OLLAMA_CHAT_TIMEOUT_MS = 120000

interface OllamaModelEntry {
  name?: string
  size?: number
}

interface OllamaTagsResponse {
  models?: OllamaModelEntry[]
}

interface OllamaToolCall {
  function?: {
    name?: string
    arguments?: Record<string, unknown> | string
  }
}

interface OllamaStreamEnvelope {
  message?: {
    content?: string
    tool_calls?: OllamaToolCall[]
  }
  error?: string
}

export function buildOllamaModelId(name: string): string {
  return `ollama/${name}`
}

export function parseOllamaModelId(modelId: string): string {
  return modelId.startsWith('ollama/') ? modelId.slice('ollama/'.length) : modelId
}

export class OllamaClient {
  constructor(private readonly baseUrl = DEFAULT_OLLAMA_BASE_URL) {}

  async isReachable(): Promise<boolean> {
    const response = await this.fetchJson<OllamaTagsResponse>('/api/tags', OLLAMA_DISCOVERY_TIMEOUT_MS)
    return Array.isArray(response.models)
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.fetchJson<OllamaTagsResponse>('/api/tags', OLLAMA_DISCOVERY_TIMEOUT_MS)
      const models = Array.isArray(response.models) ? response.models : []
      return models
        .filter((model): model is OllamaModelEntry & { name: string } => typeof model.name === 'string' && model.name.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((model) => ({
          id: buildOllamaModelId(model.name),
          name: `Ollama ${model.name}`,
          provider: 'ollama',
          isLocal: true,
          size: typeof model.size === 'number' ? model.size : undefined,
        }))
    } catch {
      return []
    }
  }

  async chatStream(
    options: {
      model: string
      messages: ProviderMessage[]
      tools?: ProviderTool[]
      temperature?: number
      maxTokens?: number
      signal?: AbortSignal
    },
    onChunk: (chunk: StreamChunk) => void,
  ): Promise<void> {
    const response = await fetch(new URL('/api/chat', this.baseUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: parseOllamaModelId(options.model),
        stream: true,
        messages: options.messages.map(toOllamaMessage),
        tools: options.tools?.map(toOllamaTool),
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 2048,
        },
      }),
      signal: options.signal ?? AbortSignal.timeout(OLLAMA_CHAT_TIMEOUT_MS),
    })

    if (!response.ok) {
      onChunk({
        type: 'error',
        error: `Ollama request failed (${response.status})`,
      })
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      onChunk({ type: 'error', error: 'Ollama did not return a response stream.' })
      return
    }

    const decoder = new TextDecoder()
    const emittedToolCalls = new Set<string>()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          let parsed: OllamaStreamEnvelope
          try {
            parsed = JSON.parse(trimmed) as OllamaStreamEnvelope
          } catch {
            continue
          }

          if (parsed.error) {
            onChunk({ type: 'error', error: parsed.error })
            continue
          }

          const content = parsed.message?.content
          if (typeof content === 'string' && content.length > 0) {
            onChunk({ type: 'text', text: content })
          }

          const toolCalls = parsed.message?.tool_calls ?? []
          for (const toolCall of toolCalls) {
            const toolName = toolCall.function?.name?.trim()
            if (!toolName) continue

            const serializedArgs = normalizeToolArguments(toolCall.function?.arguments)
            const dedupeKey = `${toolName}:${serializedArgs}`
            if (emittedToolCalls.has(dedupeKey)) {
              continue
            }
            emittedToolCalls.add(dedupeKey)

            onChunk({
              type: 'tool_call',
              toolCall: {
                id: crypto.randomUUID(),
                name: toolName,
                arguments: serializedArgs,
              },
            })
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  private async fetchJson<T>(pathname: string, timeoutMs: number): Promise<T> {
    const response = await fetch(new URL(pathname, this.baseUrl), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!response.ok) {
      throw new Error(`Ollama request failed (${response.status})`)
    }

    return (await response.json()) as T
  }
}

function toOllamaMessage(message: ProviderMessage): Record<string, unknown> {
  if (message.role === 'assistant' && message.toolCalls?.length) {
    return {
      role: 'assistant',
      content: message.content,
      tool_calls: message.toolCalls.map((toolCall) => ({
        function: {
          name: toolCall.name,
          arguments: safeParseJson(toolCall.arguments),
        },
      })),
    }
  }

  if (message.role === 'tool') {
    return {
      role: 'tool',
      content: message.content,
      tool_call_id: message.toolCallId,
    }
  }

  return {
    role: message.role,
    content: message.content,
  }
}

function toOllamaTool(tool: ProviderTool): Record<string, unknown> {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }
}

function normalizeToolArguments(argumentsValue: Record<string, unknown> | string | undefined): string {
  if (typeof argumentsValue === 'string') {
    return argumentsValue
  }
  return JSON.stringify(argumentsValue ?? {})
}

function safeParseJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}
