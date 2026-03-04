import { workflowEngine } from '../infrastructure/workflow-engine'

type ScheduledHandle = {
  id: string
  workflowId: string
  expression: string
  cancel: () => void
}

export interface ScheduledWorkflowInfo {
  id: string
  workflowId: string
  expression: string
}

const EVERY_RE = /^@every\s*(\d+)\s*(ms|s|m|h|d)$/i
const STEP_MIN_RE = /^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/
const STEP_HOUR_RE = /^0\s+\*\/(\d+)\s+\*\s+\*\s+\*$/
const DAILY_RE = /^(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+\*$/

function toIntervalMs(expression: string): number | null {
  const normalized = expression.trim().toLowerCase()

  const every = normalized.match(EVERY_RE)
  if (every) {
    const rawValue = Number(every[1] ?? 0)
    if (!Number.isFinite(rawValue) || rawValue <= 0) return null
    const unit = every[2]
    const multiplier = unit === 'ms' ? 1 : unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000
    return Math.floor(rawValue * multiplier)
  }

  const minStep = normalized.match(STEP_MIN_RE)
  if (minStep) {
    const minutes = Number(minStep[1] ?? 0)
    if (!Number.isFinite(minutes) || minutes <= 0) return null
    return minutes * 60_000
  }

  const hourStep = normalized.match(STEP_HOUR_RE)
  if (hourStep) {
    const hours = Number(hourStep[1] ?? 0)
    if (!Number.isFinite(hours) || hours <= 0) return null
    return hours * 3_600_000
  }

  return null
}

function parseDaily(expression: string): { minute: number; hour: number } | null {
  const normalized = expression.trim().toLowerCase()
  const match = normalized.match(DAILY_RE)
  if (!match) return null

  const minute = Number(match[1] ?? -1)
  const hour = Number(match[2] ?? -1)
  if (!Number.isFinite(minute) || !Number.isFinite(hour)) return null
  if (minute < 0 || minute > 59 || hour < 0 || hour > 23) return null

  return { minute, hour }
}

function nextDailyDelayMs(targetHour: number, targetMinute: number): number {
  const now = new Date()
  const next = new Date(now)
  next.setHours(targetHour, targetMinute, 0, 0)
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1)
  }
  return Math.max(next.getTime() - now.getTime(), 1000)
}

class CronScheduler {
  private handles = new Map<string, ScheduledHandle>()

  schedule(workflowId: string, expression: string): string {
    const normalizedWorkflowId = workflowId.trim()
    const normalizedExpression = expression.trim()
    if (!normalizedWorkflowId) throw new Error('workflowId is required')
    if (!normalizedExpression) throw new Error('cron expression is required')

    const id = `cron_${normalizedWorkflowId}_${crypto.randomUUID()}`
    const intervalMs = toIntervalMs(normalizedExpression)
    if (intervalMs != null) {
      const timer = setInterval(() => {
        workflowEngine.execute(normalizedWorkflowId).catch(() => {})
      }, intervalMs)
      this.handles.set(id, {
        id,
        workflowId: normalizedWorkflowId,
        expression: normalizedExpression,
        cancel: () => clearInterval(timer),
      })
      return id
    }

    const daily = parseDaily(normalizedExpression)
    if (!daily) {
      throw new Error(`Unsupported cron expression: ${expression}`)
    }

    let cancelled = false
    let timeout: ReturnType<typeof setTimeout> | null = null

    const scheduleNext = () => {
      if (cancelled) return
      const delay = nextDailyDelayMs(daily.hour, daily.minute)
      timeout = setTimeout(() => {
        workflowEngine.execute(normalizedWorkflowId).catch(() => {})
        scheduleNext()
      }, delay)
    }

    scheduleNext()

    this.handles.set(id, {
      id,
      workflowId: normalizedWorkflowId,
      expression: normalizedExpression,
      cancel: () => {
        cancelled = true
        if (timeout) clearTimeout(timeout)
      },
    })
    return id
  }

  unschedule(scheduleId: string): boolean {
    const handle = this.handles.get(scheduleId)
    if (!handle) return false
    handle.cancel()
    this.handles.delete(scheduleId)
    return true
  }

  list(): ScheduledWorkflowInfo[] {
    return Array.from(this.handles.values()).map((item) => ({
      id: item.id,
      workflowId: item.workflowId,
      expression: item.expression,
    }))
  }

  clear(): void {
    for (const handle of this.handles.values()) {
      handle.cancel()
    }
    this.handles.clear()
  }
}

export const cronScheduler = new CronScheduler()
