import { afterEach, describe, expect, it, vi } from 'vitest'
import { OllamaProvider } from '../../src/main/ai/providers/ollama'

const originalFetch = global.fetch

function createNdjsonResponse(lines: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(`${line}\n`))
      }
      controller.close()
    },
  })

  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'application/x-ndjson' },
  })
}

describe('ollama-provider', () => {
  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('maps Ollama tags to local model metadata', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      models: [{ name: 'qwen3:4b', size: 1024 }],
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch

    const provider = new OllamaProvider()
    const models = await provider.listModels()

    expect(models).toEqual([
      {
        id: 'ollama/qwen3:4b',
        name: 'Ollama qwen3:4b',
        size: 1024,
      },
    ])
  })

  it('streams text and tool calls from the Ollama NDJSON response', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      expect(body['model']).toBe('qwen3:4b')
      expect(Array.isArray(body['tools'])).toBe(true)

      return createNdjsonResponse([
        JSON.stringify({ message: { content: 'Hello' } }),
        JSON.stringify({
          message: {
            tool_calls: [
              {
                function: {
                  name: 'get_weather',
                  arguments: { city: 'Seoul' },
                },
              },
            ],
          },
        }),
      ])
    })
    global.fetch = fetchMock as typeof fetch

    const provider = new OllamaProvider()
    const chunks: Array<{ type: string; payload?: unknown }> = []

    await provider.chatStream(
      {
        model: 'ollama/qwen3:4b',
        messages: [{ role: 'user', content: 'hello' }],
        tools: [
          {
            name: 'get_weather',
            description: 'Read weather',
            parameters: {
              type: 'object',
              properties: { city: { type: 'string' } },
            },
          },
        ],
      },
      (chunk) => {
        chunks.push({
          type: chunk.type,
          payload: chunk.type === 'tool_call' ? chunk.toolCall : chunk.text,
        })
      },
    )

    expect(chunks[0]).toEqual({ type: 'text', payload: 'Hello' })
    expect(chunks[1].type).toBe('tool_call')
    expect(chunks[1].payload).toMatchObject({
      name: 'get_weather',
      arguments: JSON.stringify({ city: 'Seoul' }),
    })
  })
})
