import { useEffect, useMemo, useState } from 'react'
import { Play, Plus, Trash2, Clock3 } from 'lucide-react'
import { Button, Card, Badge, InlineNotice, Input, SectionHeader } from '../components/ui'
import WorkflowBuilder from '../components/workflow/WorkflowBuilder'
import WorkflowRunLog from '../components/workflow/WorkflowRunLog'
import { useWorkflowStore } from '../stores/workflow.store'
import { useSettingsStore } from '../stores/settings.store'
import { t } from '../i18n'

export default function WorkflowsPage() {
  const beginnerMode = useSettingsStore((s) => s.settings.beginnerMode)
  const {
    workflows,
    runs,
    activeWorkflowId,
    activeRunId,
    loading,
    error,
    initialize,
    setActiveWorkflow,
    load,
    createWorkflow,
    deleteWorkflow,
    executeWorkflow,
    pauseRun,
    resumeRun,
    cancelRun,
    scheduleWorkflow,
  } = useWorkflowStore()

  const [showBuilder, setShowBuilder] = useState(false)
  const [scheduleSeconds, setScheduleSeconds] = useState(0)
  const [scheduleResult, setScheduleResult] = useState<string | null>(null)

  useEffect(() => {
    initialize()
    load().catch(() => {})
  }, [initialize, load])

  const activeWorkflow = workflows.find((workflow) => workflow.id === activeWorkflowId) ?? null
  const workflowRuns = useMemo(() => {
    if (!activeWorkflow) return runs
    return runs.filter((run) => run.workflowId === activeWorkflow.id)
  }, [activeWorkflow, runs])

  const activeRun = workflowRuns.find((run) => run.id === activeRunId) ?? workflowRuns[0] ?? null

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
        <div>
          <h1 className="text-[length:var(--text-xl)] font-semibold text-[var(--color-text)]">{t('workflow.title')}</h1>
          <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
            {t(beginnerMode ? 'workflow.subtitleSimple' : 'workflow.subtitle')}
          </p>
        </div>
        <Button data-action="create-workflow" leftIcon={<Plus size={16} />} onClick={() => setShowBuilder(true)}>{t('workflow.create')}</Button>
      </div>

      {error ? (
        <InlineNotice tone="error" title={t('workflow.helpTitle')} className="mb-3">
          {error}
        </InlineNotice>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[320px_1fr]">
        <Card variant="outline" className="min-h-0 overflow-auto">
          <SectionHeader title={t('workflow.title')} indicator="var(--color-primary)" className="mb-3" />

          {loading ? (
            <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('files.loading')}</p>
          ) : workflows.length === 0 ? (
            <div className="space-y-2 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
              <p>{t('workflow.empty')}</p>
              <p>{t(beginnerMode ? 'workflow.emptyHintSimple' : 'workflow.emptyHint')}</p>
            </div>
          ) : (
            <div className="space-y-2" role="listbox" aria-label={t('workflow.title')}>
              {workflows.map((workflow) => {
                const selected = workflow.id === activeWorkflowId
                const runCount = runs.filter((run) => run.workflowId === workflow.id).length
                return (
                  <button
                    key={workflow.id}
                    type="button"
                    onClick={() => setActiveWorkflow(workflow.id)}
                    className={`w-full rounded-[var(--radius-md)] ring-1 px-3 py-2 text-left transition-all ${selected
                      ? 'ring-[var(--color-primary)] bg-[var(--color-primary-muted)] shadow-[var(--shadow-xs)]'
                      : 'ring-[var(--color-border-subtle)] hover:bg-[var(--color-surface-soft)] hover:ring-[var(--color-border)]'}`}
                    role="option"
                    aria-selected={selected}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[length:var(--text-md)] font-medium text-[var(--color-text)]">{workflow.name}</p>
                      <Badge variant="default">{runCount}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{workflow.description || '-'}</p>
                  </button>
                )
              })}
            </div>
          )}
        </Card>

        <div className="min-h-0 overflow-auto">
          {activeWorkflow ? (
            <div className="space-y-4">
              <Card variant="elevated" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-[length:var(--text-lg)] font-semibold text-[var(--color-text)]">{activeWorkflow.name}</h2>
                    <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{activeWorkflow.description || '-'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" leftIcon={<Play size={14} />} onClick={() => executeWorkflow(activeWorkflow.id)}>
                      {t('workflow.run')}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      leftIcon={<Trash2 size={14} />}
                      onClick={() => deleteWorkflow(activeWorkflow.id)}
                    >
                      {t('workflow.delete')}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-[1fr_180px_auto]">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={scheduleSeconds}
                    onChange={(event) => setScheduleSeconds(Math.max(0, Number(event.target.value) || 0))}
                    label={t('workflow.schedule')}
                    helperText={t(beginnerMode ? 'workflow.intervalHintSimple' : 'workflow.intervalHint')}
                  />
                  <div className="flex items-end">
                    <Button
                      variant="secondary"
                      size="md"
                      leftIcon={<Clock3 size={14} />}
                      onClick={async () => {
                        const seconds = Math.max(1, scheduleSeconds)
                        const scheduleId = await scheduleWorkflow(activeWorkflow.id, seconds * 1000)
                        setScheduleResult(scheduleId)
                      }}
                    >
                      {t('workflow.schedule')}
                    </Button>
                  </div>
                  <div className="flex items-end text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                    {scheduleResult ? `${t('workflow.scheduled')}: ${scheduleResult}` : ''}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[length:var(--text-sm)] font-medium text-[var(--color-text)]">{t('workflow.steps')}</p>
                  <div className="space-y-2">
                    {activeWorkflow.steps.length === 0 ? (
                      <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('workflow.noSteps')}</p>
                    ) : (
                      activeWorkflow.steps.map((step, index) => (
                        <div key={step.id} className="rounded-[var(--radius-md)] ring-1 ring-[var(--color-border-subtle)] bg-[var(--color-surface-soft)] px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[length:var(--text-sm)] font-medium text-[var(--color-text)]">{t('workflow.step')} {index + 1}</span>
                            <Badge variant="info">{step.type}</Badge>
                          </div>
                          <p className="mt-1 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                            {step.toolName || step.aiPrompt || '-'}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </Card>

              <WorkflowRunLog
                run={activeRun}
                steps={activeWorkflow.steps}
                onPause={pauseRun}
                onResume={resumeRun}
                onCancel={cancelRun}
              />
            </div>
          ) : (
            <Card variant="outline" className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
              {t('workflow.empty')}
            </Card>
          )}
        </div>
      </div>

      <WorkflowBuilder
        open={showBuilder}
        onClose={() => setShowBuilder(false)}
        onSubmit={async (def) => {
          await createWorkflow(def)
        }}
      />
    </div>
  )
}
