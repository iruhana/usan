/**
 * Model Router - OpenRouter-only multi-model routing and failover.
 */

import type { AppSettings, ModelInfo } from '@shared/types/ipc'
import { CLOUD_MODELS } from '@shared/constants/models'
import type { AIProvider } from './providers/base'
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
  providerFactory?: (apiKey: string) => AIProvider
}

const SUPPORTED_MODEL_IDS = new Set(CLOUD_MODELS.map((model) => model.id))

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

const WORKFLOW_KEYWORDS = [
  'workflow', 'pipeline', 'approval', 'decision engine', 'decide whether', 'proceed or stop',
  'automation plan', 'multi-step', 'scheduler', 'runbook',
  '워크플로', '자동화 계획', '단계별', '승인 흐름', '진행 여부', '멈출지', '계속할지',
  'ワークフロー', '自動化', '承認フロー', '進めるか',
]

const TOOL_USE_KEYWORDS = [
  'click', 'open the app', 'open app', 'take a screenshot', 'screenshot', 'browser', 'chrome',
  'find file', 'read file', 'write file', 'run command', 'terminal', 'shell', 'automation',
  'ui test', 'inspect window', 'desktop app', 'mcp',
  '클릭', '앱 열기', '화면 캡처', '스크린샷', '브라우저', '파일 찾아', '파일 읽', '파일 써',
  '명령 실행', '터미널', '쉘', '자동화', 'UI 테스트', '창 검사',
  'クリック', 'アプリを開', 'スクリーンショット', 'ブラウザ', 'ファイルを読', 'ファイルを書',
  'コマンド実行', 'ターミナル', '自動化',
]

const VISION_KEYWORDS = [
  'image', 'photo', 'picture', 'visual', 'vision', 'ocr', 'screenshot', 'screen', 'ui layout',
  '이미지', '사진', '화면', '스크린샷', '시각', 'OCR', '레이아웃',
  '画像', '写真', '画面', 'スクリーンショット', '視覚',
]

const CODE_KEYWORDS = [
  'code', 'typescript', 'javascript', 'python', 'cpp', 'c++', 'rust', 'go', 'sql', 'bug',
  'debug', 'refactor', 'compile', 'build', 'test', 'lint', 'implementation', 'api', 'sdk',
  '코드', '타입스크립트', '자바스크립트', '파이썬', '버그', '디버그', '리팩터링', '빌드', '테스트',
  '구현', '컴파일', '함수', '모듈', '패치',
  'コード', 'デバッグ', 'リファクタ', '実装', 'ビルド', 'テスト', '関数', 'モジュール',
]

const SUMMARY_KEYWORDS = [
  'summarize', 'summary', 'tl;dr', 'condense', 'rewrite', 'rewrite this', 'shorten', 'recap',
  '요약', '정리', '짧게', '축약', '다듬어', '재작성', '한 줄로',
  '要約', 'まとめ', '短く', '言い換え', '書き直し',
]

const COMPLEX_REASONING_KEYWORDS = [
  'analyze', 'analysis', 'reason through', 'tradeoff', 'architecture', 'design', 'strategy',
  'migration', 'root cause', 'why does', 'compare', 'decision matrix', 'deep dive',
  '분석', '아키텍처', '설계', '전략', '원인', '비교', '깊게', '깊이', '장단점', '트레이드오프',
  '分析', '設計', '戦略', '原因', '比較', '深掘り', 'トレードオフ',
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

function countKeywordMatches(input: string, keywords: string[]): string[] {
  const matches: string[] = []
  for (const keyword of keywords) {
    if (input.includes(keyword)) {
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

export class ModelRouter {
  private provider: AIProvider | null = null
  private readonly providerFactory: (apiKey: string) => AIProvider

  constructor(options: ModelRouterOptions = {}) {
    this.providerFactory = options.providerFactory ?? ((apiKey) => new OpenRouterProvider(apiKey))
  }

  /** Update provider based on user settings */
  updateSettings(settings: AppSettings): void {
    if (settings.cloudApiKey) {
      this.provider = this.providerFactory(settings.cloudApiKey)
      return
    }
    this.provider = null
  }

  /** Get the provider for a model ID */
  getProvider(modelId: string): AIProvider | null {
    if (!isSupportedModel(modelId)) {
      return null
    }
    return this.provider ?? null
  }

  /** Resolve the best route for the current request */
  async resolveRoute(options: RouteSelectionOptions = {}): Promise<ModelRouteSelection | null> {
    if (!this.provider || !(await this.provider.isAvailable())) {
      return null
    }

    const requestedModelId = options.requestedModelId?.trim()
    const input = (options.userMessage ?? '').toLowerCase()
    const inferredRoute = inferRoute(input, options.routeHint)
    if (isSupportedModel(requestedModelId)) {
      return {
        provider: this.provider,
        modelId: requestedModelId,
        fallbackModelIds: [],
        routeKind: inferredRoute.routeKind,
        reason: `explicit model selection "${requestedModelId}" was requested by the caller`,
      }
    }

    const { routeKind, signals } = inferredRoute
    const policy = ROUTING_TABLE[routeKind]
    const fallbackModelIds = getUniqueFallbacks(policy.primary, policy.fallbacks)
    const unsupportedModelReason = requestedModelId && !isSupportedModel(requestedModelId)
      ? `Requested model "${requestedModelId}" is not in the supported OpenRouter list. `
      : ''

    return {
      provider: this.provider,
      modelId: policy.primary,
      fallbackModelIds,
      routeKind,
      reason: unsupportedModelReason + buildReason(routeKind, policy, signals),
    }
  }

  /** Auto-select the best available model */
  async autoSelect(options: Omit<RouteSelectionOptions, 'requestedModelId'> = {}): Promise<ModelRouteSelection | null> {
    return this.resolveRoute(options)
  }

  /** List all available models */
  async listModels(): Promise<ModelInfo[]> {
    if (this.provider && (await this.provider.isAvailable())) {
      return CLOUD_MODELS.map((model) => ({ ...model }))
    }
    return []
  }
}

export const modelRouter = new ModelRouter()
