import type { Suggestion } from '@shared/types/infrastructure'
import { Lightbulb } from 'lucide-react'
import { Card, SectionHeader } from '../ui'
import SuggestionCard from './SuggestionCard'
import { t } from '../../i18n'

interface SuggestionTrayProps {
  suggestions: Suggestion[]
  onDismiss?: (id: string) => void
  onAction?: (id: string, action: string) => void
}

export default function SuggestionTray({ suggestions, onDismiss, onAction }: SuggestionTrayProps) {
  return (
    <Card variant="outline" className="space-y-3">
      <SectionHeader title={t('proactive.title')} icon={Lightbulb} indicator="var(--color-warning)" />
      {suggestions.length === 0 ? (
        <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('proactive.empty')}</p>
      ) : (
        <div className="max-h-72 space-y-2 overflow-auto">
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
