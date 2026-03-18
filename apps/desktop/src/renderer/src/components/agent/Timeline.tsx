import { RotateCcw } from 'lucide-react'
import { Badge, Button, InlineNotice } from '../ui'
import { t } from '../../i18n'
import { messagesToTimelineSteps } from './timeline-state'
import StepItem from './StepItem'
import type {
  TimelineApprovalRequest,
  TimelineStep,
  TimelineStepStatus,
  TimelineStreamState,
} from './types'
import type { ChatMessage } from '@shared/types/ipc'

interface TimelineProps {
  messages?: ChatMessage[]
  steps?: TimelineStep[]
  isStreaming?: boolean
  streamingPhase?: TimelineStreamState['streamingPhase']
  streamingText?: string
  activeToolName?: string | null
  pendingApproval?: TimelineApprovalRequest | null
  onRetry?: () => void
  onApprove?: (request: TimelineApprovalRequest) => void
  onReject?: (request: TimelineApprovalRequest) => void
  className?: string
}

const summaryBadgeVariant: Record<TimelineStepStatus, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
  completed: 'success',
  running: 'info',
  awaiting: 'warning',
  failed: 'danger',
  pending: 'default',
}

const statusOrder: TimelineStepStatus[] = ['running', 'awaiting', 'failed', 'completed', 'pending']

function buildTimelineSteps(messages: ChatMessage[], streamState: TimelineStreamState): TimelineStep[] {
  return messagesToTimelineSteps(messages, streamState)
}

export function Timeline({
  messages = [],
  steps,
  isStreaming = false,
  streamingPhase = 'idle',
  streamingText = '',
  activeToolName = null,
  pendingApproval = null,
  onRetry,
  onApprove,
  onReject,
  className = '',
}: TimelineProps) {
  const resolvedSteps =
    steps ??
    buildTimelineSteps(messages, {
      isStreaming,
      streamingPhase,
      streamingText,
      activeToolName,
      pendingApproval,
    })

  const counts = resolvedSteps.reduce<Record<TimelineStepStatus, number>>(
    (accumulator, step) => {
      accumulator[step.status] += 1
      return accumulator
    },
    {
      completed: 0,
      running: 0,
      awaiting: 0,
      failed: 0,
      pending: 0,
    },
  )

  const hasFailedStep = resolvedSteps.some((step) => step.status === 'failed')
  const isBusy = isStreaming || counts.running > 0 || counts.awaiting > 0

  return (
    <section
      aria-label={t('agent.timelineTitle')}
      aria-busy={isBusy}
      data-testid="agent-timeline"
      className={[
        'rounded-[28px] bg-[var(--color-panel-bg-strong)] px-5 py-5 shadow-[var(--shadow-sm)] ring-1 ring-[var(--color-border-subtle)]',
        className,
      ].join(' ')}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            {t('agent.timelineTitle')}
          </p>
          <h2 className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-[var(--color-text)]">
            {t('agent.timelineSubtitle')}
          </h2>
        </div>

        {hasFailedStep && onRetry ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leftIcon={<RotateCcw size={14} />}
            onClick={onRetry}
            data-testid="timeline-retry-button"
          >
            {t('error.retry')}
          </Button>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2" data-testid="timeline-summary">
        {statusOrder.map((status) => (
          <Badge
            key={status}
            variant={summaryBadgeVariant[status]}
            className="min-w-[92px] justify-between"
          >
            <span>{t(`agent.status.${status}`)}</span>
            <span>{counts[status]}</span>
          </Badge>
        ))}
      </div>

      {resolvedSteps.length === 0 ? (
        <InlineNotice
          tone="info"
          title={t('agent.timelineEmptyTitle')}
          className="mt-5"
        >
          {t('agent.timelineEmptyBody')}
        </InlineNotice>
      ) : (
        <ol
          className="mt-5 space-y-3"
          role="list"
          aria-live={isBusy ? 'polite' : 'off'}
          aria-relevant="additions text"
        >
          {resolvedSteps.map((step, index) => (
            <StepItem
              key={step.id}
              step={step}
              isLast={index === resolvedSteps.length - 1}
              onApprove={onApprove}
              onReject={onReject}
            />
          ))}
        </ol>
      )}
    </section>
  )
}

export default Timeline
