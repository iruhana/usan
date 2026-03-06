import { useState, useEffect, useCallback, useId } from 'react'
import {
  Type,
  Sun,
  Moon,
  Volume2,
  Cpu,
  Palette,
  RefreshCw,
  Languages,
  Power,
  Settings,
  Loader2,
  ShieldCheck,
  Download,
  KeyRound,
  Trash2,
} from 'lucide-react'
import type { CredentialVaultSummary, ModelInfo, UpdaterStatus } from '@shared/types/ipc'
import { useSettingsStore } from '../stores/settings.store'
import { useSafetyStore } from '../stores/safety.store'
import { t } from '../i18n'
import type { Locale } from '../i18n'
import { DEFAULT_SETTINGS_TAB, type SettingsTab } from '../constants/settings'
import { Card, SectionHeader, Button, IconButton, InlineNotice } from '../components/ui'
import { toTechnicalErrorDetails, toUpdaterErrorMessage } from '../lib/user-facing-errors'

const LANGUAGES: Array<{ id: Locale; label: string; code: string }> = [
  { id: 'ko', label: 'Korean', code: 'KO' },
  { id: 'en', label: 'English', code: 'EN' },
  { id: 'ja', label: 'Japanese', code: 'JA' },
]
const TABS: Array<{ id: SettingsTab; labelKey: string; icon: typeof Palette }> = [
  { id: 'display', labelKey: 'settings.group.display', icon: Palette },
  { id: 'sound', labelKey: 'settings.group.sound', icon: Volume2 },
  { id: 'system', labelKey: 'settings.group.system', icon: Settings },
  { id: 'advanced', labelKey: 'settings.group.advanced', icon: Cpu },
]

interface SettingsPageProps {
  requestedTab?: SettingsTab
  requestedTabNonce?: number
}

const PROFILE_OPTIONS = [
  { id: 'full' as const, labelKey: 'settings.permissionProfileFull', descKey: 'settings.permissionProfileFullDesc' },
  { id: 'balanced' as const, labelKey: 'settings.permissionProfileBalanced', descKey: 'settings.permissionProfileBalancedDesc' },
  { id: 'strict' as const, labelKey: 'settings.permissionProfileStrict', descKey: 'settings.permissionProfileStrictDesc' },
]

