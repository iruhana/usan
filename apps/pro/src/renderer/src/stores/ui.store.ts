/**
 * Renderer-local UI state store.
 * No domain-level state — only view state for shell panels and navigation.
 */
import { create } from 'zustand'

export type ShellView = 'chat' | 'settings'
export type UtilityTab = 'logs' | 'terminal' | 'steps' | 'approvals'

interface UiState {
  /* Navigation */
  view: ShellView
  setView: (v: ShellView) => void

  /* Z2: nav expanded */
  navExpanded: boolean
  toggleNav: () => void

  /* Z3: work list */
  activeSessionId: string | null
  setActiveSession: (id: string | null) => void

  /* Z5: context panel */
  contextPanelOpen: boolean
  toggleContextPanel: () => void

  /* Z6: utility panel */
  utilityPanelOpen: boolean
  utilityTab: UtilityTab
  toggleUtilityPanel: () => void
  setUtilityTab: (tab: UtilityTab) => void

  /* Z8: command palette */
  commandPaletteOpen: boolean
  setCommandPaletteOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  view: 'chat',
  setView: (view) => set({ view }),

  navExpanded: true,
  toggleNav: () => set((s) => ({ navExpanded: !s.navExpanded })),

  activeSessionId: 'sess-001',
  setActiveSession: (activeSessionId) => set({ activeSessionId }),

  contextPanelOpen: false,
  toggleContextPanel: () => set((s) => ({ contextPanelOpen: !s.contextPanelOpen })),

  utilityPanelOpen: false,
  utilityTab: 'steps',
  toggleUtilityPanel: () => set((s) => ({ utilityPanelOpen: !s.utilityPanelOpen })),
  setUtilityTab: (utilityTab) => set({ utilityTab, utilityPanelOpen: true }),

  commandPaletteOpen: false,
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
}))
