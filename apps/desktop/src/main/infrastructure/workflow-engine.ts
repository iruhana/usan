/**
 * Workflow Engine — multi-step automation: tool chains + conditions + loops + scheduling.
 * Executes WorkflowDefinition steps sequentially with pause/resume/cancel.
 */
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import type {
  WorkflowDefinition, WorkflowStep, WorkflowRun,
  WorkflowStepResult, WorkflowProgress,
} from '@shared/types/infrastructure'
import { eventBus } from './event-bus'
import { modelRouter } from '../ai/model-router'
import { securityRuntime, type ToolExecutionContext } from '../security/index'

const WORKFLOWS_FILE = 'workflows.json'
const RUNS_FILE = 'workflow-runs.json'
const MAX_RUNS = 100

type ToolExecutor = (name: string, args: Record<string, unknown>, context?: ToolExecutionContext) => Promise<unknown>

export class WorkflowEngine {
  private workflows: Map<string, WorkflowDefinition> = new Map()
  private runs: Map<string, WorkflowRun> = new Map()
  private activeRuns: Map<string, { paused: boolean; cancelled: boolean }> = new Map()
  private toolExecutor: ToolExecutor | null = null
  private schedules: Map<string, ReturnType<typeof setInterval>> = new Map()

  setToolExecutor(executor: ToolExecutor): void {
    this.toolExecutor = executor
  }

  create(def: Partial<WorkflowDefinition>): string {
    const id = def.id || crypto.randomUUID()
    const now = Date.now()
    const workflow: WorkflowDefinition = {
      id,
      name: def.name || 'Untitled',
      description: def.description || '',
      triggers: def.triggers || [{ type: 'manual', config: {} }],
      steps: def.steps || [],
      variables: def.variables || {},
      createdAt: now,
      updatedAt: now,
    }
    this.workflows.set(id, workflow)
    this.saveWorkflows()
    return id
  }

  update(id: string, partial: Partial<WorkflowDefinition>): boolean {
    const existing = this.workflows.get(id)
    if (!existing) return false
    const updated = { ...existing, ...partial, id, updatedAt: Date.now() }
    this.workflows.set(id, updated)
    this.saveWorkflows()
    return true
  }

  delete(id: string): boolean {
    const deleted = this.workflows.delete(id)
    if (deleted) this.saveWorkflows()
    return deleted
  }

  list(): WorkflowDefinition[] {
    return Array.from(this.workflows.values())
  }

  get(id: string): WorkflowDefinition | undefined {
    return this.workflows.get(id)
  }

  async execute(id: string, vars?: Record<string, unknown>): Promise<WorkflowRun> {
    const workflow = this.workflows.get(id)
    if (!workflow) throw new Error(`Workflow not found: ${id}`)
    if (!this.toolExecutor) throw new Error('Tool executor not set')

    const runId = crypto.randomUUID()
    const run: WorkflowRun = {
      id: runId,
      workflowId: id,
      status: 'running',
      stepResults: [],
      currentStepIndex: 0,
      variables: { ...workflow.variables, ...vars },
      startedAt: Date.now(),
    }

    this.runs.set(runId, run)
    this.activeRuns.set(runId, { paused: false, cancelled: false })
    securityRuntime.ensureSession(runId, 'workflow', id)

    this.emitProgress(run, workflow.steps.length)

    try {
      await this.executeSteps(run, workflow.steps)
      if (run.status === 'running') {
        run.status = 'completed'
      }
    } catch (err) {
      if (run.status === 'running') {
        run.status = 'failed'
        run.error = (err as Error).message
      }
    } finally {
      run.completedAt = Date.now()
      this.activeRuns.delete(runId)
      securityRuntime.destroySession(runId)
      this.emitProgress(run, workflow.steps.length)
      this.trimRuns()
      this.saveRuns()
    }

    return run
  }

  pause(runId: string): void {
    const ctrl = this.activeRuns.get(runId)
    if (ctrl) {
      ctrl.paused = true
      const run = this.runs.get(runId)
      if (run) {
        run.status = 'paused'
        this.emitProgress(run, this.getStepCount(run.workflowId))
      }
    }
  }

  resume(runId: string): void {
    const ctrl = this.activeRuns.get(runId)
    if (ctrl) {
      ctrl.paused = false
      const run = this.runs.get(runId)
      if (run) {
        run.status = 'running'
        this.emitProgress(run, this.getStepCount(run.workflowId))
      }
    }
  }

  cancel(runId: string): void {
    const ctrl = this.activeRuns.get(runId)
    if (ctrl) {
      ctrl.cancelled = true
      ctrl.paused = false // Unblock if paused
      const run = this.runs.get(runId)
      if (run) {
        run.status = 'cancelled'
        this.emitProgress(run, this.getStepCount(run.workflowId))
      }
    }
  }

