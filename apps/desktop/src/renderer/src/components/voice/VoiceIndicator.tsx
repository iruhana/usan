import { useEffect, useState } from 'react'
import { Mic, Loader2, AlertCircle } from 'lucide-react'
import type { VoiceStatusEvent } from '@shared/types/infrastructure'
import { t } from '../../i18n'

const DEFAULT_STATUS: VoiceStatusEvent = { status: 'idle' }

export default function VoiceIndicator() {
  const [status, setStatus] = useState<VoiceStatusEvent>(DEFAULT_STATUS)

  useEffect(() => {
    const unsub = window.usan?.voice.onStatus((next) => {
      setStatus(next)
    })

    return () => {
      if (unsub) unsub()
    }
  }, [])

  if (status.status === 'idle') return null

  const label = status.status === 'listening'
    ? t('voice.indicator.listening')
    : status.status === 'processing'
      ? t('voice.indicator.processing')
      : t('voice.indicator.error')

  return (
    <span className="inline-flex items-center gap-1.5" title={status.error || status.text || label}>
      {status.status === 'listening' && <Mic size={12} className="text-[var(--color-primary)]" />}
      {status.status === 'processing' && <Loader2 size={12} className="animate-spin text-[var(--color-primary)]" />}
      {status.status === 'error' && <AlertCircle size={12} className="text-[var(--color-danger)]" />}
      <span>{label}</span>
    </span>
  )
}
