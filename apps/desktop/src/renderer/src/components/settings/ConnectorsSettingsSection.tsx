import { useEffect, useRef, useState } from 'react'
import type {
  CalendarAccountConfigInput,
  CalendarAccountPreset,
  CalendarAccountStatus,
  EmailAccountConfigInput,
  EmailAccountPreset,
  EmailAccountStatus,
  EmailServerConfig,
  ExternalOAuthStatus,
  FinanceAccountConfigInput,
  FinanceAccountPreset,
  FinanceAccountStatus,
  PublicDataAccountConfigInput,
  PublicDataAccountPreset,
  PublicDataAccountStatus,
  PublicDataAuthMode,
  PublicDataFormat,
  TaxAccountConfigInput,
  TaxAccountStatus,
  TaxServiceAuthMode,
  TaxServicePreset,
} from '@shared/types/ipc'
import { Building2, CalendarDays, FileBadge2, Globe2, Landmark, Link2, Mail, RefreshCw, ShieldCheck } from 'lucide-react'
import { t } from '../../i18n'
import { Badge, Button, IconButton, InlineNotice, Input } from '../ui'
import { SettingsRow, SettingsSectionCard, SettingsSwitch } from './SettingsPrimitives'

interface ConnectorsSettingsSectionProps {
  loadingModels: boolean
  providerEntries: Array<[string, number]>
  browserCredentialAutoImportEnabled: boolean
  naverStatus: ExternalOAuthStatus | null
  kakaoStatus: ExternalOAuthStatus | null
  connectorBusy: 'idle' | 'naver-connect' | 'naver-disconnect' | 'kakao-connect' | 'kakao-disconnect'
  connectorNotice: { tone: 'idle' | 'success' | 'error'; text: string }
  calendarStatus: CalendarAccountStatus | null
  calendarBusy: 'idle' | 'saving' | 'clearing'
  calendarNotice: { tone: 'idle' | 'success' | 'error'; text: string }
  emailStatus: EmailAccountStatus | null
  emailBusy: 'idle' | 'saving' | 'clearing'
  emailNotice: { tone: 'idle' | 'success' | 'error'; text: string }
  financeStatus: FinanceAccountStatus | null
  financeBusy: 'idle' | 'saving' | 'clearing'
  financeNotice: { tone: 'idle' | 'success' | 'error'; text: string }
  publicDataStatus: PublicDataAccountStatus | null
  publicDataBusy: 'idle' | 'saving' | 'clearing'
  publicDataNotice: { tone: 'idle' | 'success' | 'error'; text: string }
  taxStatus: TaxAccountStatus | null
  taxBusy: 'idle' | 'saving' | 'clearing'
  taxNotice: { tone: 'idle' | 'success' | 'error'; text: string }
  onRefreshModels: () => void
  onToggleBrowserCredentialAutoImport: () => void
  onConnectProvider: (provider: 'naver' | 'kakao') => void
  onDisconnectProvider: (provider: 'naver' | 'kakao') => void
  onSaveCalendarConfig: (config: CalendarAccountConfigInput) => void
  onClearCalendarConfig: () => void
  onSaveEmailConfig: (config: EmailAccountConfigInput) => void
  onClearEmailConfig: () => void
  onSaveFinanceConfig: (config: FinanceAccountConfigInput) => void
  onClearFinanceConfig: () => void
  onSavePublicDataConfig: (config: PublicDataAccountConfigInput) => void
  onClearPublicDataConfig: () => void
  onSaveTaxConfig: (config: TaxAccountConfigInput) => void
  onClearTaxConfig: () => void
}

interface CalendarFormState {
  preset: CalendarAccountPreset
  serverUrl: string
  username: string
  password: string
  calendarUrl: string
}

interface EmailFormState {
  preset: EmailAccountPreset
  displayName: string
  emailAddress: string
  username: string
  password: string
  imapHost: string
  imapPort: string
  imapSecure: boolean
  smtpHost: string
  smtpPort: string
  smtpSecure: boolean
}

interface FinanceFormState {
  preset: FinanceAccountPreset
  apiBaseUrl: string
  providerLabel: string
  accountAlias: string
  clientId: string
  clientSecret: string
  accessToken: string
  refreshToken: string
  fintechUseNum: string
  userSeqNo: string
  scope: string
  contractAccountType: string
  contractAccountNum: string
  withdrawPassPhrase: string
  withdrawPrintContent: string
  clientName: string
  clientBankCode: string
  clientAccountNum: string
  clientIdentifier: string
  nameCheckOption: 'on' | 'off'
  transferPurpose: string
}

interface PublicDataFormState {
  preset: PublicDataAccountPreset
  apiBaseUrl: string
  authMode: PublicDataAuthMode
  providerLabel: string
  serviceName: string
  defaultPath: string
  defaultFormat: PublicDataFormat
  serviceKey: string
}

interface TaxFormState {
  preset: TaxServicePreset
  apiBaseUrl: string
  authMode: TaxServiceAuthMode
  providerLabel: string
  apiKey: string
  memberId: string
  corporationNumber: string
  userId: string
  businessStatePath: string
  hometaxPath: string
  taxInvoicePath: string
}

const CALENDAR_PRESETS: Record<CalendarAccountPreset, { label: string; serverUrl: string }> = {
  custom: { label: 'Custom', serverUrl: '' },
  icloud: { label: 'iCloud', serverUrl: 'https://caldav.icloud.com' },
  fastmail: { label: 'Fastmail', serverUrl: 'https://caldav.fastmail.com/dav' },
  nextcloud: { label: 'Nextcloud', serverUrl: '' },
}

const EMAIL_PRESETS: Record<EmailAccountPreset, { label: string; imap: EmailServerConfig; smtp: EmailServerConfig }> = {
  custom: { label: 'Custom', imap: { host: '', port: 993, secure: true }, smtp: { host: '', port: 587, secure: false } },
  gmail: { label: 'Gmail', imap: { host: 'imap.gmail.com', port: 993, secure: true }, smtp: { host: 'smtp.gmail.com', port: 465, secure: true } },
  outlook: { label: 'Outlook', imap: { host: 'outlook.office365.com', port: 993, secure: true }, smtp: { host: 'smtp.office365.com', port: 587, secure: false } },
  naver: { label: 'Naver', imap: { host: 'imap.naver.com', port: 993, secure: true }, smtp: { host: 'smtp.naver.com', port: 587, secure: false } },
  daum: { label: 'Daum', imap: { host: 'imap.daum.net', port: 993, secure: true }, smtp: { host: 'smtp.daum.net', port: 465, secure: true } },
}

const FINANCE_PRESETS: Record<FinanceAccountPreset, { label: string; apiBaseUrl: string; providerLabel: string }> = {
  'openbanking-testbed': {
    label: 'Open Banking Testbed',
    apiBaseUrl: 'https://testapi.openbanking.or.kr',
    providerLabel: 'KFTC Open Banking Testbed',
  },
  'openbanking-production': {
    label: 'Open Banking Production',
    apiBaseUrl: 'https://openapi.openbanking.or.kr',
    providerLabel: 'KFTC Open Banking',
  },
  'mydata-compatible': {
    label: 'MyData-compatible',
    apiBaseUrl: '',
    providerLabel: 'MyData-compatible relay',
  },
  custom: {
    label: 'Custom',
    apiBaseUrl: '',
    providerLabel: '',
  },
}

