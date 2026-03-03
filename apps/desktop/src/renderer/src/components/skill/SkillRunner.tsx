import { CheckCircle, XCircle, Loader2, Clock, Play, Pause, Square, RotateCcw } from 'lucide-react'
import { useSkillStore } from '../../stores/skill.store'
import type { SkillStepStatus, SkillRunState } from '../../stores/skill.store'
import { t } from '../../i18n'

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

const STATE_BG: Record<SkillRunState, string> = {
  idle: 'bg-[var(--color-bg)]',
  validating: 'bg-[var(--color-primary-light)]',
  running: 'bg-[var(--color-primary-light)]',
  paused: 'bg-[var(--color-surface-soft)]',
  done: 'bg-[var(--color-surface-soft)]',
  failed: 'bg-[var(--color-danger-bg)]',
  cancelled: 'bg-[var(--color-bg)]',
}

export default function SkillRunner() {
  const currentRun = useSkillStore((s) => s.currentRun)
  const setState = useSkillStore((s) => s.setState)
  const updateStep = useSkillStore((s) => s.updateStep)
  const reset = useSkillStore((s) => s.reset)

  if (!currentRun) return null

  const { title, state, steps, error } = currentRun
  const canPause = state === 'running'
  const canResume = state === 'paused'
  const canCancel = state === 'running' || state === 'paused' || state === 'validating'

  return (
    <div className="border border-[var(--color-border)] rounded-[var(--radius-lg)] bg-[var(--color-bg-card)] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-[var(--color-text)] text-[length:var(--text-md)]">
            {title}
          </h3>
          <span
            className={`inline-block mt-1 px-3 py-1 rounded-full font-medium text-[length:var(--text-sm)] ${STATE_BG[state]}`}
          >
            {t(STATE_LABEL[state])}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {canPause && (
            <button
              onClick={() => setState('paused')}
              className="p-3 rounded-[var(--radius-md)] bg-[var(--color-bg)] hover:bg-[var(--color-bg-sidebar)] transition-all"
              style={{ minWidth: '44px', minHeight: '44px' }}
              aria-label={t('skill.pause')}
            >
              <Pause size={20} />
            </button>
          )}
          {canResume && (
            <button
              onClick={() => setState('running')}
              className="p-3 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-[var(--color-text-inverse)] hover:bg-[var(--color-primary-hover)] transition-all"
              style={{ minWidth: '44px', minHeight: '44px' }}
              aria-label={t('skill.resume')}
            >
              <Play size={20} />
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => setState('cancelled')}
              className="p-3 rounded-[var(--radius-md)] bg-[var(--color-danger-bg)] text-[var(--color-danger)] hover:bg-[var(--color-danger-bg-hover)] transition-all"
              style={{ minWidth: '44px', minHeight: '44px' }}
              aria-label={t('skill.cancel')}
            >
              <Square size={20} />
            </button>
          )}
          {(state === 'done' || state === 'failed' || state === 'cancelled') && (
            <button
              onClick={reset}
              className="p-3 rounded-[var(--radius-md)] bg-[var(--color-bg)] hover:bg-[var(--color-bg-sidebar)] transition-all text-[var(--color-text-muted)]"
              style={{ minWidth: '44px', minHeight: '44px' }}
              aria-label={t('titlebar.close')}
            >
              <XCircle size={20} />
            </button>
          )}
        </div>
      </div>

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
        <div className="mt-3 p-3 rounded-[var(--radius-md)] bg-[var(--color-danger-bg)] text-[var(--color-danger)] text-[length:var(--text-md)]">
          {error}
        </div>
      )}
    </div>
  )
}
