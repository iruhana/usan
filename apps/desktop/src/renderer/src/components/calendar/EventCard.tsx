import type { CalendarEvent } from '@shared/types/infrastructure'
import { Trash2 } from 'lucide-react'
import { Button } from '../ui'
import { t } from '../../i18n'

interface EventCardProps {
  event: CalendarEvent
  onDelete?: (id: string) => void
}

export default function EventCard({ event, onDelete }: EventCardProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-[length:var(--text-sm)] font-medium text-[var(--color-text)]">{event.title}</p>
        <p className="truncate text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
          {new Date(event.start).toLocaleString()} - {new Date(event.end).toLocaleString()}
        </p>
      </div>
      <Button
        size="sm"
        variant="danger"
        leftIcon={<Trash2 size={13} />}
        onClick={() => onDelete?.(event.id)}
      >
        {t('calendar.delete')}
      </Button>
    </div>
  )
}
