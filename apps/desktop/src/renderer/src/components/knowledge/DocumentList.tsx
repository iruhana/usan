import { Trash2, FileText } from 'lucide-react'
import { Button, Card } from '../ui'
import type { RagDocument } from '@shared/types/infrastructure'
import { t } from '../../i18n'

interface DocumentListProps {
  documents: RagDocument[]
  onRemove: (id: string) => Promise<void>
  simpleMode?: boolean
}

function formatRelativeTime(ts: number): string {
  const delta = Date.now() - ts
  if (delta < 60_000) return t('time.justNow')
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}${t('time.minutesAgo')}`
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}${t('time.hoursAgo')}`
  return `${Math.floor(delta / 86_400_000)}${t('time.daysAgo')}`
}

export default function DocumentList({ documents, onRemove, simpleMode = false }: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <Card variant="outline" className="rounded-[28px] text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
        {t('knowledge.noDocuments')}
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <Card key={doc.id} variant="default" className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] p-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] bg-[var(--color-primary-light)]">
              <FileText size={18} className="text-[var(--color-primary)]" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[length:var(--text-md)] font-semibold tracking-tight text-[var(--color-text)]">{doc.name}</p>
              <p className="mt-1 truncate text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{doc.path}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-[20px] bg-[var(--color-surface-soft)] px-3 py-2 text-right text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
              {!simpleMode && <p>{doc.chunks} {t('knowledge.chunks')}</p>}
              <p className={!simpleMode ? 'mt-1' : ''}>{formatRelativeTime(doc.indexedAt)}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
              leftIcon={<Trash2 size={14} />}
              onClick={() => onRemove(doc.id)}
            >
              {t('knowledge.remove')}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  )
}
