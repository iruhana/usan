// ─── AI Providers ────────────────────────────────────────────────────────────

export type AIProviderType = 'api' | 'web'

export interface AIProvider {
  id: string
  name: string
  type: AIProviderType
  url?: string           // for web providers
  icon: string           // emoji or svg name
  color: string          // brand color hex
  description: string
}

export const AI_PROVIDERS: AIProvider[] = [
  // API-based (rendered by our own UI)
  {
    id: 'claude',
    name: 'Claude',
    type: 'api',
    icon: '◆',
    color: '#d97706',
    description: 'Anthropic Claude — powerful reasoning & analysis',
  },

  // Web-embedded
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    type: 'web',
    url: 'https://chatgpt.com',
    icon: '⬡',
    color: '#10a37f',
    description: 'OpenAI ChatGPT',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    type: 'web',
    url: 'https://gemini.google.com',
    icon: '✦',
    color: '#4285f4',
    description: 'Google Gemini',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    type: 'web',
    url: 'https://www.perplexity.ai',
    icon: '◎',
    color: '#20b2aa',
    description: 'Real-time web search AI',
  },
  {
    id: 'grok',
    name: 'Grok',
    type: 'web',
    url: 'https://x.com/i/grok',
    icon: '𝕏',
    color: '#e7e9ea',
    description: 'xAI Grok',
  },
  {
    id: 'doubao',
    name: 'Doubao',
    type: 'web',
    url: 'https://www.doubao.com/chat',
    icon: '◉',
    color: '#4f46e5',
    description: 'ByteDance Doubao (豆包)',
  },
  {
    id: 'kimi',
    name: 'Kimi',
    type: 'web',
    url: 'https://kimi.moonshot.cn',
    icon: '◐',
    color: '#1d4ed8',
    description: 'Moonshot Kimi',
  },
  {
    id: 'qwen',
    name: 'Qwen',
    type: 'web',
    url: 'https://tongyi.aliyun.com/qianwen',
    icon: '◈',
    color: '#f59e0b',
    description: 'Alibaba Qwen (通义千问)',
  },
  {
    id: 'yuanbao',
    name: '元宝',
    type: 'web',
    url: 'https://yuanbao.tencent.com/bot/app',
    icon: '◆',
    color: '#0d9488',
    description: 'Tencent Yuanbao (元宝)',
  },
  {
    id: 'clovax',
    name: 'Clova X',
    type: 'web',
    url: 'https://clova-x.naver.com',
    icon: '◷',
    color: '#03c75a',
    description: 'NAVER Clova X',
  },
]

// ─── Skills ──────────────────────────────────────────────────────────────────

export interface SkillMeta {
  slug: string
  name: string
  description: string
  version: string
  author: string
  downloads: number
  stars: number
  emoji: string
  category: string
  skillPath: string      // absolute path to skill version folder
}

// ─── AI Models ───────────────────────────────────────────────────────────────

export type AIModelProvider = 'anthropic' | 'openai' | 'google'

export interface AIModel {
  id: string
  name: string
  provider: AIModelProvider
  description: string
  color: string
}

