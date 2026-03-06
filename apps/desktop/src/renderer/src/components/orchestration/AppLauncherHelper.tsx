import { useEffect, useState } from 'react'
import { Play, Send, X } from 'lucide-react'
import { Button, Card, InlineNotice, Input, SectionHeader } from '../ui'
import { useAppOrchestrationStore } from '../../stores/app-orchestration.store'
import { t } from '../../i18n'
import registry from '../../data/app-registry.json'

type RegistryEntry = {
  id: string
  labelKey: string
  command: string
}

export default function AppLauncherHelper() {
  const { runningApps, loading, error, loadRunningApps, launchApp, closeApp, sendKeys } = useAppOrchestrationStore()
  const [keys, setKeys] = useState('')

  useEffect(() => {
    loadRunningApps().catch(() => {})
  }, [loadRunningApps])

  return (
    <Card variant="outline" className="space-y-3">
      <SectionHeader title={t('appLauncher.title')} indicator="var(--color-primary)" />

      {error ? (
        <InlineNotice tone="error" title={t('appLauncher.helpTitle')}>
          {error}
        </InlineNotice>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(registry as RegistryEntry[]).map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant="secondary"
            leftIcon={<Play size={13} />}
            onClick={() => launchApp(item.command)}
          >
            {t(item.labelKey)}
          </Button>
        ))}
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
        <Input
          label={t('appLauncher.keysLabel')}
          value={keys}
          onChange={(event) => setKeys(event.target.value)}
          placeholder={t('appLauncher.keysPlaceholder')}
        />
        <div className="flex items-end">
          <Button size="sm" leftIcon={<Send size={14} />} disabled={!keys.trim()} onClick={() => sendKeys(keys.trim())}>
            {t('appLauncher.send')}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('appLauncher.loading')}</p>
      ) : runningApps.length === 0 ? (
        <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('appLauncher.empty')}</p>
      ) : (
        <div className="max-h-48 space-y-2 overflow-auto">
          {runningApps.map((app) => (
            <div key={`${app.name}-${app.pid ?? 'n/a'}`} className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] ring-1 ring-[var(--color-border-subtle)] bg-[var(--color-bg-card)] px-3 py-2 transition-all hover:ring-[var(--color-border)]">
              <div className="min-w-0">
                <p className="truncate text-[length:var(--text-sm)] text-[var(--color-text)]">{app.name}</p>
                <p className="truncate text-[length:var(--text-xs)] text-[var(--color-text-muted)]">{app.title || '-'}</p>
              </div>
              <Button size="sm" variant="danger" leftIcon={<X size={13} />} onClick={() => closeApp(app.name)}>
                {t('appLauncher.close')}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
