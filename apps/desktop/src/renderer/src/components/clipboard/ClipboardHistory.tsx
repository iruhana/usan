import { useEffect, useMemo } from 'react'
import type { ClipboardTransformFormat } from '@shared/types/infrastructure'
import { Clipboard, Pin, PinOff, Sparkles, Trash2, RefreshCw } from 'lucide-react'
import { Card, Button, InlineNotice, SectionHeader } from '../ui'
import ClipboardSearch from './ClipboardSearch'
import { t } from '../../i18n'
import { useClipboardStore } from '../../stores/clipboard.store'

const TRANSFORM_OPTIONS: ClipboardTransformFormat[] = [
  'json_pretty',
  'url_decode',
  'base64_decode',
  'md_to_text',
]

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

export default function ClipboardHistory() {
  const {
    entries,
    query,
    transform,
    loading,
    error,
    setQuery,
    setTransform,
    load,
    clear,
    pin,
    transformAndCopy,
  } = useClipboardStore()

  useEffect(() => {
    load().catch(() => {})
  }, [load])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return entries
    return entries.filter((entry) => entry.text.toLowerCase().includes(normalized))
  }, [entries, query])

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      // Ignore clipboard write failures in restricted environments.
    }
  }

  return (
    <Card variant="outline" className="space-y-3">
      <SectionHeader
        title={t('clipboard.title')}
        icon={Clipboard}
        indicator="var(--color-primary)"
        action={(
          <Button variant="ghost" size="sm" onClick={() => load()} leftIcon={<RefreshCw size={14} />}>
            {t('dashboard.refresh')}
          </Button>
        )}
      />

      {error ? (
        <InlineNotice tone="error" title={t('clipboard.helpTitle')}>
          {error}
        </InlineNotice>
      ) : null}

      <ClipboardSearch query={query} onQueryChange={setQuery} />

      <div className="flex items-center gap-2">
        <select
          aria-label={t('clipboard.transform')}
          className="h-9 min-w-0 flex-1 rounded-[var(--radius-md)] ring-1 ring-transparent bg-[var(--color-surface-soft)] px-2 text-[length:var(--text-sm)] outline-none transition-all focus:ring-[var(--color-primary)] focus:shadow-[var(--shadow-primary)] focus:bg-[var(--color-bg-card)]"
          value={transform}
          onChange={(event) => setTransform(event.target.value as ClipboardTransformFormat)}
        >
          {TRANSFORM_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <Button
          variant="danger"
          size="sm"
          leftIcon={<Trash2 size={14} />}
          onClick={() => clear()}
        >
          {t('clipboard.clear')}
        </Button>
      </div>

      {loading ? (
        <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('files.loading')}</p>
      ) : filtered.length === 0 ? (
        <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('clipboard.empty')}</p>
      ) : (
        <div className="max-h-72 space-y-2 overflow-auto">
          {filtered.map((entry) => (
            <div key={entry.id} className="rounded-[var(--radius-md)] ring-1 ring-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-3 transition-all hover:ring-[var(--color-border)]">
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="line-clamp-2 text-[length:var(--text-sm)] text-[var(--color-text)]">{entry.text}</p>
                <span className="shrink-0 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                  {formatTime(entry.timestamp)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => pin(entry.id, !entry.pinned)}
                  leftIcon={entry.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                >
                  {entry.pinned ? t('clipboard.unpin') : t('clipboard.pin')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => copyText(entry.text)}
                >
                  {t('chat.copy')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => transformAndCopy(entry.id)}
                  leftIcon={<Sparkles size={13} />}
                >
                  {t('clipboard.transform')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