export const AI_MODELS: AIModel[] = [
  // ── Anthropic ──
  { id: 'claude-opus-4-6',           name: 'Claude Opus 4.6',    provider: 'anthropic', description: '최고 성능',        color: '#d97706' },
  { id: 'claude-sonnet-4-6',         name: 'Claude Sonnet 4.6',  provider: 'anthropic', description: '균형 성능',        color: '#d97706' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5',   provider: 'anthropic', description: '빠른 응답',        color: '#d97706' },
  // ── OpenAI ──
  { id: 'gpt-5.4-pro',               name: 'GPT-5.4 Pro',        provider: 'openai',    description: '최고 성능',        color: '#10a37f' },
  { id: 'gpt-5.4',                   name: 'GPT-5.4',            provider: 'openai',    description: '최신 플래그십',    color: '#10a37f' },
  { id: 'gpt-5.4-mini',              name: 'GPT-5.4 Mini',       provider: 'openai',    description: '빠르고 저렴',      color: '#10a37f' },
  { id: 'o3',                        name: 'o3',                  provider: 'openai',    description: '추론 특화',        color: '#10a37f' },
  { id: 'o4-mini',                   name: 'o4 Mini',             provider: 'openai',    description: '경량 추론',        color: '#10a37f' },
  // ── Google ──
  { id: 'gemini-3.1-pro-preview',    name: 'Gemini 3.1 Pro',     provider: 'google',    description: '최신 고성능',      color: '#4285f4' },
  { id: 'gemini-2.5-pro',            name: 'Gemini 2.5 Pro',     provider: 'google',    description: '안정 고성능',      color: '#4285f4' },
  { id: 'gemini-2.5-flash',          name: 'Gemini 2.5 Flash',   provider: 'google',    description: '빠른 멀티모달',    color: '#4285f4' },
  { id: 'gemini-2.5-flash-lite',     name: 'Gemini 2.5 Flash Lite', provider: 'google', description: '초경량',           color: '#4285f4' },
]

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatPayload {
  requestId: string
  sessionId: string
  userMessage: {
    id: string
    content: string
    ts: number
  }
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  model: string
  systemPrompt?: string
  useTools?: boolean
}

export interface StreamChunk {
  requestId: string
  text?: string
  toolCall?: { name: string; input: unknown }
  toolResult?: { id: string; result: string }
  error?: string
  done: boolean
}

// ─── Shell Snapshot ──────────────────────────────────────────────────────────

export type SessionStatus = 'active' | 'idle' | 'running' | 'failed' | 'approval_pending'
export type RunStepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'approval_needed'
export type ArtifactKind = 'code' | 'markdown' | 'json' | 'diff' | 'plan' | 'preview'
export type ApprovalRisk = 'low' | 'medium' | 'high'
export type ReferenceType = 'file' | 'memory' | 'web' | 'resource'
export type PreviewStatus = 'healthy' | 'partial' | 'stale' | 'failed'

export interface ShellSession {
  id: string
  title: string
  status: SessionStatus
  model: string
  updatedAt: string
  archivedAt?: string | null
  branchedFromSessionId?: string | null
  branchedFromMessageId?: string | null
  pinned: boolean
  messageCount: number
  artifactCount: number
  preview?: string
}

export interface CreateShellSessionSeed {
  title?: string
  model?: string
  pinned?: boolean
}

export interface BranchShellSessionSeed extends CreateShellSessionSeed {
  sourceMessageId?: string
}

export interface ShellRunStep {
  id: string
  sessionId: string
  label: string
  status: RunStepStatus
  detail?: string
  durationMs?: number
}

export interface ShellArtifact {
  id: string
  title: string
  kind: ArtifactKind
  sessionId: string
  createdAt: string
  size: string
  version: number
  content?: string
}

export interface ShellApproval {
  id: string
  sessionId: string
  action: string
  detail: string
  risk: ApprovalRisk
  retryable: boolean
}

export interface ShellLog {
  id: string
  sessionId: string
  ts: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
}

export interface ShellTemplate {
  id: string
  emoji: string
  title: string
  description: string
  category: 'page' | 'tool' | 'workflow' | 'document'
}

export interface ShellChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  ts: number
}

export interface ShellReference {
  id: string
  sessionId: string
  type: ReferenceType
  title: string
  detail: string
}

export interface ShellPreview {
  sessionId: string
  title: string
  status: PreviewStatus
  version: number
}

export interface ShellSnapshot {
  activeSessionId: string | null
  sessions: ShellSession[]
  runSteps: ShellRunStep[]
  artifacts: ShellArtifact[]
  approvals: ShellApproval[]
  logs: ShellLog[]
  templates: ShellTemplate[]
  messages: ShellChatMessage[]
  references: ShellReference[]
  previews: ShellPreview[]
}

// ─── Settings ────────────────────────────────────────────────────────────────

export type AppTheme = 'dark' | 'light'
export type AppLanguage = 'ko' | 'en'

export interface AppSettings {
  theme: AppTheme
  language: AppLanguage
  autoSave: boolean
  showTemplates: boolean
  toolUseEnabled: boolean
  defaultModel: string
  onboardingDismissed: boolean
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'ko',
  autoSave: true,
  showTemplates: true,
  toolUseEnabled: true,
  defaultModel: 'claude-sonnet-4-6',
  onboardingDismissed: false,
}

// ─── IPC channels ────────────────────────────────────────────────────────────

export interface IpcChannels {
  // AI tabs
  'tabs:switch': (providerId: string) => void
  'tabs:list': () => AIProvider[]

  // Skills
  'skills:list': (query?: string) => SkillMeta[]
  'skills:read': (slug: string) => string        // returns SKILL.md content
  'skills:reindex': () => { count: number }

  // Window
  'window:minimize': () => void
  'window:maximize': () => void
  'window:close': () => void
  'window:is-maximized': () => boolean

  // Phase 0 shell snapshot + settings
  'shell:get-snapshot': () => ShellSnapshot
  'shell:set-active-session': (sessionId: string) => ShellSnapshot
  'shell:create-session': (seed?: CreateShellSessionSeed) => ShellSnapshot
  'shell:branch-session': (sessionId: string, seed?: BranchShellSessionSeed) => ShellSnapshot
  'shell:promote-session': (sessionId: string) => ShellSnapshot
  'shell:archive-session': (sessionId: string) => ShellSnapshot
  'shell:restore-session': (sessionId: string) => ShellSnapshot
  'shell:append-message': (sessionId: string, message: ShellChatMessage) => ShellSnapshot
  'shell:update-session': (sessionId: string, patch: Partial<ShellSession>) => ShellSnapshot
  'shell:append-run-step': (step: ShellRunStep) => ShellSnapshot
  'shell:update-run-step': (stepId: string, patch: Partial<ShellRunStep>) => ShellSnapshot
  'shell:append-log': (log: ShellLog) => ShellSnapshot
  'shell:append-artifact': (artifact: ShellArtifact) => ShellSnapshot
  'settings:get': () => AppSettings
  'settings:update': (patch: Partial<AppSettings>) => AppSettings
}
