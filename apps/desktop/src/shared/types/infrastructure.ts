/**
 * Shared types for infrastructure modules (Phase 0)
 * Used by main process, preload, and renderer
 */

// ??? Event Bus ??????????????????????????????????
export interface UsanEvent {
  type: string
  payload: Record<string, unknown>
  timestamp: number
  source: string
}

// ??? System Monitor ?????????????????????????????
export interface SystemMetrics {
  cpu: { usage: number; cores: number }
  memory: { total: number; used: number; percent: number }
  disk: Array<{ drive: string; total: number; free: number; percent: number }>
  battery?: { percent: number; charging: boolean }
  network?: { bytesIn: number; bytesOut: number }
  timestamp: number
}

export interface ProcessInfo {
  pid: number
  name: string
  cpu: number
  memory: number
  windowTitle?: string
}

export interface ActiveWindowInfo {
  pid: number
  title: string
  processName: string
}

// ??? Context Manager ????????????????????????????
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface MonitorInfo {
  id: number
  bounds: Rect
  primary: boolean
  label?: string
}

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night'

export interface ContextSnapshot {
  activeWindow: ActiveWindowInfo | null
  activeApp: string
  timeOfDay: TimeOfDay
  idleTimeMs: number
  monitors: MonitorInfo[]
  timestamp: number
}

// ??? Hotkey Manager ?????????????????????????????
export interface HotkeyBinding {
  id: string
  accelerator: string
  label: string
  action: string
  enabled: boolean
}

// ??? Workflow Engine ????????????????????????????
export type WorkflowStepType = 'tool_call' | 'condition' | 'loop' | 'delay' | 'ai_decision'
export type WorkflowErrorStrategy = 'stop' | 'skip' | 'retry'
export type WorkflowTriggerType = 'manual' | 'schedule' | 'event' | 'hotkey'
export type WorkflowRunStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'

export interface WorkflowStep {
  id: string
  type: WorkflowStepType
  toolName?: string
  toolArgs?: Record<string, unknown>
  condition?: { field: string; operator: string; value: unknown }
  children?: WorkflowStep[]
  onError?: WorkflowErrorStrategy
  delayMs?: number
  aiPrompt?: string
}

export interface WorkflowTrigger {
  type: WorkflowTriggerType
  config: Record<string, unknown>
}

export interface WorkflowDefinition {
  id: string
  name: string
  description: string
  triggers: WorkflowTrigger[]
  steps: WorkflowStep[]
  variables: Record<string, unknown>
  createdAt: number
  updatedAt: number
}

export interface WorkflowStepResult {
  stepId: string
  status: 'completed' | 'failed' | 'skipped'
  result?: unknown
  error?: string
  durationMs: number
}

export interface WorkflowRun {
  id: string
  workflowId: string
  status: WorkflowRunStatus
  stepResults: WorkflowStepResult[]
  currentStepIndex: number
  variables: Record<string, unknown>
  startedAt: number
  completedAt?: number
  error?: string
}

export interface WorkflowProgress {
  runId: string
  workflowId: string
  status: WorkflowRunStatus
  currentStepIndex: number
  totalSteps: number
  stepResult?: WorkflowStepResult
}

// ??? Plugin Manager ?????????????????????????????
export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author: string
  skills: string[]
  tools?: string[]
  permissions?: string[]
  integrity?: {
    algorithm: 'sha256'
    manifestDigest?: string
    filesDigest?: string
  }
  provenance?: {
    source: 'local' | 'marketplace'
    repository?: string
    commit?: string
    signature?: string
  }
  minAppVersion?: string
}

export interface InstalledPlugin {
  manifest: PluginManifest
  path: string
  enabled: boolean
  installedAt: number
}

export interface MarketplaceEntry {
  id: string
  name: string
  version: string
  description: string
  author: string
  downloads: number
  rating: number
  tags: string[]
}

// ??? Proactive Suggestions ??????????????????????
export type SuggestionType = 'warning' | 'info' | 'action' | 'error'

export interface Suggestion {
  id: string
  type: SuggestionType
  title: string
  description: string
  actions: Array<{ label: string; action: string }>
  priority: number
  timestamp: number
  dismissed?: boolean
}

// ??? Clipboard History ??????????????????????????
export interface ClipboardEntry {
  id: string
  text: string
  timestamp: number
  pinned: boolean
  format?: string
}

export type ClipboardTransformFormat = 'json_pretty' | 'url_decode' | 'base64_decode' | 'md_to_text'

// ??? RAG Knowledge Base ????????????????????????
export interface RagDocument {
  id: string
  name: string
  path: string
  chunks: number
  indexedAt: number
}

export interface RagSearchResult {
  documentId: string
  documentName: string
  chunk: string
  score: number
  vectorScore?: number
  keywordScore?: number
  confidence?: 'high' | 'medium' | 'low'
}

export interface RagIndexProgress {
  current: number
  total: number
  fileName: string
}

export interface RagIndexFileResult {
  documentId: string
  chunks: number
  skipped: boolean
}

export interface RagIndexFolderResult {
  indexedCount: number
  skippedCount: number
  failedCount: number
  totalChunks: number
}

// ??? Vision ????????????????????????????????????
export interface OcrResult {
  text: string
  confidence: number
  regions: Array<{ text: string; bounds: Rect }>
}

export interface UiElement {
  label: string
  type: 'button' | 'input' | 'text' | 'image' | 'link' | 'unknown'
  bounds: Rect
  confidence: number
}

// ??? Macro ?????????????????????????????????????
export interface MacroEntry {
  id: string
  name: string
  description: string
  events: Array<{ type: string; x?: number; y?: number; text?: string; keys?: string; timestamp: number }>
  createdAt: number
}

// ??? File Organization ?????????????????????????
export interface FileOrgPreview {
  moves: Array<{ from: string; to: string; reason: string }>
  totalFiles: number
}

export interface DuplicateGroup {
  hash: string
  size: number
  files: string[]
}

// ??? Image Processing ??????????????????????????
export interface ImageInfo {
  width: number
  height: number
  format: string
  size: number
  path: string
}

// ??? Email ?????????????????????????????????????
export interface EmailEntry {
  id: string
  from: string
  subject: string
  snippet: string
  date: string
  read: boolean
}

export interface EmailFull extends EmailEntry {
  body: string
  to: string[]
  cc?: string[]
  attachments?: Array<{ name: string; size: number }>
}

// ??? Calendar ??????????????????????????????????
export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  location?: string
  description?: string
  attendees?: string[]
  allDay?: boolean
}

// ??? Monitor (Multi-display) ???????????????????
export interface DisplayInfo {
  id: number
  label: string
  bounds: Rect
  primary: boolean
  scaleFactor: number
}


export type McpTransport = 'stdio' | 'sse'

export interface McpServerConfig {
  id: string
  name: string
  transport: McpTransport
  command?: string
  args?: string[]
  url?: string
  env?: Record<string, string>
}

export interface McpServerStatus {
  id: string
  name: string
  connected: boolean
  toolCount: number
  error?: string
}

export interface McpToolInfo {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  serverId: string
  serverName: string
}

// ??? Voice ?????????????????????????????????????
export type VoiceStatus = 'idle' | 'listening' | 'processing' | 'error'

export interface VoiceStatusEvent {
  status: VoiceStatus
  text?: string
  error?: string
}

