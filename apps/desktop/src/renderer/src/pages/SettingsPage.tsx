import { useState, useEffect, useCallback, useId } from 'react'
import {
  Type,
  Sun,
  Moon,
  Volume2,
  Cpu,
  Key,
  Palette,
  RefreshCw,
  Languages,
  Power,
  Settings,
  CheckCircle,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Download,
} from 'lucide-react'
import type { ModelInfo, UpdaterStatus } from '@shared/types/ipc'
import { useSettingsStore } from '../stores/settings.store'
import { t } from '../i18n'
import type { Locale } from '../i18n'
import { Card, SectionHeader, Button, IconButton } from '../components/ui'

const LANGUAGES: Array<{ id: Locale; label: string; flag: string }> = [
  { id: 'ko', label: '한국어', flag: '🇰🇷' },
  { id: 'en', label: 'English', flag: '🇺🇸' },
  { id: 'ja', label: '日本語', flag: '🇯🇵' },
]

type SettingsTab = 'display' | 'sound' | 'system' | 'advanced'

const TABS: Array<{ id: SettingsTab; labelKey: string; icon: typeof Palette }> = [
  { id: 'display', labelKey: 'settings.group.display', icon: Palette },
  { id: 'sound', labelKey: 'settings.group.sound', icon: Volume2 },
  { id: 'system', labelKey: 'settings.group.system', icon: Settings },
  { id: 'advanced', labelKey: 'settings.group.advanced', icon: Cpu },
]

