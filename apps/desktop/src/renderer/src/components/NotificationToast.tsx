import { useState, useEffect, useCallback, useRef } from 'react'
import { AlertTriangle, Info, ShieldAlert } from 'lucide-react'
import { t } from '../i18n'
import { IconButton } from './ui'
import { X } from 'lucide-react'

interface ToastData {
  id: string
  title: string
  body: string
  level: string
}

const LEVEL_STYLES: Record<string, { bg: string; border: string; icon: typeof Info }> = {
  info: { bg: 'bg-[var(--color-primary-light)]', border: 'border-[var(--color-primary)]/20', icon: Info },
  warning: { bg: 'bg-[var(--color-surface-soft)]', border: 'border-[var(--color-warning)]/30', icon: AlertTriangle },
  danger: { bg: 'bg-[var(--color-danger-bg)]', border: 'border-[var(--color-danger)]/30', icon: ShieldAlert },
}

export default function NotificationToast() {
  const [toasts, setToasts] = useState<ToastData[]>([])
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    const unsub = window.usan?.notifications.onNotification((data) => {
      const id = crypto.randomUUID()
      setToasts((prev) => [...prev.slice(-4), { id, ...data }])
      timersRef.current.push(setTimeout(() => dismiss(id), 6000))
    })
    return () => {
      unsub?.()
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
    }
  }, [dismiss])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const style = LEVEL_STYLES[toast.level] || LEVEL_STYLES.info
        const Icon = style.icon
        return (
          <div
            key={toast.id}
            className={`${style.bg} ${style.border} border rounded-[var(--radius-lg)] p-3 shadow-[var(--shadow-lg)] animate-in flex items-start gap-2`}
            role="alert"
          >
            <Icon size={20} className="shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[length:var(--text-md)] font-semibold text-[var(--color-text)]">
                {toast.title}
              </p>
              <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)] mt-0.5">
                {toast.body}
              </p>
            </div>
            <IconButton
              icon={X}
              size="sm"
              label={t('titlebar.close')}
              onClick={() => dismiss(toast.id)}
            />
          </div>
        )
      })}
    </div>
  )
}
