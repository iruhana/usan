import { create } from 'zustand'
import type { ContextSnapshot, Suggestion, SuggestionAction } from '@shared/types/infrastructure'
import { notifyProactiveActionError, runProactiveSuggestionAction } from '../lib/proactive-actions'

interface ProactiveState {
  suggestions: Suggestion[]
  contextSnapshot: ContextSnapshot | null
  loading: boolean
  initialized: boolean

  initialize: () => void
  load: () => Promise<void>
  dismissSuggestion: (id: string) => Promise<void>
  executeSuggestionAction: (suggestionId: string, action: SuggestionAction) => Promise<void>
}

let initialized = false
let suggestionUnsubscribe: (() => void) | null = null
let contextUnsubscribe: (() => void) | null = null

export const useProactiveStore = create<ProactiveState>((set, get) => ({
  suggestions: [],
  contextSnapshot: null,
  loading: false,
  initialized: false,

  initialize: () => {
    if (initialized) return
    initialized = true

    if (!suggestionUnsubscribe && window.usan?.proactive) {
      suggestionUnsubscribe = window.usan.proactive.onSuggestion((suggestion) => {
        set((state) => ({
          suggestions: [suggestion, ...state.suggestions.filter((item) => item.id !== suggestion.id)].slice(0, 20),
        }))
      })
    }

    if (!contextUnsubscribe && window.usan?.context) {
      contextUnsubscribe = window.usan.context.onChanged((snapshot) => {
        set({ contextSnapshot: snapshot })
      })
    }

    if (!get().initialized) {
      set({ initialized: true })
    }
  },

  load: async () => {
    set({ loading: true })
    try {
      const [suggestions, contextSnapshot] = await Promise.all([
        window.usan?.proactive.list(),
        window.usan?.context.getSnapshot(),
      ])

      set({
        suggestions: suggestions ?? [],
        contextSnapshot: contextSnapshot ?? null,
        loading: false,
      })
    } catch {
      set({ loading: false })
    }
  },

  dismissSuggestion: async (id) => {
    try {
      await window.usan?.proactive.dismiss(id)
    } finally {
      set((state) => ({
        suggestions: state.suggestions.filter((suggestion) => suggestion.id !== id),
      }))
    }
  },

  executeSuggestionAction: async (suggestionId, action) => {
    try {
      await runProactiveSuggestionAction(action)
      await get().dismissSuggestion(suggestionId)
    } catch (error) {
      notifyProactiveActionError(error)
    }
  },
}))
