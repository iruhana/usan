import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotificationStore } from '../../src/renderer/src/stores/notification.store'

describe('notification.store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useNotificationStore.getState().stopListening()
    useNotificationStore.setState({ toasts: [], listening: false })
  })

  it('queues notifications and auto-dismisses them', () => {
    useNotificationStore.getState().push({
      title: 'Test notice',
      body: 'Body',
      level: 'info',
    })

    expect(useNotificationStore.getState().toasts).toHaveLength(1)

    vi.advanceTimersByTime(6000)

    expect(useNotificationStore.getState().toasts).toHaveLength(0)
  })

  it('subscribes to the preload notification bridge once', () => {
    const unsubscribe = vi.fn()
    const onNotification = vi.fn(() => unsubscribe)
    vi.stubGlobal('window', {
      usan: {
        notifications: {
          onNotification,
        },
      },
    })

    useNotificationStore.getState().startListening()
    useNotificationStore.getState().startListening()

    expect(onNotification).toHaveBeenCalledTimes(1)

    useNotificationStore.getState().stopListening()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
