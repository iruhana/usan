import { useState, useEffect, useCallback, useRef } from 'react'
import { AlertTriangle, Info, ShieldAlert, X } from 'lucide-react'
import { t } from '../i18n'

interface ToastData {
  id: string
  title: string
  body: string
  level: string
}

const LEVEL_STYLES: Record<string, { bg: string; border: string; icon: typeof Info }> = {
  info: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', icon: Info },
  warning: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', icon: AlertTriangle },
  danger: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', icon: ShieldAlert },
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
            className={`${style.bg} ${style.border} border rounded-xl p-4 shadow-lg animate-in slide-in-from-right flex items-start gap-3`}
            role="alert"
          >
            <Icon size={20} className="shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[var(--color-text)]" style={{ fontSize: 'var(--font-size-sm)' }}>
                {toast.title}
              </p>
              <p className="text-[var(--color-text-muted)] mt-0.5" style={{ fontSize: 'calc(13px * var(--font-scale))' }}>
                {toast.body}
              </p>
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className="p-2.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-all shrink-0"
              style={{ minWidth: '44px', minHeight: '44px' }}
              aria-label={t('titlebar.close')}
            >
              <X size={16} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