export default function SettingsPage({ requestedTab, requestedTabNonce = 0 }: SettingsPageProps) {
  const { settings, update: updateStore } = useSettingsStore()
  const requestConfirmation = useSafetyStore((s) => s.requestConfirmation)
  const [activeTab, setActiveTab] = useState<SettingsTab>(requestedTab ?? DEFAULT_SETTINGS_TAB)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatus | null>(null)
  const [updaterBusy, setUpdaterBusy] = useState<'idle' | 'checking' | 'downloading' | 'installing'>('idle')
  const [credentialSummary, setCredentialSummary] = useState<CredentialVaultSummary | null>(null)
  const [credentialBusy, setCredentialBusy] = useState<'idle' | 'importing' | 'clearing'>('idle')
  const [credentialNotice, setCredentialNotice] = useState<{ tone: 'idle' | 'success' | 'error'; text: string; kind: 'import' | 'clear' | null }>({
    tone: 'idle',
    text: '',
    kind: null,
  })
  const fontScaleId = useId()
  const voiceSpeedId = useId()

  const fontScale = settings.fontScale
  const highContrast = settings.highContrast
  const voiceEnabled = settings.voiceEnabled
  const voiceOverlayEnabled = settings.voiceOverlayEnabled
  const voiceSpeed = settings.voiceSpeed
  const theme = settings.theme as 'light' | 'dark' | 'system'
  const updateChannel = settings.updateChannel
  const autoDownloadUpdates = settings.autoDownloadUpdates
  const permissionProfile = settings.permissionProfile
  const beginnerMode = settings.beginnerMode
  const advancedMenusEnabled = !beginnerMode
  const browserCredentialAutoImportEnabled = settings.browserCredentialAutoImportEnabled
  const updaterBusyAny = updaterBusy !== 'idle'
  const visibleTabs = TABS

  const updateStatusTone =
    updaterBusy === 'checking'
      ? 'text-[var(--color-warning)] bg-[var(--color-warning)]/10 border-[var(--color-warning)]/20'
      : updaterStatus?.lastError
        ? 'text-[var(--color-danger)] bg-[var(--color-danger)]/10 border-[var(--color-danger)]/20'
        : updaterStatus?.downloadedVersion
          ? 'text-[var(--color-success)] bg-[var(--color-success)]/10 border-[var(--color-success)]/20'
          : updaterStatus?.updateAvailableVersion
            ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10 border-[var(--color-primary)]/20'
            : 'text-[var(--color-text-muted)] bg-[var(--color-surface-soft)] border-[var(--color-border)]/60'

  const updateStatusText =
    updaterBusy === 'checking'
      ? t('settings.updateChecking')
      : updaterStatus?.lastError
        ? t('settings.updateError')
        : updaterStatus?.downloadedVersion
          ? t('settings.updateReady')
          : updaterStatus?.updateAvailableVersion
            ? t('settings.updateAvailable')
          : t('settings.updateUpToDate')
  const updaterFriendlyError = toUpdaterErrorMessage(updaterStatus?.lastError)
  const updaterTechnicalDetails = toTechnicalErrorDetails(updaterStatus?.lastError)
  const updaterSummaryNotice = getUpdaterSummaryNotice(updaterBusy, updaterStatus, updaterFriendlyError)

  const loadModels = useCallback(async () => {
    setLoadingModels(true)
    try {
      const list = await window.usan?.ai.models()
      if (list) setModels(list as ModelInfo[])
    } catch {
      // ignore
    }
    setLoadingModels(false)
  }, [])

  const refreshUpdaterStatus = useCallback(async () => {
    try {
      const next = await window.usan?.updates.status()
      if (next) setUpdaterStatus(next)
    } catch {
      // ignore
    }
  }, [])

  const refreshCredentialSummary = useCallback(async () => {
    try {
      const summary = await window.usan?.credentials.getSummary()
      if (summary) setCredentialSummary(summary)
    } catch {
      // ignore
    }
  }, [])

  const runUpdaterAction = useCallback(async (action: 'checking' | 'downloading' | 'installing') => {
    setUpdaterBusy(action)
    try {
      if (action === 'checking') {
        const next = await window.usan?.updates.checkNow()
        if (next) setUpdaterStatus(next)
      } else if (action === 'downloading') {
        const next = await window.usan?.updates.download()
        if (next) setUpdaterStatus(next)
      } else {
        await window.usan?.updates.install()
      }
    } catch {
      // ignore
    } finally {
      setUpdaterBusy('idle')
    }
  }, [])

  const handleImportCredentials = useCallback(async () => {
    setCredentialBusy('importing')
    setCredentialNotice({ tone: 'idle', text: '', kind: 'import' })
    try {
      const result = await window.usan?.credentials.importBrowserCsv()
      if (!result) return
      const msg = t('settings.passwordImportResult')
        .replace('{imported}', String(result.importedCount))
        .replace('{skipped}', String(result.skippedCount))
      setCredentialNotice({ tone: 'success', text: msg, kind: 'import' })
      await refreshCredentialSummary()
    } catch {
      setCredentialNotice({ tone: 'error', text: t('settings.passwordImportFailed'), kind: 'import' })
    } finally {
      setCredentialBusy('idle')
    }
  }, [refreshCredentialSummary])

  const handleClearCredentials = useCallback(async () => {
    const confirmed = await requestConfirmation({
      title: t('settings.passwordVaultClearTitle'),
      summary: [
        t('settings.passwordVaultClearSummarySaved'),
        t('settings.passwordVaultClearSummaryBrowser'),
      ],
      rollback: [t('settings.passwordVaultClearRollback')],
      actionId: 'settings.passwordVaultClear',
    })

    if (!confirmed) {
      return
    }

    setCredentialBusy('clearing')
    setCredentialNotice({ tone: 'idle', text: '', kind: 'clear' })
    try {
      await window.usan?.credentials.clear()
      setCredentialNotice({ tone: 'success', text: t('settings.passwordVaultCleared'), kind: 'clear' })
      await refreshCredentialSummary()
    } catch {
      setCredentialNotice({ tone: 'error', text: t('settings.passwordClearFailed'), kind: 'clear' })
    } finally {
      setCredentialBusy('idle')
    }
  }, [refreshCredentialSummary, requestConfirmation])

  useEffect(() => {
    loadModels()
    refreshUpdaterStatus()
    refreshCredentialSummary()
  }, [loadModels, refreshUpdaterStatus, refreshCredentialSummary])

  useEffect(() => {
    if (requestedTab) {
      setActiveTab(requestedTab)
    }
  }, [requestedTab, requestedTabNonce])

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark')
    if (theme === 'dark') {
      root.classList.add('dark')
    } else if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      if (mq.matches) root.classList.add('dark')
      const handler = (e: MediaQueryListEvent) => {
        root.classList.toggle('dark', e.matches)
      }
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])

  const updateFontScale = (val: number) => {
    updateStore({ fontScale: val })
  }

  const toggleHighContrast = () => {
    const next = !highContrast
    document.documentElement.classList.toggle('high-contrast', next)
    updateStore({ highContrast: next })
  }

  const updateTheme = (newTheme: 'light' | 'dark' | 'system') => {
    updateStore({ theme: newTheme })
  }

  const formatImportedAt = (ts: number) => new Date(ts).toLocaleString()

  return (
    <div className="max-w-lg mx-auto p-8">
      {/* Header */}
      <div className="mb-6 pb-4 border-b border-[var(--color-border)]">
        <h1 className="font-semibold tracking-tight text-[length:var(--text-xl)] text-[var(--color-text)]">
          {t('settings.title')}
        </h1>
        <p className="text-[length:var(--text-md)] text-[var(--color-text-muted)] mt-1">
          {t('settings.subtitle')}
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 p-1 rounded-[var(--radius-lg)] bg-[var(--color-surface-soft)]" role="tablist" aria-label={t('settings.title')}>
        {visibleTabs.map((tab, index) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              id={`settings-tab-${tab.id}`}
              data-settings-tab={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`settings-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => {
                if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
                  return
                }

                event.preventDefault()
                let nextIndex = index
                if (event.key === 'Home') {
                  nextIndex = 0
                } else if (event.key === 'End') {
                  nextIndex = visibleTabs.length - 1
                } else if (event.key === 'ArrowRight') {
                  nextIndex = (index + 1) % visibleTabs.length
                } else if (event.key === 'ArrowLeft') {
                  nextIndex = (index - 1 + visibleTabs.length) % visibleTabs.length
                }

                const nextTab = visibleTabs[nextIndex]?.id ?? tab.id
                setActiveTab(nextTab)
                requestAnimationFrame(() => {
                  document.querySelector<HTMLButtonElement>(`[data-settings-tab="${nextTab}"]`)?.focus()
                })
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius-md)] text-[length:var(--text-sm)] font-medium transition-all ${
                isActive
                  ? 'bg-[var(--color-bg-card)] text-[var(--color-text)] shadow-[var(--shadow-sm)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
              }`}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{t(tab.labelKey)}</span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-6">
        {/* ?? Display ?? */}
        {activeTab === 'display' && <section role="tabpanel" id="settings-panel-display" aria-labelledby="settings-tab-display">
          <SectionHeader title={t('settings.group.display')} icon={Palette} />
          <div className="flex flex-col gap-3">

            {/* Language */}
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Languages size={18} className="text-[var(--color-primary)]" />
                <h3 className="text-[length:var(--text-md)] font-medium">{t('settings.language')}</h3>
              </div>
              <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)] mb-3">
                {t('settings.languageHint')}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {LANGUAGES.map((lang) => {
                  const isActive = settings.locale === lang.id
                  return (
                    <button
                      key={lang.id}
                      onClick={() => updateStore({ locale: lang.id })}
                      className={`flex flex-col items-center justify-center gap-2 py-3 rounded-[var(--radius-md)] transition-all ${
                        isActive
                          ? 'bg-[var(--color-primary)] text-[var(--color-text-inverse)] shadow-[var(--shadow-md)]'
                          : 'bg-[var(--color-surface-soft)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-card)]'
                      }`}
                    >
                      <span className="text-[length:var(--text-xs)] leading-none font-semibold tracking-wide">{lang.code}</span>
                      <span className="text-[length:var(--text-sm)] font-medium">{lang.label}</span>
                    </button>
                  )
                })}
              </div>
            </Card>

            {/* Font Size */}
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Type size={18} className="text-[var(--color-primary)]" />
                <h3 className="text-[length:var(--text-md)] font-medium">{t('settings.fontSize')}</h3>
              </div>
              <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)] mb-3">
                {t('settings.fontSizeHint')}
              </p>
              <div className="flex items-center gap-3">
                <span className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('settings.fontSizeSmall')}</span>
                <input
                  id={fontScaleId}
                  type="range"
                  min={1}
                  max={2}
                  step={0.1}
                  value={fontScale}
                  onChange={(e) => updateFontScale(parseFloat(e.target.value))}
                  className="flex-1 h-2 accent-[var(--color-primary)] cursor-pointer rounded-full"
                  style={{ minHeight: '36px' }}
                  aria-label={t('settings.fontSize')}
                />
                <span className="text-[length:var(--text-lg)] text-[var(--color-text-muted)]">{t('settings.fontSizeLarge')}</span>
              </div>
              <div className="mt-3 p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] text-center">
                <span className="text-[var(--color-text)]" style={{ fontSize: `calc(14px * ${fontScale})` }}>
                  {t('settings.fontSizeCurrent')}: {Math.round(fontScale * 100)}%
                </span>
              </div>
            </Card>

            {/* Theme */}
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Palette size={18} className="text-[var(--color-primary)]" />
                <h3 className="text-[length:var(--text-md)] font-medium">{t('settings.theme')}</h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 'light' as const, label: t('settings.themeLight'), icon: Sun },
                  { id: 'dark' as const, label: t('settings.themeDark'), icon: Moon },
                  { id: 'system' as const, label: t('settings.themeSystem'), icon: Settings },
                ]).map((item) => {
                  const Icon = item.icon
                  const isActive = theme === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => updateTheme(item.id)}
                      className={`flex flex-col items-center gap-2 py-3 rounded-[var(--radius-md)] transition-all ${
                        isActive
                          ? 'bg-[var(--color-primary)] text-[var(--color-text-inverse)] shadow-[var(--shadow-md)]'
                          : 'bg-[var(--color-surface-soft)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-card)]'
                      }`}
                    >
                      <Icon size={18} />
                      <span className="text-[length:var(--text-sm)] font-medium">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </Card>

            {/* High Contrast */}
            <Card>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] flex items-center justify-center shrink-0">
                    {highContrast ? (
                      <Moon size={18} className="text-[var(--color-primary)]" />
                    ) : (
                      <Sun size={18} className="text-[var(--color-primary)]" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-[length:var(--text-md)] font-medium">{t('settings.highContrast')}</h3>
                    <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                      {t('settings.highContrastHint')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={toggleHighContrast}
                  className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${
                    highContrast ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
                  }`}
                  role="switch"
                  aria-checked={highContrast}
                  aria-label={t('settings.highContrast')}
                >
                  <span
                    className={`absolute top-[2px] left-[2px] w-4 h-4 rounded-full bg-[var(--color-text-inverse)] shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_1px_rgba(0,0,0,0.06)] transition-transform ${
                      highContrast ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </Card>

            {/* Enter key behavior */}
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[length:var(--text-md)] font-medium">{t('settings.enterToSendTitle')}</h3>
                  <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)] mt-1">
                    {settings.enterToSend ? t('settings.enterToSendOnHint') : t('settings.enterToSendOffHint')}
                  </p>
                </div>
                <button
                  onClick={() => updateStore({ enterToSend: !settings.enterToSend })}
                  className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${
                    settings.enterToSend ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
                  }`}
                  role="switch"
                  aria-checked={settings.enterToSend}
                  aria-label={t('settings.enterToSendTitle')}
                >
                  <span
                    className={`absolute top-[2px] left-[2px] w-4 h-4 rounded-full bg-[var(--color-text-inverse)] shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_1px_rgba(0,0,0,0.06)] transition-transform ${
                      settings.enterToSend ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </Card>

          </div>
        </section>}

        {/* ?? Sound ?? */}
        {activeTab === 'sound' && <section role="tabpanel" id="settings-panel-sound" aria-labelledby="settings-tab-sound">
          <SectionHeader title={t('settings.group.sound')} icon={Volume2} />
          <div className="flex flex-col gap-3">

            {/* Voice */}
            <Card data-settings-card="voice">
              <div className="flex items-center gap-2 mb-3">
                <Volume2 size={18} className="text-[var(--color-primary)]" />
                <h3 className="text-[length:var(--text-md)] font-medium">{t('settings.voice')}</h3>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[length:var(--text-md)]">{t('settings.voiceReadAloud')}</span>
                <button
                  onClick={() => updateStore({ voiceEnabled: !voiceEnabled })}
                  className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${
                    voiceEnabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
                  }`}
                  role="switch"
                  aria-checked={voiceEnabled}
                  aria-label={t('settings.voiceReadAloud')}
                >
                  <span
                    className={`absolute top-[2px] left-[2px] w-4 h-4 rounded-full bg-[var(--color-text-inverse)] shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_1px_rgba(0,0,0,0.06)] transition-transform ${
                      voiceEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              <div className="mb-3 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
                <div>
                  <span className="text-[length:var(--text-md)]">{t('settings.voiceOverlayTitle')}</span>
                  <p className="mt-1 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                    {voiceOverlayEnabled ? t('settings.voiceOverlayHintOn') : t('settings.voiceOverlayHintOff')}
                  </p>
                </div>
                <button
                  onClick={() => updateStore({ voiceOverlayEnabled: !voiceOverlayEnabled })}
                  className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${
                    voiceOverlayEnabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
                  }`}
                  role="switch"
                  aria-checked={voiceOverlayEnabled}
                  aria-label={t('settings.voiceOverlayTitle')}
                >
                  <span
                    className={`absolute top-[2px] left-[2px] w-4 h-4 rounded-full bg-[var(--color-text-inverse)] shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_1px_rgba(0,0,0,0.06)] transition-transform ${
                      voiceOverlayEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)] mb-2">
                {t('settings.voiceSpeed')}
              </p>
              <div className="flex items-center gap-3">
                <span className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('settings.voiceSlow')}</span>
                <input
                  id={voiceSpeedId}
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.1}
                  value={voiceSpeed}
                  onChange={(e) => updateStore({ voiceSpeed: parseFloat(e.target.value) })}
                  className="flex-1 h-2 accent-[var(--color-primary)] cursor-pointer rounded-full"
                  style={{ minHeight: '36px' }}
                  aria-label={t('settings.voiceSpeed')}
                />
                <span className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('settings.voiceFast')}</span>
              </div>
            </Card>

          </div>
        </section>}

        {/* ?? System ?? */}
        {activeTab === 'system' && <section role="tabpanel" id="settings-panel-system" aria-labelledby="settings-tab-system" data-settings-panel="system">
          <SectionHeader title={t('settings.group.system')} icon={Settings} />
          <div className="flex flex-col gap-3">

            <Card variant="outline" data-settings-card="system-note">
              <h3 className="text-[length:var(--text-md)] font-medium text-[var(--color-text)]">{t('settings.systemNoteTitle')}</h3>
              <p className="mt-1 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                {t('settings.systemNoteHint')}
              </p>
            </Card>

            {/* Auto Start */}
            <Card data-settings-card="auto-start">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] flex items-center justify-center shrink-0">
                    <Power size={18} className="text-[var(--color-primary)]" />
                  </div>
                  <div>
                    <h3 className="text-[length:var(--text-md)] font-medium">{t('settings.autoStart')}</h3>
                    <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                      {t('settings.autoStartHint')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => updateStore({ openAtLogin: !settings.openAtLogin })}
                  className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${
                    settings.openAtLogin ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
                  }`}
                  role="switch"
                  aria-checked={settings.openAtLogin}
                  aria-label={t('settings.autoStart')}
                >
                  <span
                    className={`absolute top-[2px] left-[2px] w-4 h-4 rounded-full bg-[var(--color-text-inverse)] shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_1px_rgba(0,0,0,0.06)] transition-transform ${
                      settings.openAtLogin ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </Card>

            {/* Advanced Menus */}
            <Card data-settings-card="advanced-menus">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] flex items-center justify-center shrink-0">
                    <Settings size={18} className="text-[var(--color-primary)]" />
                  </div>
                  <div>
                    <h3 className="text-[length:var(--text-md)] font-medium">{t('settings.advancedMenusTitle')}</h3>
                    <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                      {advancedMenusEnabled ? t('settings.advancedMenusHintOn') : t('settings.advancedMenusHintOff')}
                    </p>
                  </div>
                </div>
                <button
                  data-action="toggle-advanced-menus"
                  onClick={() => updateStore({ beginnerMode: advancedMenusEnabled })}
                  className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${
                    advancedMenusEnabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
                  }`}
                  role="switch"
                  aria-checked={advancedMenusEnabled}
                  aria-label={t('settings.advancedMenusTitle')}
                >
                  <span
                    className={`absolute top-[2px] left-[2px] w-4 h-4 rounded-full bg-[var(--color-text-inverse)] shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_1px_rgba(0,0,0,0.06)] transition-transform ${
                      advancedMenusEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </Card>

            {/* Browser Password Import */}
            <Card data-settings-card="password-auto-import">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] flex items-center justify-center shrink-0">
                    <KeyRound size={18} className="text-[var(--color-primary)]" />
                  </div>
                  <div>
                    <h3 className="text-[length:var(--text-md)] font-medium">{t('settings.passwordAutoImportTitle')}</h3>
                    <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                      {t('settings.passwordAutoImportHint')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => updateStore({ browserCredentialAutoImportEnabled: !browserCredentialAutoImportEnabled })}
                  className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${
                    browserCredentialAutoImportEnabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
                  }`}
                  role="switch"
                  aria-checked={browserCredentialAutoImportEnabled}
                  aria-label={t('settings.passwordAutoImportTitle')}
                >
                  <span
                    className={`absolute top-[2px] left-[2px] w-4 h-4 rounded-full bg-[var(--color-text-inverse)] shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_1px_rgba(0,0,0,0.06)] transition-transform ${
                      browserCredentialAutoImportEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              <p className="mt-3 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                {t('settings.passwordAutoImportInstallHint')}
              </p>
            </Card>

          </div>
        </section>}

        {/* ?? Advanced ?? */}
        {activeTab === 'advanced' && <section role="tabpanel" id="settings-panel-advanced" aria-labelledby="settings-tab-advanced" data-settings-panel="advanced">
          <SectionHeader title={t('settings.group.advanced')} icon={Cpu} />
          <div className="flex flex-col gap-3">

            <Card variant="outline" data-settings-card="developer-note">
              <h3 className="text-[length:var(--text-md)] font-medium text-[var(--color-text)]">{t('settings.developerNoteTitle')}</h3>
              <p className="mt-1 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                {t('settings.developerNoteHint')}
              </p>
            </Card>

            <SectionHeader title={t('settings.developerGroupUpdates')} indicator="var(--color-primary)" />
            <p className="mt-[-8px] mb-3 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
              {t('settings.developerGroupUpdatesHint')}
            </p>

            {/* Update Channel */}
            <Card data-settings-card="update-channel">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Download size={18} className="text-[var(--color-primary)]" />
                  <h3 className="text-[length:var(--text-md)] font-medium">{t('settings.updateChannel')}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[length:var(--text-xs)] font-medium ${updateStatusTone}`}>
                    {updateStatusText}
                  </span>
                  <IconButton
                    icon={RefreshCw}
                    size="sm"
                    label={t('settings.updateRefresh')}
                    onClick={refreshUpdaterStatus}
                    disabled={updaterBusyAny}
                  />
                </div>
              </div>
              <p className="mb-3 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                {t(beginnerMode ? 'settings.updateChannelHintSimple' : 'settings.updateChannelHint')}
              </p>
              <div className="mb-3 grid grid-cols-2 gap-2">
                {([
                  { id: 'stable' as const, label: t('settings.updateChannelStable') },
                  { id: 'beta' as const, label: t('settings.updateChannelBeta') },
                ]).map((item) => {
                  const isActive = updateChannel === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={async () => {
                        await updateStore({ updateChannel: item.id })
                        await refreshUpdaterStatus()
                      }}
                      className={`rounded-[var(--radius-md)] py-2 text-[length:var(--text-sm)] font-medium transition-all ${
                        isActive
                          ? 'bg-[var(--color-primary)] text-[var(--color-text-inverse)] shadow-[var(--shadow-md)]'
                          : 'bg-[var(--color-surface-soft)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                      }`}
                      style={{ minHeight: '36px' }}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </div>

              <div className="mb-3 flex items-center justify-between">
                <span className="text-[length:var(--text-md)]">{t('settings.updateAutoDownload')}</span>
                <button
                  type="button"
                  onClick={async () => {
                    await updateStore({ autoDownloadUpdates: !autoDownloadUpdates })
                    await refreshUpdaterStatus()
                  }}
                  className={`relative w-9 h-5 shrink-0 rounded-full transition-colors ${
                    autoDownloadUpdates ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
                  }`}
                  role="switch"
                  aria-checked={autoDownloadUpdates}
                  aria-label={t('settings.updateAutoDownload')}
                >
                  <span
                    className={`absolute top-[2px] left-[2px] w-4 h-4 rounded-full bg-[var(--color-text-inverse)] shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_1px_rgba(0,0,0,0.06)] transition-transform ${
                      autoDownloadUpdates ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  loading={updaterBusy === 'checking'}
                  onClick={() => runUpdaterAction('checking')}
                  disabled={updaterBusyAny && updaterBusy !== 'checking'}
                >
                  {t('settings.updateCheckNow')}
                </Button>
                {updaterStatus?.updateAvailableVersion && (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={updaterBusy === 'downloading'}
                    onClick={() => runUpdaterAction('downloading')}
                    disabled={updaterBusyAny && updaterBusy !== 'downloading'}
                  >
                    {t('settings.updateDownload')}
                  </Button>
                )}
                {updaterStatus?.downloadedVersion && (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={updaterBusy === 'installing'}
                    onClick={() => runUpdaterAction('installing')}
                    disabled={updaterBusyAny && updaterBusy !== 'installing'}
                  >
                    {t('settings.updateInstall')}
                  </Button>
                )}
              </div>
              {updaterSummaryNotice ? (
                <InlineNotice tone={updaterSummaryNotice.tone} title={updaterSummaryNotice.title} className="mt-3">
                  <p>{updaterSummaryNotice.body}</p>
                </InlineNotice>
              ) : null}
              {updaterStatus?.lastCheckAt && (
                <p className="mt-1 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                  {t('settings.updateLastCheck')}: {new Date(updaterStatus.lastCheckAt).toLocaleString()}
                </p>
              )}
              {updaterFriendlyError ? (
                <div className="mt-3">
                  <InlineNotice tone="warning" title={t('settings.updateErrorHelpTitle')}>
                    <p>{updaterFriendlyError}</p>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[length:var(--text-xs)] font-medium text-[var(--color-text-muted)]">
                        {t('settings.technicalDetails')}
                      </summary>
                      <p className="mt-1 break-all text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                        {updaterTechnicalDetails}
                      </p>
                    </details>
                  </InlineNotice>
                </div>
              ) : null}
            </Card>

            <SectionHeader title={t('settings.developerGroupAccess')} indicator="var(--color-primary)" className="mt-1" />
            <p className="mt-[-8px] mb-3 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
              {t('settings.developerGroupAccessHint')}
            </p>

            {/* Permission Profile */}
            <Card data-settings-card="permission-profile">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck size={18} className="text-[var(--color-primary)]" />
                <h3 className="text-[length:var(--text-md)] font-medium">{t('settings.permissionProfile')}</h3>
              </div>
              <p className="mb-3 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                {t(beginnerMode ? 'settings.permissionProfileHintSimple' : 'settings.permissionProfileHint')}
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {PROFILE_OPTIONS.map((option) => {
                  const isActive = permissionProfile === option.id
                  const descKey = beginnerMode ? `${option.descKey}Simple` : option.descKey
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => updateStore({ permissionProfile: option.id })}
                      className={`rounded-[var(--radius-md)] ring-1 px-3 py-2 text-left transition-all ${
                        isActive
                          ? 'ring-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-text-inverse)] shadow-[var(--shadow-md)]'
                          : 'ring-[var(--color-border-subtle)] bg-[var(--color-surface-soft)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:ring-[var(--color-border)]'
                      }`}
                    >
                      <span className="block text-[length:var(--text-sm)] font-semibold">{t(option.labelKey)}</span>
                      <span className={`mt-1 block text-[length:var(--text-xs)] ${isActive ? 'text-[var(--color-text-inverse)]/85' : 'text-[var(--color-text-muted)]'}`}>
                        {t(descKey)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </Card>

            <SectionHeader title={t('settings.developerGroupPasswords')} indicator="var(--color-primary)" className="mt-1" />
            <p className="mt-[-8px] mb-3 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
              {t('settings.developerGroupPasswordsHint')}
            </p>

            {/* Password Tools */}
            <Card data-settings-card="password-tools">
              <div className="mb-3 flex items-center gap-2">
                <KeyRound size={18} className="text-[var(--color-primary)]" />
                <h3 className="text-[length:var(--text-md)] font-medium">{t('settings.passwordImportTitle')}</h3>
              </div>
              <p className="mb-3 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                {t('settings.passwordImportHint')}
              </p>
              <p className="mb-3 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                {t('settings.passwordImportHowTo')}
              </p>

              <div className="mb-3 grid grid-cols-2 gap-2">
                <div className="rounded-[var(--radius-md)] ring-1 ring-[var(--color-border-subtle)] bg-[var(--color-surface-soft)] p-3">
                  <p className="text-[length:var(--text-xs)] text-[var(--color-text-muted)]">{t('settings.passwordVaultCount')}</p>
                  <p className="text-[length:var(--text-lg)] font-semibold text-[var(--color-text)]">{credentialSummary?.totalCount ?? 0}</p>
                </div>
                <div className="rounded-[var(--radius-md)] ring-1 ring-[var(--color-border-subtle)] bg-[var(--color-surface-soft)] p-3">
                  <p className="text-[length:var(--text-xs)] text-[var(--color-text-muted)]">{t('settings.passwordVaultLastImport')}</p>
                  <p className="text-[length:var(--text-sm)] font-medium text-[var(--color-text)]">
                    {credentialSummary?.lastImportedAt ? formatImportedAt(credentialSummary.lastImportedAt) : t('settings.passwordVaultNever')}
                  </p>
                </div>
              </div>

              {credentialSummary?.preview?.length ? (
                <div className="mb-3 rounded-[var(--radius-md)] ring-1 ring-[var(--color-border-subtle)] bg-[var(--color-bg-card)]">
                  {credentialSummary.preview.map((item) => (
                    <div key={item.id} className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-3 py-2 last:border-b-0">
                      <span className="max-w-[50%] truncate text-[length:var(--text-sm)] text-[var(--color-text)]">{item.site}</span>
                      <span className="text-[length:var(--text-xs)] text-[var(--color-text-muted)]">{item.usernameMasked}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              {credentialNotice.text ? (
                <InlineNotice
                  tone={credentialNotice.tone === 'error' ? 'error' : 'success'}
                  title={getCredentialNoticeTitle(credentialNotice)}
                  className="mb-3"
                >
                  <p>{credentialNotice.text}</p>
                </InlineNotice>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  loading={credentialBusy === 'importing'}
                  disabled={credentialBusy !== 'idle'}
                  onClick={handleImportCredentials}
                >
                  {t('settings.passwordImportButton')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={credentialBusy === 'clearing'}
                  disabled={credentialBusy !== 'idle' || (credentialSummary?.totalCount ?? 0) === 0}
                  onClick={handleClearCredentials}
                >
                  <Trash2 size={14} className="mr-1" />
                  {t('settings.passwordVaultClear')}
                </Button>
              </div>
            </Card>

            <SectionHeader title={t('settings.developerGroupDiagnostics')} indicator="var(--color-primary)" className="mt-1" />
            <p className="mt-[-8px] mb-3 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
              {t('settings.developerGroupDiagnosticsHint')}
            </p>

            {/* AI Models */}
            <Card data-settings-card="ai-models">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Cpu size={18} className="text-[var(--color-primary)]" />
                  <h3 className="text-[length:var(--text-md)] font-medium">{t('settings.aiModels')}</h3>
                </div>
                <IconButton
                  icon={RefreshCw}
                  size="sm"
                  label={t('settings.refreshModels')}
                  onClick={loadModels}
                  disabled={loadingModels}
                  className={loadingModels ? '[&>svg]:animate-spin' : ''}
                />
              </div>

              {models.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {models.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between px-3 py-2 rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] ring-1 ring-[var(--color-border-subtle)] hover:ring-[var(--color-primary)]/20 transition-all"
                    >
                      <div>
                        <span className="text-[length:var(--text-md)] font-medium text-[var(--color-text)]">{m.name}</span>
                        <span className="text-[length:var(--text-xs)] text-[var(--color-text-muted)] ml-2">
                          {t('settings.provider')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-6 rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] ring-1 ring-dashed ring-[var(--color-border-subtle)] text-center text-[length:var(--text-md)] text-[var(--color-text-muted)]">
                  {loadingModels ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      <span>{t('settings.loadingModels')}</span>
                    </div>
                  ) : t('settings.noModels')}
                </div>
              )}
            </Card>

          </div>
        </section>}
      </div>
    </div>
  )
}

function getUpdaterSummaryNotice(
  updaterBusy: 'idle' | 'checking' | 'downloading' | 'installing',
  updaterStatus: UpdaterStatus | null,
  updaterFriendlyError: string | null,
): { tone: 'info' | 'success' | 'warning'; title: string; body: string } | null {
  if (updaterBusy === 'checking') {
    return {
      tone: 'info',
      title: t('settings.updateNoticeCheckingTitle'),
      body: t('settings.updateNoticeCheckingBody'),
    }
  }

  if (updaterStatus?.lastError && updaterFriendlyError) {
    return {
      tone: 'warning',
      title: t('settings.updateNoticeProblemTitle'),
      body: updaterFriendlyError,
    }
  }

  if (updaterStatus?.downloadedVersion) {
    return {
      tone: 'success',
      title: t('settings.updateNoticeReadyTitle'),
      body: `${updaterStatus.downloadedVersion} ${t('settings.updateNoticeReadyBody')}`,
    }
  }

  if (updaterStatus?.updateAvailableVersion) {
    return {
      tone: 'info',
      title: t('settings.updateNoticeAvailableTitle'),
      body: `${updaterStatus.updateAvailableVersion} ${t('settings.updateNoticeAvailableBody')}`,
    }
  }

  if (updaterStatus) {
    return {
      tone: 'success',
      title: t('settings.updateNoticeCurrentTitle'),
      body: t('settings.updateNoticeCurrentBody'),
    }
  }

  return null
}

function getCredentialNoticeTitle(
  notice: { tone: 'idle' | 'success' | 'error'; text: string; kind: 'import' | 'clear' | null },
): string {
  if (notice.kind === 'clear') {
    return notice.tone === 'error' ? t('settings.passwordClearErrorTitle') : t('settings.passwordClearSuccessTitle')
  }

  return notice.tone === 'error' ? t('settings.passwordImportErrorTitle') : t('settings.passwordImportSuccessTitle')
}
