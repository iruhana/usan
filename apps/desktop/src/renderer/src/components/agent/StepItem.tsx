import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  CircleDashed,
  FileText,
  LoaderCircle,
  ShieldAlert,
  Wrench,
} from 'lucide-react'
import { Badge, Card } from '../ui'
import { getLocale, t } from '../../i18n'
import ApprovalCard from './ApprovalCard'
import type { TimelineApprovalRequest, TimelineStep, TimelineStepKind, TimelineStepStatus } from './types'

interface StepItemProps {
  step: TimelineStep
  isLast?: boolean
  onApprove?: (request: TimelineApprovalRequest) => void
  onReject?: (request: TimelineApprovalRequest) => void
}

const statusBadgeVariant: Record<TimelineStepStatus, 'success' | 'info' | 'warning' | 'danger' | 'default'> = {
  completed: 'success',
  running: 'info',
  awaiting: 'warning',
  failed: 'danger',
  pending: 'default',
}

const statusIconClassName: Record<TimelineStepStatus, string> = {
  completed: 'text-[var(--color-success)]',
  running: 'text-[var(--color-primary)]',
  awaiting: 'text-[var(--color-warning)]',
  failed: 'text-[var(--color-danger)]',
  pending: 'text-[var(--color-text-muted)]',
}

const kindIconClassName: Record<TimelineStepKind, string> = {
  tool: 'text-[var(--color-primary)]',
  response: 'text-[var(--color-text)]',
  thinking: 'text-[var(--color-primary)]',
  approval: 'text-[var(--color-warning)]',
  error: 'text-[var(--color-danger)]',
}

const statusIcons: Record<TimelineStepStatus, typeof CheckCircle2> = {
  completed: CheckCircle2,
  running: LoaderCircle,
  awaiting: ShieldAlert,
  failed: AlertTriangle,
  pending: CircleDashed,
}

const kindIcons: Record<TimelineStepKind, typeof Wrench> = {
  tool: Wrench,
  response: FileText,
  thinking: Brain,
  approval: ShieldAlert,
  error: AlertTriangle,
}

function formatDuration(durationMs?: number): string | null {
  if (typeof durationMs !== 'number' || Number.isNaN(durationMs)) return null
  if (durationMs < 1000) return `${Math.round(durationMs)}ms`
  if (durationMs < 10_000) return `${(durationMs / 1000).toFixed(1)}s`
  return `${Math.round(durationMs / 100) / 10}s`
}

function formatTimestamp(timestamp?: number): string | null {
  if (!timestamp) return null

  const locale = getLocale()
  const localeTag = locale === 'ko' ? 'ko-KR' : locale === 'ja' ? 'ja-JP' : 'en-US'

  try {
    return new Intl.DateTimeFormat(localeTag, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(timestamp))
  } catch {
    return null
  }
}

function DetailBlock({ label, value, tone = 'default' }: { label: string; value?: string; tone?: 'default' | 'danger' }) {
  if (!value) return null

  return (
    <div className="rounded-[16px] bg-[var(--color-panel-muted)] px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <pre
        className={[
          'mt-1.5 whitespace-pre-wrap break-words font-sans text-[13px] leading-6',
          tone === 'danger' ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-secondary)]',
        ].join(' ')}
      >
        {value}
      </pre>
    </div>
  )
}

export function StepItem({ step, isLast = false, onApprove, onReject }: StepItemProps) {
  const StatusIcon = statusIcons[step.status]
  const KindIcon = kindIcons[step.kind]
  const durationLabel = formatDuration(step.durationMs)
  const timeLabel = formatTimestamp(step.timestamp)

  return (
    <li
      className="relative pl-14"
      data-testid={`timeline-step-${step.status}-${step.id}`}
      aria-current={step.status === 'running' ? 'step' : undefined}
    >
      {!isLast ? (
        <span
          aria-hidden="true"
          className="absolute left-[1.125rem] top-10 bottom-[-1rem] w-px bg-[var(--color-border-subtle)]"
        />
      ) : null}

      <span
        aria-hidden="true"
        className="absolute left-0 top-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-panel-bg-strong)] ring-1 ring-[var(--color-border-subtle)] shadow-[var(--shadow-xs)]"
      >
        <StatusIcon
          size={18}
          className={[
            statusIconClassName[step.status],
            step.status === 'running' ? 'animate-spin' : '',
          ].join(' ')}
        />
      </span>

      <Card
        variant={step.status === 'failed' ? 'outline' : 'default'}
        padding="md"
        className={[
          'rounded-[24px]',
          step.status === 'awaiting' ? 'ring-[rgba(217,129,31,0.2)]' : '',
          step.status === 'failed' ? 'ring-[rgba(229,72,77,0.18)]' : '',
        ].join(' ')}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] bg-[var(--color-surface-soft)]"
              >
                <KindIcon size={16} className={kindIconClassName[step.kind]} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-[15px] font-semibold text-[var(--color-text)]">
                    {step.title}
                  </h3>
                  <Badge variant={statusBadgeVariant[step.status]}>
                    {t(`agent.status.${step.status}`)}
                  </Badge>
                </div>
                {step.description ? (
                  <p className="mt-1 text-[14px] leading-6 text-[var(--color-text-secondary)]">
                    {step.description}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1 text-right text-[12px] text-[var(--color-text-muted)]">
            {durationLabel ? (
              <span>
                {t('agent.detail.duration')}: {durationLabel}
              </span>
            ) : null}
            {timeLabel ? (
              <span>
                {t('agent.detail.time')}: {timeLabel}
              </span>
            ) : null}
          </div>
        </div>

        {step.argsPreview || step.resultPreview || step.error ? (
          <div className="mt-4 grid gap-3">
            <DetailBlock label={t('agent.detail.arguments')} value={step.argsPreview} />
            <DetailBlock label={t('agent.detail.result')} value={step.resultPreview} />
            <DetailBlock
              label={t('agent.detail.error')}
              value={step.error}
              tone="danger"
            />
          </div>
        ) : null}

        {step.approval ? (
          <ApprovalCard request={step.approval} onApprove={onApprove} onReject={onReject} />
        ) : null}
      </Card>
    </li>
  )
}

export default StepItem