const PUBLIC_DATA_PRESETS: Record<PublicDataAccountPreset, {
  label: string
  apiBaseUrl: string
  authMode: PublicDataAuthMode
  providerLabel: string
  serviceName: string
  defaultPath: string
  defaultFormat: PublicDataFormat
}> = {
  'data-go-kr': {
    label: 'data.go.kr',
    apiBaseUrl: 'https://apis.data.go.kr',
    authMode: 'query',
    providerLabel: 'Government24 / data.go.kr',
    serviceName: 'Public service query',
    defaultPath: '',
    defaultFormat: 'json',
  },
  odcloud: {
    label: 'odcloud',
    apiBaseUrl: 'https://api.odcloud.kr',
    authMode: 'query',
    providerLabel: 'data.go.kr odcloud',
    serviceName: 'NTS business status',
    defaultPath: '/api/nts-businessman/v1/status',
    defaultFormat: 'json',
  },
  custom: {
    label: 'Custom',
    apiBaseUrl: '',
    authMode: 'query',
    providerLabel: '',
    serviceName: '',
    defaultPath: '',
    defaultFormat: 'json',
  },
}

const TAX_PRESETS: Record<TaxServicePreset, {
  label: string
  apiBaseUrl: string
  authMode: TaxServiceAuthMode
  providerLabel: string
}> = {
  barobill: {
    label: 'Barobill',
    apiBaseUrl: 'https://api.barobill.co.kr',
    authMode: 'header',
    providerLabel: 'Barobill',
  },
  custom: {
    label: 'Custom',
    apiBaseUrl: '',
    authMode: 'header',
    providerLabel: '',
  },
}

function createCalendarFormState(status: CalendarAccountStatus | null): CalendarFormState {
  const preset = status?.preset ?? 'icloud'
  return {
    preset,
    serverUrl: status?.serverUrl ?? CALENDAR_PRESETS[preset].serverUrl,
    username: status?.username ?? '',
    password: '',
    calendarUrl: status?.calendarUrl ?? '',
  }
}

function createEmailFormState(status: EmailAccountStatus | null): EmailFormState {
  const preset = status?.preset ?? 'gmail'
  const defaults = EMAIL_PRESETS[preset]
  return {
    preset,
    displayName: status?.displayName ?? '',
    emailAddress: status?.emailAddress ?? '',
    username: status?.username ?? status?.emailAddress ?? '',
    password: '',
    imapHost: status?.imap?.host ?? defaults.imap.host,
    imapPort: String(status?.imap?.port ?? defaults.imap.port),
    imapSecure: status?.imap?.secure ?? defaults.imap.secure,
    smtpHost: status?.smtp?.host ?? defaults.smtp.host,
    smtpPort: String(status?.smtp?.port ?? defaults.smtp.port),
    smtpSecure: status?.smtp?.secure ?? defaults.smtp.secure,
  }
}

function createFinanceFormState(status: FinanceAccountStatus | null): FinanceFormState {
  const preset = status?.preset ?? 'openbanking-testbed'
  const defaults = FINANCE_PRESETS[preset]
  const transferDefaults = status?.transferDefaults

  return {
    preset,
    apiBaseUrl: status?.apiBaseUrl ?? defaults.apiBaseUrl,
    providerLabel: status?.providerLabel ?? defaults.providerLabel,
    accountAlias: status?.accountAlias ?? '',
    clientId: status?.clientId ?? '',
    clientSecret: '',
    accessToken: '',
    refreshToken: '',
    fintechUseNum: status?.fintechUseNum ?? '',
    userSeqNo: status?.userSeqNo ?? '',
    scope: status?.scope ?? '',
    contractAccountType: transferDefaults?.contractAccountType ?? 'N',
    contractAccountNum: transferDefaults?.contractAccountNum ?? '',
    withdrawPassPhrase: transferDefaults?.withdrawPassPhrase ?? 'NONE',
    withdrawPrintContent: transferDefaults?.withdrawPrintContent ?? 'Usan payment',
    clientName: transferDefaults?.clientName ?? '',
    clientBankCode: transferDefaults?.clientBankCode ?? '',
    clientAccountNum: transferDefaults?.clientAccountNum ?? '',
    clientIdentifier: transferDefaults?.clientIdentifier ?? '',
    nameCheckOption: transferDefaults?.nameCheckOption === 'on' ? 'on' : 'off',
    transferPurpose: transferDefaults?.transferPurpose ?? 'TR',
  }
}

function createPublicDataFormState(status: PublicDataAccountStatus | null): PublicDataFormState {
  const preset = status?.preset ?? 'odcloud'
  const defaults = PUBLIC_DATA_PRESETS[preset]

  return {
    preset,
    apiBaseUrl: status?.apiBaseUrl ?? defaults.apiBaseUrl,
    authMode: status?.authMode ?? defaults.authMode,
    providerLabel: status?.providerLabel ?? defaults.providerLabel,
    serviceName: status?.serviceName ?? defaults.serviceName,
    defaultPath: status?.defaultPath ?? defaults.defaultPath,
    defaultFormat: status?.defaultFormat ?? defaults.defaultFormat,
    serviceKey: '',
  }
}

function createTaxFormState(status: TaxAccountStatus | null): TaxFormState {
  const preset = status?.preset ?? 'barobill'
  const defaults = TAX_PRESETS[preset]

  return {
    preset,
    apiBaseUrl: status?.apiBaseUrl ?? defaults.apiBaseUrl,
    authMode: status?.authMode ?? defaults.authMode,
    providerLabel: status?.providerLabel ?? defaults.providerLabel,
    apiKey: '',
    memberId: status?.memberId ?? '',
    corporationNumber: status?.corporationNumber ?? '',
    userId: status?.userId ?? '',
    businessStatePath: status?.businessStatePath ?? '',
    hometaxPath: status?.hometaxPath ?? '',
    taxInvoicePath: status?.taxInvoicePath ?? '',
  }
}

