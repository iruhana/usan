import type { SystemMetrics } from '@shared/types/infrastructure'
import { Card } from '../ui'
import { t } from '../../i18n'

interface NetworkTrafficProps {
  metrics: SystemMetrics | null
  history: SystemMetrics[]
}

function buildPolylinePoints(values: number[], max: number, width: number, height: number): string {
  if (values.length === 0 || max <= 0) return ''
  const stepX = width / Math.max(values.length - 1, 1)
  return values
    .map((value, idx) => {
      const x = idx * stepX
      const y = height - (Math.max(0, value) / max) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function toHumanBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B/s'
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  let current = value
  let index = 0
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024
    index += 1
  }
  return `${current.toFixed(current >= 100 ? 0 : 1)} ${units[index]}`
}

export default function NetworkTraffic({ metrics, history }: NetworkTrafficProps) {
  const inboundValues = history.slice(-60).map((item) => item.network?.bytesIn ?? 0)
  const outboundValues = history.slice(-60).map((item) => item.network?.bytesOut ?? 0)
  const max = Math.max(1, ...inboundValues, ...outboundValues)
  const inboundPoints = buildPolylinePoints(inboundValues, max, 220, 56)
  const outboundPoints = buildPolylinePoints(outboundValues, max, 220, 56)

  return (
    <Card variant="elevated" className="space-y-3">
      <h3 className="text-[length:var(--text-md)] font-semibold text-[var(--color-text)]">{t('dashboard.network')}</h3>

      <svg viewBox="0 0 220 56" className="h-14 w-full">
        <polyline points={inboundPoints} fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" />
        <polyline points={outboundPoints} fill="none" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round" />
      </svg>

      <div className="space-y-1 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
        <p>{t('dashboard.network.in')}: {toHumanBytes(metrics?.network?.bytesIn ?? 0)}</p>
        <p>{t('dashboard.network.out')}: {toHumanBytes(metrics?.network?.bytesOut ?? 0)}</p>
      </div>
    </Card>
  )
}
