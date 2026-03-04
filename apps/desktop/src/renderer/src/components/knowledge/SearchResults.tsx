import { Search } from 'lucide-react'
import { Card } from '../ui'
import type { RagSearchResult } from '@shared/types/infrastructure'
import { t } from '../../i18n'

interface SearchResultsProps {
  results: RagSearchResult[]
}

export default function SearchResults({ results }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <Card variant="outline" className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
        {t('knowledge.searchEmpty')}
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {results.map((result, index) => (
        <Card key={`${result.documentId}-${index}`} variant="outline" className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Search size={14} className="text-[var(--color-primary)]" />
              <span className="truncate text-[length:var(--text-sm)] font-medium text-[var(--color-text)]">{result.documentName}</span>
            </div>
            <span className="rounded-[var(--radius-sm)] bg-[var(--color-primary-light)] px-2 py-0.5 text-[length:var(--text-xs)] text-[var(--color-primary)]">
              {t('knowledge.result.score')}: {result.score}%
            </span>
          </div>
          <p className="whitespace-pre-wrap text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{result.chunk}</p>
          {(result.vectorScore !== undefined || result.keywordScore !== undefined || result.confidence) && (
            <div className="flex flex-wrap items-center gap-2 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
              {result.vectorScore !== undefined && (
                <span>{t('knowledge.result.vectorScore')}: {result.vectorScore}%</span>
              )}
              {result.keywordScore !== undefined && (
                <span>{t('knowledge.result.keywordScore')}: {result.keywordScore}%</span>
              )}
              {result.confidence && (
                <span>{t('knowledge.result.confidence')}: {result.confidence}</span>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
