import type { ContextSnapshot, SuggestionType, SystemMetrics } from '@shared/types/infrastructure'
import type { ProactiveRule } from './rules'

export interface TriggeredSuggestion {
  type: SuggestionType
  title: string
  description: string
  priority: number
  actions: Array<{ label: string; action: string }>
}

function withAction(action?: { label: string; action: string }): Array<{ label: string; action: string }> {
  return action ? [action] : []
}

export function evaluateProactiveTriggers(
  metrics: SystemMetrics | null,
  context: ContextSnapshot,
  rules: ProactiveRule[],
): TriggeredSuggestion[] {
  const triggered: TriggeredSuggestion[] = []

  for (const rule of rules) {
    if (!rule.enabled) continue

    if (rule.kind === 'cpu' && metrics && metrics.cpu.usage >= rule.threshold) {
      triggered.push({
        type: rule.type,
        title: rule.title,
        description: `CPU usage is ${metrics.cpu.usage.toFixed(1)}%. Close heavy processes if performance feels slow.`,
        priority: rule.priority,
        actions: withAction(rule.action),
      })
    }

    if (rule.kind === 'memory' && metrics && metrics.memory.percent >= rule.threshold) {
      triggered.push({
        type: rule.type,
        title: rule.title,
        description: `Memory usage is ${metrics.memory.percent.toFixed(1)}%. Consider closing unused apps.`,
        priority: rule.priority,
        actions: withAction(rule.action),
      })
    }

    if (rule.kind === 'disk' && metrics) {
      for (const disk of metrics.disk) {
        if (disk.percent < rule.threshold) continue
        triggered.push({
          type: rule.type,
          title: `${rule.title} on ${disk.drive}`,
          description: `${disk.drive} is ${disk.percent.toFixed(1)}% used. Free space: ${disk.free.toFixed(1)} GB.`,
          priority: rule.priority,
          actions: withAction(rule.action),
        })
      }
    }

    if (rule.kind === 'battery' && metrics?.battery && !metrics.battery.charging && metrics.battery.percent <= rule.threshold) {
      triggered.push({
        type: rule.type,
        title: rule.title,
        description: `Battery is at ${metrics.battery.percent.toFixed(0)}%. Connect a charger to avoid interruption.`,
        priority: rule.priority,
        actions: withAction(rule.action),
      })
    }

    if (rule.kind === 'idle') {
      const thresholdMs = rule.threshold * 60 * 1000
      if (context.idleTimeMs >= thresholdMs) {
        triggered.push({
          type: rule.type,
          title: rule.title,
          description: `No activity detected for ${rule.threshold}+ minutes.`,
          priority: rule.priority,
          actions: withAction(rule.action),
        })
      }
    }
  }

  return triggered
}
