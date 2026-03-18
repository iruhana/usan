import { useEffect, useState } from 'react'
import { Pause, Play, Square } from 'lucide-react'
import { Badge, Button, Card, InlineNotice, ProgressSummary } from '../ui'
import type { WorkflowRun, WorkflowStep } from '@shared/types/infrastructure'
import { t } from '../../i18n'
import { toTechnicalErrorDetails, toWorkflowErrorMessage } from '../../lib/user-facing-errors'

interface WorkflowRunLogProps {
  run: WorkflowRun | null
  steps?: WorkflowStep[]
  onPause: (runId: string) => Promise<void>
  onResume: (runId: string) => Promise<void>
  onCancel: (runId: string) => Promise<void>
}

type WorkflowDisplayStatus = WorkflowRun['status'] | 'skipped'

function statusVariant(status: WorkflowDisplayStatus): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case 'completed': return 'success'
    case 'failed': return 'danger'
    case 'skipped': return 'default'
    case 'paused': return 'warning'
    case 'cancelled': return 'warning'
    case 'running': return 'info'
    default: return 'default'
  }
}

function getStatusLabel(status: WorkflowDisplayStatus): string {
  const translated = t(`workflow.status.${status}`)
  return translated.startsWith('workflow.status.') ? status : translated
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0ms'
  if (ms < 1000) return `${Math.round(ms)}ms`
  const sec = ms / 1000
  if (sec < 60) return `${sec.toFixed(1)}s`
  return `${(sec / 60).toFixed(1)}m`
}

export default function WorkflowRunLog({ run, steps, onPause, onResume, onCancel }: WorkflowRunLogProps) {
  const [liveNow, setLiveNow] = useState(0)

  useEffect(() => {
    if (!run) {
      setLiveNow(0)
      return
    }
    if (run.completedAt) {
      setLiveNow(run.completedAt)
      return
    }

    const tick = () => setLiveNow(Date.now())
    tick()

    if (run.status !== 'running') {
      return
    }

    const timer = window.setInterval(tick, 250)
    return () => window.clearInterval(timer)
  }, [run])

  if (!run) {
    return (
      <Card variant="outline" className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
        {t('workflow.run.empty')}
      </Card>
    )
  }

  const totalDuration = Math.max(0, (run.completedAt ?? liveNow) - run.startedAt)
  const workflowSteps = steps ?? []
  const totalSteps = workflowSteps.length
  const completedCount = run.stepResults.filter((result) => result.status === 'completed').length
  const failedCount = run.stepResults.filter((result) => result.status === 'failed').length
  const skippedCount = run.stepResults.filter((result) => result.status === 'skipped').length
  const touchedCount = Math.min(totalSteps || run.stepResults.length, run.stepResults.length + (run.status === 'running' || run.status === 'paused' ? 1 : 0))
  const progressPercent = totalSteps > 0 ? Math.min(100, Math.round((touchedCount / totalSteps) * 100)) : 0
  const currentStep = run.status === 'running' || run.status === 'paused'
    ? workflowSteps[run.currentStepIndex] ?? null
    : null
  const currentStepLabel = currentStep ? describeWorkflowStep(currentStep) : null

  return (
    <Card variant="default" className="space-y-4">
      <ProgressSummary
        title={t('workflow.run.title')}
        status={<Badge variant={statusVariant(run.status)}>{getStatusLabel(run.status)}</Badge>}
        metrics={[
          { label: t('progress.progress'), value: totalSteps > 0 ? `${touchedCount}/${totalSteps}` : String(run.stepResults.length) },
          { label: t('workflow.run.duration'), value: formatDuration(totalDuration) },
          { label: t('workflow.status.completed'), value: String(completedCount) },
          { label: t('workflow.status.failed'), value: String(failedCount) },
          { label: t('workflow.status.skipped'), value: String(skippedCount) },
        ]}
        progressPercent={totalSteps > 0 ? progressPercent : undefined}
        progressLabel={t('progress.progress')}
        footer={currentStepLabel ? `${t('progress.current')}: ${currentStepLabel}` : t('progress.finished')}
        actions={
          run.status === 'running' || run.status === 'paused' ? (
            <>
              {run.status === 'running' ? (
                <Button variant="secondary" size="sm" leftIcon={<Pause size={14} />} onClick={() => onPause(run.id)}>{t('workflow.pause')}</Button>
              ) : (
                <Button variant="secondary" size="sm" leftIcon={<Play size={14} />} onClick={() => onResume(run.id)}>{t('workflow.resume')}</Button>
              )}
              <Button variant="danger" size="sm" leftIcon={<Square size={14} />} onClick={() => onCancel(run.id)}>{t('workflow.cancel')}</Button>
            </>
          ) : undefined
        }
      />

      {run.error && (
        <InlineNotice tone="error" title={t('workflow.run.error')}>
          <p>{toWorkflowErrorMessage(run.error, 'run')}</p>
          <details className="mt-2">
            <summary className="cursor-pointer text-[length:var(--text-xs)] font-medium text-[var(--color-text-muted)]">
              {t('workflow.run.viewDetails')}
            </summary>
            <pre className="mt-2 overflow-auto rounded-[var(--radius-sm)] bg-[var(--color-bg-card)] p-2 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
              {toTechnicalErrorDetails(run.error)}
            </pre>
          </details>
        </InlineNotice>
      )}

      <div className="space-y-2">
        {run.stepResults.map((result, index) => (
          <div
            key={`${result.stepId}-${index}`}
            className="rounded-[24px] bg-[var(--color-surface-soft)] px-4 py-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[length:var(--text-sm)] font-medium text-[var(--color-text)]">
                {t('workflow.run.step')} {index + 1} - {result.stepId}
              </span>
              <Badge variant={statusVariant(result.status)}>
                {getStatusLabel(result.status)}
              </Badge>
            </div>

            <div className="mt-1 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
              {t('workflow.run.duration')}: {formatDuration(result.durationMs)}
            </div>

            {result.error && (
              <InlineNotice tone="error" className="mt-2">
                <p>{t('workflow.run.stepFailed')}</p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-[length:var(--text-xs)] font-medium text-[var(--color-text-muted)]">
                    {t('workflow.run.viewDetails')}
                  </summary>
                  <pre className="mt-2 overflow-auto rounded-[var(--radius-sm)] bg-[var(--color-bg-card)] p-2 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                    {toTechnicalErrorDetails(result.error)}
                  </pre>
                </details>
              </InlineNotice>
            )}

            {result.result !== undefined && (
              <pre className="mt-2 overflow-auto rounded-[var(--radius-sm)] bg-[var(--color-bg-card)] p-2 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                {typeof result.result === 'string' ? result.result : JSON.stringify(result.result, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

function describeWorkflowStep(step: WorkflowStep): string {
  if (step.type === 'tool_call' && step.toolName) {
    const key = `tool.${step.toolName}`
    const label = t(key)
    return label !== key ? label : step.toolName
  }

  if (step.type === 'ai_decision' && step.aiPrompt) {
    return step.aiPrompt
  }

  if (step.type === 'delay' && typeof step.delayMs === 'number') {
    return `${t('workflow.step')} ${Math.max(1, Math.round(step.delayMs / 1000))}s`
  }

  return step.id
}
