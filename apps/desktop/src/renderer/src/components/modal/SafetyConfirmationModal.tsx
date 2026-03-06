import { useEffect, useId, useRef, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useSafetyStore } from '../../stores/safety.store'
import FocusTrap from '../accessibility/FocusTrap'
import { t } from '../../i18n'
import { Button, IconButton } from '../ui'

export default function SafetyConfirmationModal() {
  const { open, prompt, confirm, cancel } = useSafetyStore()
  const [understood, setUnderstood] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (open) {
      setUnderstood(false)
      setTimeout(() => cancelRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, cancel])

  if (!open || !prompt) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-backdrop">
      <div className="absolute inset-0 bg-[var(--color-backdrop)]" onClick={cancel} aria-hidden="true" />
      <FocusTrap active={open}>
        <div
          data-dialog-id="safety-confirmation"
          className="relative mx-4 w-full max-w-md rounded-[var(--radius-xl)] ring-1 ring-[var(--color-danger)]/20 bg-[var(--color-bg-card)] p-4 shadow-[var(--shadow-xl)] animate-scale-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-danger-bg)]">
              <AlertTriangle size={20} className="text-[var(--color-danger)]" />
            </div>
            <h2 id={titleId} className="flex-1 text-[length:var(--text-md)] font-semibold text-[var(--color-danger)]">
              {prompt.title}
            </h2>
            <IconButton
              icon={X}
              size="sm"
              label={t('titlebar.close')}
              onClick={cancel}
            />
          </div>

          {prompt.summary.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-[length:var(--text-md)] font-semibold text-[var(--color-text)]">
                {t('safety.whatWillHappen')}
              </p>
              <ul className="flex flex-col gap-2">
                {prompt.summary.map((item, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-[length:var(--text-md)] text-[var(--color-text-muted)]"
                  >
                    <span aria-hidden="true" className="mt-0.5 shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {prompt.rollback.length > 0 && (
            <div className="mb-4 rounded-[var(--radius-lg)] bg-[var(--color-surface-soft)] p-3">
              <p className="mb-2 text-[length:var(--text-md)] font-semibold text-[var(--color-text)]">
                {t('safety.howToUndo')}
              </p>
              <ul className="flex flex-col gap-2">
                {prompt.rollback.map((item, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-[length:var(--text-md)] text-[var(--color-text-muted)]"
                  >
                    <span aria-hidden="true" className="mt-0.5 shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label className="mb-6 flex cursor-pointer select-none items-center gap-3">
            <input
              type="checkbox"
              checked={understood}
              onChange={(event) => setUnderstood(event.target.checked)}
              className="h-4.5 w-4.5 cursor-pointer rounded-[var(--radius-xs)] accent-[var(--color-danger)]"
            />
            <span className="text-[length:var(--text-md)] text-[var(--color-text)]">
              {t('safety.understand')}
            </span>
          </label>

          <div className="flex gap-3">
            <Button
              data-action="safety-cancel"
              ref={cancelRef}
              variant="secondary"
              className="flex-1"
              onClick={cancel}
            >
              {t('safety.cancel')}
            </Button>
            <Button
              data-action="safety-confirm"
              variant="danger"
              className="flex-1"
              onClick={confirm}
              disabled={!understood}
            >
              {t('safety.confirm')}
            </Button>
          </div>
        </div>
      </FocusTrap>
    </div>
  )
}