  listRuns(workflowId?: string): WorkflowRun[] {
    const all = Array.from(this.runs.values())
    if (workflowId) return all.filter((r) => r.workflowId === workflowId)
    return all
  }

  schedule(workflowId: string, intervalMs: number): string {
    const schedId = `sched_${workflowId}`
    this.unschedule(schedId)
    const timer = setInterval(() => {
      this.execute(workflowId).catch(() => {})
    }, intervalMs)
    this.schedules.set(schedId, timer)
    return schedId
  }

  unschedule(scheduleId: string): void {
    const timer = this.schedules.get(scheduleId)
    if (timer) {
      clearInterval(timer)
      this.schedules.delete(scheduleId)
    }
  }

  private async executeSteps(run: WorkflowRun, steps: WorkflowStep[]): Promise<void> {
    for (let i = 0; i < steps.length; i++) {
      const ctrl = this.activeRuns.get(run.id)
      if (!ctrl || ctrl.cancelled) {
        run.status = 'cancelled'
        return
      }

      // Wait while paused
      while (ctrl.paused && !ctrl.cancelled) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
      if (ctrl.cancelled) {
        run.status = 'cancelled'
        return
      }

      run.currentStepIndex = i
      const step = steps[i]
      const stepStart = Date.now()

      try {
        const result = await this.executeStep(step, run)
        const stepResult: WorkflowStepResult = {
          stepId: step.id,
          status: 'completed',
          result,
          durationMs: Date.now() - stepStart,
        }
        run.stepResults.push(stepResult)
        this.emitProgress(run, steps.length, stepResult)
      } catch (err) {
        const stepResult: WorkflowStepResult = {
          stepId: step.id,
          status: 'failed',
          error: (err as Error).message,
          durationMs: Date.now() - stepStart,
        }
        run.stepResults.push(stepResult)
        this.emitProgress(run, steps.length, stepResult)

        const errorStrategy = step.onError ?? 'stop'
        if (errorStrategy === 'stop') throw err
        if (errorStrategy === 'retry') {
          try {
            const retryResult = await this.executeStep(step, run)
            run.stepResults[run.stepResults.length - 1] = {
              stepId: step.id,
              status: 'completed',
              result: retryResult,
              durationMs: Date.now() - stepStart,
            }
          } catch (retryErr) {
            // Retry also failed — update result and continue (skip)
            run.stepResults[run.stepResults.length - 1] = {
              stepId: step.id,
              status: 'failed',
              error: `Retry failed: ${(retryErr as Error).message}`,
              durationMs: Date.now() - stepStart,
            }
          }
        }
        // 'skip' — continue to next step
      }
    }
  }

