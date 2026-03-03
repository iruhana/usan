/**
 * Undo toast store — shows a toast with undo action for destructive operations
 */

import { create } from 'zustand'

interface UndoState {
  visible: boolean
  message: string
  undoFn: (() => void) | null
  timerId: ReturnType<typeof setTimeout> | null

  show: (message: string, undoFn: () => void) => void
  undo: () => void
  dismiss: () => void
}

const UNDO_TIMEOUT = 5000

export const useUndoStore = create<UndoState>((set, get) => ({
  visible: false,
  message: '',
  undoFn: null,
  timerId: null,

  show: (message, undoFn) => {
    const prev = get().timerId
    if (prev) clearTimeout(prev)

    const timerId = setTimeout(() => {
      set({ visible: false, message: '', undoFn: null, timerId: null })
    }, UNDO_TIMEOUT)

    set({ visible: true, message, undoFn, timerId })
  },

  undo: () => {
    const { undoFn, timerId } = get()
    if (timerId) clearTimeout(timerId)
    undoFn?.()
    set({ visible: false, message: '', undoFn: null, timerId: null })
  },

  dismiss: () => {
    const { timerId } = get()
    if (timerId) clearTimeout(timerId)
    set({ visible: false, message: '', undoFn: null, timerId: null })
  },
}))
