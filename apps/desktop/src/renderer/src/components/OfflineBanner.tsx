import { useState, useEffect } from 'react'
import { WifiOff } from 'lucide-react'
import { t } from '../i18n'

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const goOffline = () => setOffline(true)
    const goOnline = () => setOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      className="bg-[var(--color-surface-soft)] border-b border-[var(--color-warning)]/30 px-4 py-2 flex items-center justify-center gap-2"
      role="alert"
    >
      <WifiOff size={16} className="text-[var(--color-warning)]" />
      <span
        className="text-[var(--color-text)] font-medium text-[length:var(--text-md)]"
      >
        {t('error.offline')}
      </span>
    </div>
  )
}
