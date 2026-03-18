import { afterEach, describe, expect, it, vi } from 'vitest'
import { OpenRouterProvider } from '../../src/main/ai/providers/openrouter'

const originalFetch = global.fetch

function createStreamResponse(): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

describe('openrouter-provider', () => {
  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('sends OpenRouter fallback models as a models array', async () => {
    const fetchMock = vi.fn(async () => createStreamResponse())
    global.fetch = fetchMock as typeof fetch

    const provider = new OpenRouterProvider('test-key')
    await provider.chatStream(
      {
        model: 'anthropic/claude-sonnet-4',
        fallbackModels: ['openai/gpt-4o', 'deepseek/deepseek-chat'],
        messages: [{ role: 'user', content: 'hello' }],
      },
      () => {},
    )

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    const body = JSON.parse(String(init.body)) as Record<string, unknown>

    expect(body['models']).toEqual([
      'anthropic/claude-sonnet-4',
      'openai/gpt-4o',
      'deepseek/deepseek-chat',
    ])
    expect(body['model']).toBeUndefined()
  })

  it('keeps the legacy single-model field when no fallbacks are provided', async () => {
    const fetchMock = vi.fn(async () => createStreamResponse())
    global.fetch = fetchMock as typeof fetch

    const provider = new OpenRouterProvider('test-key')
    await provider.chatStream(
      {
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: 'hello' }],
      },
      () => {},
    )

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    const body = JSON.parse(String(init.body)) as Record<string, unknown>

    expect(body['model']).toBe('google/gemini-2.5-flash')
    expect(body['models']).toBeUndefined()
  })
})
