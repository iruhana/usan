import { describe, expect, it } from 'vitest'
import type { AIProvider, ProviderOptions, StreamChunk } from '../../src/main/ai/providers/base'
import { ModelRouter } from '../../src/main/ai/model-router'
import type { AppSettings } from '../../src/shared/types/ipc'

const BASE_SETTINGS: AppSettings = {
  schemaVersion: 1,
  fontScale: 1,
  highContrast: false,
  voiceEnabled: true,
  voiceOverlayEnabled: true,
  voiceSpeed: 1,
  locale: 'ko',
  localeConfigured: true,
  theme: 'system',
  openAtLogin: false,
  updateChannel: 'stable',
  autoDownloadUpdates: true,
  permissionProfile: 'balanced',
  beginnerMode: false,
  browserCredentialAutoImportEnabled: false,
  browserCredentialAutoImportDone: false,
  sidebarCollapsed: false,
  enterToSend: true,
  cloudApiKey: 'test-openrouter-key',
}

class FakeProvider implements AIProvider {
  constructor(
    readonly name: string,
    readonly isLocal: boolean,
    private readonly models: Array<{ id: string; name: string; size?: number }> = [],
    private readonly available = true,
  ) {}

  async isAvailable(): Promise<boolean> {
    return this.available
  }

  async listModels(): Promise<Array<{ id: string; name: string; size?: number }>> {
    return this.available ? this.models : []
  }

  async chatStream(
    _options: ProviderOptions,
    _onChunk: (chunk: StreamChunk) => void,
  ): Promise<void> {
    return
  }
}