export default function ConnectorsSettingsSection(props: ConnectorsSettingsSectionProps) {
  const { loadingModels, providerEntries, browserCredentialAutoImportEnabled, naverStatus, kakaoStatus, connectorBusy, connectorNotice, calendarStatus, calendarBusy, calendarNotice, emailStatus, emailBusy, emailNotice, financeStatus, financeBusy, financeNotice, publicDataStatus, publicDataBusy, publicDataNotice, taxStatus, taxBusy, taxNotice, onRefreshModels, onToggleBrowserCredentialAutoImport, onConnectProvider, onDisconnectProvider, onSaveCalendarConfig, onClearCalendarConfig, onSaveEmailConfig, onClearEmailConfig, onSaveFinanceConfig, onClearFinanceConfig, onSavePublicDataConfig, onClearPublicDataConfig, onSaveTaxConfig, onClearTaxConfig } = props
  const [calendarForm, setCalendarForm] = useState(() => createCalendarFormState(calendarStatus))
  const [emailForm, setEmailForm] = useState(() => createEmailFormState(emailStatus))
  const [financeForm, setFinanceForm] = useState(() => createFinanceFormState(financeStatus))
  const [publicDataForm, setPublicDataForm] = useState(() => createPublicDataFormState(publicDataStatus))
  const [taxForm, setTaxForm] = useState(() => createTaxFormState(taxStatus))
  const calendarDirtyRef = useRef(false)
  const emailDirtyRef = useRef(false)
  const financeDirtyRef = useRef(false)
  const publicDataDirtyRef = useRef(false)
  const taxDirtyRef = useRef(false)

  useEffect(() => {
    const shouldSync = calendarBusy === 'idle' && calendarNotice.tone === 'success'
    if (!calendarDirtyRef.current || shouldSync) {
      setCalendarForm(createCalendarFormState(calendarStatus))
      if (shouldSync) calendarDirtyRef.current = false
    }
  }, [calendarBusy, calendarNotice.tone, calendarStatus])

  useEffect(() => {
    const shouldSync = emailBusy === 'idle' && emailNotice.tone === 'success'
    if (!emailDirtyRef.current || shouldSync) {
      setEmailForm(createEmailFormState(emailStatus))
      if (shouldSync) emailDirtyRef.current = false
    }
  }, [emailBusy, emailNotice.tone, emailStatus])

  useEffect(() => {
    const shouldSync = financeBusy === 'idle' && financeNotice.tone === 'success'
    if (!financeDirtyRef.current || shouldSync) {
      setFinanceForm(createFinanceFormState(financeStatus))
      if (shouldSync) financeDirtyRef.current = false
    }
  }, [financeBusy, financeNotice.tone, financeStatus])

  useEffect(() => {
    const shouldSync = publicDataBusy === 'idle' && publicDataNotice.tone === 'success'
    if (!publicDataDirtyRef.current || shouldSync) {
      setPublicDataForm(createPublicDataFormState(publicDataStatus))
      if (shouldSync) publicDataDirtyRef.current = false
    }
  }, [publicDataBusy, publicDataNotice.tone, publicDataStatus])

  useEffect(() => {
    const shouldSync = taxBusy === 'idle' && taxNotice.tone === 'success'
    if (!taxDirtyRef.current || shouldSync) {
      setTaxForm(createTaxFormState(taxStatus))
      if (shouldSync) taxDirtyRef.current = false
    }
  }, [taxBusy, taxNotice.tone, taxStatus])

  const connectorPlatforms = [
    { id: 'naver' as const, label: 'Naver', status: naverStatus, hint: t('settings.connector.naverHint'), configHint: t('settings.connector.naverConfigHint') },
    { id: 'kakao' as const, label: 'Kakao', status: kakaoStatus, hint: t('settings.connector.kakaoHint'), configHint: t('settings.connector.kakaoConfigHint') },
  ]

  return (
    <div className="space-y-4">
      <SettingsSectionCard cardId="korean-platforms" icon={ShieldCheck} title={t('settings.card.koreanPlatforms')} description={t('settings.card.koreanPlatformsDesc')}>
        <div className="space-y-3">
          {connectorNotice.tone !== 'idle' && connectorNotice.text ? <InlineNotice tone={connectorNotice.tone === 'error' ? 'error' : 'success'} title={t('settings.connector.noticeTitle')}>{connectorNotice.text}</InlineNotice> : null}
          <div className="grid gap-3 lg:grid-cols-2">
            {connectorPlatforms.map((platform) => {
              const badge = getStatusBadge(platform.status)
              const connected = platform.status?.authenticated === true
              const configured = platform.status?.configured === true
              const primaryLabel = platform.status?.profile?.email || platform.status?.profile?.nickname || platform.status?.profile?.name || t('settings.connector.accountEmpty')
              return (
                <div key={platform.id} className="rounded-[20px] bg-[var(--color-panel-muted)] px-4 py-4 shadow-[var(--shadow-xs)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-[var(--color-text)]">{platform.label}</p>
                      <p className="mt-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">{platform.hint}</p>
                    </div>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <InfoTile label={t('settings.connector.accountLabel')} value={primaryLabel} />
                    <InfoTile label={t('settings.connector.scopeLabel')} value={formatScopes(platform.status?.scopes)} />
                  </div>
                  {!configured ? <p className="mt-3 text-[12px] leading-5 text-[var(--color-text-secondary)]">{platform.configHint}</p> : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {connected ? <Button variant="secondary" size="sm" loading={connectorBusy === `${platform.id}-disconnect`} onClick={() => onDisconnectProvider(platform.id)}>{t('settings.connector.disconnect')}</Button> : <Button variant="primary" size="sm" disabled={!configured} loading={connectorBusy === `${platform.id}-connect`} onClick={() => onConnectProvider(platform.id)}>{t('settings.connector.connect')}</Button>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard cardId="calendar-account" icon={CalendarDays} title={t('settings.card.calendarAccount')} description={t('settings.card.calendarAccountDesc')}>
        <div className="space-y-4">
          {calendarNotice.tone !== 'idle' && calendarNotice.text ? <InlineNotice tone={calendarNotice.tone === 'error' ? 'error' : 'success'} title={t('settings.calendar.noticeTitle')}>{calendarNotice.text}</InlineNotice> : null}
          {calendarStatus?.provider && calendarStatus.provider !== 'none' && calendarStatus.provider !== 'caldav' ? <InlineNotice tone="info" title={t('settings.calendar.oauthTitle')}>{t('settings.calendar.oauthHint')}</InlineNotice> : null}
          <div className="grid gap-3 lg:grid-cols-3">
            <InfoTile label={t('settings.calendar.connectedCalendar')} value={calendarStatus?.calendarName || t('settings.connector.accountEmpty')} />
            <StatusTile label={t('settings.calendar.providerLabel')} badge={getCalendarStatusBadge(calendarStatus)} value={formatCalendarProvider(calendarStatus?.provider ?? 'none')} />
            <InfoTile label={t('settings.calendar.lastVerified')} value={calendarStatus?.lastVerifiedAt ? new Date(calendarStatus.lastVerifiedAt).toLocaleString() : t('settings.calendar.lastVerifiedEmpty')} />
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            <SelectField id="settings-calendar-preset" label={t('settings.calendar.preset')} value={calendarForm.preset} options={Object.entries(CALENDAR_PRESETS).map(([value, preset]) => ({ value, label: preset.label }))} onChange={(value) => { calendarDirtyRef.current = true; setCalendarForm((current) => ({ ...current, preset: value as CalendarAccountPreset, serverUrl: CALENDAR_PRESETS[value as CalendarAccountPreset].serverUrl || current.serverUrl })) }} />
            <Input label={t('settings.calendar.username')} value={calendarForm.username} placeholder="name@example.com" onChange={(event) => { calendarDirtyRef.current = true; setCalendarForm((current) => ({ ...current, username: event.target.value })) }} />
            <Input label={t('settings.calendar.serverUrl')} value={calendarForm.serverUrl} placeholder="https://example.com/dav" helperText={t('settings.calendar.serverUrlHint')} onChange={(event) => { calendarDirtyRef.current = true; setCalendarForm((current) => ({ ...current, serverUrl: event.target.value })) }} />
            <Input label={t('settings.calendar.password')} type="password" value={calendarForm.password} placeholder={calendarStatus?.hasStoredPassword ? t('settings.calendar.passwordSaved') : t('settings.calendar.passwordPlaceholder')} helperText={t('settings.calendar.passwordHint')} onChange={(event) => { calendarDirtyRef.current = true; setCalendarForm((current) => ({ ...current, password: event.target.value })) }} />
          </div>
          <Input label={t('settings.calendar.calendarUrl')} value={calendarForm.calendarUrl} placeholder="https://example.com/dav/calendars/user/default/" helperText={t('settings.calendar.calendarUrlHint')} onChange={(event) => { calendarDirtyRef.current = true; setCalendarForm((current) => ({ ...current, calendarUrl: event.target.value })) }} />
          <p className="text-[12px] leading-5 text-[var(--color-text-muted)]">{t('settings.calendar.securityHint')}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" loading={calendarBusy === 'saving'} onClick={() => onSaveCalendarConfig({ preset: calendarForm.preset, serverUrl: calendarForm.serverUrl.trim(), username: calendarForm.username.trim(), password: calendarForm.password.trim() || undefined, calendarUrl: calendarForm.calendarUrl.trim() || undefined })}>{t('settings.calendar.save')}</Button>
            <Button variant="secondary" disabled={calendarStatus?.provider !== 'caldav' || !calendarStatus.configured} loading={calendarBusy === 'clearing'} onClick={onClearCalendarConfig}>{t('settings.calendar.clear')}</Button>
          </div>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard cardId="email-account" icon={Mail} title={t('settings.card.emailAccount')} description={t('settings.card.emailAccountDesc')}>
        <div className="space-y-4">
          {emailNotice.tone !== 'idle' && emailNotice.text ? <InlineNotice tone={emailNotice.tone === 'error' ? 'error' : 'success'} title={t('settings.email.noticeTitle')}>{emailNotice.text}</InlineNotice> : null}
          {emailStatus?.provider && emailStatus.provider !== 'none' && emailStatus.provider !== 'imap-smtp' ? <InlineNotice tone="info" title={t('settings.email.oauthTitle')}>{t('settings.email.oauthHint')}</InlineNotice> : null}
          <div className="grid gap-3 lg:grid-cols-3">
            <InfoTile label={t('settings.email.connectedAccount')} value={emailStatus?.emailAddress || t('settings.connector.accountEmpty')} />
            <StatusTile label={t('settings.email.providerLabel')} badge={getEmailStatusBadge(emailStatus)} value={formatEmailProvider(emailStatus?.provider ?? 'none')} />
            <InfoTile label={t('settings.email.lastVerified')} value={emailStatus?.lastVerifiedAt ? new Date(emailStatus.lastVerifiedAt).toLocaleString() : t('settings.email.lastVerifiedEmpty')} />
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            <Input label={t('settings.email.displayName')} value={emailForm.displayName} placeholder={t('settings.email.displayNamePlaceholder')} onChange={(event) => { emailDirtyRef.current = true; setEmailForm((current) => ({ ...current, displayName: event.target.value })) }} />
            <Input label={t('settings.email.emailAddress')} value={emailForm.emailAddress} placeholder="name@example.com" onChange={(event) => { const nextEmail = event.target.value; emailDirtyRef.current = true; setEmailForm((current) => ({ ...current, emailAddress: nextEmail, username: !current.username || current.username === current.emailAddress ? nextEmail : current.username })) }} />
            <SelectField id="settings-email-preset" label={t('settings.email.preset')} value={emailForm.preset} options={Object.entries(EMAIL_PRESETS).map(([value, preset]) => ({ value, label: preset.label }))} onChange={(value) => { const preset = value as EmailAccountPreset; emailDirtyRef.current = true; setEmailForm((current) => ({ ...current, preset, imapHost: EMAIL_PRESETS[preset].imap.host, imapPort: String(EMAIL_PRESETS[preset].imap.port), imapSecure: EMAIL_PRESETS[preset].imap.secure, smtpHost: EMAIL_PRESETS[preset].smtp.host, smtpPort: String(EMAIL_PRESETS[preset].smtp.port), smtpSecure: EMAIL_PRESETS[preset].smtp.secure })) }} />
            <Input label={t('settings.email.username')} value={emailForm.username} placeholder="name@example.com" onChange={(event) => { emailDirtyRef.current = true; setEmailForm((current) => ({ ...current, username: event.target.value })) }} />
            <Input label={t('settings.email.password')} type="password" value={emailForm.password} placeholder={emailStatus?.hasStoredPassword ? t('settings.email.passwordSaved') : t('settings.email.passwordPlaceholder')} helperText={t('settings.email.passwordHint')} onChange={(event) => { emailDirtyRef.current = true; setEmailForm((current) => ({ ...current, password: event.target.value })) }} />
          </div>
          <div className="grid gap-4 rounded-[20px] bg-[var(--color-panel-muted)] px-4 py-4 xl:grid-cols-2">
            <div className="space-y-3">
              <p className="text-[14px] font-semibold text-[var(--color-text)]">{t('settings.email.imapTitle')}</p>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
                <Input label={t('settings.email.imapHost')} value={emailForm.imapHost} onChange={(event) => { emailDirtyRef.current = true; setEmailForm((current) => ({ ...current, imapHost: event.target.value })) }} />
                <Input label={t('settings.email.imapPort')} inputMode="numeric" value={emailForm.imapPort} onChange={(event) => { emailDirtyRef.current = true; setEmailForm((current) => ({ ...current, imapPort: event.target.value })) }} />
              </div>
              <SettingsRow title={t('settings.email.imapSecure')} description={t('settings.email.imapSecureHint')}>
                <div className="flex justify-end">
                  <SettingsSwitch checked={emailForm.imapSecure} onClick={() => { emailDirtyRef.current = true; setEmailForm((current) => ({ ...current, imapSecure: !current.imapSecure })) }} ariaLabel={t('settings.email.imapSecure')} />
                </div>
              </SettingsRow>
            </div>
            <div className="space-y-3">
              <p className="text-[14px] font-semibold text-[var(--color-text)]">{t('settings.email.smtpTitle')}</p>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
                <Input label={t('settings.email.smtpHost')} value={emailForm.smtpHost} onChange={(event) => { emailDirtyRef.current = true; setEmailForm((current) => ({ ...current, smtpHost: event.target.value })) }} />
                <Input label={t('settings.email.smtpPort')} inputMode="numeric" value={emailForm.smtpPort} onChange={(event) => { emailDirtyRef.current = true; setEmailForm((current) => ({ ...current, smtpPort: event.target.value })) }} />
              </div>
              <SettingsRow title={t('settings.email.smtpSecure')} description={t('settings.email.smtpSecureHint')}>
                <div className="flex justify-end">
                  <SettingsSwitch checked={emailForm.smtpSecure} onClick={() => { emailDirtyRef.current = true; setEmailForm((current) => ({ ...current, smtpSecure: !current.smtpSecure })) }} ariaLabel={t('settings.email.smtpSecure')} />
                </div>
              </SettingsRow>
            </div>
          </div>
          <p className="text-[12px] leading-5 text-[var(--color-text-muted)]">{t('settings.email.securityHint')}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" loading={emailBusy === 'saving'} onClick={() => onSaveEmailConfig({ preset: emailForm.preset, displayName: emailForm.displayName.trim() || undefined, emailAddress: emailForm.emailAddress.trim(), username: emailForm.username.trim(), password: emailForm.password.trim() || undefined, imap: { host: emailForm.imapHost.trim(), port: Number.parseInt(emailForm.imapPort, 10) || 993, secure: emailForm.imapSecure }, smtp: { host: emailForm.smtpHost.trim(), port: Number.parseInt(emailForm.smtpPort, 10) || 587, secure: emailForm.smtpSecure } })}>{t('settings.email.save')}</Button>
            <Button variant="secondary" disabled={emailStatus?.provider !== 'imap-smtp' || !emailStatus.configured} loading={emailBusy === 'clearing'} onClick={onClearEmailConfig}>{t('settings.email.clear')}</Button>
          </div>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard cardId="finance-account" icon={Landmark} title={t('settings.card.financeAccount')} description={t('settings.card.financeAccountDesc')}>
        <div className="space-y-4">
          {financeNotice.tone !== 'idle' && financeNotice.text ? <InlineNotice tone={financeNotice.tone === 'error' ? 'error' : 'success'} title={t('settings.finance.noticeTitle')}>{financeNotice.text}</InlineNotice> : null}
          <div className="grid gap-3 xl:grid-cols-4">
            <InfoTile label={t('settings.finance.connectedAccount')} value={financeStatus?.accountAlias || financeStatus?.accountMask || t('settings.connector.accountEmpty')} />
            <StatusTile label={t('settings.finance.providerLabel')} badge={getFinanceStatusBadge(financeStatus)} value={formatFinanceProvider(financeStatus)} />
            <InfoTile label={t('settings.finance.balanceLabel')} value={formatFinanceBalance(financeStatus)} />
            <InfoTile label={t('settings.finance.lastVerified')} value={financeStatus?.lastVerifiedAt ? new Date(financeStatus.lastVerifiedAt).toLocaleString() : t('settings.finance.lastVerifiedEmpty')} />
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            <SelectField id="settings-finance-preset" label={t('settings.finance.preset')} value={financeForm.preset} options={Object.entries(FINANCE_PRESETS).map(([value, preset]) => ({ value, label: preset.label }))} onChange={(value) => {
              const preset = value as FinanceAccountPreset
              financeDirtyRef.current = true
              setFinanceForm((current) => ({
                ...current,
                preset,
                apiBaseUrl: FINANCE_PRESETS[preset].apiBaseUrl || current.apiBaseUrl,
                providerLabel: FINANCE_PRESETS[preset].providerLabel || current.providerLabel,
              }))
            }} />
            <Input label={t('settings.finance.providerName')} value={financeForm.providerLabel} placeholder={t('settings.finance.providerNamePlaceholder')} onChange={(event) => { financeDirtyRef.current = true; setFinanceForm((current) => ({ ...current, providerLabel: event.target.value })) }} />
            <Input label={t('settings.finance.apiBaseUrl')} value={financeForm.apiBaseUrl} placeholder="https://testapi.openbanking.or.kr" helperText={t('settings.finance.apiBaseUrlHint')} onChange={(event) => { financeDirtyRef.current = true; setFinanceForm((current) => ({ ...current, apiBaseUrl: event.target.value })) }} />
            <Input label={t('settings.finance.accountAlias')} value={financeForm.accountAlias} placeholder={t('settings.finance.accountAliasPlaceholder')} onChange={(event) => { financeDirtyRef.current = true; setFinanceForm((current) => ({ ...current, accountAlias: event.target.value })) }} />
            <Input label={t('settings.finance.clientId')} value={financeForm.clientId} placeholder="client-id" onChange={(event) => { financeDirtyRef.current = true; setFinanceForm((current) => ({ ...current, clientId: event.target.value })) }} />
            <Input label={t('settings.finance.fintechUseNum')} value={financeForm.fintechUseNum} placeholder="199003B123456789012345" onChange={(event) => { financeDirtyRef.current = true; setFinanceForm((current) => ({ ...current, fintechUseNum: event.target.value })) }} />
            <Input label={t('settings.finance.userSeqNo')} value={financeForm.userSeqNo} placeholder={t('settings.finance.userSeqNoPlaceholder')} onChange={(event) => { financeDirtyRef.current = true; setFinanceForm((current) => ({ ...current, userSeqNo: event.target.value })) }} />
            <Input label={t('settings.finance.scope')} value={financeForm.scope} placeholder="inquiry transfer" onChange={(event) => { financeDirtyRef.current = true; setFinanceForm((current) => ({ ...current, scope: event.target.value })) }} />
            <Input label={t('settings.finance.accessToken')} type="password" value={financeForm.accessToken} placeholder={financeStatus?.hasStoredAccessToken ? t('settings.finance.accessTokenSaved') : t('settings.finance.accessTokenPlaceholder')} helperText={t('settings.finance.accessTokenHint')} onChange={(event) => { financeDirtyRef.current = true; setFinanceForm((current) => ({ ...current, accessToken: event.target.value })) }} />
            <Input label={t('settings.finance.refreshToken')} type="password" value={financeForm.refreshToken} placeholder={financeStatus?.hasStoredRefreshToken ? t('settings.finance.refreshTokenSaved') : t('settings.finance.refreshTokenPlaceholder')} helperText={t('settings.finance.refreshTokenHint')} onChange={(event) => { financeDirtyRef.current = true; setFinanceForm((current) => ({ ...current, refreshToken: event.target.value })) }} />
            <Input label={t('settings.finance.clientSecret')} type="password" value={financeForm.clientSecret} placeholder={financeStatus?.hasStoredClientSecret ? t('settings.finance.clientSecretSaved') : t('settings.finance.clientSecretPlaceholder')} helperText={t('settings.finance.clientSecretHint')} onChange={(event) => { financeDirtyRef.current = true; setFinanceForm((current) => ({ ...current, clientSecret: event.target.value })) }} />
          </div>
          <div className="grid gap-4 rounded-[20px] bg-[var(--color-panel-muted)] px-4 py-4 xl:grid-cols-2">
            <div className="space-y-3">
              <p className="text-[14px] font-semibold text-[var(--color-text)]">{t('settings.finance.transferTitle')}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label={t('settings.finance.contractAccountType')} value={financeForm.contractAccountType} onChange={(event) => { financeDirtyRef.current = true; setFinanceForm((current) => ({ ...current, contractAccountType: event.target.value })) }} />
                <Input label={t('settings.finance.contractAccountNum')} value={financeForm.contractAccountNum} onChange={(event) => { financeDirtyRef.current = true; setFinanceForm((current) => ({ ...current, contractAccountNum: event.target.value })) }} />
                <Input label={t('settings.finance.withdrawPassPhrase')} value={financeForm.withdrawPassPhrase} onChange={(event) => { financeDirtyRef.current = true; setFinanceForm((current) => ({ ...current, withdrawPassPhrase: event.target.value })) }} />
                <Input label={t('settings.finance.withdrawPrintContent')} value={financeForm.withdrawPrintContent} onChange={(event) => { financeDirtyRef.current = true; setFinanceForm((current) => ({ ...current, withdrawPrintContent: event.target.value })) }} />
                <SelectField id="settings-finance-name-check-option" label={t('settings.finance.nameCheckOption')} value={financeForm.nameCheckOption} options={[{ value: 'off', label: t('settings.finance.nameCheckOptionOff') }, { value: 'on', label: t('settings.finance.nameCheckOptionOn') }]} onChange={(value) => { financeDirtyRef.current = true; setFinanceForm((current) => ({ ...current, nameCheckOption: value === 'on' ? 'on' : 'off' })) }} />
                <Input label={t('settings.finance.transferPurpose')} value={financeForm.transferPurpose} onChange={(event) => { financeDirtyRef.current = true; setFinanceForm((current) => ({ ...current, transferPurpose: event.target.value })) }} />
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-[14px] font-semibold text-[var(--color-text)]">{t('settings.finance.requestClientTitle')}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label={t('settings.finance.clientName')} value={financeForm.clientName} onChange={(event) => { financeDirtyRef.current = true; setFinanceForm((current) => ({ ...current, clientName: event.target.value })) }} />
                <Input label={t('settings.finance.clientIdentifier')} value={financeForm.clientIdentifier} onChange={(event) => { financeDirtyRef.current = true; setFinanceForm((current) => ({ ...current, clientIdentifier: event.target.value })) }} />
                <Input label={t('settings.finance.clientBankCode')} value={financeForm.clientBankCode} onChange={(event) => { financeDirtyRef.current = true; setFinanceForm((current) => ({ ...current, clientBankCode: event.target.value })) }} />
                <Input label={t('settings.finance.clientAccountNum')} value={financeForm.clientAccountNum} onChange={(event) => { financeDirtyRef.current = true; setFinanceForm((current) => ({ ...current, clientAccountNum: event.target.value })) }} />
              </div>
            </div>
          </div>
          <p className="text-[12px] leading-5 text-[var(--color-text-muted)]">{t('settings.finance.securityHint')}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" loading={financeBusy === 'saving'} onClick={() => onSaveFinanceConfig({
              preset: financeForm.preset,
              apiBaseUrl: financeForm.apiBaseUrl.trim(),
              clientId: financeForm.clientId.trim(),
              clientSecret: financeForm.clientSecret.trim() || undefined,
              accessToken: financeForm.accessToken.trim() || undefined,
              refreshToken: financeForm.refreshToken.trim() || undefined,
              fintechUseNum: financeForm.fintechUseNum.trim(),
              userSeqNo: financeForm.userSeqNo.trim() || undefined,
              scope: financeForm.scope.trim() || undefined,
              accountAlias: financeForm.accountAlias.trim() || undefined,
              providerLabel: financeForm.providerLabel.trim() || undefined,
              transferDefaults: {
                contractAccountType: financeForm.contractAccountType.trim() || undefined,
                contractAccountNum: financeForm.contractAccountNum.trim() || undefined,
                withdrawPassPhrase: financeForm.withdrawPassPhrase.trim() || undefined,
                withdrawPrintContent: financeForm.withdrawPrintContent.trim() || undefined,
                clientName: financeForm.clientName.trim() || undefined,
                clientBankCode: financeForm.clientBankCode.trim() || undefined,
                clientAccountNum: financeForm.clientAccountNum.trim() || undefined,
                clientIdentifier: financeForm.clientIdentifier.trim() || undefined,
                nameCheckOption: financeForm.nameCheckOption,
                transferPurpose: financeForm.transferPurpose.trim() || undefined,
              },
            })}>{t('settings.finance.save')}</Button>
            <Button variant="secondary" disabled={financeStatus?.provider === 'none' || !financeStatus?.configured} loading={financeBusy === 'clearing'} onClick={onClearFinanceConfig}>{t('settings.finance.clear')}</Button>
          </div>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard cardId="government-public-data" icon={Building2} title={t('settings.card.publicDataAccount')} description={t('settings.card.publicDataAccountDesc')}>
        <div className="space-y-4">
          {publicDataNotice.tone !== 'idle' && publicDataNotice.text ? <InlineNotice tone={publicDataNotice.tone === 'error' ? 'error' : 'success'} title={t('settings.publicData.noticeTitle')}>{publicDataNotice.text}</InlineNotice> : null}
          <div className="grid gap-3 xl:grid-cols-4">
            <StatusTile label={t('settings.publicData.providerLabel')} badge={getPublicDataStatusBadge(publicDataStatus)} value={formatPublicDataProvider(publicDataStatus)} />
            <InfoTile label={t('settings.publicData.serviceName')} value={publicDataStatus?.serviceName || t('settings.publicData.serviceNameEmpty')} />
            <InfoTile label={t('settings.publicData.defaultPath')} value={publicDataStatus?.defaultPath || t('settings.publicData.defaultPathEmpty')} />
            <InfoTile label={t('settings.publicData.lastVerified')} value={publicDataStatus?.lastVerifiedAt ? new Date(publicDataStatus.lastVerifiedAt).toLocaleString() : t('settings.publicData.lastVerifiedEmpty')} />
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            <SelectField id="settings-public-data-preset" label={t('settings.publicData.preset')} value={publicDataForm.preset} options={Object.entries(PUBLIC_DATA_PRESETS).map(([value, preset]) => ({ value, label: preset.label }))} onChange={(value) => {
              const preset = value as PublicDataAccountPreset
              publicDataDirtyRef.current = true
              setPublicDataForm((current) => ({
                ...current,
                preset,
                apiBaseUrl: PUBLIC_DATA_PRESETS[preset].apiBaseUrl || current.apiBaseUrl,
                authMode: PUBLIC_DATA_PRESETS[preset].authMode,
                providerLabel: PUBLIC_DATA_PRESETS[preset].providerLabel || current.providerLabel,
                serviceName: PUBLIC_DATA_PRESETS[preset].serviceName || current.serviceName,
                defaultPath: PUBLIC_DATA_PRESETS[preset].defaultPath || current.defaultPath,
                defaultFormat: PUBLIC_DATA_PRESETS[preset].defaultFormat,
              }))
            }} />
            <Input label={t('settings.publicData.providerName')} value={publicDataForm.providerLabel} placeholder={t('settings.publicData.providerNamePlaceholder')} onChange={(event) => { publicDataDirtyRef.current = true; setPublicDataForm((current) => ({ ...current, providerLabel: event.target.value })) }} />
            <Input label={t('settings.publicData.apiBaseUrl')} value={publicDataForm.apiBaseUrl} placeholder="https://api.odcloud.kr" helperText={t('settings.publicData.apiBaseUrlHint')} onChange={(event) => { publicDataDirtyRef.current = true; setPublicDataForm((current) => ({ ...current, apiBaseUrl: event.target.value })) }} />
            <SelectField id="settings-public-data-auth-mode" label={t('settings.publicData.authMode')} value={publicDataForm.authMode} options={[{ value: 'query', label: t('settings.publicData.authModeQuery') }, { value: 'header', label: t('settings.publicData.authModeHeader') }, { value: 'both', label: t('settings.publicData.authModeBoth') }]} onChange={(value) => { publicDataDirtyRef.current = true; setPublicDataForm((current) => ({ ...current, authMode: value as PublicDataAuthMode })) }} />
            <Input label={t('settings.publicData.serviceName')} value={publicDataForm.serviceName} placeholder={t('settings.publicData.serviceNamePlaceholder')} onChange={(event) => { publicDataDirtyRef.current = true; setPublicDataForm((current) => ({ ...current, serviceName: event.target.value })) }} />
            <Input label={t('settings.publicData.defaultPath')} value={publicDataForm.defaultPath} placeholder="/api/nts-businessman/v1/status" helperText={t('settings.publicData.defaultPathHint')} onChange={(event) => { publicDataDirtyRef.current = true; setPublicDataForm((current) => ({ ...current, defaultPath: event.target.value })) }} />
            <SelectField id="settings-public-data-default-format" label={t('settings.publicData.defaultFormat')} value={publicDataForm.defaultFormat} options={[{ value: 'json', label: 'JSON' }, { value: 'xml', label: 'XML' }]} onChange={(value) => { publicDataDirtyRef.current = true; setPublicDataForm((current) => ({ ...current, defaultFormat: value as PublicDataFormat })) }} />
            <Input label={t('settings.publicData.serviceKey')} type="password" value={publicDataForm.serviceKey} placeholder={publicDataStatus?.hasStoredServiceKey ? t('settings.publicData.serviceKeySaved') : t('settings.publicData.serviceKeyPlaceholder')} helperText={t('settings.publicData.serviceKeyHint')} onChange={(event) => { publicDataDirtyRef.current = true; setPublicDataForm((current) => ({ ...current, serviceKey: event.target.value })) }} />
          </div>
          <p className="text-[12px] leading-5 text-[var(--color-text-muted)]">{t('settings.publicData.securityHint')}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" loading={publicDataBusy === 'saving'} onClick={() => onSavePublicDataConfig({
              preset: publicDataForm.preset,
              apiBaseUrl: publicDataForm.apiBaseUrl.trim(),
              serviceKey: publicDataForm.serviceKey.trim() || undefined,
              authMode: publicDataForm.authMode,
              providerLabel: publicDataForm.providerLabel.trim() || undefined,
              serviceName: publicDataForm.serviceName.trim() || undefined,
              defaultPath: publicDataForm.defaultPath.trim() || undefined,
              defaultFormat: publicDataForm.defaultFormat,
            })}>{t('settings.publicData.save')}</Button>
            <Button variant="secondary" disabled={publicDataStatus?.provider === 'none' || !publicDataStatus?.configured} loading={publicDataBusy === 'clearing'} onClick={onClearPublicDataConfig}>{t('settings.publicData.clear')}</Button>
          </div>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard cardId="tax-service" icon={FileBadge2} title={t('settings.card.taxAccount')} description={t('settings.card.taxAccountDesc')}>
        <div className="space-y-4">
          {taxNotice.tone !== 'idle' && taxNotice.text ? <InlineNotice tone={taxNotice.tone === 'error' ? 'error' : 'success'} title={t('settings.tax.noticeTitle')}>{taxNotice.text}</InlineNotice> : null}
          <div className="grid gap-3 xl:grid-cols-4">
            <StatusTile label={t('settings.tax.providerLabel')} badge={getTaxStatusBadge(taxStatus)} value={formatTaxProvider(taxStatus)} />
            <InfoTile label={t('settings.tax.corporationNumber')} value={taxStatus?.corporationNumber || t('settings.tax.corporationNumberEmpty')} />
            <InfoTile label={t('settings.tax.businessStatePath')} value={taxStatus?.businessStatePath || t('settings.tax.pathEmpty')} />
            <InfoTile label={t('settings.tax.lastVerified')} value={taxStatus?.lastVerifiedAt ? new Date(taxStatus.lastVerifiedAt).toLocaleString() : t('settings.tax.lastVerifiedEmpty')} />
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            <SelectField id="settings-tax-preset" label={t('settings.tax.preset')} value={taxForm.preset} options={Object.entries(TAX_PRESETS).map(([value, preset]) => ({ value, label: preset.label }))} onChange={(value) => {
              const preset = value as TaxServicePreset
              taxDirtyRef.current = true
              setTaxForm((current) => ({
                ...current,
                preset,
                apiBaseUrl: TAX_PRESETS[preset].apiBaseUrl || current.apiBaseUrl,
                authMode: TAX_PRESETS[preset].authMode,
                providerLabel: TAX_PRESETS[preset].providerLabel || current.providerLabel,
              }))
            }} />
            <Input label={t('settings.tax.providerName')} value={taxForm.providerLabel} placeholder={t('settings.tax.providerNamePlaceholder')} onChange={(event) => { taxDirtyRef.current = true; setTaxForm((current) => ({ ...current, providerLabel: event.target.value })) }} />
            <Input label={t('settings.tax.apiBaseUrl')} value={taxForm.apiBaseUrl} placeholder="https://api.barobill.co.kr" helperText={t('settings.tax.apiBaseUrlHint')} onChange={(event) => { taxDirtyRef.current = true; setTaxForm((current) => ({ ...current, apiBaseUrl: event.target.value })) }} />
            <SelectField id="settings-tax-auth-mode" label={t('settings.tax.authMode')} value={taxForm.authMode} options={[{ value: 'header', label: t('settings.tax.authModeHeader') }, { value: 'bearer', label: t('settings.tax.authModeBearer') }, { value: 'query', label: t('settings.tax.authModeQuery') }]} onChange={(value) => { taxDirtyRef.current = true; setTaxForm((current) => ({ ...current, authMode: value as TaxServiceAuthMode })) }} />
            <Input label={t('settings.tax.memberId')} value={taxForm.memberId} placeholder={t('settings.tax.memberIdPlaceholder')} onChange={(event) => { taxDirtyRef.current = true; setTaxForm((current) => ({ ...current, memberId: event.target.value })) }} />
            <Input label={t('settings.tax.corporationNumber')} value={taxForm.corporationNumber} placeholder="1234567890" onChange={(event) => { taxDirtyRef.current = true; setTaxForm((current) => ({ ...current, corporationNumber: event.target.value })) }} />
            <Input label={t('settings.tax.userId')} value={taxForm.userId} placeholder={t('settings.tax.userIdPlaceholder')} onChange={(event) => { taxDirtyRef.current = true; setTaxForm((current) => ({ ...current, userId: event.target.value })) }} />
            <Input label={t('settings.tax.apiKey')} type="password" value={taxForm.apiKey} placeholder={taxStatus?.hasStoredApiKey ? t('settings.tax.apiKeySaved') : t('settings.tax.apiKeyPlaceholder')} helperText={t('settings.tax.apiKeyHint')} onChange={(event) => { taxDirtyRef.current = true; setTaxForm((current) => ({ ...current, apiKey: event.target.value })) }} />
            <Input label={t('settings.tax.businessStatePath')} value={taxForm.businessStatePath} placeholder="/corp-state" helperText={t('settings.tax.businessStatePathHint')} onChange={(event) => { taxDirtyRef.current = true; setTaxForm((current) => ({ ...current, businessStatePath: event.target.value })) }} />
            <Input label={t('settings.tax.hometaxPath')} value={taxForm.hometaxPath} placeholder="/hometax/sales-purchase" helperText={t('settings.tax.hometaxPathHint')} onChange={(event) => { taxDirtyRef.current = true; setTaxForm((current) => ({ ...current, hometaxPath: event.target.value })) }} />
            <Input label={t('settings.tax.taxInvoicePath')} value={taxForm.taxInvoicePath} placeholder="/taxinvoice/list" helperText={t('settings.tax.taxInvoicePathHint')} onChange={(event) => { taxDirtyRef.current = true; setTaxForm((current) => ({ ...current, taxInvoicePath: event.target.value })) }} />
          </div>
          <p className="text-[12px] leading-5 text-[var(--color-text-muted)]">{t('settings.tax.securityHint')}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" loading={taxBusy === 'saving'} onClick={() => onSaveTaxConfig({
              preset: taxForm.preset,
              apiBaseUrl: taxForm.apiBaseUrl.trim(),
              apiKey: taxForm.apiKey.trim() || undefined,
              authMode: taxForm.authMode,
              providerLabel: taxForm.providerLabel.trim() || undefined,
              memberId: taxForm.memberId.trim() || undefined,
              corporationNumber: taxForm.corporationNumber.trim() || undefined,
              userId: taxForm.userId.trim() || undefined,
              businessStatePath: taxForm.businessStatePath.trim() || undefined,
              hometaxPath: taxForm.hometaxPath.trim() || undefined,
              taxInvoicePath: taxForm.taxInvoicePath.trim() || undefined,
            })}>{t('settings.tax.save')}</Button>
            <Button variant="secondary" disabled={taxStatus?.provider === 'none' || !taxStatus?.configured} loading={taxBusy === 'clearing'} onClick={onClearTaxConfig}>{t('settings.tax.clear')}</Button>
          </div>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard cardId="connected-services" icon={Link2} title={t('settings.card.connectedServices')} description={t('settings.card.connectedServicesDesc')} action={<IconButton icon={RefreshCw} size="sm" label={t('settings.refreshModels')} onClick={onRefreshModels} disabled={loadingModels} className={loadingModels ? '[&>svg]:animate-spin' : ''} />}>
        {providerEntries.length > 0 ? <div className="grid gap-3 sm:grid-cols-3">{providerEntries.map(([provider, count]) => <div key={provider} className="rounded-[18px] bg-[var(--color-panel-muted)] px-4 py-4"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{provider}</p><p className="mt-2 text-[20px] font-semibold text-[var(--color-text)]">{count}</p><p className="mt-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">{t('settings.connectedServicesCountLabel')}</p></div>)}</div> : <InlineNotice tone="info" title={t('settings.connectedServicesEmptyTitle')}>{loadingModels ? t('settings.loadingModels') : t('settings.connectedServicesEmptyBody')}</InlineNotice>}
      </SettingsSectionCard>

      <SettingsSectionCard cardId="browser-hooks" icon={Globe2} title={t('settings.card.browserHooks')} description={t('settings.card.browserHooksDesc')}>
        <SettingsRow title={t('settings.passwordAutoImportTitle')} description={t('settings.passwordAutoImportHint')}>
          <div className="space-y-3">
            <div className="flex justify-end">
              <SettingsSwitch checked={browserCredentialAutoImportEnabled} onClick={onToggleBrowserCredentialAutoImport} ariaLabel={t('settings.passwordAutoImportTitle')} />
            </div>
            <p className="text-[12px] leading-5 text-[var(--color-text-muted)]">{t('settings.passwordAutoImportInstallHint')}</p>
          </div>
        </SettingsRow>
      </SettingsSectionCard>
    </div>
  )
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[18px] bg-[var(--color-panel-muted)] px-4 py-4"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</p><p className="mt-2 text-[13px] leading-6 text-[var(--color-text)]">{value}</p></div>
}

