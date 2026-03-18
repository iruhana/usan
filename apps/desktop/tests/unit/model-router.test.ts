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
  readonly name = 'openrouter'
  readonly isLocal = false

  async isAvailable(): Promise<boolean> {
    return true
  }

  async listModels(): Promise<Array<{ id: string; name: string }>> {
    return []
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
    const router = new ModelRouter({ providerFactory: () => new FakeProvider() })
    router.updateSettings(BASE_SETTINGS)

    const route = await router.resolveRoute({
      userMessage: 'TypeScript 코드 리팩터링하고 failing test 원인도 분석해줘.',
    })

    expect(route?.routeKind).toBe('code-generation')
    expect(route?.modelId).toBe('anthropic/claude-sonnet-4')
    expect(route?.fallbackModelIds).toEqual(['deepseek/deepseek-chat', 'openai/gpt-4o'])
  })

  it('routes short conversational prompts to the quick-chat path', async () => {
    const router = new ModelRouter({ providerFactory: () => new FakeProvider() })
    router.updateSettings(BASE_SETTINGS)

    const route = await router.resolveRoute({
      userMessage: '오늘 날씨 어때?',
    })

    expect(route?.routeKind).toBe('quick-chat')
    expect(route?.modelId).toBe('google/gemini-2.5-flash')
  })

  it('respects explicit model selection without adding hidden fallbacks', async () => {
    const router = new ModelRouter({ providerFactory: () => new FakeProvider() })
    router.updateSettings(BASE_SETTINGS)

    const route = await router.resolveRoute({
      requestedModelId: 'openai/gpt-4o',
      userMessage: '이 모델로만 답해줘',
    })

    expect(route?.modelId).toBe('openai/gpt-4o')
    expect(route?.fallbackModelIds).toEqual([])
    expect(route?.reason).toContain('explicit model selection')
  })

  it('honors workflow route hints for non-chat execution', async () => {
    const router = new ModelRouter({ providerFactory: () => new FakeProvider() })
    router.updateSettings(BASE_SETTINGS)

    const route = await router.resolveRoute({
      routeHint: 'workflow',
      userMessage: 'Decide whether to proceed or stop based on the workflow variables.',
    })

    expect(route?.routeKind).toBe('workflow')
    expect(route?.modelId).toBe('anthropic/claude-sonnet-4')
    expect(route?.fallbackModelIds).toEqual(['openai/gpt-4o'])
  })

  it('falls back to automatic routing when an unsupported model is requested', async () => {
    const router = new ModelRouter({ providerFactory: () => new FakeProvider() })
    router.updateSettings(BASE_SETTINGS)

    const route = await router.resolveRoute({
      requestedModelId: 'anthropic/claude-opus-4',
      userMessage: '긴 설계 문서 분석하고 tradeoff도 정리해줘',
    })

    expect(route?.routeKind).toBe('complex-reasoning')
    expect(route?.reason).toContain('is not in the supported OpenRouter list')
  })

  it('returns null when no cloud provider is configured', async () => {
    const router = new ModelRouter({ providerFactory: () => new FakeProvider() })
    router.updateSettings({ ...BASE_SETTINGS, cloudApiKey: '' })

    const route = await router.resolveRoute({ userMessage: '아무거나' })

    expect(route).toBeNull()
  })
})
