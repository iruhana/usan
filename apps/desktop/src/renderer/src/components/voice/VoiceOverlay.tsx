import { useEffect, useState } from 'react'
import type { VoiceStatusEvent } from '@shared/types/infrastructure'
import { Mic, MicOff, Loader2, X } from 'lucide-react'
import { Button } from '../ui'
import { t } from '../../i18n'

const DEFAULT_STATUS: VoiceStatusEvent = { status: 'idle' }

export default function VoiceOverlay() {
  const [status, setStatus] = useState<VoiceStatusEvent>(DEFAULT_STATUS)
  const [lastText, setLastText] = useState('')
  const [hidden, setHidden] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const unsubscribe = window.usan?.voice.onStatus((event) => {
      setStatus(event)
      if (event.status !== 'idle') {
        setHidden(false)
      }
      // Show interim/final text from voice events
      if (event.text) {
        setLastText(event.text)
      }
    })
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  if (hidden || (status.status === 'idle' && !lastText)) {
    return null
  }

  const stateLabel = status.status === 'listening'
    ? t('voice.indicator.listening')
    : status.status === 'processing'
      ? t('voice.indicator.processing')
      : status.status === 'error'
        ? t('voice.indicator.error')
        : t('status.idle')

  return (
    <div className="pointer-events-none fixed bottom-10 right-6 z-40 w-[320px] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 shadow-[var(--shadow-lg)]">
      <div className="pointer-events-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {status.status === 'processing' ? (
            <Loader2 size={15} className="animate-spin text-[var(--color-primary)]" />
          ) : status.status === 'listening' ? (
            <Mic size={15} className="text-[var(--color-primary)]" />
          ) : (
            <MicOff size={15} className="text-[var(--color-text-muted)]" />
          )}
          <p className="text-[length:var(--text-sm)] font-medium text-[var(--color-text)]">{stateLabel}</p>
        </div>
        <button
          type="button"
          className="rounded-[var(--radius-sm)] p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-soft)]"
          onClick={() => setHidden(true)}
          aria-label={t('chat.cancel')}
        >
          <X size={14} />
        </button>
      </div>

      {status.error && (
        <p className="mt-2 text-[length:var(--text-xs)] text-[var(--color-danger)]">{status.error}</p>
      )}

      {(lastText || status.status === 'listening') && (
        <div className="mt-2 max-h-20 overflow-auto whitespace-pre-wrap text-[length:var(--text-sm)] text-[var(--color-text)]">
          {lastText || (
            <span className="text-[var(--color-text-muted)] italic animate-pulse">
              {t('voice.indicator.listening')}...
            </span>
          )}
        </div>
      )}

      <div className="pointer-events-auto mt-3 flex gap-2">
        {status.status === 'listening' ? (
          <Button
            size="sm"
            variant="danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                const result = await window.usan?.voice.listenStop() as { text?: string; error?: string } | undefined
                if (result?.text) setLastText(result.text)
                if (result?.error) setStatus({ status: 'error', error: result.error })
              } finally {
                setBusy(false)
              }
            }}
          >
            {t('home.voiceStop')}
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                const result = await window.usan?.voice.listenStart() as { text?: string; error?: string } | undefined
                if (result?.text) setLastText(result.text)
                if (result?.error) setStatus({ status: 'error', error: result.error })
              } finally {
                setBusy(false)
              }
            }}
          >
            {t('home.voiceStart')}
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => setLastText('')}>
          {t('chat.delete')}
        </Button>
      </div>
    </div>
  )
}
