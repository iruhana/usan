import type { SystemMetrics } from '@shared/types/infrastructure'
import { Card } from '../ui'
import { t } from '../../i18n'

interface DiskUsageProps {
  metrics: SystemMetrics | null
}

export default function DiskUsage({ metrics }: DiskUsageProps) {
  const disks = metrics?.disk ?? []

  return (
    <Card variant="elevated" className="space-y-3">
      <h3 className="text-[length:var(--text-md)] font-semibold text-[var(--color-text)]">{t('dashboard.disk')}</h3>

      {disks.length === 0 ? (
        <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('dashboard.noData')}</p>
      ) : (
        <div className="space-y-2">
          {disks.map((disk) => (
            <div key={disk.drive} className="space-y-1">
              <div className="flex items-center justify-between text-[length:var(--text-sm)]">
                <span className="text-[var(--color-text)]">{disk.drive}</span>
                <span className="text-[var(--color-text-muted)]">{disk.percent.toFixed(1)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-soft)]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(0, Math.min(100, disk.percent))}%`,
                    backgroundColor: disk.percent >= 90 ? 'var(--color-danger)' : disk.percent >= 75 ? 'var(--color-warning)' : 'var(--color-primary)',
                  }}
                />
              </div>
              <p className="text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                {(disk.total - disk.free).toFixed(1)} / {disk.total.toFixed(1)} GB
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
