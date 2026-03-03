import { useState, useEffect } from 'react'
import { useChatStore } from '../../stores/chat.store'
import { useSettingsStore } from '../../stores/settings.store'
import { t } from '../../i18n'

export default function StatusBar() {
  const [online, setOnline] = useState(navigator.onLine)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const { settings } = useSettingsStore()

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return (
    <div
      className="flex items-center justify-between h-6 px-4 bg-transparent border-t border-[var(--color-border)] text-[length:var(--text-xs)] text-[var(--color-text-muted)] chrome-no-select shrink-0"
    >
      {/* Left: online/offline */}
      <div className="flex items-center gap-2">
        <span
          className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]'}`}
          role="status"
          aria-label={online ? t('status.online') : t('status.offline')}
        />
        <span>{online ? t('status.online') : t('status.offline')}</span>
      </div>

      {/* Center: current status */}
      {isStreaming && (
        <span className="flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-[var(--color-primary)] animate-pulse" />
          {t('status.working')}
        </span>
      )}

      {/* Right: locale */}
      <span>{settings.locale.toUpperCase()}</span>
    </div>
  )
}
