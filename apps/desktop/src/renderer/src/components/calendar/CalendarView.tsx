import { useCallback, useEffect, useState } from 'react'
import type { CalendarEvent } from '@shared/types/infrastructure'
import { CalendarDays, Plus, RefreshCw } from 'lucide-react'
import { Card, Button, Input, SectionHeader } from '../ui'
import { t } from '../../i18n'
import EventCard from './EventCard'

function toIso(value: string): string {
  if (!value) return ''
  return new Date(value).toISOString()
}

function toDateInput(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function toDateTimeInput(value: Date): string {
  return value.toISOString().slice(0, 16)
}

export default function CalendarView() {
  const now = new Date()
  const endDefault = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const [startDate, setStartDate] = useState(toDateInput(now))
  const [endDate, setEndDate] = useState(toDateInput(endDefault))
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [title, setTitle] = useState('')
  const [eventStart, setEventStart] = useState(toDateTimeInput(now))
  const [eventEnd, setEventEnd] = useState(toDateTimeInput(new Date(now.getTime() + 60 * 60 * 1000)))
  const [freeDate, setFreeDate] = useState(toDateInput(now))
  const [durationMinutes, setDurationMinutes] = useState(30)
  const [freeSlots, setFreeSlots] = useState<Array<{ start: string; end: string }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await window.usan?.calendar.listEvents(toIso(startDate), toIso(endDate))
      setEvents(next ?? [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    loadEvents().catch(() => {})
  }, [loadEvents])

  return (
    <Card variant="outline" className="space-y-3">
      <SectionHeader
        title={t('calendar.title')}
        icon={CalendarDays}
        indicator="var(--color-primary)"
        action={(
          <Button size="sm" variant="ghost" leftIcon={<RefreshCw size={14} />} onClick={() => loadEvents()}>
            {t('dashboard.refresh')}
          </Button>
        )}
      />

      {error && (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-3 py-2 text-[length:var(--text-sm)] text-[var(--color-danger)]">
          {error}
        </p>
      )}

      <div className="grid gap-2 md:grid-cols-2">
        <Input label={t('calendar.start')} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        <Input label={t('calendar.end')} type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
        <p className="mb-2 text-[length:var(--text-sm)] font-medium text-[var(--color-text)]">{t('calendar.create')}</p>
        <div className="grid gap-2 md:grid-cols-2">
          <Input label={t('calendar.title')} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t('calendar.titlePlaceholder')} />
          <Input label={t('calendar.start')} type="datetime-local" value={eventStart} onChange={(event) => setEventStart(event.target.value)} />
          <Input label={t('calendar.end')} type="datetime-local" value={eventEnd} onChange={(event) => setEventEnd(event.target.value)} />
          <div className="flex items-end">
            <Button
              size="sm"
              leftIcon={<Plus size={14} />}
              disabled={title.trim().length === 0}
              onClick={async () => {
                await window.usan?.calendar.createEvent({
                  title: title.trim(),
                  start: toIso(eventStart),
                  end: toIso(eventEnd),
                })
                setTitle('')
                await loadEvents()
              }}
            >
              {t('calendar.create')}
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('files.loading')}</p>
      ) : events.length === 0 ? (
        <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('calendar.empty')}</p>
      ) : (
        <div className="max-h-64 space-y-2 overflow-auto">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onDelete={async (id) => {
                await window.usan?.calendar.deleteEvent(id)
                await loadEvents()
              }}
            />
          ))}
        </div>
      )}

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
        <p className="mb-2 text-[length:var(--text-sm)] font-medium text-[var(--color-text)]">{t('calendar.freeTime')}</p>
        <div className="grid gap-2 md:grid-cols-[1fr_140px_auto]">
          <Input label={t('calendar.date')} type="date" value={freeDate} onChange={(event) => setFreeDate(event.target.value)} />
          <Input label={t('calendar.duration')} type="number" min={15} step={15} value={durationMinutes} onChange={(event) => setDurationMinutes(Math.max(15, Number(event.target.value) || 15))} />
          <div className="flex items-end">
            <Button
              size="sm"
              onClick={async () => {
                const slots = await window.usan?.calendar.findFreeTime(toIso(freeDate), durationMinutes)
                setFreeSlots(slots ?? [])
              }}
            >
              {t('calendar.findFreeTime')}
            </Button>
          </div>
        </div>
        <div className="mt-2 space-y-1">
          {freeSlots.length === 0 ? (
            <p className="text-[length:var(--text-xs)] text-[var(--color-text-muted)]">{t('calendar.noFreeSlots')}</p>
          ) : (
            freeSlots.map((slot, index) => (
              <p key={`${slot.start}-${slot.end}-${index}`} className="text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                {new Date(slot.start).toLocaleString()} - {new Date(slot.end).toLocaleString()}
              </p>
            ))
          )}
        </div>
      </div>
    </Card>
  )
}
