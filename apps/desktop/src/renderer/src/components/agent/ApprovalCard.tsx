import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { Button, Card } from '../ui'
import { t } from '../../i18n'
import type { TimelineApprovalRequest } from './types'

interface ApprovalCardProps {
  request: TimelineApprovalRequest
  onApprove?: (request: TimelineApprovalRequest) => void
  onReject?: (request: TimelineApprovalRequest) => void
}

export default function ApprovalCard({ request, onApprove, onReject }: ApprovalCardProps) {
  const tone = request.tone ?? 'default'
  const danger = tone === 'danger'
  const Icon = danger ? AlertTriangle : ShieldAlert

  return (
    <Card
      variant="outline"
      padding="md"
      role="alert"
      aria-label={request.title}
      data-testid={`approval-card-${request.id}`}
      className={[
        'mt-3 rounded-[20px] border-l-4',
        danger
          ? 'border-l-[var(--color-danger)]'
          : 'border-l-[var(--color-primary)]',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <div
          className={[
            'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]',
            danger
              ? 'bg-[var(--color-danger-light)] text-[var(--color-danger)]'
              : 'bg-[var(--color-primary-light)] text-[var(--color-primary)]',
          ].join(' ')}
        >
          <Icon size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-[var(--color-text)]">{request.title}</p>
          <p className="mt-1 text-[13px] leading-6 text-[var(--color-text-secondary)]">
            {request.description ?? t('agent.approval.description')}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={danger ? 'danger' : 'primary'}
              onClick={() => onApprove?.(request)}
            >
              {request.confirmLabel ?? t('agent.approval.approve')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onReject?.(request)}
            >
              {request.rejectLabel ?? t('agent.approval.reject')}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