export default function SettingsPage() {
  const { settings, update: updateStore } = useSettingsStore()
  const [activeTab, setActiveTab] = useState<SettingsTab>('display')
  const [cloudApiKey, setCloudApiKey] = useState('')
  const [apiKeyDirty, setApiKeyDirty] = useState(false)
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [keyValidation, setKeyValidation] = useState<{ status: 'idle' | 'loading' | 'valid' | 'error'; message?: string }>({ status: 'idle' })
  const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatus | null>(null)
  const [updaterBusy, setUpdaterBusy] = useState<'idle' | 'checking' | 'downloading' | 'installing'>('idle')
  const fontScaleId = useId()
  const voiceSpeedId = useId()
  const apiKeyId = useId()
  const apiKeyHelpId = useId()

  const fontScale = settings.fontScale
  const highContrast = settings.highContrast
  const voiceEnabled = settings.voiceEnabled
  const voiceSpeed = settings.voiceSpeed
  const theme = settings.theme as 'light' | 'dark' | 'system'
  const updateChannel = settings.updateChannel
  const autoDownloadUpdates = settings.autoDownloadUpdates
  const permissionProfile = settings.permissionProfile

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

  useEffect(() => {
    window.usan?.settings.get().then((s) => {
      setCloudApiKey(s.cloudApiKey ?? '')
    })
    loadModels()
    refreshUpdaterStatus()
  }, [loadModels, refreshUpdaterStatus])

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

  const validateApiKey = async () => {
    const key = cloudApiKey.replace(/•/g, '')
    if (!key || key === '••••••••') {
      setKeyValidation({ status: 'error', message: t('settings.apiKeyEmpty') })
      return
    }
    if (apiKeyDirty) {
      updateStore({ cloudApiKey })
      setApiKeyDirty(false)
    }
    setKeyValidation({ status: 'loading' })
    try {
      const result = await window.usan?.aiExtras.validateKey(key)
      if (result?.valid) {
        setKeyValidation({ status: 'valid', message: t('settings.keyValid') })
      } else {
        setKeyValidation({ status: 'error', message: result?.error ?? t('settings.apiKeyInvalid') })
      }
    } catch {
      setKeyValidation({ status: 'error', message: t('settings.apiKeyCheckError') })
    }
  }

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
      <div className="flex gap-1 mb-6 p-1 rounded-[var(--radius-lg)] bg-[var(--color-surface-soft)]" role="tablist">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
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
        {/* ── Display ── */}
        {activeTab === 'display' && <section>
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
                      style={{ minHeight: '64px' }}
                    >
                      <span className="text-[20px] leading-none">{lang.flag}</span>
                      <span className="text-[length:var(--text-md)] font-medium">{lang.label}</span>
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
                  style={{ minHeight: '48px' }}
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
                      style={{ minHeight: '64px' }}
                    >
                      <Icon size={20} />
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
                  className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${
                    highContrast ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
                  }`}
                  role="switch"
                  aria-checked={highContrast}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-[var(--color-text-inverse)] shadow-sm transition-transform ${
                      highContrast ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </Card>

            {/* Enter key behavior */}
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[length:var(--text-md)] font-medium">Enter 키로 전송</h3>
                  <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)] mt-1">
                    {settings.enterToSend ? 'Enter = 전송, Shift+Enter = 줄바꿈' : 'Enter = 줄바꿈, 버튼 클릭 = 전송'}
                  </p>
                </div>
                <button
                  onClick={() => updateStore({ enterToSend: !settings.enterToSend })}
                  className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${
                    settings.enterToSend ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
                  }`}
                  role="switch"
                  aria-checked={settings.enterToSend}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-[var(--color-text-inverse)] shadow-sm transition-transform ${
                      settings.enterToSend ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </Card>

          </div>
        </section>}

        {/* ── Sound ── */}
        {activeTab === 'sound' && <section>
          <SectionHeader title={t('settings.group.sound')} icon={Volume2} />
          <div className="flex flex-col gap-3">

            {/* Voice */}
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Volume2 size={18} className="text-[var(--color-primary)]" />
                <h3 className="text-[length:var(--text-md)] font-medium">{t('settings.voice')}</h3>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[length:var(--text-md)]">{t('settings.voiceReadAloud')}</span>
                <button
                  onClick={() => updateStore({ voiceEnabled: !voiceEnabled })}
                  className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${
                    voiceEnabled ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
                  }`}
                  role="switch"
                  aria-checked={voiceEnabled}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-[var(--color-text-inverse)] shadow-sm transition-transform ${
                      voiceEnabled ? 'translate-x-5' : 'translate-x-0'
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
                  style={{ minHeight: '48px' }}
                  aria-label={t('settings.voiceSpeed')}
                />
                <span className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('settings.voiceFast')}</span>
              </div>
            </Card>

          </div>
        </section>}

        {/* ── System ── */}
        {activeTab === 'system' && <section>
          <SectionHeader title={t('settings.group.system')} icon={Settings} />
          <div className="flex flex-col gap-3">

            {/* Auto Start */}
            <Card>
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
                  className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${
                    settings.openAtLogin ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
                  }`}
                  role="switch"
                  aria-checked={settings.openAtLogin}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-[var(--color-text-inverse)] shadow-sm transition-transform ${
                      settings.openAtLogin ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </Card>

            {/* Update Channel */}
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Download size={18} className="text-[var(--color-primary)]" />
                <h3 className="text-[length:var(--text-md)] font-medium">{t('settings.updateChannel')}</h3>
              </div>
              <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)] mb-3">
                {t('settings.updateChannelHint')}
              </p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {([
                  { id: 'stable' as const, label: t('settings.updateChannelStable') },
                  { id: 'beta' as const, label: t('settings.updateChannelBeta') },
                ]).map((item) => {
                  const isActive = updateChannel === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={async () => {
                        await updateStore({ updateChannel: item.id })
                        await refreshUpdaterStatus()
                      }}
                      className={`py-2 rounded-[var(--radius-md)] text-[length:var(--text-sm)] font-medium transition-all ${
                        isActive
                          ? 'bg-[var(--color-primary)] text-[var(--color-text-inverse)] shadow-[var(--shadow-md)]'
                          : 'bg-[var(--color-surface-soft)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                      }`}
                      style={{ minHeight: '44px' }}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center justify-between mb-3">
                <span className="text-[length:var(--text-md)]">{t('settings.updateAutoDownload')}</span>
                <button
                  onClick={async () => {
                    await updateStore({ autoDownloadUpdates: !autoDownloadUpdates })
                    await refreshUpdaterStatus()
                  }}
                  className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${
                    autoDownloadUpdates ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'
                  }`}
                  role="switch"
                  aria-checked={autoDownloadUpdates}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-[var(--color-text-inverse)] shadow-sm transition-transform ${
                      autoDownloadUpdates ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  loading={updaterBusy === 'checking'}
                  onClick={() => runUpdaterAction('checking')}
                >
                  {t('settings.updateCheckNow')}
                </Button>
                {updaterStatus?.updateAvailableVersion && (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={updaterBusy === 'downloading'}
                    onClick={() => runUpdaterAction('downloading')}
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
                  >
                    {t('settings.updateInstall')}
                  </Button>
                )}
              </div>
              {updaterStatus && (
                <p className="mt-3 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                  {t('settings.updateStatus')}: {updaterStatus.downloadedVersion
                    ? `${t('settings.updateReady')} ${updaterStatus.downloadedVersion}`
                    : updaterStatus.updateAvailableVersion
                      ? `${t('settings.updateAvailable')} ${updaterStatus.updateAvailableVersion}`
                      : t('settings.updateUpToDate')}
                </p>
              )}
              {updaterStatus?.lastCheckAt && (
                <p className="mt-1 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                  {t('settings.updateLastCheck')}: {new Date(updaterStatus.lastCheckAt).toLocaleString()}
                </p>
              )}
              {updaterStatus?.lastError && (
                <p className="mt-1 text-[length:var(--text-xs)] text-[var(--color-danger)]">
                  {t('settings.updateLastError')}: {updaterStatus.lastError}
                </p>
              )}
            </Card>

            {/* Permission Profile */}
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck size={18} className="text-[var(--color-primary)]" />
                <h3 className="text-[length:var(--text-md)] font-medium">{t('settings.permissionProfile')}</h3>
              </div>
              <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)] mb-3">
                {t('settings.permissionProfileHint')}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 'full' as const, label: t('settings.permissionProfileFull') },
                  { id: 'balanced' as const, label: t('settings.permissionProfileBalanced') },
                  { id: 'strict' as const, label: t('settings.permissionProfileStrict') },
                ]).map((item) => {
                  const isActive = permissionProfile === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => updateStore({ permissionProfile: item.id })}
                      className={`py-2 rounded-[var(--radius-md)] text-[length:var(--text-sm)] font-medium transition-all ${
                        isActive
                          ? 'bg-[var(--color-primary)] text-[var(--color-text-inverse)] shadow-[var(--shadow-md)]'
                          : 'bg-[var(--color-surface-soft)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                      }`}
                      style={{ minHeight: '44px' }}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </Card>

          </div>
        </section>}

        {/* ── Advanced ── */}
        {activeTab === 'advanced' && <section>
          <SectionHeader title={t('settings.group.advanced')} icon={Cpu} />
          <div className="flex flex-col gap-3">

            {/* AI Models */}
            <Card>
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
                      className="flex items-center justify-between px-3 py-2 rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] border border-[var(--color-border)]/50 hover:border-[var(--color-primary)]/20 transition-all"
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
                <div className="px-4 py-6 rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] border border-dashed border-[var(--color-border)] text-center text-[length:var(--text-md)] text-[var(--color-text-muted)]">
                  {loadingModels ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      <span>{t('settings.loadingModels')}</span>
                    </div>
                  ) : t('settings.noModels')}
                </div>
              )}
            </Card>

            {/* API Key */}
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Key size={18} className="text-[var(--color-primary)]" />
                <h3 className="text-[length:var(--text-md)] font-medium">{t('settings.apiKey')}</h3>
              </div>
              <p id={apiKeyHelpId} className="text-[length:var(--text-sm)] text-[var(--color-text-muted)] mb-3">
                {t('settings.apiKeyHint')}
              </p>

              <div>
                <label
                  htmlFor={apiKeyId}
                  className="block mb-1 text-[length:var(--text-sm)] font-medium text-[var(--color-text)]"
                >
                  {t('settings.apiKeyLabel')}
                </label>
                <div className="relative">
                  <input
                    id={apiKeyId}
                    type="password"
                    value={cloudApiKey}
                    onChange={(e) => {
                      setCloudApiKey(e.target.value)
                      setApiKeyDirty(true)
                      setKeyValidation({ status: 'idle' })
                    }}
                    onBlur={() => {
                      if (apiKeyDirty && cloudApiKey) {
                        updateStore({ cloudApiKey })
                        setApiKeyDirty(false)
                      }
                    }}
                    placeholder="sk-or-..."
                    aria-describedby={apiKeyHelpId}
                    aria-invalid={keyValidation.status === 'error' ? true : undefined}
                    className={`w-full h-10 px-3 pr-10 rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] border transition-all text-[length:var(--text-md)] focus:outline-none focus:ring-2 ${
                      keyValidation.status === 'valid'
                        ? 'border-[var(--color-success)] focus:ring-[var(--color-success)]/20'
                        : keyValidation.status === 'error'
                        ? 'border-[var(--color-danger)] focus:ring-[var(--color-danger)]/20'
                        : 'border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20'
                    }`}
                  />
                  {keyValidation.status === 'valid' && (
                    <CheckCircle size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-success)]" />
                  )}
                  {keyValidation.status === 'error' && (
                    <AlertCircle size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-danger)]" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    size="sm"
                    loading={keyValidation.status === 'loading'}
                    onClick={validateApiKey}
                  >
                    {keyValidation.status === 'loading' ? t('settings.validating') : t('settings.validateKey')}
                  </Button>
                  {keyValidation.status === 'valid' && (
                    <span className="text-[length:var(--text-sm)] text-[var(--color-success)] font-medium">
                      {keyValidation.message}
                    </span>
                  )}
                  {keyValidation.status === 'error' && (
                    <span className="text-[length:var(--text-sm)] text-[var(--color-danger)] font-medium">
                      {keyValidation.message}
                    </span>
                  )}
                </div>
              </div>
            </Card>

          </div>
        </section>}
      </div>
    </div>
  )
}
