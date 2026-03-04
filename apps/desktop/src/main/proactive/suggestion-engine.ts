import type { Suggestion } from '@shared/types/infrastructure'
import { systemMonitor } from '../infrastructure/system-monitor'
import { contextManager } from '../infrastructure/context-manager'
import { eventBus } from '../infrastructure/event-bus'
import { buildRulesFromConfig } from './rules'
import { evaluateProactiveTriggers } from './triggers'

const MAX_SUGGESTIONS = 20
const MIN_EVALUATE_INTERVAL_MS = 5_000
const MAX_EVALUATE_INTERVAL_MS = 5 * 60 * 1000
const MIN_COOLDOWN_MS = 10 * 1000
const MAX_COOLDOWN_MS = 60 * 60 * 1000

type EngineEnabledFlags = {
  cpu: boolean
  memory: boolean
  disk: boolean
  battery: boolean
  idle: boolean
}

type EngineThresholds = {
  cpuPercent: number
  memoryPercent: number
  diskPercent: number
  lowBatteryPercent: number
  idleMinutes: number
}

export interface SuggestionEngineConfig {
  evaluateIntervalMs: number
  cooldownMs: number
  enabled: EngineEnabledFlags
  thresholds: EngineThresholds
}

const DEFAULT_CONFIG: SuggestionEngineConfig = {
  evaluateIntervalMs: 30_000,
  cooldownMs: 5 * 60 * 1000,
  enabled: {
    cpu: true,
    memory: true,
    disk: true,
    battery: true,
    idle: true,
  },
  thresholds: {
    cpuPercent: 90,
    memoryPercent: 90,
    diskPercent: 90,
    lowBatteryPercent: 20,
    idleMinutes: 30,
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function sanitizeNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(Math.floor(parsed), min), max)
}

function sanitizePercent(value: unknown, fallback: number): number {
  return sanitizeNumber(value, fallback, 1, 100)
}

function sanitizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const lower = value.toLowerCase()
    if (lower === 'true') return true
    if (lower === 'false') return false
  }
  return fallback
}

export class SuggestionEngine {
  private suggestions: Suggestion[] = []
  private timer: ReturnType<typeof setInterval> | null = null
  private lastEmitted: Map<string, number> = new Map()
  private config: SuggestionEngineConfig = {
    evaluateIntervalMs: DEFAULT_CONFIG.evaluateIntervalMs,
    cooldownMs: DEFAULT_CONFIG.cooldownMs,
    enabled: { ...DEFAULT_CONFIG.enabled },
    thresholds: { ...DEFAULT_CONFIG.thresholds },
  }

  start(): void {
    if (this.timer) return
    this.evaluate()
    this.timer = setInterval(() => this.evaluate(), this.config.evaluateIntervalMs)
  }

  stop(): void {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
  }

  list(): Suggestion[] {
    return this.suggestions.filter((s) => !s.dismissed)
  }

  dismiss(id: string): void {
    const suggestion = this.suggestions.find((s) => s.id === id)
    if (suggestion) suggestion.dismissed = true
  }

  getConfig(): SuggestionEngineConfig {
    return {
      evaluateIntervalMs: this.config.evaluateIntervalMs,
      cooldownMs: this.config.cooldownMs,
      enabled: { ...this.config.enabled },
      thresholds: { ...this.config.thresholds },
    }
  }

  configure(rawConfig: Record<string, unknown>): SuggestionEngineConfig {
    const next = this.mergeConfig(this.config, rawConfig)
    const intervalChanged = next.evaluateIntervalMs !== this.config.evaluateIntervalMs
    this.config = next

    if (intervalChanged && this.timer) {
      clearInterval(this.timer)
      this.timer = setInterval(() => this.evaluate(), this.config.evaluateIntervalMs)
    }

    return this.getConfig()
  }

  private mergeConfig(
    current: SuggestionEngineConfig,
    rawConfig: Record<string, unknown>,
  ): SuggestionEngineConfig {
    const next: SuggestionEngineConfig = {
      evaluateIntervalMs: sanitizeNumber(
        rawConfig['evaluateIntervalMs'],
        current.evaluateIntervalMs,
        MIN_EVALUATE_INTERVAL_MS,
        MAX_EVALUATE_INTERVAL_MS,
      ),
      cooldownMs: sanitizeNumber(rawConfig['cooldownMs'], current.cooldownMs, MIN_COOLDOWN_MS, MAX_COOLDOWN_MS),
      enabled: { ...current.enabled },
      thresholds: { ...current.thresholds },
    }

    const enabledRaw = rawConfig['enabled']
    if (isRecord(enabledRaw)) {
      next.enabled.cpu = sanitizeBoolean(enabledRaw['cpu'], current.enabled.cpu)
      next.enabled.memory = sanitizeBoolean(enabledRaw['memory'], current.enabled.memory)
      next.enabled.disk = sanitizeBoolean(enabledRaw['disk'], current.enabled.disk)
      next.enabled.battery = sanitizeBoolean(enabledRaw['battery'], current.enabled.battery)
      next.enabled.idle = sanitizeBoolean(enabledRaw['idle'], current.enabled.idle)
    }

    const thresholdsRaw = rawConfig['thresholds']
    if (isRecord(thresholdsRaw)) {
      next.thresholds.cpuPercent = sanitizePercent(thresholdsRaw['cpuPercent'], current.thresholds.cpuPercent)
      next.thresholds.memoryPercent = sanitizePercent(thresholdsRaw['memoryPercent'], current.thresholds.memoryPercent)
      next.thresholds.diskPercent = sanitizePercent(thresholdsRaw['diskPercent'], current.thresholds.diskPercent)
      next.thresholds.lowBatteryPercent = sanitizePercent(
        thresholdsRaw['lowBatteryPercent'],
        current.thresholds.lowBatteryPercent,
      )
      next.thresholds.idleMinutes = sanitizeNumber(thresholdsRaw['idleMinutes'], current.thresholds.idleMinutes, 1, 720)
    }

    return next
  }

  private evaluate(): void {
    const metrics = systemMonitor.getLatest()
    const context = contextManager.getSnapshot()
    const rules = buildRulesFromConfig({
      enabled: this.config.enabled,
      thresholds: this.config.thresholds,
    })
    const triggered = evaluateProactiveTriggers(metrics, context, rules)

    for (const item of triggered) {
      this.addSuggestion(item)
    }
  }

  private addSuggestion(item: {
    type: Suggestion['type']
    title: string
    description: string
    actions: Array<{ label: string; action: string }>
    priority: number
  }): void {
    const key = `${item.type}:${item.title}`
    const now = Date.now()
    const lastTime = this.lastEmitted.get(key) ?? 0
    if (now - lastTime < this.config.cooldownMs) return

    const suggestion: Suggestion = {
      id: crypto.randomUUID(),
      type: item.type,
      title: item.title,
      description: item.description,
      actions: item.actions,
      priority: item.priority,
      timestamp: now,
    }

    this.suggestions.unshift(suggestion)
    if (this.suggestions.length > MAX_SUGGESTIONS) {
      this.suggestions = this.suggestions.slice(0, MAX_SUGGESTIONS)
    }

    this.lastEmitted.set(key, now)
    eventBus.emit('proactive.suggestion', suggestion as unknown as Record<string, unknown>, 'suggestion-engine')
  }

  destroy(): void {
    this.stop()
    this.suggestions = []
    this.lastEmitted.clear()
  }
}

export const suggestionEngine = new SuggestionEngine()
