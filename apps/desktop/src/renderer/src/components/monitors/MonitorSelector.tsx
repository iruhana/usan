import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DisplayInfo } from '@shared/types/infrastructure'
import { Monitor, Camera, RefreshCw } from 'lucide-react'
import { Card, Button, InlineNotice, SectionHeader } from '../ui'
import { t } from '../../i18n'
import { toMonitorErrorMessage } from '../../lib/user-facing-errors'

function toDataUrl(image: string): string {
  if (image.startsWith('data:')) return image
  return `data:image/png;base64,${image}`
}

export default function MonitorSelector() {
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDisplays = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await window.usan?.monitors.list()
      const resolved = next ?? []
      setDisplays(resolved)
      if (resolved.length > 0 && (selectedId == null || !resolved.some((item) => item.id === selectedId))) {
        setSelectedId(resolved[0].id)
      }
    } catch (err) {
      setError(toMonitorErrorMessage(err, 'load'))
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => {
    loadDisplays().catch(() => {})
  }, [loadDisplays])

  const selected = useMemo(() => displays.find((item) => item.id === selectedId) ?? null, [displays, selectedId])

  return (
    <Card variant="outline" className="space-y-3">
      <SectionHeader
        title={t('monitor.title')}
        icon={Monitor}
        indicator="var(--color-primary)"
        action={(
          <Button variant="ghost" size="sm" onClick={() => loadDisplays()} leftIcon={<RefreshCw size={14} />}>
            {t('dashboard.refresh')}
          </Button>
        )}
      />

      {error ? (
        <InlineNotice tone="error" title={t('monitor.helpTitle')}>
          {error}
        </InlineNotice>
      ) : null}

      {loading ? (
        <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('files.loading')}</p>
      ) : displays.length === 0 ? (
        <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('monitor.empty')}</p>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {displays.map((display) => (
              <button
                key={display.id}
                type="button"
                onClick={() => setSelectedId(display.id)}
                className={`rounded-[var(--radius-md)] ring-1 px-3 py-2.5 text-left transition-all ${
                  selectedId === display.id
                    ? 'ring-[var(--color-primary)] bg-[var(--color-primary-muted)] shadow-[var(--shadow-xs)]'
                    : 'ring-[var(--color-border-subtle)] hover:bg-[var(--color-surface-soft)] hover:ring-[var(--color-border)]'
                }`}
              >
                <p className="text-[length:var(--text-sm)] font-medium text-[var(--color-text)]">{display.label}</p>
                <p className="text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                  {display.bounds.width}x{display.bounds.height} - {display.primary ? t('monitor.primary') : t('monitor.secondary')}
                </p>
              </button>
            ))}
          </div>

          <Button
            size="sm"
            leftIcon={<Camera size={14} />}
            onClick={async () => {
              if (selectedId == null) return
              try {
                setError(null)
                const image = await window.usan?.monitors.screenshot(selectedId)
                if (image) {
                  setPreview(toDataUrl(image))
                }
              } catch (err) {
                setError(toMonitorErrorMessage(err, 'capture'))
              }
            }}
          >
            {t('monitor.capture')}
          </Button>

          {selected ? (
            <p className="text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
              {t('monitor.selected')}: {selected.label} ({selected.scaleFactor}x)
            </p>
          ) : null}

          {preview ? (
            <div className="overflow-hidden rounded-[var(--radius-md)] ring-1 ring-[var(--color-border-subtle)] bg-black/70">
              <img src={preview} alt={t('monitor.previewAlt')} className="h-auto max-h-64 w-full object-contain" />
            </div>
          ) : null}
        </div>
      )}
    </Card>
  )
}