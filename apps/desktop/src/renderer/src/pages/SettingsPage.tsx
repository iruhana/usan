import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  Bot,
  Info,
  Link2,
  Palette,
  ShieldCheck,
  User,
  type LucideIcon,
} from 'lucide-react'
import type { CredentialVaultSummary, ModelInfo, UpdaterStatus } from '@shared/types/ipc'
import { useSettingsStore } from '../stores/settings.store'
import { useSafetyStore } from '../stores/safety.store'
import { t } from '../i18n'
import {
  DEFAULT_SETTINGS_TAB,
  normalizeSettingsTab,
  type SettingsSectionId,
  type SettingsTab,
} from '../constants/settings'
import {
  AboutSettingsSection,
  AccountSettingsPanel,
  ConnectorsSettingsSection,
  GeneralSettingsSection,
  ModelsSettingsSection,
  SecuritySettingsSection,
} from '../components/settings'
import { Badge, Card, PageIntro } from '../components/ui'
import { toTechnicalErrorDetails, toUpdaterErrorMessage } from '../lib/user-facing-errors'

const SECTIONS: Array<{
  id: SettingsSectionId
  labelKey: string
  descriptionKey: string
  icon: LucideIcon
}> = [
  { id: 'general', labelKey: 'settings.section.general', descriptionKey: 'settings.section.generalDesc', icon: Palette },
  { id: 'account', labelKey: 'settings.section.account', descriptionKey: 'settings.section.accountDesc', icon: User },
  { id: 'connectors', labelKey: 'settings.section.connectors', descriptionKey: 'settings.section.connectorsDesc', icon: Link2 },
  { id: 'security', labelKey: 'settings.section.security', descriptionKey: 'settings.section.securityDesc', icon: ShieldCheck },
  { id: 'models', labelKey: 'settings.section.models', descriptionKey: 'settings.section.modelsDesc', icon: Bot },
  { id: 'about', labelKey: 'settings.section.about', descriptionKey: 'settings.section.aboutDesc', icon: Info },
]

interface SettingsPageProps {
  requestedTab?: SettingsTab
  requestedTabNonce?: number
}

