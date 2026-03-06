import { useState } from 'react'
import { Mic, MicOff, Loader2, X } from 'lucide-react'
import { Button } from '../ui'
import { t } from '../../i18n'
import { toVoiceErrorMessage } from '../../lib/user-facing-errors'
import { useVoiceStore } from '../../stores/voice.store'
import { hasE2EQueryFlag } from '../../lib/e2e-flags'

export default function VoiceOverlay() {
  const forceVisible = hasE2EQueryFlag('usan_e2e_force_voice_overlay')
  const status = useVoiceStore((s) => s.status)
  const lastText = useVoiceStore((s) => s.lastText)
  const hidden = useVoiceStore((s) => s.hidden)
  const setHidden = useVoiceStore((s) => s.setHidden)
  const clearLastText = useVoiceStore((s) => s.clearLastText)
  const setError = useVoiceStore((s) => s.setError)
  const applyStatus = useVoiceStore((s) => s.applyStatus)
  const [busy, setBusy] = useState(false)

  const effectiveStatus =
    forceVisible && status.status === 'idle' && !lastText
      ? { status: 'error' as const, error: 'API key is not configured' }
      : status

  if (!forceVisible && (hidden || (status.status === 'idle' && !lastText))) {
    return null
  }

  const stateLabel = effectiveStatus.status === 'listening'
    ? t('voice.indicator.listening')
    : effectiveStatus.status === 'processing'
      ? t('voice.indicator.processing')
      : effectiveStatus.status === 'error'
        ? t('voice.indicator.error')
        : t('status.idle')

  return (
    <div
      data-view="voice-overlay"
      aria-label={t('voice.title')}
      className="pointer-events-none fixed bottom-10 right-6 z-40 w-[320px] rounded-[var(--radius-lg)] ring-1 ring-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-3 shadow-[var(--shadow-lg)]"
    >
      <div className="pointer-events-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {effectiveStatus.status === 'processing' ? (
            <Loader2 size={15} className="animate-spin text-[var(--color-primary)]" />
          ) : effectiveStatus.status === 'listening' ? (
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
          aria-label={t('voice.hide')}
        >
          <X size={14} />
        </button>
      </div>

      {effectiveStatus.error && (
        <p className="mt-2 text-[length:var(--text-xs)] text-[var(--color-danger)]">{toVoiceErrorMessage(effectiveStatus.error)}</p>
      )}

      {(lastText || effectiveStatus.status === 'listening') && (
        <div className="mt-2 max-h-20 overflow-auto whitespace-pre-wrap text-[length:var(--text-sm)] text-[var(--color-text)]">
          {lastText || (
            <span className="text-[var(--color-text-muted)] italic animate-pulse">
              {t('voice.indicator.listening')}...
            </span>
          )}
        </div>
      )}

      <div className="pointer-events-auto mt-3 flex gap-2">
        {effectiveStatus.status === 'listening' ? (
          <Button
            size="sm"
            variant="danger"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                const result = await window.usan?.voice.listenStop() as { text?: string; error?: string } | undefined
                if (result?.text) applyStatus({ status: 'idle', text: result.text })
                if (result?.error) setError(result.error)
              } finally {
                setBusy(false)
              }
            }}
          >
            {t('voice.stop')}
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                const result = await window.usan?.voice.listenStart() as { text?: string; error?: string } | undefined
                if (result?.text) applyStatus({ status: 'idle', text: result.text })
                if (result?.error) setError(result.error)
              } finally {
                setBusy(false)
              }
            }}
          >
            {t('voice.start')}
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={clearLastText}>
          {t('clipboard.clear')}
        </Button>
      </div>
    </div>
  )
}
