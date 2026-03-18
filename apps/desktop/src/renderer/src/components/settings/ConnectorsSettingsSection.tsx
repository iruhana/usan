import type { ExternalOAuthStatus } from '@shared/types/ipc'
import { Globe2, Link2, RefreshCw, ShieldCheck } from 'lucide-react'
import { t } from '../../i18n'
import { Badge, Button, IconButton, InlineNotice } from '../ui'
import { SettingsRow, SettingsSectionCard, SettingsSwitch } from './SettingsPrimitives'

interface ConnectorsSettingsSectionProps {
  loadingModels: boolean
  providerEntries: Array<[string, number]>
  browserCredentialAutoImportEnabled: boolean
  naverStatus: ExternalOAuthStatus | null
  kakaoStatus: ExternalOAuthStatus | null
  connectorBusy: 'idle' | 'naver-connect' | 'naver-disconnect' | 'kakao-connect' | 'kakao-disconnect'
  connectorNotice: {
    tone: 'idle' | 'success' | 'error'
    text: string
  }
  onRefreshModels: () => void
  onToggleBrowserCredentialAutoImport: () => void
  onConnectProvider: (provider: 'naver' | 'kakao') => void
  onDisconnectProvider: (provider: 'naver' | 'kakao') => void
}

export default function ConnectorsSettingsSection({
  loadingModels,
  providerEntries,
  browserCredentialAutoImportEnabled,
  naverStatus,
  kakaoStatus,
  connectorBusy,
  connectorNotice,
  onRefreshModels,
  onToggleBrowserCredentialAutoImport,
  onConnectProvider,
  onDisconnectProvider,
}: ConnectorsSettingsSectionProps) {
  const platforms = [
    {
      id: 'naver' as const,
      label: 'Naver',
      status: naverStatus,
      hint: t('settings.connector.naverHint'),
      configHint: t('settings.connector.naverConfigHint'),
    },
    {
      id: 'kakao' as const,
      label: 'Kakao',
      status: kakaoStatus,
      hint: t('settings.connector.kakaoHint'),
      configHint: t('settings.connector.kakaoConfigHint'),
    },
  ]

  return (
    <div className="space-y-4">
      <SettingsSectionCard
        cardId="korean-platforms"
        icon={ShieldCheck}
        title={t('settings.card.koreanPlatforms')}
        description={t('settings.card.koreanPlatformsDesc')}
      >
        <div className="space-y-3">
          {connectorNotice.tone !== 'idle' && connectorNotice.text ? (
            <InlineNotice
              tone={connectorNotice.tone === 'error' ? 'error' : 'success'}
              title={t('settings.connector.noticeTitle')}
            >
              {connectorNotice.text}
            </InlineNotice>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-2">
            {platforms.map((platform) => {
              const busyConnect = connectorBusy === `${platform.id}-connect`
              const busyDisconnect = connectorBusy === `${platform.id}-disconnect`
              const isConnected = platform.status?.authenticated === true
              const isConfigured = platform.status?.configured === true
              const primaryLabel =
                platform.status?.profile?.email ||
                platform.status?.profile?.nickname ||
                platform.status?.profile?.name ||
                t('settings.connector.accountEmpty')
              const scopes = formatScopes(platform.status?.scopes)
              const badge = getStatusBadge(platform.status)

              return (
                <div
                  key={platform.id}
                  className="rounded-[20px] bg-[var(--color-panel-muted)] px-4 py-4 shadow-[var(--shadow-xs)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-[var(--color-text)]">{platform.label}</p>
                      <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">
                        {platform.hint}
                      </p>
                    </div>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-[16px] bg-white/80 px-3.5 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                        {t('settings.connector.accountLabel')}
                      </p>
                      <p className="mt-1 text-[13px] leading-6 text-[var(--color-text)]">{primaryLabel}</p>
                    </div>
                    <div className="rounded-[16px] bg-white/80 px-3.5 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
                        {t('settings.connector.scopeLabel')}
                      </p>
                      <p className="mt-1 text-[13px] leading-6 text-[var(--color-text)]">{scopes}</p>
                    </div>
                  </div>

                  {platform.status?.expiresAt ? (
                    <p className="mt-3 text-[12px] leading-5 text-[var(--color-text-secondary)]">
                      {t('settings.connector.expiresAtLabel')}{' '}
                      {new Date(platform.status.expiresAt).toLocaleString()}
                    </p>
                  ) : null}

                  {!isConfigured ? (
                    <p className="mt-3 text-[12px] leading-5 text-[var(--color-text-secondary)]">
                      {platform.configHint}
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {isConnected ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={busyDisconnect}
                        onClick={() => onDisconnectProvider(platform.id)}
                      >
                        {t('settings.connector.disconnect')}
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={!isConfigured}
                        loading={busyConnect}
                        onClick={() => onConnectProvider(platform.id)}
                      >
                        {t('settings.connector.connect')}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </SettingsSectionCard>

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

function getStatusBadge(status: ExternalOAuthStatus | null): {
  variant: 'success' | 'warning' | 'default'
  label: string
} {
  if (!status?.configured) {
    return { variant: 'warning', label: t('settings.connector.statusNeedsConfig') }
  }
  if (status.authenticated) {
    return { variant: 'success', label: t('settings.connector.statusConnected') }
  }
  return { variant: 'default', label: t('settings.connector.statusDisconnected') }
}

function formatScopes(scopes?: string[]): string {
  if (!scopes || scopes.length === 0) {
    return t('settings.connector.scopeEmpty')
  }

  const preview = scopes.slice(0, 3).join(', ')
  return scopes.length > 3 ? `${preview} +${scopes.length - 3}` : preview
}