  private async executeStep(step: WorkflowStep, run: WorkflowRun): Promise<unknown> {
    switch (step.type) {
      case 'tool_call': {
        if (!step.toolName || !this.toolExecutor) throw new Error('No tool specified')
        const args = this.resolveVariables(step.toolArgs ?? {}, run.variables)
        return this.toolExecutor(step.toolName, args, {
          actorType: 'workflow',
          actorId: run.workflowId,
          sessionId: run.id,
          workflowRunId: run.id,
          source: 'workflow-engine',
        })
      }

      case 'condition': {
        if (!step.condition) throw new Error('No condition specified')
        const met = this.evaluateCondition(step.condition, run.variables)
        if (met && step.children) {
          await this.executeSteps(run, step.children)
        }
        return { conditionMet: met }
      }

      case 'loop': {
        if (!step.children) return { loopIterations: 0 }
        const maxIter = (step.condition?.value as number) ?? 10
        let iterations = 0
        while (iterations < maxIter) {
          const ctrl = this.activeRuns.get(run.id)
          if (!ctrl || ctrl.cancelled) break
          await this.executeSteps(run, step.children)
          iterations++
        }
        return { loopIterations: iterations }
      }

      case 'delay': {
        const ms = step.delayMs ?? 1000
        await new Promise((resolve) => setTimeout(resolve, ms))
        return { delayed: ms }
      }

      case 'ai_decision': {
        const prompt = step.aiPrompt || 'Decide whether to proceed or stop.'
        const contextVars = JSON.stringify(run.variables, null, 2)
        const fullPrompt = `${prompt}\n\nContext variables:\n${contextVars}\n\nRespond with JSON: { "decision": "proceed" | "stop", "reason": "..." }`

        const route = await modelRouter.resolveRoute({
          routeHint: 'workflow',
          userMessage: fullPrompt,
        })
        if (!route) {
          return { decision: 'proceed', reason: 'AI unavailable, defaulting to proceed' }
        }

        let text = ''
        await route.provider.chatStream(
          {
            model: route.modelId,
            fallbackModels: route.fallbackModelIds,
            messages: [
              { role: 'system', content: 'You are a workflow decision engine. Respond only with valid JSON.' },
              { role: 'user', content: fullPrompt },
            ],
          },
          (chunk) => { if (chunk.text) text += chunk.text },
        )

        try {
          const jsonMatch = text.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]) as { decision: string; reason?: string }
            return {
              decision: parsed.decision || 'proceed',
              reason: parsed.reason,
              prompt,
              modelId: route.modelId,
              routeKind: route.routeKind,
            }
          }
        } catch { /* parse failed */ }
        return {
          decision: 'proceed',
          reason: 'Could not parse AI response',
          raw: text,
          modelId: route.modelId,
          routeKind: route.routeKind,
        }
      }

      default:
        throw new Error(`Unknown step type: ${step.type}`)
    }
  }

  private evaluateCondition(
    condition: { field: string; operator: string; value: unknown },
    variables: Record<string, unknown>,
  ): boolean {
    const fieldValue = variables[condition.field]
    switch (condition.operator) {
      case 'eq': return fieldValue === condition.value
      case 'neq': return fieldValue !== condition.value
      case 'gt': return (fieldValue as number) > (condition.value as number)
      case 'lt': return (fieldValue as number) < (condition.value as number)
      case 'gte': return (fieldValue as number) >= (condition.value as number)
      case 'lte': return (fieldValue as number) <= (condition.value as number)
      case 'contains': return String(fieldValue).includes(String(condition.value))
      case 'exists': return fieldValue !== undefined && fieldValue !== null
      default: return false
    }
  }

  private resolveVariables(
    args: Record<string, unknown>,
    variables: Record<string, unknown>,
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(args)) {
      if (typeof value === 'string' && value.startsWith('$')) {
        resolved[key] = variables[value.slice(1)] ?? value
      } else {
        resolved[key] = value
      }
    }
    return resolved
  }

  private emitProgress(run: WorkflowRun, totalSteps: number, stepResult?: WorkflowStepResult): void {
    const progress: WorkflowProgress = {
      runId: run.id,
      workflowId: run.workflowId,
      status: run.status,
      currentStepIndex: run.currentStepIndex,
      totalSteps,
      stepResult,
    }
    eventBus.emit('workflow.progress', progress as unknown as Record<string, unknown>, 'workflow-engine')
  }

  private getStepCount(workflowId: string): number {
    return this.workflows.get(workflowId)?.steps.length ?? 0
  }

  private trimRuns(): void {
    if (this.runs.size <= MAX_RUNS) return
    const sorted = Array.from(this.runs.entries()).sort((a, b) => a[1].startedAt - b[1].startedAt)
    while (sorted.length > MAX_RUNS) {
      const [id] = sorted.shift()!
      this.runs.delete(id)
    }
  }

  // ─── Persistence ──────────────────────────────
  private getDataDir(): string {
    return join(app.getPath('userData'), 'workflows')
  }

  async loadFromDisk(): Promise<void> {
    try {
      const dir = this.getDataDir()
      const wfData = await readFile(join(dir, WORKFLOWS_FILE), 'utf-8')
      const workflows = JSON.parse(wfData) as WorkflowDefinition[]
      for (const wf of workflows) this.workflows.set(wf.id, wf)
    } catch { /* fresh start */ }

    try {
      const dir = this.getDataDir()
      const runData = await readFile(join(dir, RUNS_FILE), 'utf-8')
      const runs = JSON.parse(runData) as WorkflowRun[]
      for (const r of runs) this.runs.set(r.id, r)
    } catch { /* fresh start */ }
  }

  private async saveWorkflows(): Promise<void> {
    try {
      const dir = this.getDataDir()
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, WORKFLOWS_FILE), JSON.stringify(this.list(), null, 2), 'utf-8')
    } catch { /* silently fail */ }
  }

  private async saveRuns(): Promise<void> {
    try {
      const dir = this.getDataDir()
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, RUNS_FILE), JSON.stringify(this.listRuns(), null, 2), 'utf-8')
    } catch { /* silently fail */ }
  }

  destroy(): void {
    for (const [, ctrl] of this.activeRuns) {
      ctrl.cancelled = true
      ctrl.paused = false
    }
    for (const [id] of this.schedules) {
      this.unschedule(id)
    }
    this.workflows.clear()
    this.runs.clear()
  }
}

/** Singleton instance */
export const workflowEngine = new WorkflowEngine()
