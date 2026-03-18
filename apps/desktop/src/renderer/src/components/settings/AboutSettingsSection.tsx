import { Info, RefreshCw } from 'lucide-react'
import type { UpdaterStatus } from '@shared/types/ipc'
import { t } from '../../i18n'
import { Button, IconButton } from '../ui'
import {
  SettingsRow,
  SettingsSectionCard,
  SettingsSegmentedControl,
  SettingsSwitch,
} from './SettingsPrimitives'

const ACTION_BUTTON_CLASS =
  '!h-9 !rounded-[12px] !px-3.5 !text-[13px] !font-semibold shadow-none hover:shadow-none'

interface AboutSettingsSectionProps {
  beginnerMode: boolean
  updateChannel: 'stable' | 'beta'
  autoDownloadUpdates: boolean
  updaterBusy: 'idle' | 'checking' | 'downloading' | 'installing'
  updaterBusyAny: boolean
  updaterStatus: UpdaterStatus | null
  updaterSummaryNotice: { tone: 'info' | 'success' | 'warning'; title: string; body: string } | null
  updaterFriendlyError: string | null
  updaterTechnicalDetails: string | null
  onRefreshUpdaterStatus: () => void
  onUpdateChannelChange: (value: 'stable' | 'beta') => void
  onToggleAutoDownload: () => void
  onRunUpdaterAction: (action: 'checking' | 'downloading' | 'installing') => void
}

export default function AboutSettingsSection({
  beginnerMode,
  updateChannel,
  autoDownloadUpdates,
  updaterBusy,
  updaterBusyAny,
  updaterStatus,
  updaterSummaryNotice,
  updaterFriendlyError,
  updaterTechnicalDetails,
  onRefreshUpdaterStatus,
  onUpdateChannelChange,
  onToggleAutoDownload,
  onRunUpdaterAction,
}: AboutSettingsSectionProps) {
  return (
    <div className="space-y-4">
      <SettingsSectionCard
        cardId="update-policy"
        icon={RefreshCw}
        title={t('settings.developerGroupUpdates')}
        description={t('settings.developerGroupUpdatesHint')}
        action={
          <IconButton
            icon={RefreshCw}
            size="sm"
            label={t('settings.updateRefresh')}
            onClick={onRefreshUpdaterStatus}
            disabled={updaterBusyAny}
            className={updaterBusyAny ? '[&>svg]:animate-spin' : ''}
          />
        }
      >
        <SettingsRow
          title={t('settings.updateChannel')}
          description={t(beginnerMode ? 'settings.updateChannelHintSimple' : 'settings.updateChannelHint')}
        >
          <SettingsSegmentedControl
            value={updateChannel}
            onChange={(id) => onUpdateChannelChange(id as 'stable' | 'beta')}
            options={[
              { id: 'stable', label: t('settings.updateChannelStable') },
              { id: 'beta', label: t('settings.updateChannelBeta') },
            ]}
          />
        </SettingsRow>

        <SettingsRow title={t('settings.updateAutoDownload')} description={t('settings.card.aboutAutoDownloadDesc')}>
          <div className="flex justify-end">
            <SettingsSwitch
              checked={autoDownloadUpdates}
              onClick={onToggleAutoDownload}
              ariaLabel={t('settings.updateAutoDownload')}
            />
          </div>
        </SettingsRow>

        <SettingsRow
          title={t('settings.updateCheckNow')}
          description={t('settings.developerGroupDiagnosticsHint')}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                className={ACTION_BUTTON_CLASS}
                loading={updaterBusy === 'checking'}
                disabled={updaterBusyAny && updaterBusy !== 'checking'}
                onClick={() => onRunUpdaterAction('checking')}
              >
                {t('settings.updateCheckNow')}
              </Button>
              {updaterStatus?.updateAvailableVersion ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className={ACTION_BUTTON_CLASS}
                  loading={updaterBusy === 'downloading'}
                  disabled={updaterBusyAny && updaterBusy !== 'downloading'}
                  onClick={() => onRunUpdaterAction('downloading')}
                >
                  {t('settings.updateDownload')}
                </Button>
              ) : null}
              {updaterStatus?.downloadedVersion ? (
                <Button
                  size="sm"
                  variant="secondary"
                  className={ACTION_BUTTON_CLASS}
                  loading={updaterBusy === 'installing'}
                  disabled={updaterBusyAny && updaterBusy !== 'installing'}
                  onClick={() => onRunUpdaterAction('installing')}
                >
                  {t('settings.updateInstall')}
                </Button>
              ) : null}
            </div>

            <div className="rounded-[16px] bg-[var(--color-surface-soft)]/72 px-4 py-4">
              <div className="text-[12px] font-semibold text-[var(--color-text)]">
                {updaterSummaryNotice?.title ?? t('settings.updateStatus')}
              </div>
              <div className="mt-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">
                {updaterSummaryNotice?.body ?? t('settings.updateUpToDate')}
              </div>
              {updaterStatus?.lastCheckAt ? (
                <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                  {t('settings.updateLastCheck')}: {new Date(updaterStatus.lastCheckAt).toLocaleString()}
                </p>
              ) : null}
            </div>

            {updaterFriendlyError ? (
              <div className="rounded-[16px] bg-[var(--color-warning-light)] px-4 py-3">
                <p className="text-[12px] font-semibold text-[var(--color-text)]">
                  {t('settings.updateErrorHelpTitle')}
                </p>
                <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">
                  {updaterFriendlyError}
                </p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11px] font-medium text-[var(--color-text-muted)]">
                    {t('settings.technicalDetails')}
                  </summary>
                  <p className="mt-1 break-all text-[11px] leading-5 text-[var(--color-text-muted)]">
                    {updaterTechnicalDetails}
                  </p>
                </details>
              </div>
            ) : null}
          </div>
        </SettingsRow>
      </SettingsSectionCard>

      <SettingsSectionCard
        cardId="about-usan"
        icon={Info}
        title={t('settings.card.aboutUsan')}
        description={t('settings.card.aboutUsanDesc')}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[16px] bg-[var(--color-panel-muted)] px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              {t('settings.card.aboutStorage')}
            </p>
            <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
              {t('settings.card.aboutStorageDesc')}
            </p>
          </div>
          <div className="rounded-[16px] bg-[var(--color-panel-muted)] px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              {t('settings.card.aboutPrivacy')}
            </p>
            <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
              {t('settings.card.aboutPrivacyDesc')}
            </p>
          </div>
          <div className="rounded-[16px] bg-[var(--color-panel-muted)] px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              {t('settings.card.aboutUpdates')}
            </p>
            <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
              {t(updateChannel === 'beta' ? 'settings.card.aboutUpdatesBeta' : 'settings.card.aboutUpdatesStable')}
            </p>
          </div>
          <div className="rounded-[16px] bg-[var(--color-panel-muted)] px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              {t('settings.card.aboutSupport')}
            </p>
            <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
              {t('settings.card.aboutSupportDesc')}
            </p>
          </div>
        </div>
      </SettingsSectionCard>
    </div>
  )
}
