/**
 * Files store manages file browser state and directory loading.
 */

import { create } from 'zustand'
import type { FileEntry } from '@shared/types/ipc'
import { toFilesErrorMessage } from '../lib/user-facing-errors'

interface FilesState {
  currentPath: string
  entries: FileEntry[]
  loading: boolean
  error: string | null

  loadDirectory: (dir: string) => Promise<void>
  init: () => Promise<void>
}

export const useFilesStore = create<FilesState>((set, get) => ({
  currentPath: '',
  entries: [],
  loading: false,
  error: null,

  loadDirectory: async (dir) => {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const list = await window.usan?.fs.list(dir)
      if (list) {
        const sorted = [...list].sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
          return a.name.localeCompare(b.name)
        })
        set({ entries: sorted, currentPath: dir, loading: false })
      } else {
        set({ loading: false })
      }
    } catch (error) {
      set({
        error: toFilesErrorMessage(error),
        entries: [],
        loading: false,
      })
    }
  },

  init: async () => {
    if (get().currentPath) return
    try {
      const desktopPath = await window.usan?.system.desktopPath()
      if (desktopPath) {
        await get().loadDirectory(desktopPath)
      } else {
        await get().loadDirectory('C:\\Users')
      }
    } catch {
      await get().loadDirectory('C:\\Users')
    }
  },
}))