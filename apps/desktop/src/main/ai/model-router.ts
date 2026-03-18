/**
 * Model Router - OpenRouter-first routing with local AI fallback.
 */

import type { AppSettings, ModelInfo } from '@shared/types/ipc'
import { CLOUD_MODELS } from '@shared/constants/models'
import type { AIProvider } from './providers/base'
import { NodeLlamaCppProvider } from './providers/node-llama'
import { OllamaProvider } from './providers/ollama'
import { OpenRouterProvider } from './providers/openrouter'

export type ModelRouteKind =
  | 'complex-reasoning'
  | 'code-generation'
  | 'quick-chat'
  | 'summarization'
  | 'vision'
  | 'tool-use'
  | 'workflow'

export interface RouteSelectionOptions {
  requestedModelId?: string
  routeHint?: ModelRouteKind
  userMessage?: string
}

export interface ModelRouteSelection {
  provider: AIProvider
  modelId: string
  fallbackModelIds: string[]
  routeKind: ModelRouteKind
  reason: string
}

interface RoutePolicy {
  primary: string
  fallbacks: string[]
  summary: string
}

interface ModelRouterOptions {
  cloudProviderFactory?: (apiKey: string) => AIProvider
  localProviders?: AIProvider[]
}

interface LocalModelEntry {
  provider: AIProvider
  model: ModelInfo
}

const SUPPORTED_MODEL_IDS = new Set(CLOUD_MODELS.map((model) => model.id))
const LOCAL_PROVIDER_PREFIXES = ['ollama/', 'node-llama-cpp/'] as const
const LOCAL_MODEL_CACHE_TTL_MS = 5000

const ROUTE_PRIORITY: ModelRouteKind[] = [
  'workflow',
  'tool-use',
  'vision',
  'code-generation',
  'summarization',
  'complex-reasoning',
  'quick-chat',
]

const ROUTING_TABLE: Record<ModelRouteKind, RoutePolicy> = {
  'complex-reasoning': {
    primary: 'anthropic/claude-sonnet-4',
    fallbacks: ['openai/gpt-4o', 'deepseek/deepseek-chat'],
    summary: 'long-form analysis, planning, and synthesis',
  },
  'code-generation': {
    primary: 'anthropic/claude-sonnet-4',
    fallbacks: ['deepseek/deepseek-chat', 'openai/gpt-4o'],
    summary: 'coding, debugging, and implementation work',
  },
  'quick-chat': {
    primary: 'google/gemini-2.5-flash',
    fallbacks: ['deepseek/deepseek-chat', 'openai/gpt-4o'],
    summary: 'fast, low-latency everyday chat',
  },
  summarization: {
    primary: 'anthropic/claude-sonnet-4',
    fallbacks: ['google/gemini-2.5-flash', 'deepseek/deepseek-chat'],
    summary: 'summaries, rewriting, and condensation',
  },
  vision: {
    primary: 'anthropic/claude-sonnet-4',
    fallbacks: ['openai/gpt-4o'],
    summary: 'screenshots, images, and visual inspection',
  },
  'tool-use': {
    primary: 'anthropic/claude-sonnet-4',
    fallbacks: ['openai/gpt-4o'],
    summary: 'computer control, browser actions, and tool orchestration',
  },
  workflow: {
    primary: 'anthropic/claude-sonnet-4',
    fallbacks: ['openai/gpt-4o'],
    summary: 'workflow decisions and automation planning',
  },
}

const LOCAL_PROVIDER_ORDER: Record<ModelRouteKind, Array<'ollama' | 'node-llama-cpp'>> = {
  'complex-reasoning': ['ollama', 'node-llama-cpp'],
  'code-generation': ['ollama', 'node-llama-cpp'],
  'quick-chat': ['ollama', 'node-llama-cpp'],
  summarization: ['ollama', 'node-llama-cpp'],
  vision: [],
  'tool-use': ['ollama'],
  workflow: ['ollama'],
}

const LOCAL_MODEL_PREFERENCES: Record<ModelRouteKind, RegExp[]> = {
  'complex-reasoning': [/qwen3/i, /qwen2\.5/i, /phi-?4/i, /gemma3/i, /llama3/i],
  'code-generation': [/qwen.*coder/i, /deepseek.*coder/i, /codellama/i, /starcoder/i, /qwen/i],
  'quick-chat': [/qwen3/i, /phi-?4/i, /gemma3/i, /llama3/i],
  summarization: [/qwen3/i, /gemma3/i, /phi-?4/i, /llama3/i],
  vision: [],
  'tool-use': [/qwen3/i, /llama3/i, /gemma3/i],
  workflow: [/qwen3/i, /phi-?4/i, /llama3/i],
}

