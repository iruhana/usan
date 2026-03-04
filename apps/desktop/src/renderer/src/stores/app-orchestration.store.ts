import { create } from 'zustand'

export interface RunningAppInfo {
  name: string
  pid?: number
  title?: string
}

interface AppOrchestrationState {
  runningApps: RunningAppInfo[]
  loading: boolean
  error: string | null

  loadRunningApps: () => Promise<void>
  launchApp: (name: string, args?: string) => Promise<void>
  closeApp: (name: string) => Promise<void>
  sendKeys: (keys: string) => Promise<void>
}

export const useAppOrchestrationStore = create<AppOrchestrationState>((set, get) => ({
  runningApps: [],
  loading: false,
  error: null,

  loadRunningApps: async () => {
    set({ loading: true, error: null })
    try {
      const apps = await window.usan?.appControl.listRunning()
      set({ runningApps: apps ?? [], loading: false })
    } catch (err) {
      set({ loading: false, error: (err as Error).message })
    }
  },

  launchApp: async (name, args) => {
    try {
      await window.usan?.appControl.launch(name, args)
      await get().loadRunningApps()
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },

  closeApp: async (name) => {
    try {
      await window.usan?.appControl.close(name)
      await get().loadRunningApps()
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },

  sendKeys: async (keys) => {
    try {
      await window.usan?.appControl.sendKeys(keys)
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },
}))
