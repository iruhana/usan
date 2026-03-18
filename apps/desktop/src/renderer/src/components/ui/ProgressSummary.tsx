import type { ReactNode } from 'react'

interface ProgressMetric {
  label: string
  value: string
}

interface ProgressSummaryProps {
  title: string
  status?: ReactNode
  actions?: ReactNode
  metrics?: ProgressMetric[]
  progressPercent?: number
  progressLabel?: string
  footer?: string | null
  className?: string
}

export function ProgressSummary({
  title,
  status,
  actions,
  metrics = [],
  progressPercent,
  progressLabel,
  footer,
  className = '',
}: ProgressSummaryProps) {
  return (
    <div className={`rounded-[var(--radius-md)] ring-1 ring-[var(--color-border-subtle)] bg-[var(--color-surface-soft)] px-4 py-3 ${className}`.trim()}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[length:var(--text-md)] font-semibold text-[var(--color-text)]">{title}</h3>
            {status}
          </div>
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>

      {metrics.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {metrics.map((metric) => (
            <div key={`${metric.label}-${metric.value}`} className="rounded-[var(--radius-sm)] bg-[var(--color-bg-card)] px-3 py-2">
              <p className="text-[length:var(--text-xs)] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                {metric.label}
              </p>
              <p className="mt-1 text-[length:var(--text-lg)] font-semibold text-[var(--color-text)]">
                {metric.value}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {typeof progressPercent === 'number' ? (
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-bg-card)]"
          role="progressbar"
          aria-label={progressLabel ?? 'Progress'}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.max(0, Math.min(100, progressPercent))}
        >
          <div
            className="h-full rounded-full bg-[var(--color-primary)] transition-all"
            style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
          />
        </div>
      ) : null}

      {footer ? (
        <p className="mt-3 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{footer}</p>
      ) : null}
    </div>
  )
}
