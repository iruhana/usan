import { Search } from 'lucide-react'
import { Card } from '../ui'
import type { RagSearchResult } from '@shared/types/infrastructure'
import { t } from '../../i18n'

interface SearchResultsProps {
  results: RagSearchResult[]
  simpleMode?: boolean
}

export default function SearchResults({ results, simpleMode = false }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <Card variant="outline" className="rounded-[28px] text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
        {t('knowledge.searchEmpty')}
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {results.map((result, index) => (
        <Card key={`${result.documentId}-${index}`} variant="default" className="space-y-3 rounded-[28px] p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[16px] bg-[var(--color-primary-light)]">
                <Search size={14} className="text-[var(--color-primary)]" />
              </div>
              <span className="truncate text-[length:var(--text-sm)] font-semibold text-[var(--color-text)]">{result.documentName}</span>
            </div>
            {!simpleMode && (
              <span className="rounded-full bg-[var(--color-primary-light)] px-3 py-1 text-[length:var(--text-xs)] font-semibold text-[var(--color-primary)]">
                {t('knowledge.result.score')}: {result.score}%
              </span>
            )}
          </div>
          <div className="rounded-[20px] bg-[var(--color-surface-soft)] px-4 py-3">
            <p className="whitespace-pre-wrap text-[length:var(--text-sm)] leading-relaxed text-[var(--color-text-secondary)]">{result.chunk}</p>
          </div>
          {!simpleMode && (result.vectorScore !== undefined || result.keywordScore !== undefined || result.confidence) && (
            <div className="flex flex-wrap items-center gap-2 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
              {result.vectorScore !== undefined && (
                <span className="rounded-full bg-[var(--color-surface-soft)] px-3 py-1">{t('knowledge.result.vectorScore')}: {result.vectorScore}%</span>
              )}
              {result.keywordScore !== undefined && (
                <span className="rounded-full bg-[var(--color-surface-soft)] px-3 py-1">{t('knowledge.result.keywordScore')}: {result.keywordScore}%</span>
              )}
              {result.confidence && (
                <span className="rounded-full bg-[var(--color-surface-soft)] px-3 py-1">{t('knowledge.result.confidence')}: {result.confidence}</span>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
