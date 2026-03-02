import { useState, useEffect, useRef } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { useSafetyStore } from '../../stores/safety.store'
import FocusTrap from '../accessibility/FocusTrap'
import { t } from '../../i18n'

export default function SafetyConfirmationModal() {
  const { open, prompt, confirm, cancel } = useSafetyStore()
  const [understood, setUnderstood] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <FocusTrap active={open}>
        <div
          className="bg-[var(--color-bg-card)] rounded-2xl border-2 border-red-300 dark:border-red-700 shadow-2xl max-w-md w-full mx-4 p-6"
          aria-label={t('safety.title')}
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
              <AlertTriangle size={24} className="text-red-600 dark:text-red-400" />
            </div>
            <h2 className="font-bold text-red-700 dark:text-red-400 flex-1" style={{ fontSize: 'var(--font-size-lg)' }}>
              {prompt.title}
            </h2>
            <button
              onClick={cancel}
              className="p-2.5 rounded-lg hover:bg-[var(--color-bg)] transition-all text-[var(--color-text-muted)]"
              style={{ minWidth: '44px', minHeight: '44px' }}
              aria-label={t('titlebar.close')}
            >
              <X size={20} />
            </button>
          </div>

          {/* What will happen */}
          {prompt.summary.length > 0 && (
            <div className="mb-4">
              <p className="font-semibold text-[var(--color-text)] mb-2" style={{ fontSize: 'var(--font-size-sm)' }}>
                {t('safety.whatWillHappen')}
              </p>
              <ul className="flex flex-col gap-1.5">
                {prompt.summary.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-[var(--color-text-muted)]" style={{ fontSize: 'calc(14px * var(--font-scale))' }}>
                    <span className="shrink-0 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* How to undo */}
          {prompt.rollback.length > 0 && (
            <div className="mb-4 p-3 rounded-xl bg-[var(--color-surface-soft)]">
              <p className="font-semibold text-[var(--color-text)] mb-2" style={{ fontSize: 'var(--font-size-sm)' }}>
                {t('safety.howToUndo')}
              </p>
              <ul className="flex flex-col gap-1.5">
                {prompt.rollback.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-[var(--color-text-muted)]" style={{ fontSize: 'calc(14px * var(--font-scale))' }}>
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
              className="w-6 h-6 rounded accent-red-600 cursor-pointer"
              style={{ minHeight: '24px' }}
            />
            <span className="text-[var(--color-text)]" style={{ fontSize: 'var(--font-size-sm)' }}>
              {t('safety.understand')}
            </span>
          </label>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              ref={cancelRef}
              onClick={cancel}
              className="flex-1 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] font-semibold hover:bg-[var(--color-bg-sidebar)] transition-all"
              style={{ fontSize: 'var(--font-size-sm)', minHeight: 'var(--min-target)' }}
            >
              {t('safety.cancel')}
            </button>
            <button
              onClick={confirm}
              disabled={!understood}
              className="flex-1 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              style={{ fontSize: 'var(--font-size-sm)', minHeight: 'var(--min-target)' }}
            >
              {t('safety.confirm')}
            </button>
          </div>
        </div>
      </FocusTrap>
    </div>
  )
}
