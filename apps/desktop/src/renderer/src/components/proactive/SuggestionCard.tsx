import type { Suggestion, SuggestionAction } from '@shared/types/infrastructure'
import { AlertTriangle, Bell, CircleAlert, Zap } from 'lucide-react'
import { Button } from '../ui'
import { t } from '../../i18n'

interface SuggestionCardProps {
  suggestion: Suggestion
  onDismiss?: (id: string) => void
  onAction?: (id: string, action: SuggestionAction) => void
}

function indicatorForType(type: Suggestion['type']): string {
  if (type === 'warning') return 'var(--color-warning)'
  if (type === 'action') return 'var(--color-success)'
  if (type === 'error') return 'var(--color-danger)'
  return 'var(--color-primary)'
}

export default function SuggestionCard({ suggestion, onDismiss, onAction }: SuggestionCardProps) {
  const iconColor = indicatorForType(suggestion.type)
  const icon = suggestion.type === 'warning'
    ? <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: iconColor }} />
    : suggestion.type === 'action'
      ? <Zap size={14} className="mt-0.5 shrink-0" style={{ color: iconColor }} />
      : suggestion.type === 'error'
        ? <CircleAlert size={14} className="mt-0.5 shrink-0" style={{ color: iconColor }} />
        : <Bell size={14} className="mt-0.5 shrink-0" style={{ color: iconColor }} />

  return (
    <div
      className="rounded-[var(--radius-md)] ring-1 ring-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-3 transition-all hover:ring-[var(--color-border)]"
      data-testid={`suggestion-card-${suggestion.id}`}
    >
      <div className="mb-2 flex items-start gap-2">
        {icon}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[length:var(--text-sm)] font-medium text-[var(--color-text)]">{suggestion.title}</p>
          <p className="text-[length:var(--text-xs)] text-[var(--color-text-muted)]">{suggestion.description}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {suggestion.actions.map((action) => (
          <Button
            key={`${suggestion.id}:${action.action}`}
            size="sm"
            variant="secondary"
            onClick={() => onAction?.(suggestion.id, action)}
            data-testid={`suggestion-action-${suggestion.id}-${action.action}`}
          >
            {action.label}
          </Button>
        ))}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDismiss?.(suggestion.id)}
          data-testid={`suggestion-dismiss-${suggestion.id}`}
        >
          {t('proactive.dismiss')}
        </Button>
      </div>
    </div>
  )
}
