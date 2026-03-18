import { create } from 'zustand'
import { toAppControlErrorMessage } from '../lib/user-facing-errors'

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
  launchApp: (name: string, args?: string | string[]) => Promise<void>
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
      set({ loading: false, error: toAppControlErrorMessage(err, 'load') })
    }
  },

  launchApp: async (name, args) => {
    try {
      await window.usan?.appControl.launch(name, args)
      await get().loadRunningApps()
    } catch (err) {
      set({ error: toAppControlErrorMessage(err, 'launch') })
    }
  },

  closeApp: async (name) => {
    try {
      await window.usan?.appControl.close(name)
      await get().loadRunningApps()
    } catch (err) {
      set({ error: toAppControlErrorMessage(err, 'close') })
    }
  },

  sendKeys: async (keys) => {
    try {
      await window.usan?.appControl.sendKeys(keys)
    } catch (err) {
      set({ error: toAppControlErrorMessage(err, 'sendKeys') })
    }
  },
}))
