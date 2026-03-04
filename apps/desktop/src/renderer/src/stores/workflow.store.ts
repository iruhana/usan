import { create } from 'zustand'
import type { WorkflowDefinition, WorkflowRun, WorkflowProgress } from '@shared/types/infrastructure'

interface WorkflowState {
  workflows: WorkflowDefinition[]
  runs: WorkflowRun[]
  activeWorkflowId: string | null
  activeRunId: string | null
  loading: boolean
  error: string | null
  lastProgress: WorkflowProgress | null

  initialize: () => void
  setActiveWorkflow: (id: string | null) => void
  load: () => Promise<void>
  loadRuns: (workflowId?: string) => Promise<void>
  createWorkflow: (def: Partial<WorkflowDefinition>) => Promise<string | null>
  deleteWorkflow: (id: string) => Promise<void>
  executeWorkflow: (id: string) => Promise<void>
  pauseRun: (runId: string) => Promise<void>
  resumeRun: (runId: string) => Promise<void>
  cancelRun: (runId: string) => Promise<void>
  scheduleWorkflow: (id: string, intervalMs: number) => Promise<string | null>
  unscheduleWorkflow: (scheduleId: string) => Promise<void>
}

let workflowUnsubscribe: (() => void) | null = null

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflows: [],
  runs: [],
  activeWorkflowId: null,
  activeRunId: null,
  loading: false,
  error: null,
  lastProgress: null,

  initialize: () => {
    if (workflowUnsubscribe || !window.usan?.workflow) return

    workflowUnsubscribe = window.usan.workflow.onProgress((progress) => {
      set((state) => {
        const nextRuns = state.runs.map((run) => {
          if (run.id !== progress.runId) return run
          const merged: WorkflowRun = {
            ...run,
            status: progress.status,
            currentStepIndex: progress.currentStepIndex,
            stepResults: progress.stepResult
              ? [...run.stepResults.filter((s) => s.stepId !== progress.stepResult!.stepId), progress.stepResult]
              : run.stepResults,
          }
          return merged
        })

        return {
          runs: nextRuns,
          activeRunId: progress.runId,
          lastProgress: progress,
        }
      })
    })
  },

  setActiveWorkflow: (id) => {
    set({ activeWorkflowId: id })
  },

  load: async () => {
    set({ loading: true, error: null })
    try {
      const workflows = await window.usan?.workflow.list()
      const next = workflows ?? []
      set((state) => ({
        workflows: next,
        activeWorkflowId: state.activeWorkflowId && next.some((w) => w.id === state.activeWorkflowId)
          ? state.activeWorkflowId
          : (next[0]?.id ?? null),
        loading: false,
      }))

      const activeId = get().activeWorkflowId
      await get().loadRuns(activeId ?? undefined)
    } catch (err) {
      set({
        loading: false,
        error: (err as Error).message,
      })
    }
  },

  loadRuns: async (workflowId) => {
    try {
      const runs = await window.usan?.workflow.listRuns(workflowId)
      set({ runs: runs ?? [] })
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },

  createWorkflow: async (def) => {
    set({ error: null })
    try {
      const id = await window.usan?.workflow.create(def)
      await get().load()
      if (id) {
        set({ activeWorkflowId: id })
        await get().loadRuns(id)
      }
      return id ?? null
    } catch (err) {
      set({ error: (err as Error).message })
      return null
    }
  },

  deleteWorkflow: async (id) => {
    set({ error: null })
    try {
      await window.usan?.workflow.delete(id)
      await get().load()
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },

  executeWorkflow: async (id) => {
    set({ error: null })
    try {
      const run = await window.usan?.workflow.execute(id)
      if (!run) return

      set((state) => ({
        runs: [run, ...state.runs.filter((r) => r.id !== run.id)],
        activeRunId: run.id,
      }))
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },

  pauseRun: async (runId) => {
    try {
      await window.usan?.workflow.pause(runId)
      set((state) => ({
        runs: state.runs.map((run) => run.id === runId ? { ...run, status: 'paused' } : run),
      }))
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },

  resumeRun: async (runId) => {
    try {
      await window.usan?.workflow.resume(runId)
      set((state) => ({
        runs: state.runs.map((run) => run.id === runId ? { ...run, status: 'running' } : run),
      }))
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },

  cancelRun: async (runId) => {
    try {
      await window.usan?.workflow.cancel(runId)
      set((state) => ({
        runs: state.runs.map((run) => run.id === runId ? { ...run, status: 'cancelled' } : run),
      }))
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },

  scheduleWorkflow: async (id, intervalMs) => {
    try {
      const scheduleId = await window.usan?.workflow.schedule(id, intervalMs)
      return scheduleId ?? null
    } catch (err) {
      set({ error: (err as Error).message })
      return null
    }
  },

  unscheduleWorkflow: async (scheduleId) => {
    try {
      await window.usan?.workflow.unschedule(scheduleId)
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },
}))
