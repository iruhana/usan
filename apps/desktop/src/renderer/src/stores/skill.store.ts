import { create } from 'zustand'

export type SkillStepStatus = 'pending' | 'running' | 'done' | 'failed'
export type SkillRunState = 'idle' | 'validating' | 'running' | 'paused' | 'failed' | 'cancelled' | 'done'

export interface SkillStep {
  id: string
  title: string
  status: SkillStepStatus
  detail?: string
}

export interface SkillRun {
  skillId: string
  title: string
  state: SkillRunState
  steps: SkillStep[]
  error?: string
}

interface SkillState {
  currentRun: SkillRun | null
  startRun: (skillId: string, title: string, steps: SkillStep[]) => void
  updateStep: (stepId: string, status: SkillStepStatus, detail?: string) => void
  setState: (state: SkillRunState, error?: string) => void
  reset: () => void
}

export const useSkillStore = create<SkillState>((set, get) => ({
  currentRun: null,

  startRun: (skillId, title, steps) => {
    set({
      currentRun: { skillId, title, state: 'running', steps },
    })
  },

  updateStep: (stepId, status, detail) => {
    const run = get().currentRun
    if (!run) return
    set({
      currentRun: {
        ...run,
        steps: run.steps.map((s) =>
          s.id === stepId ? { ...s, status, detail: detail ?? s.detail } : s,
        ),
      },
    })
  },

  setState: (state, error) => {
    const run = get().currentRun
    if (!run) return
    set({ currentRun: { ...run, state, error } })
  },

  reset: () => set({ currentRun: null }),
}))