const WORKFLOW_KEYWORDS = [
  'workflow', 'pipeline', 'approval', 'decision engine', 'decide whether', 'proceed or stop',
  'automation plan', 'multi-step', 'scheduler', 'runbook',
  '워크플로', '자동화 계획', '승인 흐름', '진행 여부', '결정 엔진', '다단계',
]

const TOOL_USE_KEYWORDS = [
  'click', 'open the app', 'open app', 'take a screenshot', 'screenshot', 'browser', 'chrome',
  'find file', 'read file', 'write file', 'run command', 'terminal', 'shell', 'automation',
  'ui test', 'inspect window', 'desktop app', 'mcp',
  '클릭', '앱 열기', '화면 캡처', '스크린샷', '브라우저', '파일 찾기', '파일 읽기',
  '파일 쓰기', '명령 실행', '터미널', '자동화', 'UI 테스트', '창 검사',
]

const VISION_KEYWORDS = [
  'image', 'photo', 'picture', 'visual', 'vision', 'ocr', 'screenshot', 'screen', 'ui layout',
  '이미지', '사진', '화면', '스크린샷', '시각', 'ocr', '레이아웃',
]

const CODE_KEYWORDS = [
  'code', 'typescript', 'javascript', 'python', 'cpp', 'c++', 'rust', 'go', 'sql', 'bug',
  'debug', 'refactor', 'compile', 'build', 'test', 'lint', 'implementation', 'api', 'sdk',
  '코드', '타입스크립트', '자바스크립트', '파이썬', '버그', '디버그', '리팩터링',
  '빌드', '테스트', '구현', 'api', 'sdk',
]

const SUMMARY_KEYWORDS = [
  'summarize', 'summary', 'tl;dr', 'condense', 'rewrite', 'rewrite this', 'shorten', 'recap',
  '요약', '정리', '짧게', '축약', '다시 써줘', '줄여줘',
]

const COMPLEX_REASONING_KEYWORDS = [
  'analyze', 'analysis', 'reason through', 'tradeoff', 'architecture', 'design', 'strategy',
  'migration', 'root cause', 'why does', 'compare', 'decision matrix', 'deep dive',
  '분석', '아키텍처', '설계', '전략', '원인', '비교', '깊게', '트레이드오프',
]

function getUniqueFallbacks(primary: string, fallbackIds: string[]): string[] {
  const seen = new Set<string>([primary])
  const result: string[] = []
  for (const modelId of fallbackIds) {
    if (!SUPPORTED_MODEL_IDS.has(modelId) || seen.has(modelId)) {
      continue
    }
    seen.add(modelId)
    result.push(modelId)
  }
  return result
}

function isSupportedModel(modelId: string | undefined): modelId is string {
  return !!modelId && SUPPORTED_MODEL_IDS.has(modelId)
}

function isLocalModelId(modelId: string | undefined): modelId is string {
  return !!modelId && LOCAL_PROVIDER_PREFIXES.some((prefix) => modelId.startsWith(prefix))
}

function countKeywordMatches(input: string, keywords: string[]): string[] {
  const matches: string[] = []
  for (const keyword of keywords) {
    if (input.includes(keyword.toLowerCase())) {
      matches.push(keyword)
    }
  }
  return matches.slice(0, 3)
}

function buildReason(routeKind: ModelRouteKind, policy: RoutePolicy, signals: string[]): string {
  if (signals.length > 0) {
    return `${routeKind} selected because ${signals.join('; ')}. Primary model: ${policy.primary}.`
  }
  return `${routeKind} selected as the default route for ${policy.summary}. Primary model: ${policy.primary}.`
}

