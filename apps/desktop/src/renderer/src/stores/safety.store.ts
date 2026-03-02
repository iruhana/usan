import { create } from 'zustand'

export interface SafetyPrompt {
  title: string
  summary: string[]
  rollback: string[]
  actionId: string
}

interface SafetyState {
  open: boolean
  prompt: SafetyPrompt | null
  resolve: ((confirmed: boolean) => void) | null
  requestConfirmation: (prompt: SafetyPrompt) => Promise<boolean>
  confirm: () => void
  cancel: () => void
}

export const useSafetyStore = create<SafetyState>((set, get) => ({
  open: false,
  prompt: null,
  resolve: null,

  requestConfirmation: (prompt) => {
    return new Promise<boolean>((resolve) => {
      set({ open: true, prompt, resolve })
    })
  },

  confirm: () => {
    const { resolve } = get()
    resolve?.(true)
    set({ open: false, prompt: null, resolve: null })
  },

  cancel: () => {
    const { resolve } = get()
    resolve?.(false)
    set({ open: false, prompt: null, resolve: null })
  },
}))