describe('model-router', () => {
  it('routes code tasks to the coding stack', async () => {
    const router = new ModelRouter({
      cloudProviderFactory: () => new FakeProvider('openrouter', false),
    })
    router.updateSettings(BASE_SETTINGS)

    const route = await router.resolveRoute({
      userMessage: 'TypeScript 肄붾뱶 由ы뙥?곕쭅?섍퀬 failing test ?먯씤??遺꾩꽍?댁쨾.',
    })

    expect(route?.routeKind).toBe('code-generation')
    expect(route?.modelId).toBe('anthropic/claude-sonnet-4')
    expect(route?.fallbackModelIds).toEqual(['deepseek/deepseek-chat', 'openai/gpt-4o'])
  })

  it('routes short conversational prompts to the quick-chat path', async () => {
    const router = new ModelRouter({
      cloudProviderFactory: () => new FakeProvider('openrouter', false),
    })
    router.updateSettings(BASE_SETTINGS)

    const route = await router.resolveRoute({
      userMessage: '?ㅻ뒛 ?좎뵪 ?대븣?',
    })

    expect(route?.routeKind).toBe('quick-chat')
    expect(route?.modelId).toBe('google/gemini-2.5-flash')
  })

  it('respects explicit cloud model selection without adding hidden fallbacks', async () => {
    const router = new ModelRouter({
      cloudProviderFactory: () => new FakeProvider('openrouter', false),
    })
    router.updateSettings(BASE_SETTINGS)

    const route = await router.resolveRoute({
      requestedModelId: 'openai/gpt-4o',
      userMessage: '??紐⑤뜽濡쒕쭔 ?듯빐以?',
    })

    expect(route?.modelId).toBe('openai/gpt-4o')
    expect(route?.fallbackModelIds).toEqual([])
    expect(route?.reason).toContain('explicit model selection')
  })

  it('honors workflow route hints for non-chat execution', async () => {
    const router = new ModelRouter({
      cloudProviderFactory: () => new FakeProvider('openrouter', false),
    })
    router.updateSettings(BASE_SETTINGS)

    const route = await router.resolveRoute({
      routeHint: 'workflow',
      userMessage: 'Decide whether to proceed or stop based on the workflow variables.',
    })

    expect(route?.routeKind).toBe('workflow')
    expect(route?.modelId).toBe('anthropic/claude-sonnet-4')
    expect(route?.fallbackModelIds).toEqual(['openai/gpt-4o'])
  })

  it('falls back to automatic routing when an unsupported cloud model is requested', async () => {
    const router = new ModelRouter({
      cloudProviderFactory: () => new FakeProvider('openrouter', false),
    })
    router.updateSettings(BASE_SETTINGS)

    const route = await router.resolveRoute({
      requestedModelId: 'anthropic/claude-opus-4',
      userMessage: '湲??ㅺ퀎 臾몄꽌 遺꾩꽍?섍퀬 tradeoff???뺣━?댁쨾',
    })

    expect(route?.routeKind).toBe('complex-reasoning')
    expect(route?.reason).toContain('is not in the supported OpenRouter list')
  })

  it('routes to Ollama when no cloud provider is configured but a local runtime is available', async () => {
    const router = new ModelRouter({
      localProviders: [
        new FakeProvider('ollama', true, [
          { id: 'ollama/llama3.2:3b', name: 'Ollama llama3.2:3b' },
          { id: 'ollama/qwen3:4b', name: 'Ollama qwen3:4b' },
        ]),
      ],
    })
    router.updateSettings({ ...BASE_SETTINGS, cloudApiKey: '' })

    const route = await router.resolveRoute({
      userMessage: '짧게 요약해줘',
    })

    expect(route?.provider.name).toBe('ollama')
    expect(route?.modelId).toBe('ollama/qwen3:4b')
    expect(route?.fallbackModelIds).toEqual(['ollama/llama3.2:3b'])
  })

  it('routes to node-llama-cpp when it is the only local runtime left', async () => {
    const router = new ModelRouter({
      localProviders: [
        new FakeProvider('node-llama-cpp', true, [
          { id: 'node-llama-cpp/qwen2.5-0.5b', name: 'Local GGUF qwen2.5-0.5b' },
        ]),
      ],
    })
    router.updateSettings({ ...BASE_SETTINGS, cloudApiKey: '' })

    const route = await router.resolveRoute({
      userMessage: '이 코드 설명해줘',
    })

    expect(route?.provider.name).toBe('node-llama-cpp')
    expect(route?.modelId).toBe('node-llama-cpp/qwen2.5-0.5b')
  })

  it('respects explicit local model selection', async () => {
    const router = new ModelRouter({
      localProviders: [
        new FakeProvider('ollama', true, [
          { id: 'ollama/qwen3:4b', name: 'Ollama qwen3:4b' },
        ]),
      ],
    })
    router.updateSettings({ ...BASE_SETTINGS, cloudApiKey: '' })

    const route = await router.resolveRoute({
      requestedModelId: 'ollama/qwen3:4b',
      userMessage: '로컬 모델로만 답해줘',
    })

    expect(route?.provider.name).toBe('ollama')
    expect(route?.modelId).toBe('ollama/qwen3:4b')
    expect(route?.reason).toContain('explicit local model selection')
  })

  it('lists both cloud and local models when both are available', async () => {
    const router = new ModelRouter({
      cloudProviderFactory: () => new FakeProvider('openrouter', false),
      localProviders: [
        new FakeProvider('ollama', true, [
          { id: 'ollama/qwen3:4b', name: 'Ollama qwen3:4b' },
        ]),
      ],
    })
    router.updateSettings(BASE_SETTINGS)

    const models = await router.listModels()

    expect(models.some((model) => model.provider === 'openrouter')).toBe(true)
    expect(models.some((model) => model.provider === 'ollama')).toBe(true)
  })

  it('returns null when neither cloud nor local providers are available', async () => {
    const router = new ModelRouter({
      localProviders: [new FakeProvider('ollama', true, [], false)],
    })
    router.updateSettings({ ...BASE_SETTINGS, cloudApiKey: '' })

    const route = await router.resolveRoute({ userMessage: '?꾨Т嫄곕굹' })

    expect(route).toBeNull()
  })
})
