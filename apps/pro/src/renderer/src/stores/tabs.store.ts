import { create } from 'zustand'
import { AI_PROVIDERS } from '@shared/types'
import type { AIProvider } from '@shared/types'

interface TabsState {
  providers: AIProvider[]
  activeId: string
  isTransitioning: boolean

  switchTo: (id: string) => Promise<void>
  setProviders: (providers: AIProvider[]) => void
}

export const useTabsStore = create<TabsState>((set, get) => ({
  providers: AI_PROVIDERS,
  activeId: 'claude',
  isTransitioning: false,

  switchTo: async (id) => {
    if (get().activeId === id) return
    set({ isTransitioning: true })
    await window.usan.tabs.switch(id)
    set({ activeId: id, isTransitioning: false })
  },

  setProviders: (providers) => set({ providers }),
}))
