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

const CONFIRMATION_TIMEOUT_MS = 60_000 // 60 seconds

export const useSafetyStore = create<SafetyState>((set, get) => ({
  open: false,
  prompt: null,
  resolve: null,

  requestConfirmation: (prompt) => {
    // Reject any pending confirmation before creating a new one
    const prev = get().resolve
    if (prev) prev(false)

    return new Promise<boolean>((resolve) => {
      set({ open: true, prompt, resolve })
      // Auto-cancel after timeout to prevent dangling promises
      setTimeout(() => {
        const current = get().resolve
        if (current === resolve) {
          resolve(false)
          set({ open: false, prompt: null, resolve: null })
        }
      }, CONFIRMATION_TIMEOUT_MS)
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
