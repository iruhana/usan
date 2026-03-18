import { Bot, Cpu, Loader2, RefreshCw } from 'lucide-react'
import type { ModelInfo } from '@shared/types/ipc'
import { t } from '../../i18n'
import { IconButton } from '../ui'
import { SettingsSectionCard } from './SettingsPrimitives'

interface ModelsSettingsSectionProps {
  models: ModelInfo[]
  loadingModels: boolean
  providerCount: number
  onRefreshModels: () => void
}

export default function ModelsSettingsSection({
  models,
  loadingModels,
  providerCount,
  onRefreshModels,
}: ModelsSettingsSectionProps) {
  return (
    <div className="space-y-4">
      <SettingsSectionCard
        cardId="ai-models"
        icon={Bot}
        title={t('settings.aiModels')}
        description={t('settings.card.aiModelsDesc')}
        action={
          <IconButton
            icon={RefreshCw}
            size="sm"
            label={t('settings.refreshModels')}
            onClick={onRefreshModels}
            disabled={loadingModels}
            className={loadingModels ? '[&>svg]:animate-spin' : ''}
          />
        }
      >
        {models.length > 0 ? (
          <div className="space-y-2 rounded-[16px] bg-[var(--color-surface-soft)]/52 p-2">
            {models.map((model) => (
              <div
                key={model.id}
                className="flex items-center justify-between gap-3 rounded-[10px] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-medium text-[var(--color-text)]">
                    {model.name}
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                    {model.id}
                  </div>
                </div>
                <div className="shrink-0 text-[11px] text-[var(--color-text-muted)]">
                  {model.provider}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[16px] bg-[var(--color-surface-soft)]/52 px-4 py-6 text-center text-[12px] text-[var(--color-text-muted)]">
            {loadingModels ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                <span>{t('settings.loadingModels')}</span>
              </div>
            ) : (
              t('settings.noModels')
            )}
          </div>
        )}
      </SettingsSectionCard>

      <SettingsSectionCard
        cardId="model-routing"
        icon={Cpu}
        title={t('settings.card.modelRouting')}
        description={t('settings.card.modelRoutingDesc')}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[16px] bg-[var(--color-panel-muted)] px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              {t('settings.card.modelRoutingConnected')}
            </p>
            <p className="mt-2 text-[20px] font-semibold text-[var(--color-text)]">
              {models.length}
            </p>
          </div>
          <div className="rounded-[16px] bg-[var(--color-panel-muted)] px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              {t('settings.card.modelRoutingProviders')}
            </p>
            <p className="mt-2 text-[20px] font-semibold text-[var(--color-text)]">
              {providerCount}
            </p>
          </div>
        </div>
      </SettingsSectionCard>
    </div>
  )
}
