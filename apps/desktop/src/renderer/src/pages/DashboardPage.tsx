import { useEffect } from 'react'
import { RefreshCcw } from 'lucide-react'
import { Button, Card, SectionHeader } from '../components/ui'
import { useDashboardStore } from '../stores/dashboard.store'
import CpuChart from '../components/dashboard/CpuChart'
import MemoryChart from '../components/dashboard/MemoryChart'
import DiskUsage from '../components/dashboard/DiskUsage'
import NetworkTraffic from '../components/dashboard/NetworkTraffic'
import ProcessTable from '../components/dashboard/ProcessTable'
import ClipboardHistory from '../components/clipboard/ClipboardHistory'
import MonitorSelector from '../components/monitors/MonitorSelector'
import MacroPanel from '../components/macro/MacroPanel'
import HotkeySettings from '../components/hotkeys/HotkeySettings'
import EmailInbox from '../components/email/EmailInbox'
import CalendarView from '../components/calendar/CalendarView'
import SuggestionTray from '../components/proactive/SuggestionTray'
import AppLauncherHelper from '../components/orchestration/AppLauncherHelper'
import OrganizationPreview from '../components/file-org/OrganizationPreview'
import DuplicateList from '../components/file-org/DuplicateList'
import ImageEditor from '../components/image/ImageEditor'
import VisionPanel from '../components/vision/VisionPanel'
import { t } from '../i18n'

export default function DashboardPage() {
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

  useEffect(() => {
    initialize()
    startMonitoring().catch(() => {})

    const timer = setInterval(() => {
      loadProcesses().catch(() => {})
    }, 10_000)

    return () => {
      clearInterval(timer)
      stopMonitoring().catch(() => {})
    }
  }, [initialize, startMonitoring, stopMonitoring, loadProcesses])

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
        <div>
          <h1 className="text-[length:var(--text-xl)] font-semibold text-[var(--color-text)]">{t('dashboard.title')}</h1>
          <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('dashboard.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RefreshCcw size={14} />}
            onClick={() => {
              startMonitoring().catch(() => {})
              loadProcesses().catch(() => {})
            }}
          >
            {t('dashboard.refresh')}
          </Button>
          <span className="text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
            {monitorRunning ? t('status.working') : t('status.idle')}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-[var(--radius-md)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-3 py-2 text-[length:var(--text-sm)] text-[var(--color-danger)]">
          {error}
        </div>
      )}

      <div className="mb-4 grid gap-4 xl:grid-cols-4">
        <CpuChart metrics={metrics} history={metricsHistory} />
        <MemoryChart metrics={metrics} history={metricsHistory} />
        <DiskUsage metrics={metrics} />
        <NetworkTraffic metrics={metrics} history={metricsHistory} />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card variant="outline" className="space-y-2">
          <SectionHeader title={t('dashboard.processes')} indicator="var(--color-primary)" className="mb-2" />
          <ProcessTable processes={processes} />
        </Card>
        <SuggestionTray suggestions={suggestions} onDismiss={(id) => dismissSuggestion(id)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <MonitorSelector />
        <ClipboardHistory />
        <CalendarView />
        <EmailInbox />
        <MacroPanel />
        <HotkeySettings />
        <AppLauncherHelper />
        <OrganizationPreview />
        <DuplicateList />
        <VisionPanel />
        <ImageEditor />
      </div>

      {loading && <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('files.loading')}</p>}
    </div>
  )
}
