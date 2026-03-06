import { useEffect } from 'react'
import { CheckCircle, XCircle, Loader2, Clock, Play, Pause, Square, RotateCcw } from 'lucide-react'
import { useSkillStore } from '../../stores/skill.store'
import type { SkillStepStatus, SkillRunState } from '../../stores/skill.store'
import { t } from '../../i18n'
import { Badge, Button, InlineNotice, ProgressSummary } from '../ui'
import { toSkillErrorMessage, toTechnicalErrorDetails } from '../../lib/user-facing-errors'

const STEP_ICON: Record<SkillStepStatus, typeof Clock> = {
  pending: Clock,
  running: Loader2,
  done: CheckCircle,
  failed: XCircle,
}

const STEP_COLOR: Record<SkillStepStatus, string> = {
  pending: 'text-[var(--color-text-muted)]',
  running: 'text-[var(--color-primary)]',
  done: 'text-[var(--color-success)]',
  failed: 'text-[var(--color-danger)]',
}

const STATE_LABEL: Record<SkillRunState, string> = {
  idle: 'skill.pending',
  validating: 'skill.running',
  running: 'skill.running',
  paused: 'skill.paused',
  done: 'skill.done',
  failed: 'skill.failed',
  cancelled: 'skill.cancelled',
}

const STATE_BADGE: Record<SkillRunState, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  idle: 'default',
  validating: 'info',
  running: 'info',
  paused: 'warning',
  done: 'success',
  failed: 'danger',
  cancelled: 'warning',
}

export default function SkillRunner() {
  const currentRun = useSkillStore((s) => s.currentRun)
  const setState = useSkillStore((s) => s.setState)
  const updateStep = useSkillStore((s) => s.updateStep)
  const reset = useSkillStore((s) => s.reset)
  const forceVisible =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('usan_e2e_force_skill_runner') === '1'

  useEffect(() => {
    if (!forceVisible || currentRun) {
      return
    }

    const store = useSkillStore.getState()
    store.startRun('e2e-skill-runner', 'File cleanup check', [
      { id: 'scan', title: 'Check the selected folder', status: 'done', detail: 'Folder scan finished.' },
      { id: 'review', title: 'Review suggested changes', status: 'failed', detail: 'Usan needs you to check one item.' },
      { id: 'finish', title: 'Finish cleanup', status: 'pending' },
    ])
    store.setState('failed', 'network timeout')
  }, [currentRun, forceVisible])

  if (!currentRun) return null

  const { title, state, steps, error } = currentRun
  const canPause = state === 'running'
  const canResume = state === 'paused'
  const canCancel = state === 'running' || state === 'paused' || state === 'validating'
  const completedSteps = steps.filter((step) => step.status === 'done').length
  const activeStep =
    steps.find((step) => step.status === 'running') ??
    steps.find((step) => step.status === 'failed') ??
    null
  const progressPercent = steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0

  return (
    <section
      data-view="skill-runner"
      aria-label={t('skill.title')}
      className="fixed bottom-10 left-6 z-40 w-[360px] max-w-[calc(100vw-3rem)] rounded-[var(--radius-lg)] ring-1 ring-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-4 shadow-[var(--shadow-lg)]"
    >
      <ProgressSummary
        title={title}
        status={<Badge variant={STATE_BADGE[state]}>{t(STATE_LABEL[state])}</Badge>}
        metrics={[
          { label: t('progress.progress'), value: `${completedSteps}/${steps.length}` },
          { label: t('progress.status'), value: t(STATE_LABEL[state]) },
        ]}
        progressPercent={progressPercent}
        progressLabel={t('progress.progress')}
        footer={activeStep ? `${t('progress.current')}: ${activeStep.title}` : t('progress.finished')}
        actions={
          <>
            {canPause && (
              <Button size="sm" variant="secondary" leftIcon={<Pause size={14} />} onClick={() => setState('paused')}>
                {t('skill.pause')}
              </Button>
            )}
            {canResume && (
              <Button size="sm" leftIcon={<Play size={14} />} onClick={() => setState('running')}>
                {t('skill.resume')}
              </Button>
            )}
            {canCancel && (
              <Button size="sm" variant="danger" leftIcon={<Square size={14} />} onClick={() => setState('cancelled')}>
                {t('skill.cancel')}
              </Button>
            )}
            {(state === 'done' || state === 'failed' || state === 'cancelled') && (
              <Button size="sm" variant="secondary" leftIcon={<XCircle size={14} />} onClick={reset}>
                {t('titlebar.close')}
              </Button>
            )}
          </>
        }
        className="mb-4"
      />

      {/* Step timeline */}
      <div className="flex flex-col gap-1">
        {steps.map((step, i) => {
          const Icon = STEP_ICON[step.status]
          return (
            <div key={step.id} className="flex items-start gap-3">
              {/* Timeline line + icon */}
              <div className="flex flex-col items-center">
                <div className={`${STEP_COLOR[step.status]} ${step.status === 'running' ? 'animate-spin' : ''}`}>
                  <Icon size={20} />
                </div>
                {i < steps.length - 1 && (
                  <div className="w-px h-6 bg-[var(--color-border)]" />
                )}
              </div>

              {/* Step content */}
              <div className="flex-1 pb-2">
                <span
                  className={`font-medium text-[length:var(--text-md)] ${step.status === 'failed' ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]'}`}
                >
                  {step.title}
                </span>
                {step.detail && (
                  <p className="text-[var(--color-text-muted)] mt-0.5 text-[length:var(--text-sm)]">
                    {step.detail}
                  </p>
                )}
                {step.status === 'failed' && (
                  <button
                    onClick={() => updateStep(step.id, 'pending')}
                    className="mt-1 flex items-center gap-1 text-[var(--color-primary)] font-medium text-[length:var(--text-md)]"
                    style={{ minHeight: '44px' }}
                  >
                    <RotateCcw size={14} /> {t('skill.retry')}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Error message */}
      {error && (
        <InlineNotice tone="error" title={t('skill.failed')} className="mt-3">
          <p>{toSkillErrorMessage(error)}</p>
          <details className="mt-2">
            <summary className="cursor-pointer text-[length:var(--text-xs)] font-medium text-[var(--color-text-muted)]">
              {t('error.details')}
            </summary>
            <pre className="mt-2 whitespace-pre-wrap rounded-[var(--radius-sm)] bg-[var(--color-bg-card)] p-2 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
              {toTechnicalErrorDetails(error)}
            </pre>
          </details>
        </InlineNotice>
      )}
    </section>
  )
}
