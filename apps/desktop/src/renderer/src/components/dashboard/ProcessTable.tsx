import type { ProcessInfo } from '@shared/types/infrastructure'
import { t } from '../../i18n'

interface ProcessTableProps {
  processes: ProcessInfo[]
}

export default function ProcessTable({ processes }: ProcessTableProps) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] ring-1 ring-[var(--color-border-subtle)] bg-[var(--color-bg-card)]">
      <div className="overflow-auto">
        <table className="min-w-full text-left text-[length:var(--text-sm)]">
          <thead className="bg-[var(--color-surface-soft)] text-[var(--color-text-muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">{t('dashboard.process.name')}</th>
              <th className="px-3 py-2 font-medium">{t('dashboard.process.pid')}</th>
              <th className="px-3 py-2 font-medium">{t('dashboard.process.cpu')}</th>
              <th className="px-3 py-2 font-medium">{t('dashboard.process.memory')}</th>
              <th className="px-3 py-2 font-medium">{t('dashboard.process.window')}</th>
            </tr>
          </thead>
          <tbody>
            {processes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-[var(--color-text-muted)]">{t('dashboard.noData')}</td>
              </tr>
            ) : (
              processes.map((process) => (
                <tr key={`${process.pid}-${process.name}`} className="border-t border-[var(--color-border-subtle)]">
                  <td className="px-3 py-2 text-[var(--color-text)]">{process.name}</td>
                  <td className="px-3 py-2 text-[var(--color-text-muted)]">{process.pid}</td>
                  <td className="px-3 py-2 text-[var(--color-text-muted)]">{process.cpu.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-[var(--color-text-muted)]">{process.memory.toFixed(0)} MB</td>
                  <td className="max-w-[280px] truncate px-3 py-2 text-[var(--color-text-muted)]" title={process.windowTitle}>{process.windowTitle || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
