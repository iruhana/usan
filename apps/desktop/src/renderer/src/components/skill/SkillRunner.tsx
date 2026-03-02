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
  failed: 'text-red-500',
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
  validating: 'bg-blue-100 dark:bg-blue-900/20',
  running: 'bg-blue-100 dark:bg-blue-900/20',
  paused: 'bg-amber-100 dark:bg-amber-900/20',
  done: 'bg-green-100 dark:bg-green-900/20',
  failed: 'bg-red-100 dark:bg-red-900/20',
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
    <div className="border border-[var(--color-border)] rounded-2xl bg-[var(--color-bg-card)] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-[var(--color-text)]" style={{ fontSize: 'var(--font-size-base)' }}>
            {title}
          </h3>
          <span
            className={`inline-block mt-1 px-3 py-1 rounded-full font-medium ${STATE_BG[state]}`}
            style={{ fontSize: 'calc(12px * var(--font-scale))' }}
          >
            {t(STATE_LABEL[state])}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {canPause && (
            <button
              onClick={() => setState('paused')}
              className="p-2.5 rounded-lg bg-[var(--color-bg)] hover:bg-[var(--color-bg-sidebar)] transition-all"
              style={{ minWidth: '44px', minHeight: '44px' }}
              aria-label={t('skill.pause')}
            >
              <Pause size={20} />
            </button>
          )}
          {canResume && (
            <button
              onClick={() => setState('running')}
              className="p-2.5 rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-all"
              style={{ minWidth: '44px', minHeight: '44px' }}
              aria-label={t('skill.resume')}
            >
              <Play size={20} />
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => setState('cancelled')}
              className="p-2.5 rounded-lg bg-red-100 dark:bg-red-900/20 text-red-600 hover:bg-red-200 dark:hover:bg-red-900/40 transition-all"
              style={{ minWidth: '44px', minHeight: '44px' }}
              aria-label={t('skill.cancel')}
            >
              <Square size={20} />
            </button>
          )}
          {(state === 'done' || state === 'failed' || state === 'cancelled') && (
            <button
              onClick={reset}
              className="p-2.5 rounded-lg bg-[var(--color-bg)] hover:bg-[var(--color-bg-sidebar)] transition-all text-[var(--color-text-muted)]"
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
                  className={`font-medium ${step.status === 'failed' ? 'text-red-500' : 'text-[var(--color-text)]'}`}
                  style={{ fontSize: 'var(--font-size-sm)' }}
                >
                  {step.title}
                </span>
                {step.detail && (
                  <p className="text-[var(--color-text-muted)] mt-0.5" style={{ fontSize: 'calc(12px * var(--font-scale))' }}>
                    {step.detail}
                  </p>
                )}
                {step.status === 'failed' && (
                  <button
                    onClick={() => updateStep(step.id, 'pending')}
                    className="mt-1 flex items-center gap-1 text-[var(--color-primary)] font-medium"
                    style={{ fontSize: 'calc(13px * var(--font-scale))', minHeight: '44px' }}
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
        <div className="mt-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400" style={{ fontSize: 'var(--font-size-sm)' }}>
          {error}
        </div>
      )}
    </div>
  )
}
