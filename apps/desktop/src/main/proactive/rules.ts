import type { SuggestionType } from '@shared/types/infrastructure'

export type ProactiveRuleKind = 'cpu' | 'memory' | 'disk' | 'battery' | 'idle'

export interface ProactiveRule {
  id: string
  kind: ProactiveRuleKind
  enabled: boolean
  threshold: number
  type: SuggestionType
  priority: number
  title: string
  action?: { label: string; action: string }
}

export interface ProactiveRuleConfig {
  enabled: {
    cpu: boolean
    memory: boolean
    disk: boolean
    battery: boolean
    idle: boolean
  }
  thresholds: {
    cpuPercent: number
    memoryPercent: number
    diskPercent: number
    lowBatteryPercent: number
    idleMinutes: number
  }
}

export function buildRulesFromConfig(config: ProactiveRuleConfig): ProactiveRule[] {
  return [
    {
      id: 'cpu-high',
      kind: 'cpu',
      enabled: config.enabled.cpu,
      threshold: config.thresholds.cpuPercent,
      type: 'warning',
      priority: 8,
      title: 'High CPU usage',
      action: { label: 'View processes', action: 'show_processes' },
    },
    {
      id: 'memory-high',
      kind: 'memory',
      enabled: config.enabled.memory,
      threshold: config.thresholds.memoryPercent,
      type: 'warning',
      priority: 8,
      title: 'High memory usage',
      action: { label: 'View processes', action: 'show_processes' },
    },
    {
      id: 'disk-high',
      kind: 'disk',
      enabled: config.enabled.disk,
      threshold: config.thresholds.diskPercent,
      type: 'warning',
      priority: 9,
      title: 'Low disk space',
      action: { label: 'Clean temp files', action: 'clean_temp' },
    },
    {
      id: 'battery-low',
      kind: 'battery',
      enabled: config.enabled.battery,
      threshold: config.thresholds.lowBatteryPercent,
      type: 'warning',
      priority: 10,
      title: 'Low battery',
    },
    {
      id: 'user-idle',
      kind: 'idle',
      enabled: config.enabled.idle,
      threshold: config.thresholds.idleMinutes,
      type: 'info',
      priority: 2,
      title: 'You have been idle',
    },
  ]
}
