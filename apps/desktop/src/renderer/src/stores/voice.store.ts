import { create } from 'zustand'
import type { VoiceStatusEvent } from '@shared/types/infrastructure'

const IDLE_STATUS: VoiceStatusEvent = { status: 'idle' }

interface VoiceState {
  status: VoiceStatusEvent
  lastText: string
  hidden: boolean
  listening: boolean
  eventVersion: number
  applyStatus: (event: VoiceStatusEvent) => void
  startListening: () => void
  stopListening: () => void
  setHidden: (hidden: boolean) => void
  clearLastText: () => void
  setError: (error: string) => void
}

let unsubscribeVoice: (() => void) | null = null

export const useVoiceStore = create<VoiceState>((set, get) => ({
  status: IDLE_STATUS,
  lastText: '',
  hidden: false,
  listening: false,
  eventVersion: 0,

  applyStatus: (event) => {
    set((state) => ({
      status: event,
      lastText: event.text ? event.text : state.lastText,
      hidden: event.status === 'idle' ? state.hidden : false,
      eventVersion: state.eventVersion + 1,
    }))
  },

  startListening: () => {
    if (get().listening) return

    const unsubscribe = window.usan?.voice.onStatus((event) => {
      get().applyStatus(event)
    })

    if (!unsubscribe) return

    unsubscribeVoice = unsubscribe
    set({ listening: true })
  },

  stopListening: () => {
    unsubscribeVoice?.()
    unsubscribeVoice = null
    set({
      status: IDLE_STATUS,
      lastText: '',
      hidden: false,
      listening: false,
      eventVersion: 0,
    })
  },

  setHidden: (hidden) => {
    set({ hidden })
  },

  clearLastText: () => {
    set({ lastText: '' })
  },

  setError: (error) => {
    get().applyStatus({ status: 'error', error })
  },
}))
