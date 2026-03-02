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
      className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center justify-center gap-2"
      role="alert"
    >
      <WifiOff size={16} className="text-amber-600" />
      <span
        className="text-amber-800 dark:text-amber-200 font-medium"
        style={{ fontSize: 'var(--font-size-sm)' }}
      >
        {t('error.offline')}
      </span>
    </div>
  )
}
