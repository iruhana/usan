import { useEffect, useMemo, useState } from 'react'
import type { HotkeyBinding } from '@shared/types/infrastructure'
import { Keyboard, Plus, Trash2, RefreshCw } from 'lucide-react'
import { Card, Button, InlineNotice, Input, SectionHeader } from '../ui'
import HotkeyRecorder from './HotkeyRecorder'
import { t } from '../../i18n'
import { useHotkeyStore } from '../../stores/hotkey.store'

const EMPTY_FORM: Omit<HotkeyBinding, 'enabled'> = {
  id: '',
  accelerator: '',
  label: '',
  action: '',
}

export default function HotkeySettings() {
  const { items, lastTriggered, loading, error, initialize, load, save, remove } = useHotkeyStore()
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    initialize()
    load().catch(() => {})
  }, [initialize, load])

  const canSave = useMemo(() => (
    form.id.trim().length > 0
    && form.accelerator.trim().length > 0
    && form.action.trim().length > 0
  ), [form])

  return (
    <Card variant="outline" className="space-y-3">
      <SectionHeader
        title={t('hotkey.title')}
        icon={Keyboard}
        indicator="var(--color-primary)"
        action={(
          <Button size="sm" variant="ghost" leftIcon={<RefreshCw size={14} />} onClick={() => load()}>
            {t('dashboard.refresh')}
          </Button>
        )}
      />

      {error ? (
        <InlineNotice tone="error" title={t('hotkey.helpTitle')}>
          {error}
        </InlineNotice>
      ) : null}

      <div className="grid gap-2 md:grid-cols-2">
        <Input
          label={t('hotkey.id')}
          value={form.id}
          onChange={(event) => setForm((state) => ({ ...state, id: event.target.value }))}
          placeholder={t('hotkey.idPlaceholder')}
        />
        <div className="space-y-1">
          <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)] font-medium">{t('hotkey.accelerator')}</p>
          <HotkeyRecorder
            value={form.accelerator}
            onChange={(accelerator) => setForm((state) => ({ ...state, accelerator }))}
          />
        </div>
        <Input
          label={t('hotkey.label')}
          value={form.label}
          onChange={(event) => setForm((state) => ({ ...state, label: event.target.value }))}
          placeholder={t('hotkey.labelPlaceholder')}
        />
        <Input
          label={t('hotkey.action')}
          value={form.action}
          onChange={(event) => setForm((state) => ({ ...state, action: event.target.value }))}
          placeholder={t('hotkey.actionPlaceholder')}
        />
      </div>

      <Button
        size="sm"
        leftIcon={<Plus size={14} />}
        disabled={!canSave}
        onClick={async () => {
          const next: HotkeyBinding = {
            ...form,
            id: form.id.trim(),
            accelerator: form.accelerator.trim(),
            action: form.action.trim(),
            label: form.label.trim() || form.id.trim(),
            enabled: true,
          }
          const success = await save(next)
          if (success) {
            setForm(EMPTY_FORM)
          }
        }}
      >
        {t('hotkey.save')}
      </Button>

      {lastTriggered && (
        <p className="text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
          {t('hotkey.lastTriggered')}: {lastTriggered}
        </p>
      )}

      {loading ? (
        <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('files.loading')}</p>
      ) : items.length === 0 ? (
        <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('hotkey.empty')}</p>
      ) : (
        <div className="max-h-72 space-y-2 overflow-auto">
          {items.map((binding) => (
            <div key={binding.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] ring-1 ring-[var(--color-border-subtle)] bg-[var(--color-bg-card)] px-3 py-2 transition-all hover:ring-[var(--color-border)]">
              <div className="min-w-0">
                <p className="truncate text-[length:var(--text-sm)] font-medium text-[var(--color-text)]">{binding.label}</p>
                <p className="truncate text-[length:var(--text-xs)] text-[var(--color-text-muted)]">{binding.accelerator} - {binding.action}</p>
              </div>
              <Button
                size="sm"
                variant="danger"
                leftIcon={<Trash2 size={13} />}
                onClick={() => remove(binding.id)}
              >
                {t('hotkey.remove')}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
