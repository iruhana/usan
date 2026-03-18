import { Download, RefreshCcw, Star } from 'lucide-react'
import { Badge, Button, Card } from '../ui'
import type { MarketplaceEntry, InstalledPlugin } from '@shared/types/infrastructure'
import { t } from '../../i18n'

interface PluginCardProps {
  entry: MarketplaceEntry
  installed: InstalledPlugin | null
  loading?: boolean
  onInstall: (id: string) => Promise<void>
  onUpdate: (id: string) => Promise<void>
  onSelect?: (id: string) => void
  simpleMode?: boolean
}

export default function PluginCard({ entry, installed, loading, onInstall, onUpdate, onSelect, simpleMode = false }: PluginCardProps) {
  const isInstalled = !!installed
  const installAction = isInstalled ? () => onUpdate(entry.id) : () => onInstall(entry.id)

  return (
    <Card variant="default" className="space-y-4 rounded-[28px] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {simpleMode || !onSelect ? (
            <h3 className="truncate text-[length:var(--text-md)] font-semibold tracking-tight text-[var(--color-text)]">{entry.name}</h3>
          ) : (
            <button
              type="button"
              className="text-left transition-colors hover:text-[var(--color-primary)]"
              aria-label={`${entry.name} ${t('marketplace.viewDetails')}`}
              onClick={() => onSelect(entry.id)}
            >
              <h3 className="truncate text-[length:var(--text-md)] font-semibold tracking-tight text-[var(--color-text)]">{entry.name}</h3>
            </button>
          )}
          <p className="mt-1 text-[length:var(--text-sm)] leading-relaxed text-[var(--color-text-secondary)]">{entry.description}</p>
        </div>
        <Badge variant={isInstalled ? 'success' : 'default'}>{isInstalled ? t('marketplace.installed') : t('marketplace.notInstalled')}</Badge>
      </div>

      {!simpleMode && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
            <span className="rounded-full bg-[var(--color-surface-soft)] px-3 py-1">{t('marketplace.version')} {entry.version}</span>
            <span className="rounded-full bg-[var(--color-surface-soft)] px-3 py-1">{entry.author}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-soft)] px-3 py-1"><Star size={12} /> {entry.rating.toFixed(1)}</span>
            <span className="rounded-full bg-[var(--color-surface-soft)] px-3 py-1">{entry.downloads.toLocaleString()} {t('marketplace.downloads')}</span>
            {entry.mcpServerCount > 0 ? (
              <span className="rounded-full bg-[var(--color-primary-light)] px-3 py-1 text-[var(--color-primary)]">MCP {entry.mcpServerCount}</span>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-1">
            {entry.tags.map((tag) => (
              <span key={`${entry.id}-${tag}`} className="rounded-full bg-[var(--color-primary-light)] px-2.5 py-1 text-[length:var(--text-xs)] font-medium text-[var(--color-primary)]">{tag}</span>
            ))}
          </div>
        </>
      )}

      <div className="flex justify-end">
        <Button
          size="sm"
          loading={loading}
          leftIcon={isInstalled ? <RefreshCcw size={14} /> : <Download size={14} />}
          onClick={installAction}
        >
          {isInstalled ? t('marketplace.update') : t('marketplace.install')}
        </Button>
      </div>
    </Card>
  )
}
