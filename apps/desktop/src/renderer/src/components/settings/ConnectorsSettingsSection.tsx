import { Globe2, Link2, RefreshCw } from 'lucide-react'
import { t } from '../../i18n'
import { IconButton, InlineNotice } from '../ui'
import { SettingsRow, SettingsSectionCard, SettingsSwitch } from './SettingsPrimitives'

interface ConnectorsSettingsSectionProps {
  loadingModels: boolean
  providerEntries: Array<[string, number]>
  browserCredentialAutoImportEnabled: boolean
  onRefreshModels: () => void
  onToggleBrowserCredentialAutoImport: () => void
}

export default function ConnectorsSettingsSection({
  loadingModels,
  providerEntries,
  browserCredentialAutoImportEnabled,
  onRefreshModels,
  onToggleBrowserCredentialAutoImport,
}: ConnectorsSettingsSectionProps) {
  return (
    <div className="space-y-4">
      <SettingsSectionCard
        cardId="connected-services"
        icon={Link2}
        title={t('settings.card.connectedServices')}
        description={t('settings.card.connectedServicesDesc')}
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
        {providerEntries.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {providerEntries.map(([provider, count]) => (
              <div
                key={provider}
                className="rounded-[18px] bg-[var(--color-panel-muted)] px-4 py-4"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                  {provider}
                </p>
                <p className="mt-2 text-[20px] font-semibold text-[var(--color-text)]">{count}</p>
                <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">
                  {t('settings.connectedServicesCountLabel')}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <InlineNotice tone="info" title={t('settings.connectedServicesEmptyTitle')}>
            {loadingModels ? t('settings.loadingModels') : t('settings.connectedServicesEmptyBody')}
          </InlineNotice>
        )}
      </SettingsSectionCard>

      <SettingsSectionCard
        cardId="browser-hooks"
        icon={Globe2}
        title={t('settings.card.browserHooks')}
        description={t('settings.card.browserHooksDesc')}
      >
        <SettingsRow
          title={t('settings.passwordAutoImportTitle')}
          description={t('settings.passwordAutoImportHint')}
        >
          <div className="space-y-3">
            <div className="flex justify-end">
              <SettingsSwitch
                checked={browserCredentialAutoImportEnabled}
                onClick={onToggleBrowserCredentialAutoImport}
                ariaLabel={t('settings.passwordAutoImportTitle')}
              />
            </div>
            <p className="text-[12px] leading-5 text-[var(--color-text-muted)]">
              {t('settings.passwordAutoImportInstallHint')}
            </p>
          </div>
        </SettingsRow>
      </SettingsSectionCard>
    </div>
  )
}
