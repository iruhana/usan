/**
 * AI-Generated Content Label
 *
 * Required by Korea AI Basic Act (2026-01-22).
 * Default: ON (visible). User can toggle OFF in settings.
 *
 * Displays a small, non-intrusive badge on AI-generated outputs.
 */

import { t } from '../../i18n'
import { useSettingsStore } from '../../stores/settings.store'

interface AiLabelProps {
  className?: string
}

export default function AiLabel({ className = '' }: AiLabelProps) {
  const showLabel = useSettingsStore((s) => s.settings.aiLabelEnabled ?? true)

  if (!showLabel) return null

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-[var(--usan-color-border-secondary)] bg-[var(--usan-color-bg-surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--usan-color-text-tertiary)] ${className}`}
      title={t('ai.label.tooltip')}
      aria-label={t('ai.label.aria')}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path
          d="M6 1L7.5 4.5L11 6L7.5 7.5L6 11L4.5 7.5L1 6L4.5 4.5L6 1Z"
          fill="currentColor"
          opacity="0.6"
        />
      </svg>
      {t('ai.label.text')}
    </span>
  )
}
