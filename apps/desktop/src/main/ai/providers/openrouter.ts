/**
 * OpenRouter provider — multi-model cloud gateway
 * Supports Claude, GPT, DeepSeek, Gemini via single API
 */

import type { AIProvider, ProviderOptions, StreamChunk, ProviderMessage, ProviderTool } from './base'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

export class OpenRouterProvider implements AIProvider {
  readonly name = 'openrouter'
  readonly isLocal = false

  constructor(private apiKey: string) {}

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey
  }

  async listModels(): Promise<Array<{ id: string; name: string }>> {
    try {
      const res = await fetch(`${OPENROUTER_BASE}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      })
      const data = (await res.json()) as { data: Array<{ id: string; name: string }> }
      return data.data.map((m) => ({ id: m.id, name: m.name }))
    } catch {
      return []
    }
  }

  async chatStream(
    options: ProviderOptions,
    onChunk: (chunk: StreamChunk) => void
  ): Promise<void> {
    const body: Record<string, unknown> = {
      model: options.model,
      messages: options.messages.map(toOpenAIMessage),
      stream: true,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
    }

    if (options.tools?.length) {
      body.tools = options.tools.map(toOpenAITool)
    }

    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://usan.ai',
        'X-Title': 'Usan AI Secretary',
      },
      body: JSON.stringify(body),
      signal: options.signal ?? AbortSignal.timeout(60000),
    })

    if (!res.ok) {
      const status = res.status
      const message = status === 401 ? 'API 키가 올바르지 않습니다'
        : status === 429 ? '요청이 너무 많습니다. 잠시 후 다시 시도해주세요'
        : status >= 500 ? 'AI 서버에 문제가 발생했습니다'
        : `AI 요청 실패 (${status})`
      onChunk({ type: 'error', error: message })
      return
    }

    const reader = res.body?.getReader()
    if (!reader) {
      onChunk({ type: 'error', error: 'No response stream' })
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''
    const toolCallBuffers = new Map<number, { id: string; name: string; args: string }>()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') break

          try {
            const parsed = JSON.parse(data) as {
              choices: Array<{
                delta: {
                  content?: string
                  tool_calls?: Array<{
                    index: number
                    id?: string
                    function?: { name?: string; arguments?: string }
                  }>
                }
              }>
            }
            const delta = parsed.choices?.[0]?.delta
            if (!delta) continue

            if (delta.content) {
              onChunk({ type: 'text', text: delta.content })
            }

            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index
                if (!toolCallBuffers.has(idx)) {
                  toolCallBuffers.set(idx, {
                    id: tc.id || crypto.randomUUID(),
                    name: tc.function?.name || '',
                    args: tc.function?.arguments || '',
                  })
                } else {
                  const buf = toolCallBuffers.get(idx)!
                  if (tc.function?.name) buf.name = tc.function.name
                  if (tc.function?.arguments) buf.args += tc.function.arguments
                }
              }
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } finally {
      reader.releaseLock()
      // Flush all accumulated tool calls (works on both normal end and error)
      for (const tc of toolCallBuffers.values()) {
        onChunk({
          type: 'tool_call',
          toolCall: { id: tc.id, name: tc.name, arguments: tc.args },
        })
      }
      // Don't emit 'done' here — agent-loop is responsible for signaling completion
    }
  }
}

function toOpenAIMessage(msg: ProviderMessage) {
  if (msg.role === 'tool') {
    return {
      role: 'tool' as const,
      content: msg.content,
      tool_call_id: msg.toolCallId || '',
    }
  }

  const result: Record<string, unknown> = {
    role: msg.role,
    content: msg.content,
  }

  if (msg.toolCalls?.length) {
    result.tool_calls = msg.toolCalls.map((tc) => ({
      id: tc.id,
      type: 'function',
      function: { name: tc.name, arguments: tc.arguments },
    }))
  }

  return result
}

function toOpenAITool(tool: ProviderTool) {
  return {
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }
}
