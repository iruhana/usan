import { lazy, Suspense, useEffect, useState } from 'react'
import { RefreshCcw } from 'lucide-react'
import { Button, Card, InlineNotice, SectionHeader } from '../components/ui'
import { useDashboardStore } from '../stores/dashboard.store'
import CpuChart from '../components/dashboard/CpuChart'
import MemoryChart from '../components/dashboard/MemoryChart'
import DiskUsage from '../components/dashboard/DiskUsage'
import NetworkTraffic from '../components/dashboard/NetworkTraffic'
import ProcessTable from '../components/dashboard/ProcessTable'
import ClipboardHistory from '../components/clipboard/ClipboardHistory'
import MonitorSelector from '../components/monitors/MonitorSelector'
import CalendarView from '../components/calendar/CalendarView'
import SuggestionTray from '../components/proactive/SuggestionTray'
import { useSettingsStore } from '../stores/settings.store'
import { t } from '../i18n'

const MacroPanel = lazy(() => import('../components/macro/MacroPanel'))
const HotkeySettings = lazy(() => import('../components/hotkeys/HotkeySettings'))
const EmailInbox = lazy(() => import('../components/email/EmailInbox'))
const AppLauncherHelper = lazy(() => import('../components/orchestration/AppLauncherHelper'))
const OrganizationPreview = lazy(() => import('../components/file-org/OrganizationPreview'))
const DuplicateList = lazy(() => import('../components/file-org/DuplicateList'))
const ImageEditor = lazy(() => import('../components/image/ImageEditor'))
const VisionPanel = lazy(() => import('../components/vision/VisionPanel'))

function getUsageStateKey(value: number, busyAt: number, warningAt: number): string {
  if (value >= warningAt) return 'dashboard.simple.check'
  if (value >= busyAt) return 'dashboard.simple.busy'
  return 'dashboard.simple.good'
}