function inferRoute(input: string, routeHint?: ModelRouteKind): { routeKind: ModelRouteKind; signals: string[] } {
  const scores = new Map<ModelRouteKind, number>()
  const signals = new Map<ModelRouteKind, string[]>()

  for (const routeKind of ROUTE_PRIORITY) {
    scores.set(routeKind, routeKind === 'quick-chat' ? 1 : 0)
    signals.set(routeKind, [])
  }

  const addSignal = (routeKind: ModelRouteKind, weight: number, description: string): void => {
    scores.set(routeKind, (scores.get(routeKind) ?? 0) + weight)
    signals.get(routeKind)?.push(description)
  }

  if (routeHint) {
    addSignal(routeHint, 100, `explicit route hint "${routeHint}"`)
  }

  const trimmed = input.trim()
  const tokenCount = trimmed ? trimmed.split(/\s+/).length : 0

  if (trimmed.length > 1200 || tokenCount > 220) {
    addSignal('complex-reasoning', 5, 'prompt is long enough to benefit from deeper reasoning')
  }

  if (trimmed.length > 0 && trimmed.length < 140 && tokenCount <= 24) {
    addSignal('quick-chat', 2, 'prompt is short and latency-sensitive')
  }

  const keywordGroups: Array<{ routeKind: ModelRouteKind; keywords: string[]; weight: number; label: string }> = [
    { routeKind: 'workflow', keywords: WORKFLOW_KEYWORDS, weight: 10, label: 'workflow' },
    { routeKind: 'tool-use', keywords: TOOL_USE_KEYWORDS, weight: 8, label: 'tool-use' },
    { routeKind: 'vision', keywords: VISION_KEYWORDS, weight: 7, label: 'vision' },
    { routeKind: 'code-generation', keywords: CODE_KEYWORDS, weight: 9, label: 'code' },
    { routeKind: 'summarization', keywords: SUMMARY_KEYWORDS, weight: 8, label: 'summary' },
    { routeKind: 'complex-reasoning', keywords: COMPLEX_REASONING_KEYWORDS, weight: 7, label: 'reasoning' },
  ]

  for (const group of keywordGroups) {
    const matches = countKeywordMatches(input, group.keywords)
    if (matches.length > 0) {
      addSignal(group.routeKind, group.weight + matches.length, `${group.label} keywords matched: ${matches.join(', ')}`)
    }
  }

  let selected = ROUTE_PRIORITY[ROUTE_PRIORITY.length - 1]
  let bestScore = Number.NEGATIVE_INFINITY
  for (const routeKind of ROUTE_PRIORITY) {
    const score = scores.get(routeKind) ?? 0
    if (score > bestScore) {
      bestScore = score
      selected = routeKind
    }
  }

  return { routeKind: selected, signals: signals.get(selected) ?? [] }
}

function scoreLocalModel(modelId: string, patterns: RegExp[]): number {
  return patterns.reduce((score, pattern, index) => (
    pattern.test(modelId) ? score + (patterns.length - index) * 10 : score
  ), 0)
}

function orderLocalModelsByPreference(models: ModelInfo[], routeKind: ModelRouteKind): ModelInfo[] {
  const patterns = LOCAL_MODEL_PREFERENCES[routeKind]
  return [...models].sort((left, right) => {
    const leftScore = scoreLocalModel(left.id, patterns)
    const rightScore = scoreLocalModel(right.id, patterns)
    if (leftScore !== rightScore) {
      return rightScore - leftScore
    }
    return left.name.localeCompare(right.name)
  })
}

function selectPreferredLocalModel(models: ModelInfo[], routeKind: ModelRouteKind): ModelInfo {
  return orderLocalModelsByPreference(models, routeKind)[0] ?? models[0]
}

export class ModelRouter {
  private cloudProvider: AIProvider | null = null
  private readonly cloudProviderFactory: (apiKey: string) => AIProvider
  private readonly localProviders: AIProvider[]
  private localModelCache: { expiresAt: number; entries: LocalModelEntry[] } | null = null

  constructor(options: ModelRouterOptions = {}) {
    this.cloudProviderFactory = options.cloudProviderFactory ?? ((apiKey) => new OpenRouterProvider(apiKey))
    this.localProviders = options.localProviders ?? [new OllamaProvider(), new NodeLlamaCppProvider()]
  }

  updateSettings(settings: AppSettings): void {
    this.cloudProvider = settings.cloudApiKey
      ? this.cloudProviderFactory(settings.cloudApiKey)
      : null
  }

  getProvider(modelId: string): AIProvider | null {
    if (SUPPORTED_MODEL_IDS.has(modelId)) {
      return this.cloudProvider ?? null
    }

    if (modelId.startsWith('ollama/')) {
      return this.localProviders.find((provider) => provider.name === 'ollama') ?? null
    }

    if (modelId.startsWith('node-llama-cpp/')) {
      return this.localProviders.find((provider) => provider.name === 'node-llama-cpp') ?? null
    }

    return null
  }

  async resolveRoute(options: RouteSelectionOptions = {}): Promise<ModelRouteSelection | null> {
    const requestedModelId = options.requestedModelId?.trim()
    const input = (options.userMessage ?? '').toLowerCase()
    const inferredRoute = inferRoute(input, options.routeHint)
    const explicitRoute = await this.resolveExplicitModelRoute(requestedModelId, inferredRoute.routeKind)

    if (explicitRoute) {
      return explicitRoute
    }

    if (this.cloudProvider && (await this.cloudProvider.isAvailable())) {
      const policy = ROUTING_TABLE[inferredRoute.routeKind]
      const fallbackModelIds = getUniqueFallbacks(policy.primary, policy.fallbacks)
      const unsupportedModelReason = requestedModelId && !isSupportedModel(requestedModelId) && !isLocalModelId(requestedModelId)
        ? `Requested model "${requestedModelId}" is not in the supported OpenRouter list. `
        : ''

      return {
        provider: this.cloudProvider,
        modelId: policy.primary,
        fallbackModelIds,
        routeKind: inferredRoute.routeKind,
        reason: unsupportedModelReason + buildReason(inferredRoute.routeKind, policy, inferredRoute.signals),
      }
    }

    return this.resolveLocalRoute(inferredRoute)
  }

