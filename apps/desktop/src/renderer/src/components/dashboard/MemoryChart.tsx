import type { SystemMetrics } from '@shared/types/infrastructure'
import { Card } from '../ui'
import { t } from '../../i18n'

interface MemoryChartProps {
  metrics: SystemMetrics | null
  history: SystemMetrics[]
}

function buildPolylinePoints(values: number[], width: number, height: number): string {
  if (values.length === 0) return ''
  const stepX = width / Math.max(values.length - 1, 1)
  return values
    .map((value, idx) => {
      const x = idx * stepX
      const y = height - (Math.max(0, Math.min(100, value)) / 100) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export default function MemoryChart({ metrics, history }: MemoryChartProps) {
  const values = history.slice(-60).map((item) => item.memory.percent)
  const percent = metrics?.memory.percent ?? 0
  const points = buildPolylinePoints(values, 220, 56)

  return (
    <Card variant="elevated" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[length:var(--text-md)] font-semibold text-[var(--color-text)]">{t('dashboard.memory')}</h3>
        <span className="text-[length:var(--text-lg)] font-semibold text-[var(--color-text)]">{percent.toFixed(1)}%</span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-soft)]">
        <div className="h-full rounded-full bg-[var(--color-success)] transition-all" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      </div>

      <svg viewBox="0 0 220 56" className="h-14 w-full">
        <polyline points={points} fill="none" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" />
      </svg>

      <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
        {metrics ? `${metrics.memory.used.toFixed(0)} / ${metrics.memory.total.toFixed(0)} MB` : '0 / 0 MB'}
      </p>
    </Card>
  )
}
