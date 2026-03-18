import { Mic, Loader2, AlertCircle } from 'lucide-react'
import { t } from '../../i18n'
import { toVoiceErrorMessage } from '../../lib/user-facing-errors'
import { useSettingsStore } from '../../stores/settings.store'
import { useVoiceStore } from '../../stores/voice.store'

export default function VoiceIndicator() {
  const voiceOverlayEnabled = useSettingsStore((s) => s.settings.voiceOverlayEnabled)
  const status = useVoiceStore((s) => s.status)

  if (!voiceOverlayEnabled || status.status === 'idle') return null

  const label = status.status === 'listening'
    ? t('voice.indicator.listening')
    : status.status === 'processing'
      ? t('voice.indicator.processing')
      : t('voice.indicator.error')

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-surface-soft)] px-2.5 py-1 text-[length:var(--text-xs)] font-medium text-[var(--color-text-secondary)]"
      title={status.error ? toVoiceErrorMessage(status.error) : status.text || label}
    >
      {status.status === 'listening' && <Mic size={12} className="text-[var(--color-primary)]" />}
      {status.status === 'processing' && <Loader2 size={12} className="animate-spin text-[var(--color-primary)]" />}
      {status.status === 'error' && <AlertCircle size={12} className="text-[var(--color-danger)]" />}
      <span>{label}</span>
    </span>
  )
}
