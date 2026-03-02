/**
 * Notification system — tray notifications with priority levels.
 * Supports system native notifications + sound alerts.
 */
import { Notification, app } from 'electron'
import { getMainWindow } from './index'

export type NotificationLevel = 'info' | 'warning' | 'danger'

interface NotifyOptions {
  title: string
  body: string
  level?: NotificationLevel
  sound?: boolean
}

export function sendNotification({ title, body, level = 'info', sound = true }: NotifyOptions): void {
  const notification = new Notification({
    title,
    body,
    icon: undefined,
    silent: !sound,
    urgency: level === 'danger' ? 'critical' : level === 'warning' ? 'normal' : 'low',
  })

  notification.on('click', () => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.show()
      win.focus()
    }
  })

  // Auto-close after 30s to prevent accumulating Notification objects
  const autoCloseTimer = setTimeout(() => notification.close(), 30000)
  notification.once('close', () => clearTimeout(autoCloseTimer))

  notification.show()

  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send('notification', { title, body, level })
  }
}

let flashTimer: ReturnType<typeof setTimeout> | null = null

export function flashWindow(): void {
  const win = getMainWindow()
  if (win && !win.isDestroyed() && !win.isFocused()) {
    if (flashTimer) clearTimeout(flashTimer)
    win.flashFrame(true)
    flashTimer = setTimeout(() => {
      flashTimer = null
      const w = getMainWindow()
      if (w && !w.isDestroyed()) w.flashFrame(false)
    }, 5000)
  }
}

export function isNotificationSupported(): boolean {
  return Notification.isSupported()
}