  async autoSelect(options: Omit<RouteSelectionOptions, 'requestedModelId'> = {}): Promise<ModelRouteSelection | null> {
    return this.resolveRoute(options)
  }

  async listModels(): Promise<ModelInfo[]> {
    const models: ModelInfo[] = []
    if (this.cloudProvider && (await this.cloudProvider.isAvailable())) {
      models.push(...CLOUD_MODELS.map((model) => ({ ...model })))
    }

    const localModels = await this.collectLocalModels(true)
    models.push(...localModels.map(({ model }) => ({ ...model })))
    return models
  }

  private async resolveExplicitModelRoute(
    requestedModelId: string | undefined,
    routeKind: ModelRouteKind,
  ): Promise<ModelRouteSelection | null> {
    if (isSupportedModel(requestedModelId)) {
      if (!this.cloudProvider || !(await this.cloudProvider.isAvailable())) {
        return null
      }

      return {
        provider: this.cloudProvider,
        modelId: requestedModelId,
        fallbackModelIds: [],
        routeKind,
        reason: `explicit model selection "${requestedModelId}" was requested by the caller`,
      }
    }

    if (!isLocalModelId(requestedModelId)) {
      return null
    }

    const localModels = await this.collectLocalModels()
    const selected = localModels.find(({ model }) => model.id === requestedModelId)
    if (!selected) {
      return null
    }

    return {
      provider: selected.provider,
      modelId: selected.model.id,
      fallbackModelIds: this.buildLocalFallbackIds(selected.provider.name, localModels, routeKind, selected.model.id),
      routeKind,
      reason: `explicit local model selection "${requestedModelId}" was requested by the caller`,
    }
  }

  private async resolveLocalRoute(
    inferredRoute: { routeKind: ModelRouteKind; signals: string[] },
  ): Promise<ModelRouteSelection | null> {
    const localModels = await this.collectLocalModels()
    if (localModels.length === 0) {
      return null
    }

    for (const providerName of LOCAL_PROVIDER_ORDER[inferredRoute.routeKind]) {
      const candidateModels = localModels.filter(({ provider }) => provider.name === providerName)
      if (candidateModels.length === 0) {
        continue
      }

      const selectedModel = selectPreferredLocalModel(
        candidateModels.map(({ model }) => model),
        inferredRoute.routeKind,
      )

      return {
        provider: candidateModels[0].provider,
        modelId: selectedModel.id,
        fallbackModelIds: this.buildLocalFallbackIds(providerName, localModels, inferredRoute.routeKind, selectedModel.id),
        routeKind: inferredRoute.routeKind,
        reason: `local ${providerName} route selected because no cloud model is available. Preferred for ${inferredRoute.routeKind}.`,
      }
    }

    return null
  }

  private async collectLocalModels(forceRefresh = false): Promise<LocalModelEntry[]> {
    if (!forceRefresh && this.localModelCache && this.localModelCache.expiresAt > Date.now()) {
      return this.localModelCache.entries
    }

    const entries: LocalModelEntry[] = []
    for (const provider of this.localProviders) {
      try {
        const models = await provider.listModels()
        for (const model of models) {
          entries.push({
            provider,
            model: {
              id: model.id,
              name: model.name,
              provider: provider.name as ModelInfo['provider'],
              isLocal: true,
              size: model.size,
            },
          })
        }
      } catch {
        continue
      }
    }

    this.localModelCache = {
      expiresAt: Date.now() + LOCAL_MODEL_CACHE_TTL_MS,
      entries,
    }

    return entries
  }

  private buildLocalFallbackIds(
    providerName: string,
    localModels: LocalModelEntry[],
    routeKind: ModelRouteKind,
    selectedModelId: string,
  ): string[] {
    const sameProviderModels = localModels
      .filter(({ provider }) => provider.name === providerName)
      .map(({ model }) => model)

    return orderLocalModelsByPreference(sameProviderModels, routeKind)
      .map((model) => model.id)
      .filter((modelId) => modelId !== selectedModelId)
      .slice(0, 2)
  }
}

export const modelRouter = new ModelRouter()