function StatusTile({ label, badge, value }: { label: string; badge: { variant: 'success' | 'warning' | 'default'; label: string }; value: string }) {
  return <div className="rounded-[18px] bg-[var(--color-panel-muted)] px-4 py-4"><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">{label}</p><div className="mt-2 flex items-center gap-2"><Badge variant={badge.variant}>{badge.label}</Badge><span className="text-[13px] text-[var(--color-text-secondary)]">{value}</span></div></div>
}

function SelectField({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return <div className="flex flex-col gap-2"><label htmlFor={id} className="text-[13px] font-semibold leading-5 text-[var(--color-text-secondary)]">{label}</label><select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="h-12 w-full rounded-[var(--radius-lg)] bg-[var(--color-bg-card)] px-4 text-[14px] text-[var(--color-text)] ring-1 ring-[var(--color-border)] shadow-[var(--shadow-xs)] focus:outline-none focus:ring-[var(--color-primary)]">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
}

function getStatusBadge(status: ExternalOAuthStatus | null): { variant: 'success' | 'warning' | 'default'; label: string } {
  if (!status?.configured) return { variant: 'warning', label: t('settings.connector.statusNeedsConfig') }
  if (status.authenticated) return { variant: 'success', label: t('settings.connector.statusConnected') }
  return { variant: 'default', label: t('settings.connector.statusDisconnected') }
}

function getCalendarStatusBadge(status: CalendarAccountStatus | null): { variant: 'success' | 'warning' | 'default'; label: string } {
  if (!status?.configured) return { variant: 'warning', label: t('settings.calendar.statusNeedsConfig') }
  if (status.provider === 'caldav') return { variant: 'success', label: t('settings.calendar.statusConnected') }
  return { variant: 'default', label: t('settings.calendar.statusOauth') }
}

function getEmailStatusBadge(status: EmailAccountStatus | null): { variant: 'success' | 'warning' | 'default'; label: string } {
  if (!status?.configured) return { variant: 'warning', label: t('settings.email.statusNeedsConfig') }
  if (status.provider === 'imap-smtp') return { variant: 'success', label: t('settings.email.statusConnected') }
  return { variant: 'default', label: t('settings.email.statusOauth') }
}

function getFinanceStatusBadge(status: FinanceAccountStatus | null): { variant: 'success' | 'warning' | 'default'; label: string } {
  if (!status?.configured) return { variant: 'warning', label: t('settings.finance.statusNeedsConfig') }
  return { variant: 'success', label: t('settings.finance.statusConnected') }
}

function getPublicDataStatusBadge(status: PublicDataAccountStatus | null): { variant: 'success' | 'warning' | 'default'; label: string } {
  if (!status?.configured) return { variant: 'warning', label: t('settings.publicData.statusNeedsConfig') }
  if (status.lastVerifiedAt) return { variant: 'success', label: t('settings.publicData.statusVerified') }
  return { variant: 'default', label: t('settings.publicData.statusSaved') }
}

function getTaxStatusBadge(status: TaxAccountStatus | null): { variant: 'success' | 'warning' | 'default'; label: string } {
  if (!status?.configured) return { variant: 'warning', label: t('settings.tax.statusNeedsConfig') }
  if (status.lastVerifiedAt) return { variant: 'success', label: t('settings.tax.statusVerified') }
  return { variant: 'default', label: t('settings.tax.statusSaved') }
}

function formatScopes(scopes?: string[]): string {
  if (!scopes || scopes.length === 0) return t('settings.connector.scopeEmpty')
  const preview = scopes.slice(0, 3).join(', ')
  return scopes.length > 3 ? `${preview} +${scopes.length - 3}` : preview
}

function formatCalendarProvider(provider: CalendarAccountStatus['provider']): string {
  if (provider === 'caldav') return 'CalDAV'
  if (provider === 'google') return 'Google OAuth'
  if (provider === 'microsoft') return 'Microsoft OAuth'
  return t('settings.calendar.providerEmpty')
}

function formatEmailProvider(provider: EmailAccountStatus['provider']): string {
  if (provider === 'imap-smtp') return 'IMAP/SMTP'
  if (provider === 'google') return 'Google OAuth'
  if (provider === 'microsoft') return 'Microsoft OAuth'
  return t('settings.email.providerEmpty')
}

function formatFinanceProvider(status: FinanceAccountStatus | null): string {
  if (status?.providerLabel?.trim()) return status.providerLabel
  if (status?.provider === 'open-banking') return 'Open Banking'
  if (status?.provider === 'mydata') return 'MyData-compatible'
  return t('settings.finance.providerEmpty')
}

function formatFinanceBalance(status: FinanceAccountStatus | null): string {
  if (!status?.lastBalance) return t('settings.finance.balanceEmpty')
  return `${status.lastBalance} ${status.currency || 'KRW'}`
}

function formatPublicDataProvider(status: PublicDataAccountStatus | null): string {
  if (status?.providerLabel?.trim()) return status.providerLabel
  if (status?.provider === 'odcloud') return 'odcloud'
  if (status?.provider === 'data-go-kr') return 'data.go.kr'
  return t('settings.publicData.providerEmpty')
}

function formatTaxProvider(status: TaxAccountStatus | null): string {
  if (status?.providerLabel?.trim()) return status.providerLabel
  if (status?.provider === 'barobill') return 'Barobill'
  return t('settings.tax.providerEmpty')
}
