import { useState, useEffect } from 'react'
import { useChatStore } from '../../stores/chat.store'
import { t } from '../../i18n'
import VoiceIndicator from '../voice/VoiceIndicator'

const APP_VERSION = 'v0.1.0'

export default function StatusBar() {
  const [online, setOnline] = useState(navigator.onLine)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const streamingPhase = useChatStore((s) => s.streamingPhase)
  const activeToolName = useChatStore((s) => s.activeToolName)
  const searchHint = t('status.searchHint')
  const shortcutHint =
    searchHint.includes('검색') ? '검색' : searchHint.includes('検索') ? '検索' : searchHint

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

  const phaseLabel = isStreaming
    ? streamingPhase === 'tool'
      ? activeToolName
        ? `${activeToolName} ${t('status.toolRunningSuffix')}`
        : t('status.toolRunning')
      : streamingPhase === 'generating'
        ? t('status.generating')
        : t('status.working')
    : null

  return (
    <div className="flex h-8 shrink-0 items-center justify-between border-t border-[var(--color-border-subtle)] bg-white/84 px-4 text-[length:var(--text-xs)] text-[var(--color-text-muted)] backdrop-blur-sm chrome-no-select dark:bg-[var(--color-bg-sidebar)]">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-[var(--color-success-light)] px-2 py-0.5 font-medium text-[var(--color-success)]">
          <span className={`h-[5px] w-[5px] rounded-full ${online ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]'}`} />
          {online ? t('status.online') : t('status.offline')}
        </span>
        <VoiceIndicator />
        {phaseLabel && (
          <span className="rounded-full bg-[var(--color-primary-light)] px-2 py-0.5 font-medium text-[var(--color-primary)]">
            {phaseLabel}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 font-medium">
        <span>Ctrl+K {shortcutHint}</span>
        <div className="h-3 w-px bg-[var(--color-border-subtle)]" />
        <span>{APP_VERSION}</span>
      </div>
    </div>
  )
}
