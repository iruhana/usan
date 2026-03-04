import { useEffect, useState } from 'react'
import { Pause, Play, Square } from 'lucide-react'
import { Badge, Button, Card } from '../ui'
import type { WorkflowRun } from '@shared/types/infrastructure'
import { t } from '../../i18n'

interface WorkflowRunLogProps {
  run: WorkflowRun | null
  onPause: (runId: string) => Promise<void>
  onResume: (runId: string) => Promise<void>
  onCancel: (runId: string) => Promise<void>
}

function statusVariant(status: WorkflowRun['status']): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case 'completed': return 'success'
    case 'failed': return 'danger'
    case 'paused': return 'warning'
    case 'running': return 'info'
    default: return 'default'
  }
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0ms'
  if (ms < 1000) return `${Math.round(ms)}ms`
  const sec = ms / 1000
  if (sec < 60) return `${sec.toFixed(1)}s`
  return `${(sec / 60).toFixed(1)}m`
}

export default function WorkflowRunLog({ run, onPause, onResume, onCancel }: WorkflowRunLogProps) {
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

  return (
    <Card variant="outline" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[length:var(--text-md)] font-semibold text-[var(--color-text)]">{t('workflow.run.title')}</h3>
          <Badge variant={statusVariant(run.status)}>{t(`workflow.status.${run.status}`)}</Badge>
        </div>

        {(run.status === 'running' || run.status === 'paused') && (
          <div className="flex items-center gap-2">
            {run.status === 'running' ? (
              <Button variant="secondary" size="sm" leftIcon={<Pause size={14} />} onClick={() => onPause(run.id)}>{t('workflow.pause')}</Button>
            ) : (
              <Button variant="secondary" size="sm" leftIcon={<Play size={14} />} onClick={() => onResume(run.id)}>{t('workflow.resume')}</Button>
            )}
            <Button variant="danger" size="sm" leftIcon={<Square size={14} />} onClick={() => onCancel(run.id)}>{t('workflow.cancel')}</Button>
          </div>
        )}
      </div>

      <div className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
        {t('workflow.run.duration')}: {formatDuration(totalDuration)}
      </div>

      <div className="space-y-2">
        {run.stepResults.map((result, index) => (
          <div
            key={`${result.stepId}-${index}`}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[length:var(--text-sm)] font-medium text-[var(--color-text)]">
                {t('workflow.run.step')} {index + 1} - {result.stepId}
              </span>
              <Badge variant={result.status === 'completed' ? 'success' : result.status === 'failed' ? 'danger' : 'default'}>
                {result.status}
              </Badge>
            </div>

            <div className="mt-1 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
              {t('workflow.run.duration')}: {formatDuration(result.durationMs)}
            </div>

            {result.error && (
              <div className="mt-1 text-[length:var(--text-xs)] text-[var(--color-danger)]">
                {t('workflow.run.error')}: {result.error}
              </div>
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
