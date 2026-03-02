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
      className="flex items-center justify-between px-4 bg-[var(--color-bg-sidebar)] border-t border-[var(--color-border)] text-[var(--color-text-muted)] select-none"
      style={{ fontSize: 'calc(12px * var(--font-scale))', height: 'calc(28px * var(--font-scale))', minHeight: 'auto' }}
    >
      {/* Left: online/offline */}
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${online ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]'}`}
          style={{ minHeight: '8px' }}
        />
        <span>{online ? t('status.online') : t('status.offline')}</span>
      </div>

      {/* Center: current status */}
      <span>{isStreaming ? t('status.working') : t('status.idle')}</span>

      {/* Right: locale */}
      <div className="flex items-center gap-3">
        <span>{settings.locale.toUpperCase()}</span>
      </div>
    </div>
  )
}
