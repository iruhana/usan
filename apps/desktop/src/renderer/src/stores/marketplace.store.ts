import { create } from 'zustand'
import type { MarketplaceEntry, InstalledPlugin } from '@shared/types/infrastructure'
import { toMarketplaceErrorMessage } from '../lib/user-facing-errors'

interface MarketplaceState {
  query: string
  entries: MarketplaceEntry[]
  installed: InstalledPlugin[]
  selectedEntryId: string | null
  loading: boolean
  error: string | null

  setQuery: (query: string) => void
  setSelectedEntry: (id: string | null) => void
  loadInstalled: () => Promise<void>
  search: (query?: string) => Promise<void>
  install: (id: string) => Promise<void>
  update: (id: string) => Promise<void>
  uninstall: (id: string) => Promise<void>
  enable: (id: string) => Promise<void>
  disable: (id: string) => Promise<void>
}

export const useMarketplaceStore = create<MarketplaceState>((set, get) => ({
  query: '',
  entries: [],
  installed: [],
  selectedEntryId: null,
  loading: false,
  error: null,

  setQuery: (query) => {
    set({ query })
  },

  setSelectedEntry: (id) => {
    set({ selectedEntryId: id })
  },

  loadInstalled: async () => {
    try {
      const installed = await window.usan?.plugin.list()
      set({ installed: installed ?? [] })
    } catch (err) {
      set({ error: toMarketplaceErrorMessage(err, 'load') })
    }
  },

  search: async (query) => {
    const q = query ?? get().query
    set({ loading: true, error: null, query: q })
    try {
      const entries = await window.usan?.marketplace.search(q)
      set({ entries: entries ?? [], loading: false })
      await get().loadInstalled()
    } catch (err) {
      set({ loading: false, error: toMarketplaceErrorMessage(err, 'search') })
    }
  },

  install: async (id) => {
    set({ loading: true, error: null })
    try {
      await window.usan?.marketplace.install(id)
      await Promise.all([get().search(), get().loadInstalled()])
      set({ loading: false })
    } catch (err) {
      set({ loading: false, error: toMarketplaceErrorMessage(err, 'install') })
    }
  },

  update: async (id) => {
    set({ loading: true, error: null })
    try {
      await window.usan?.marketplace.update(id)
      await Promise.all([get().search(), get().loadInstalled()])
      set({ loading: false })
    } catch (err) {
      set({ loading: false, error: toMarketplaceErrorMessage(err, 'update') })
    }
  },

  uninstall: async (id) => {
    set({ loading: true, error: null })
    try {
      await window.usan?.plugin.uninstall(id)
      await get().loadInstalled()
      set({ loading: false })
    } catch (err) {
      set({ loading: false, error: toMarketplaceErrorMessage(err, 'uninstall') })
    }
  },

  enable: async (id) => {
    try {
      await window.usan?.plugin.enable(id)
      await get().loadInstalled()
    } catch (err) {
      set({ error: toMarketplaceErrorMessage(err, 'enable') })
    }
  },

  disable: async (id) => {
    try {
      await window.usan?.plugin.disable(id)
      await get().loadInstalled()
    } catch (err) {
      set({ error: toMarketplaceErrorMessage(err, 'disable') })
    }
  },
}))
