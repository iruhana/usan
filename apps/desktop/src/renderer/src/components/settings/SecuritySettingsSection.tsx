import { KeyRound, Trash2, ShieldCheck } from 'lucide-react'
import type { CredentialVaultSummary } from '@shared/types/ipc'
import { t } from '../../i18n'
import { Button } from '../ui'
import { SettingsRow, SettingsSectionCard } from './SettingsPrimitives'

const ACTION_BUTTON_CLASS =
  '!h-9 !rounded-[12px] !px-3.5 !text-[13px] !font-semibold shadow-none hover:shadow-none'

type PermissionProfile = 'full' | 'balanced' | 'strict'

const PROFILE_OPTIONS = [
  {
    id: 'full' as const,
    labelKey: 'settings.permissionProfileFull',
    descKey: 'settings.permissionProfileFullDesc',
  },
  {
    id: 'balanced' as const,
    labelKey: 'settings.permissionProfileBalanced',
    descKey: 'settings.permissionProfileBalancedDesc',
  },
  {
    id: 'strict' as const,
    labelKey: 'settings.permissionProfileStrict',
    descKey: 'settings.permissionProfileStrictDesc',
  },
]

interface SecuritySettingsSectionProps {
  beginnerMode: boolean
  permissionProfile: PermissionProfile
  credentialSummary: CredentialVaultSummary | null
  credentialBusy: 'idle' | 'importing' | 'clearing'
  credentialNotice: {
    tone: 'idle' | 'success' | 'error'
    text: string
    kind: 'import' | 'clear' | null
  }
  onSetPermissionProfile: (profile: PermissionProfile) => void
  onImportCredentials: () => void
  onClearCredentials: () => void
  formatImportedAt: (timestamp: number) => string
  getCredentialNoticeTitle: (notice: {
    tone: 'idle' | 'success' | 'error'
    text: string
    kind: 'import' | 'clear' | null
  }) => string
}

export default function SecuritySettingsSection({
  beginnerMode,
  permissionProfile,
  credentialSummary,
  credentialBusy,
  credentialNotice,
  onSetPermissionProfile,
  onImportCredentials,
  onClearCredentials,
  formatImportedAt,
  getCredentialNoticeTitle,
}: SecuritySettingsSectionProps) {
  return (
    <div className="space-y-4">
      <SettingsSectionCard
        cardId="permission-profile"
        icon={ShieldCheck}
        title={t('settings.developerGroupAccess')}
        description={t('settings.developerGroupAccessHint')}
      >
        <SettingsRow
          title={t('settings.permissionProfile')}
          description={t(beginnerMode ? 'settings.permissionProfileHintSimple' : 'settings.permissionProfileHint')}
        >
          <div className="space-y-2">
            {PROFILE_OPTIONS.map((option) => {
              const isActive = permissionProfile === option.id
              const descKey = beginnerMode ? `${option.descKey}Simple` : option.descKey
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onSetPermissionProfile(option.id)}
                  className={`w-full rounded-[16px] px-4 py-3 text-left transition-all ${
                    isActive
                      ? 'bg-white ring-1 ring-[color:rgba(49,130,246,0.16)] shadow-[var(--shadow-xs)]'
                      : 'bg-[var(--color-surface-soft)]/68 hover:bg-white/70'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1 h-2.5 w-2.5 rounded-full ${
                        isActive ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-[var(--color-text)]">
                        {t(option.labelKey)}
                      </div>
                      <div className="mt-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">
                        {t(descKey)}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </SettingsRow>
      </SettingsSectionCard>

      <SettingsSectionCard
        cardId="password-vault"
        icon={KeyRound}
        title={t('settings.developerGroupPasswords')}
        description={t('settings.developerGroupPasswordsHint')}
      >
        <SettingsRow
          title={t('settings.passwordImportTitle')}
          description={t('settings.passwordImportHint')}
        >
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[16px] bg-[var(--color-surface-soft)]/68 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                  {t('settings.passwordVaultCount')}
                </p>
                <p className="mt-2 text-[20px] font-semibold text-[var(--color-text)]">
                  {credentialSummary?.totalCount ?? 0}
                </p>
              </div>
              <div className="rounded-[16px] bg-[var(--color-surface-soft)]/68 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                  {t('settings.passwordVaultLastImport')}
                </p>
                <p className="mt-2 text-[13px] font-medium leading-5 text-[var(--color-text)]">
                  {credentialSummary?.lastImportedAt
                    ? formatImportedAt(credentialSummary.lastImportedAt)
                    : t('settings.passwordVaultNever')}
                </p>
              </div>
            </div>

            <p className="text-[12px] leading-5 text-[var(--color-text-muted)]">
              {t('settings.passwordImportHowTo')}
            </p>

            {credentialSummary?.preview?.length ? (
              <div className="rounded-[16px] bg-[var(--color-surface-soft)]/52 p-2">
                {credentialSummary.preview.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-[10px] px-3 py-2"
                  >
                    <span className="truncate text-[12px] font-medium text-[var(--color-text)]">
                      {item.site}
                    </span>
                    <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">
                      {item.usernameMasked}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            {credentialNotice.text ? (
              <div
                className={`rounded-[16px] px-4 py-3 ${
                  credentialNotice.tone === 'error'
                    ? 'bg-[var(--color-danger-light)]'
                    : 'bg-[var(--color-surface-soft)]'
                }`}
              >
                <p className="text-[12px] font-semibold text-[var(--color-text)]">
                  {getCredentialNoticeTitle(credentialNotice)}
                </p>
                <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">
                  {credentialNotice.text}
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                className={ACTION_BUTTON_CLASS}
                loading={credentialBusy === 'importing'}
                disabled={credentialBusy !== 'idle'}
                onClick={onImportCredentials}
              >
                {t('settings.passwordImportButton')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className={`${ACTION_BUTTON_CLASS} !text-[var(--color-text-secondary)]`}
                loading={credentialBusy === 'clearing'}
                disabled={credentialBusy !== 'idle' || (credentialSummary?.totalCount ?? 0) === 0}
                onClick={onClearCredentials}
              >
                <Trash2 size={14} className="mr-1" />
                {t('settings.passwordVaultClear')}
              </Button>
            </div>
          </div>
        </SettingsRow>
      </SettingsSectionCard>
    </div>
  )
}
