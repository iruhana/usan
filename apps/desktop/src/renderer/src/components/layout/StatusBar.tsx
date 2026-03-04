import { useState, useEffect } from 'react'
import { useChatStore } from '../../stores/chat.store'
import { useSettingsStore } from '../../stores/settings.store'
import { t } from '../../i18n'

export default function StatusBar() {
  const [online, setOnline] = useState(navigator.onLine)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const streamingPhase = useChatStore((s) => s.streamingPhase)
  const conversations = useChatStore((s) => s.conversations)
  const activeConversationId = useChatStore((s) => s.activeConversationId)
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

  const activeConv = conversations.find((c) => c.id === activeConversationId)
  const msgCount = activeConv?.messages.filter((m) => m.role !== 'tool').length ?? 0

  const phaseLabel = isStreaming
    ? streamingPhase === 'tool'
      ? t('status.toolRunning')
      : streamingPhase === 'generating'
        ? t('status.generating')
        : t('status.working')
    : null

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
        {msgCount > 0 && (
          <>
            <span className="text-[var(--color-border)]">|</span>
            <span>{msgCount} {t('status.messages')}</span>
          </>
        )}
      </div>

      {/* Center: current status */}
      {phaseLabel && (
        <span className="flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-[var(--color-primary)] animate-pulse" />
          {phaseLabel}
        </span>
      )}

      {/* Right: locale + shortcut hint */}
      <div className="flex items-center gap-2">
        <span>{settings.locale.toUpperCase()}</span>
        <span className="text-[var(--color-border)]">|</span>
        <span className="opacity-60">Ctrl+K</span>
      </div>
    </div>
  )
}
