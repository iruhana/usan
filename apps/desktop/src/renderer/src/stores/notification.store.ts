import { create } from 'zustand'

interface NotificationInput {
  title: string
  body: string
  level: string
}

interface NotificationToast extends NotificationInput {
  id: string
}

interface NotificationState {
  toasts: NotificationToast[]
  listening: boolean
  push: (notification: NotificationInput) => void
  dismiss: (id: string) => void
  clear: () => void
  startListening: () => void
  stopListening: () => void
}

const NOTIFICATION_TIMEOUT = 6000
const toastTimers = new Map<string, ReturnType<typeof setTimeout>>()
let unsubscribeNotifications: (() => void) | null = null

function makeToastId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function clearToastTimer(id: string): void {
  const timer = toastTimers.get(id)
  if (!timer) return
  clearTimeout(timer)
  toastTimers.delete(id)
}

function clearAllToastTimers(): void {
  toastTimers.forEach(clearTimeout)
  toastTimers.clear()
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  toasts: [],
  listening: false,

  push: (notification) => {
    const id = makeToastId()
    const timer = setTimeout(() => {
      get().dismiss(id)
    }, NOTIFICATION_TIMEOUT)

    toastTimers.set(id, timer)

    set((state) => ({
      toasts: [...state.toasts.slice(-4), { id, ...notification }],
    }))
  },

  dismiss: (id) => {
    clearToastTimer(id)
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }))
  },

  clear: () => {
    clearAllToastTimers()
    set({ toasts: [] })
  },

  startListening: () => {
    if (get().listening) return

    const unsubscribe = window.usan?.notifications.onNotification((notification) => {
      get().push(notification)
    })

    if (!unsubscribe) return

    unsubscribeNotifications = unsubscribe
    set({ listening: true })
  },

  stopListening: () => {
    unsubscribeNotifications?.()
    unsubscribeNotifications = null
    clearAllToastTimers()
    set({ listening: false, toasts: [] })
  },
}))
