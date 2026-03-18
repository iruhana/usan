import { create } from 'zustand'
import type { SystemMetrics, ProcessInfo, Suggestion, ContextSnapshot } from '@shared/types/infrastructure'
import { toDashboardErrorMessage } from '../lib/user-facing-errors'

const HISTORY_LIMIT = 60

interface DashboardState {
  metrics: SystemMetrics | null
  metricsHistory: SystemMetrics[]
  processes: ProcessInfo[]
  suggestions: Suggestion[]
  contextSnapshot: ContextSnapshot | null
  loading: boolean
  error: string | null
  monitorRunning: boolean

  initialize: () => void
  startMonitoring: () => Promise<void>
  stopMonitoring: () => Promise<void>
  loadProcesses: () => Promise<void>
  refreshSuggestions: () => Promise<void>
  dismissSuggestion: (id: string) => Promise<void>
  configureProactive: (config: Record<string, unknown>) => Promise<void>
}

let metricsUnsub: (() => void) | null = null
let suggestionUnsub: (() => void) | null = null
let contextUnsub: (() => void) | null = null
export const useDashboardStore = create<DashboardState>((set, get) => ({
  metrics: null,
  metricsHistory: [],
  processes: [],
  suggestions: [],
  contextSnapshot: null,
  loading: false,
  error: null,
  monitorRunning: false,

  initialize: () => {
    if (!metricsUnsub && window.usan?.systemMonitor) {
      metricsUnsub = window.usan.systemMonitor.onMetrics((metrics) => {
        set((state) => ({
          metrics,
          metricsHistory: [...state.metricsHistory, metrics].slice(-HISTORY_LIMIT),
        }))
      })
    }

    if (!suggestionUnsub && window.usan?.proactive) {
      suggestionUnsub = window.usan.proactive.onSuggestion((suggestion) => {
        set((state) => ({
          suggestions: [suggestion, ...state.suggestions.filter((s) => s.id !== suggestion.id)].slice(0, 20),
        }))
      })
    }

    if (!contextUnsub && window.usan?.context) {
      contextUnsub = window.usan.context.onChanged((snapshot) => {
        set({ contextSnapshot: snapshot })
      })
    }

  },

  startMonitoring: async () => {
    set({ loading: true, error: null })
    try {
      await window.usan?.systemMonitor.start()
      const [latest, context, suggestions] = await Promise.all([
        window.usan?.systemMonitor.getLatest(),
        window.usan?.context.getSnapshot(),
        window.usan?.proactive.list(),
      ])

      set({
        metrics: latest ?? null,
        contextSnapshot: context ?? null,
        suggestions: suggestions ?? [],
        monitorRunning: true,
        loading: false,
      })

      await get().loadProcesses()
    } catch (err) {
      set({ loading: false, error: toDashboardErrorMessage(err, 'monitor') })
    }
  },

  stopMonitoring: async () => {
    try {
      await window.usan?.systemMonitor.stop()
      set({ monitorRunning: false })
    } catch (err) {
      set({ error: toDashboardErrorMessage(err, 'monitor') })
    }
  },

  loadProcesses: async () => {
    try {
      const processes = await window.usan?.systemMonitor.getProcesses()
      set({ processes: processes ?? [] })
    } catch (err) {
      set({ error: toDashboardErrorMessage(err, 'processes') })
    }
  },

  refreshSuggestions: async () => {
    try {
      const suggestions = await window.usan?.proactive.list()
      set({ suggestions: suggestions ?? [] })
    } catch (err) {
      set({ error: toDashboardErrorMessage(err, 'suggestions') })
    }
  },

  dismissSuggestion: async (id) => {
    try {
      await window.usan?.proactive.dismiss(id)
      set((state) => ({ suggestions: state.suggestions.filter((s) => s.id !== id) }))
    } catch (err) {
      set({ error: toDashboardErrorMessage(err, 'suggestions') })
    }
  },

  configureProactive: async (config) => {
    try {
      await window.usan?.proactive.configure(config)
      await get().refreshSuggestions()
    } catch (err) {
      set({ error: toDashboardErrorMessage(err, 'settings') })
    }
  },
}))