export default function DashboardPage() {
  const beginnerMode = useSettingsStore((s) => s.settings.beginnerMode)
  const [showSystemDetails, setShowSystemDetails] = useState(false)
  const [showToolPanels, setShowToolPanels] = useState(false)
  const {
    metrics,
    metricsHistory,
    processes,
    suggestions,
    loading,
    error,
    monitorRunning,
    initialize,
    startMonitoring,
    stopMonitoring,
    loadProcesses,
    dismissSuggestion,
  } = useDashboardStore()

  const cpuUsage = metrics?.cpu.usage ?? 0
  const memoryUsage = metrics?.memory.percent ?? 0
  const fullestDisk = metrics?.disk.reduce((max, disk) => Math.max(max, disk.percent), 0) ?? 0
  const battery = metrics?.battery
  const networkActive = (metrics?.network?.bytesIn ?? 0) + (metrics?.network?.bytesOut ?? 0) > 1024
  const quickChecks = [
    {
      id: 'cpu',
      label: t('dashboard.simple.cpu'),
      value: metrics ? `${cpuUsage.toFixed(0)}%` : t('dashboard.noData'),
      status: t(getUsageStateKey(cpuUsage, 60, 85)),
    },
    {
      id: 'memory',
      label: t('dashboard.simple.memory'),
      value: metrics ? `${memoryUsage.toFixed(0)}%` : t('dashboard.noData'),
      status: t(getUsageStateKey(memoryUsage, 70, 85)),
    },
    {
      id: 'storage',
      label: t('dashboard.simple.storage'),
      value: metrics ? `${fullestDisk.toFixed(0)}%` : t('dashboard.noData'),
      status: t(getUsageStateKey(fullestDisk, 75, 90)),
    },
    battery
      ? {
          id: 'battery',
          label: t('dashboard.simple.battery'),
          value: `${battery.percent.toFixed(0)}%`,
          status: t(battery.charging ? 'dashboard.simple.charging' : 'dashboard.simple.onBattery'),
        }
      : {
          id: 'network',
          label: t('dashboard.simple.network'),
          value: t(networkActive ? 'dashboard.simple.active' : 'dashboard.simple.quiet'),
          status: t('dashboard.simple.online'),
        },
  ]

  useEffect(() => {
    initialize()
    startMonitoring().catch(() => {})

    const timer = beginnerMode
      ? null
      : setInterval(() => {
          loadProcesses().catch(() => {})
        }, 10_000)

    return () => {
      if (timer) clearInterval(timer)
      stopMonitoring().catch(() => {})
    }
  }, [beginnerMode, initialize, startMonitoring, stopMonitoring, loadProcesses])

  useEffect(() => {
    if (beginnerMode) {
      setShowSystemDetails(false)
      setShowToolPanels(false)
    }
  }, [beginnerMode])

  return (
    <div className="flex h-full flex-col overflow-hidden p-5">
      <div className="mb-6 rounded-[var(--radius-lg)] bg-[var(--color-bg-card)] p-6 shadow-[var(--shadow-lg)] ring-1 ring-[var(--color-border-subtle)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center rounded-full bg-[var(--color-primary-light)] px-3 py-1.5 text-[length:var(--text-xs)] font-semibold text-[var(--color-primary)]">
              {t('dashboard.title')}
            </div>
            <h1 className="mt-4 text-[length:var(--text-xl)] font-semibold tracking-tight text-[var(--color-text)]">{t('dashboard.title')}</h1>
            <p className="mt-2 max-w-2xl text-[length:var(--text-sm)] leading-relaxed text-[var(--color-text-secondary)]">
              {t(beginnerMode ? 'dashboard.subtitleSimple' : 'dashboard.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[var(--color-surface-soft)] px-3 py-1.5 text-[length:var(--text-xs)] font-medium text-[var(--color-text-muted)]">
              {monitorRunning ? t('status.working') : t('status.idle')}
            </span>
            <Button
              data-action="dashboard-refresh"
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCcw size={14} />}
              onClick={() => {
                startMonitoring().catch(() => {})
                if (!beginnerMode) {
                  loadProcesses().catch(() => {})
                }
              }}
            >
              {t('dashboard.refresh')}
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickChecks.map((item) => (
            <div key={item.id} className="rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] px-5 py-4">
              <p className="text-[length:var(--text-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{item.label}</p>
              <p className="mt-3 text-[length:var(--text-xl)] font-semibold tracking-tight text-[var(--color-text)]">{item.value}</p>
              <p className="mt-1 text-[length:var(--text-sm)] text-[var(--color-text-secondary)]">{item.status}</p>
            </div>
          ))}
        </div>
      </div>

      {error ? (
        <InlineNotice tone="error" title={t('dashboard.helpTitle')} className="mb-3">
          {error}
        </InlineNotice>
      ) : null}

      {beginnerMode && !error ? (
        <InlineNotice tone="info" title={t('dashboard.quickHelpTitle')} className="mb-4">
          <p>{t('dashboard.quickHelpBody')}</p>
        </InlineNotice>
      ) : null}

      {beginnerMode ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <Card variant="outline" className="space-y-3">
            <SectionHeader title={t('dashboard.quickHelpTitle')} indicator="var(--color-primary)" className="mb-1" />
            <p className="text-[length:var(--text-sm)] leading-relaxed text-[var(--color-text-secondary)]">
              {t('dashboard.quickHelpBody')}
            </p>
          </Card>
          <SuggestionTray suggestions={suggestions} onDismiss={(id) => dismissSuggestion(id)} />
        </div>
      ) : (
        <>
          <div className="mb-4 grid gap-4 xl:grid-cols-4">
            <CpuChart metrics={metrics} history={metricsHistory} />
            <MemoryChart metrics={metrics} history={metricsHistory} />
            <DiskUsage metrics={metrics} />
            <NetworkTraffic metrics={metrics} history={metricsHistory} />
          </div>

          <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_320px]">
            <Card variant="outline" className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <SectionHeader title={t('dashboard.systemDetailsTitle')} indicator="var(--color-primary)" className="mb-0" />
                  <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('dashboard.systemDetailsHint')}</p>
                </div>
                <Button
                  data-action="dashboard-toggle-system-details"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowSystemDetails((current) => !current)}
                >
                  {t(showSystemDetails ? 'dashboard.hideDetails' : 'dashboard.showDetails')}
                </Button>
              </div>

              {showSystemDetails ? (
                <div className="space-y-4">
                  <ProcessTable processes={processes} />
                  <div className="border-t border-[var(--color-border)] pt-4">
                    <MonitorSelector />
                  </div>
                </div>
              ) : (
                <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                  {t('dashboard.systemDetailsCollapsed')}
                </p>
              )}
            </Card>
            <SuggestionTray suggestions={suggestions} onDismiss={(id) => dismissSuggestion(id)} />
          </div>

          <Card variant="outline" className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <SectionHeader title={t('dashboard.toolPanelsTitle')} indicator="var(--color-primary)" className="mb-0" />
                <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('dashboard.toolPanelsHint')}</p>
              </div>
              <Button
                data-action="dashboard-toggle-tools"
                variant="secondary"
                size="sm"
                onClick={() => setShowToolPanels((current) => !current)}
              >
                {t(showToolPanels ? 'dashboard.hideTools' : 'dashboard.showTools')}
              </Button>
            </div>

            {showToolPanels ? (
              <div className="grid gap-4 xl:grid-cols-2">
                <ClipboardHistory />
                <CalendarView />
                <Suspense fallback={<p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('files.loading')}</p>}>
                  <EmailInbox />
                  <MacroPanel />
                  <HotkeySettings />
                  <AppLauncherHelper />
                  <OrganizationPreview />
                  <DuplicateList />
                  <VisionPanel />
                  <ImageEditor />
                </Suspense>
              </div>
            ) : (
              <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                {t('dashboard.toolPanelsCollapsed')}
              </p>
            )}
          </Card>
        </>
      )}

      {loading && <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('files.loading')}</p>}
    </div>
  )
}
