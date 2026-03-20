/**
 * Renderer-local UI state store.
 * No domain-level state — only view state for shell panels and navigation.
 */
import { create } from 'zustand'

export type ShellView = 'chat' | 'settings'
export type UtilityTab = 'logs' | 'terminal' | 'steps' | 'approvals'
export type WorkListFilter = 'all' | 'approvals' | 'tools' | 'attachments' | 'issues'
export type LogFeedFilter = 'all' | 'tools' | 'attachments' | 'issues'

interface UiState {
  /* Navigation */
  view: ShellView
  setView: (v: ShellView) => void

  /* Z2: nav expanded */
  navExpanded: boolean
  toggleNav: () => void

  /* Session history */
  sessionHistoryOpen: boolean
  toggleSessionHistory: () => void
  setSessionHistoryOpen: (open: boolean) => void
  workListFilter: WorkListFilter
  setWorkListFilter: (filter: WorkListFilter) => void
  logFeedFilter: LogFeedFilter
  setLogFeedFilter: (filter: LogFeedFilter) => void

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

  sessionHistoryOpen: false,
  toggleSessionHistory: () => set((s) => ({ sessionHistoryOpen: !s.sessionHistoryOpen })),
  setSessionHistoryOpen: (sessionHistoryOpen) => set({ sessionHistoryOpen }),
  workListFilter: 'all',
  setWorkListFilter: (workListFilter) => set({ workListFilter }),
  logFeedFilter: 'all',
  setLogFeedFilter: (logFeedFilter) => set({ logFeedFilter }),

  contextPanelOpen: false,
  toggleContextPanel: () => set((s) => ({ contextPanelOpen: !s.contextPanelOpen })),

  utilityPanelOpen: false,
  utilityTab: 'steps',
  toggleUtilityPanel: () => set((s) => ({ utilityPanelOpen: !s.utilityPanelOpen })),
  setUtilityTab: (utilityTab) => set({ utilityTab, utilityPanelOpen: true }),

  commandPaletteOpen: false,
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
}))
