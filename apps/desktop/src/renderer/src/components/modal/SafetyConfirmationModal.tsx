import { useState, useEffect, useRef, useId } from 'react'
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
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, cancel])

  if (!open || !prompt) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-backdrop)] backdrop-blur-sm">
      <FocusTrap active={open}>
        <div
          className="bg-[var(--color-bg-card)] rounded-[var(--radius-lg)] border border-[var(--color-danger)]/30 shadow-[var(--shadow-lg)] max-w-md w-full mx-4 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-danger-bg)] flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-[var(--color-danger)]" />
            </div>
            <h2 id={titleId} className="text-[length:var(--text-md)] font-semibold text-[var(--color-danger)] flex-1">
              {prompt.title}
            </h2>
            <IconButton
              icon={X}
              size="sm"
              label={t('titlebar.close')}
              onClick={cancel}
            />
          </div>

          {/* What will happen */}
          {prompt.summary.length > 0 && (
            <div className="mb-4">
              <p className="text-[length:var(--text-md)] font-semibold text-[var(--color-text)] mb-2">
                {t('safety.whatWillHappen')}
              </p>
              <ul className="flex flex-col gap-2">
                {prompt.summary.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-[length:var(--text-md)] text-[var(--color-text-muted)]">
                    <span className="shrink-0 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* How to undo */}
          {prompt.rollback.length > 0 && (
            <div className="mb-4 p-3 rounded-[var(--radius-lg)] bg-[var(--color-surface-soft)]">
              <p className="text-[length:var(--text-md)] font-semibold text-[var(--color-text)] mb-2">
                {t('safety.howToUndo')}
              </p>
              <ul className="flex flex-col gap-2">
                {prompt.rollback.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-[length:var(--text-md)] text-[var(--color-text-muted)]">
                    <span className="shrink-0 mt-0.5">↩</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Understanding checkbox */}
          <label className="flex items-center gap-3 mb-6 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              className="w-6 h-6 rounded accent-[var(--color-danger)] cursor-pointer"
            />
            <span className="text-[length:var(--text-md)] text-[var(--color-text)]">
              {t('safety.understand')}
            </span>
          </label>

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              ref={cancelRef}
              variant="secondary"
              className="flex-1"
              onClick={cancel}
            >
              {t('safety.cancel')}
            </Button>
            <Button
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