export default function SettingsPage({
  requestedTab,
  requestedTabNonce = 0,
}: SettingsPageProps) {
  const { settings, update: updateStore } = useSettingsStore()
  const requestConfirmation = useSafetyStore((state) => state.requestConfirmation)
  const [activeSection, setActiveSection] = useState<SettingsSectionId>(
    normalizeSettingsTab(requestedTab),
  )
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatus | null>(null)
  const [updaterBusy, setUpdaterBusy] = useState<
    'idle' | 'checking' | 'downloading' | 'installing'
  >('idle')
  const [credentialSummary, setCredentialSummary] =
    useState<CredentialVaultSummary | null>(null)
  const [credentialBusy, setCredentialBusy] = useState<'idle' | 'importing' | 'clearing'>('idle')
  const [credentialNotice, setCredentialNotice] = useState<{
    tone: 'idle' | 'success' | 'error'
    text: string
    kind: 'import' | 'clear' | null
  }>({ tone: 'idle', text: '', kind: null })

  const theme = settings.theme as 'light' | 'dark' | 'system'
  const advancedMenusEnabled = !settings.beginnerMode
  const updaterBusyAny = updaterBusy !== 'idle'
  const updaterFriendlyError = toUpdaterErrorMessage(updaterStatus?.lastError)
  const updaterTechnicalDetails = toTechnicalErrorDetails(updaterStatus?.lastError)
  const updaterSummaryNotice = getUpdaterSummaryNotice(
    updaterBusy,
    updaterStatus,
    updaterFriendlyError,
  )

  const loadModels = useCallback(async () => {
    setLoadingModels(true)
    try {
      const next = await window.usan?.ai.models()
      setModels(next ? (next as ModelInfo[]) : [])
    } catch {
      setModels([])
    } finally {
      setLoadingModels(false)
    }
  }, [])

  const refreshUpdaterStatus = useCallback(async () => {
    try {
      const next = await window.usan?.updates.status()
      if (next) {
        setUpdaterStatus(next)
      }
    } catch {
      // ignore
    }
  }, [])

  const refreshCredentialSummary = useCallback(async () => {
    try {
      const next = await window.usan?.credentials.getSummary()
      if (next) {
        setCredentialSummary(next)
      }
    } catch {
      // ignore
    }
  }, [])

  const runUpdaterAction = useCallback(
    async (action: 'checking' | 'downloading' | 'installing') => {
      setUpdaterBusy(action)
      try {
        if (action === 'checking') {
          const next = await window.usan?.updates.checkNow()
          if (next) setUpdaterStatus(next)
          return
        }

        if (action === 'downloading') {
          const next = await window.usan?.updates.download()
          if (next) setUpdaterStatus(next)
          return
        }

        await window.usan?.updates.install()
      } catch {
        // ignore
      } finally {
        setUpdaterBusy('idle')
      }
    },
    [],
  )

  const handleImportCredentials = useCallback(async () => {
    setCredentialBusy('importing')
    setCredentialNotice({ tone: 'idle', text: '', kind: 'import' })
    try {
      const result = await window.usan?.credentials.importBrowserCsv()
      if (!result) return
      setCredentialNotice({
        tone: 'success',
        text: t('settings.passwordImportResult')
          .replace('{imported}', String(result.importedCount))
          .replace('{skipped}', String(result.skippedCount)),
        kind: 'import',
      })
      await refreshCredentialSummary()
    } catch {
      setCredentialNotice({
        tone: 'error',
        text: t('settings.passwordImportFailed'),
        kind: 'import',
      })
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

    if (!confirmed) return

    setCredentialBusy('clearing')
    setCredentialNotice({ tone: 'idle', text: '', kind: 'clear' })
    try {
      await window.usan?.credentials.clear()
      setCredentialNotice({
        tone: 'success',
        text: t('settings.passwordVaultCleared'),
        kind: 'clear',
      })
      await refreshCredentialSummary()
    } catch {
      setCredentialNotice({
        tone: 'error',
        text: t('settings.passwordClearFailed'),
        kind: 'clear',
      })
    } finally {
      setCredentialBusy('idle')
    }
  }, [refreshCredentialSummary, requestConfirmation])

  useEffect(() => {
    void loadModels()
    void refreshUpdaterStatus()
    void refreshCredentialSummary()
  }, [loadModels, refreshUpdaterStatus, refreshCredentialSummary])

  useEffect(() => {
    setActiveSection(normalizeSettingsTab(requestedTab))
  }, [requestedTab, requestedTabNonce])

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark')

    if (theme === 'dark') {
      root.classList.add('dark')
      return
    }

    if (theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)')
      root.classList.toggle('dark', media.matches)
      const handler = (event: MediaQueryListEvent) => {
        root.classList.toggle('dark', event.matches)
      }
      media.addEventListener('change', handler)
      return () => media.removeEventListener('change', handler)
    }
  }, [theme])

  const providerCounts: Record<string, number> = {}
  for (const model of models) {
    providerCounts[model.provider] = (providerCounts[model.provider] ?? 0) + 1
  }
  const providerEntries = Object.entries(providerCounts).sort((a, b) => a[0].localeCompare(b[0]))
  const activeSectionMeta = SECTIONS.find((section) => section.id === activeSection) ?? SECTIONS[0]

  function focusNavTab(nextSectionId: SettingsSectionId): void {
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLButtonElement>(`[data-settings-tab="${nextSectionId}"]`)
        ?.focus()
    })
  }

  function renderSectionContent(): ReactNode {
    switch (activeSection) {
      case 'general':
        return (
          <GeneralSettingsSection
            locale={settings.locale}
            theme={theme}
            fontScale={settings.fontScale}
            fontScaleId="settings-font-scale"
            voiceEnabled={settings.voiceEnabled}
            voiceOverlayEnabled={settings.voiceOverlayEnabled}
            voiceSpeed={settings.voiceSpeed}
            voiceSpeedId="settings-voice-speed"
            highContrast={settings.highContrast}
            enterToSend={settings.enterToSend}
            openAtLogin={settings.openAtLogin}
            advancedMenusEnabled={advancedMenusEnabled}
            onLocaleChange={(locale) => {
              void updateStore({ locale })
            }}
            onThemeChange={(nextTheme) => {
              void updateStore({ theme: nextTheme })
            }}
            onFontScaleChange={(value) => {
              void updateStore({ fontScale: value })
            }}
            onToggleHighContrast={() => {
              const next = !settings.highContrast
              document.documentElement.classList.toggle('high-contrast', next)
              void updateStore({ highContrast: next })
            }}
            onToggleEnterToSend={() => {
              void updateStore({ enterToSend: !settings.enterToSend })
            }}
            onToggleVoiceEnabled={() => {
              void updateStore({ voiceEnabled: !settings.voiceEnabled })
            }}
            onToggleVoiceOverlay={() => {
              void updateStore({ voiceOverlayEnabled: !settings.voiceOverlayEnabled })
            }}
            onVoiceSpeedChange={(value) => {
              void updateStore({ voiceSpeed: value })
            }}
            onToggleOpenAtLogin={() => {
              void updateStore({ openAtLogin: !settings.openAtLogin })
            }}
            onToggleAdvancedMenus={() => {
              void updateStore({ beginnerMode: advancedMenusEnabled })
            }}
          />
        )
      case 'account':
        return <AccountSettingsPanel />
      case 'connectors':
        return (
          <ConnectorsSettingsSection
            loadingModels={loadingModels}
            providerEntries={providerEntries}
            browserCredentialAutoImportEnabled={settings.browserCredentialAutoImportEnabled}
            onRefreshModels={() => {
              void loadModels()
            }}
            onToggleBrowserCredentialAutoImport={() => {
              void updateStore({
                browserCredentialAutoImportEnabled:
                  !settings.browserCredentialAutoImportEnabled,
              })
            }}
          />
        )
      case 'security':
        return (
          <SecuritySettingsSection
            beginnerMode={settings.beginnerMode}
            permissionProfile={settings.permissionProfile}
            credentialSummary={credentialSummary}
            credentialBusy={credentialBusy}
            credentialNotice={credentialNotice}
            onSetPermissionProfile={(profile) => {
              void updateStore({ permissionProfile: profile })
            }}
            onImportCredentials={() => {
              void handleImportCredentials()
            }}
            onClearCredentials={() => {
              void handleClearCredentials()
            }}
            formatImportedAt={(timestamp) => new Date(timestamp).toLocaleString()}
            getCredentialNoticeTitle={getCredentialNoticeTitle}
          />
        )
      case 'models':
        return (
          <ModelsSettingsSection
            models={models}
            loadingModels={loadingModels}
            providerCount={providerEntries.length}
            onRefreshModels={() => {
              void loadModels()
            }}
          />
        )
      case 'about':
        return (
          <AboutSettingsSection
            beginnerMode={settings.beginnerMode}
            updateChannel={settings.updateChannel}
            autoDownloadUpdates={settings.autoDownloadUpdates}
            updaterBusy={updaterBusy}
            updaterBusyAny={updaterBusyAny}
            updaterStatus={updaterStatus}
            updaterSummaryNotice={updaterSummaryNotice}
            updaterFriendlyError={updaterFriendlyError}
            updaterTechnicalDetails={updaterTechnicalDetails}
            onRefreshUpdaterStatus={() => {
              void refreshUpdaterStatus()
            }}
            onUpdateChannelChange={(value) => {
              void (async () => {
                await updateStore({ updateChannel: value })
                await refreshUpdaterStatus()
              })()
            }}
            onToggleAutoDownload={() => {
              void (async () => {
                await updateStore({
                  autoDownloadUpdates: !settings.autoDownloadUpdates,
                })
                await refreshUpdaterStatus()
              })()
            }}
            onRunUpdaterAction={(action) => {
              void runUpdaterAction(action)
            }}
          />
        )
      default:
        return null
    }
  }

  return (
    <div
      className="flex h-full min-w-0 flex-col bg-[var(--color-bg)]"
      data-testid="settings-page"
      data-view="settings-page"
    >
      <div className="flex-1 overflow-hidden px-4 pb-4 pt-5 md:px-5 md:pb-5">
        <div className="mx-auto flex h-full w-full max-w-[1480px] flex-col gap-4">
          <PageIntro title={t('settings.title')} description={t('settings.subtitle')} className="px-1" />

          <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
            <Card
              variant="default"
              padding="md"
              className="flex min-h-[320px] min-w-0 flex-col rounded-[24px] border border-[var(--color-border-subtle)]/80 bg-[var(--color-bg-card)]/95"
            >
              <div className="rounded-[20px] bg-[var(--color-panel-muted)] px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                  {t('settings.policySurfaceEyebrow')}
                </p>
                <p className="mt-2 text-[14px] leading-6 text-[var(--color-text-secondary)]">
                  {t('settings.policySurfaceHint')}
                </p>
              </div>

              <div
                className="mt-4 flex min-h-0 flex-1 flex-col gap-2"
                role="tablist"
                aria-orientation="vertical"
                aria-label={t('settings.title')}
                data-testid="settings-nav"
              >
                {SECTIONS.map((section, index) => {
                  const Icon = section.icon
                  const isActive = activeSection === section.id
                  return (
                    <button
                      key={section.id}
                      id={`settings-tab-${section.id}`}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-controls={`settings-panel-${section.id}`}
                      tabIndex={isActive ? 0 : -1}
                      data-settings-tab={section.id}
                      onClick={() => setActiveSection(section.id)}
                      onKeyDown={(event) => {
                        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                          return
                        }

                        event.preventDefault()
                        let nextIndex = index
                        if (event.key === 'Home') nextIndex = 0
                        else if (event.key === 'End') nextIndex = SECTIONS.length - 1
                        else if (event.key === 'ArrowDown') nextIndex = (index + 1) % SECTIONS.length
                        else if (event.key === 'ArrowUp') nextIndex = (index - 1 + SECTIONS.length) % SECTIONS.length

                        const nextSection = SECTIONS[nextIndex]?.id ?? DEFAULT_SETTINGS_TAB
                        setActiveSection(nextSection)
                        focusNavTab(nextSection)
                      }}
                      className={`rounded-[18px] px-4 py-3 text-left transition-all ${
                        isActive
                          ? 'bg-[var(--color-primary-light)] shadow-[var(--shadow-xs)] ring-1 ring-[rgba(49,130,246,0.14)]'
                          : 'bg-[var(--color-panel-muted)] hover:bg-[var(--color-surface-soft)]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-white/70 text-[var(--color-text-secondary)]">
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[14px] font-semibold text-[var(--color-text)]">
                            {t(section.labelKey)}
                          </div>
                          <div className="mt-1 text-[12px] leading-5 text-[var(--color-text-secondary)]">
                            {t(section.descriptionKey)}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </Card>

            <div className="min-h-0 overflow-auto pr-1">
              <Card variant="elevated" padding="md" className="rounded-[24px]" data-testid="settings-hero-card">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-[var(--color-text)]">
                        {t(activeSectionMeta.labelKey)}
                      </h2>
                      <Badge variant="info">{t('settings.policySurfaceBadge')}</Badge>
                    </div>
                    <p className="mt-2 max-w-[720px] text-[14px] leading-7 text-[var(--color-text-secondary)]">
                      {t(activeSectionMeta.descriptionKey)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="default">{t('settings.card.aboutStorage')}</Badge>
                    <Badge variant="default">{t('settings.card.aboutPrivacy')}</Badge>
                  </div>
                </div>
              </Card>

              <section
                role="tabpanel"
                id={`settings-panel-${activeSection}`}
                aria-labelledby={`settings-tab-${activeSection}`}
                className="mt-4 space-y-4"
                data-settings-panel={activeSection}
              >
                {renderSectionContent()}
              </section>
            </div>
          </div>
        </div>
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
    return { tone: 'info', title: t('settings.updateNoticeCheckingTitle'), body: t('settings.updateNoticeCheckingBody') }
  }

  if (updaterStatus?.lastError && updaterFriendlyError) {
    return { tone: 'warning', title: t('settings.updateNoticeProblemTitle'), body: updaterFriendlyError }
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
    return { tone: 'success', title: t('settings.updateNoticeCurrentTitle'), body: t('settings.updateNoticeCurrentBody') }
  }

  return null
}

function getCredentialNoticeTitle(notice: {
  tone: 'idle' | 'success' | 'error'
  text: string
  kind: 'import' | 'clear' | null
}): string {
  if (notice.kind === 'clear') {
    return notice.tone === 'error' ? t('settings.passwordClearErrorTitle') : t('settings.passwordClearSuccessTitle')
  }

  return notice.tone === 'error' ? t('settings.passwordImportErrorTitle') : t('settings.passwordImportSuccessTitle')
}
