import type { ContextSnapshot, Suggestion, SuggestionAction } from '@shared/types/infrastructure'
import { Clock3, Lightbulb, MonitorSmartphone } from 'lucide-react'
import { Card, SectionHeader } from '../ui'
import SuggestionCard from './SuggestionCard'
import { t } from '../../i18n'

interface SuggestionTrayProps {
  suggestions: Suggestion[]
  contextSnapshot?: ContextSnapshot | null
  onDismiss?: (id: string) => void
  onAction?: (id: string, action: SuggestionAction) => void
  className?: string
}

function formatActiveApp(snapshot?: ContextSnapshot | null): string {
  const app = snapshot?.activeApp?.trim()
  return app || t('proactive.unknownApp')
}

function formatIdleMinutes(snapshot?: ContextSnapshot | null): string {
  const idleTimeMs = snapshot?.idleTimeMs ?? 0
  return String(Math.max(0, Math.floor(idleTimeMs / 60_000)))
}

export default function SuggestionTray({
  suggestions,
  contextSnapshot,
  onDismiss,
  onAction,
  className,
}: SuggestionTrayProps) {
  return (
    <Card
      variant="default"
      padding="md"
      className={`space-y-4 ${className ?? ''}`}
      data-testid="proactive-tray"
    >
      <SectionHeader title={t('proactive.title')} icon={Lightbulb} indicator="var(--color-warning)" />

      <div className="rounded-[18px] bg-[var(--color-panel-muted)] px-4 py-3" data-testid="proactive-monitoring-card">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
          {t('proactive.monitoring')}
        </p>
        <p className="mt-1 text-[13px] leading-6 text-[var(--color-text-secondary)]">
          {t('proactive.monitoringBody')}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-[16px] bg-[var(--color-bg-card)] px-3 py-2.5">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--color-text)]">
              <MonitorSmartphone size={14} className="text-[var(--color-primary)]" />
              <span>{t('proactive.activeApp')}</span>
            </div>
            <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]" data-testid="proactive-active-app">
              {t('proactive.nowActive').replace('{app}', formatActiveApp(contextSnapshot))}
            </p>
          </div>
          <div className="rounded-[16px] bg-[var(--color-bg-card)] px-3 py-2.5">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--color-text)]">
              <Clock3 size={14} className="text-[var(--color-primary)]" />
              <span>{t('proactive.idle')}</span>
            </div>
            <p className="mt-1 text-[12px] text-[var(--color-text-secondary)]" data-testid="proactive-idle-minutes">
              {t('proactive.idleMinutes').replace('{minutes}', formatIdleMinutes(contextSnapshot))}
            </p>
          </div>
        </div>
      </div>

      {suggestions.length === 0 ? (
        <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('proactive.empty')}</p>
      ) : (
        <div className="max-h-[26rem] space-y-2 overflow-auto pr-1" data-testid="proactive-suggestion-list">
          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onDismiss={onDismiss}
              onAction={onAction}
            />
          ))}
        </div>
      )}
    </Card>
  )
}
