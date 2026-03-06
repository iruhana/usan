import type { MacroEntry } from '@shared/types/infrastructure'
import { Play, Trash2 } from 'lucide-react'
import { Button } from '../ui'
import { t } from '../../i18n'

interface MacroListProps {
  items: MacroEntry[]
  onPlay: (id: string) => void
  onDelete: (id: string) => void
}

export default function MacroList({ items, onPlay, onDelete }: MacroListProps) {
  if (items.length === 0) {
    return <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('macro.empty')}</p>
  }

  return (
    <div className="max-h-72 space-y-2 overflow-auto">
      {items.map((macro) => (
        <div key={macro.id} className="rounded-[var(--radius-md)] ring-1 ring-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-3 transition-all hover:ring-[var(--color-border)]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="truncate text-[length:var(--text-sm)] font-medium text-[var(--color-text)]">{macro.name}</p>
            <span className="text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
              {macro.events.length} {t('macro.events')}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" leftIcon={<Play size={13} />} onClick={() => onPlay(macro.id)}>
              {t('macro.play')}
            </Button>
            <Button size="sm" variant="danger" leftIcon={<Trash2 size={13} />} onClick={() => onDelete(macro.id)}>
              {t('macro.delete')}
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
