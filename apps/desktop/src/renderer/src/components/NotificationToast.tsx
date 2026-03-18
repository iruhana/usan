import { AlertTriangle, Info, ShieldAlert } from 'lucide-react'
import { t } from '../i18n'
import { IconButton } from './ui'
import { X } from 'lucide-react'
import { useNotificationStore } from '../stores/notification.store'

const LEVEL_STYLES: Record<string, { bg: string; icon: typeof Info; iconColor: string }> = {
  info: { bg: 'bg-[var(--color-bg-card)]', icon: Info, iconColor: 'text-[var(--color-primary)]' },
  warning: { bg: 'bg-[var(--color-bg-card)]', icon: AlertTriangle, iconColor: 'text-[var(--color-warning)]' },
  danger: { bg: 'bg-[var(--color-bg-card)]', icon: ShieldAlert, iconColor: 'text-[var(--color-danger)]' },
}

export default function NotificationToast() {
  const toasts = useNotificationStore((state) => state.toasts)
  const dismiss = useNotificationStore((state) => state.dismiss)

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-14 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const style = LEVEL_STYLES[toast.level] || LEVEL_STYLES.info
        const Icon = style.icon
        return (
          <div
            key={toast.id}
            className={`${style.bg} rounded-[var(--radius-lg)] p-3 shadow-[var(--shadow-lg)] ring-1 ring-[var(--color-border-subtle)] animate-slide-down flex items-start gap-2.5`}
            role="alert"
          >
            <div className={`w-7 h-7 rounded-[var(--radius-md)] ${style.bg} flex items-center justify-center shrink-0`}>
              <Icon size={16} className={style.iconColor} />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-[length:var(--text-sm)] font-semibold text-[var(--color-text)]">
                {toast.title}
              </p>
              <p className="text-[length:var(--text-xs)] text-[var(--color-text-muted)] mt-0.5 leading-relaxed">
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
