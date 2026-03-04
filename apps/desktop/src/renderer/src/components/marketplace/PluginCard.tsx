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
  onSelect: (id: string) => void
}

export default function PluginCard({ entry, installed, loading, onInstall, onUpdate, onSelect }: PluginCardProps) {
  const isInstalled = !!installed
  const installAction = isInstalled ? () => onUpdate(entry.id) : () => onInstall(entry.id)

  return (
    <Card variant="elevated" className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            className="text-left"
            aria-label={`${entry.name} details`}
            onClick={() => onSelect(entry.id)}
          >
            <h3 className="truncate text-[length:var(--text-md)] font-semibold text-[var(--color-text)]">{entry.name}</h3>
          </button>
          <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{entry.description}</p>
        </div>
        <Badge variant={isInstalled ? 'success' : 'default'}>{isInstalled ? t('marketplace.installed') : t('marketplace.notInstalled')}</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
        <span>v{entry.version}</span>
        <span>•</span>
        <span>{entry.author}</span>
        <span>•</span>
        <span className="inline-flex items-center gap-1"><Star size={12} /> {entry.rating.toFixed(1)}</span>
        <span>•</span>
        <span>{entry.downloads.toLocaleString()} {t('marketplace.downloads')}</span>
      </div>

      <div className="flex flex-wrap gap-1">
        {entry.tags.map((tag) => (
          <span key={`${entry.id}-${tag}`} className="rounded-full bg-[var(--color-surface-soft)] px-2 py-0.5 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">{tag}</span>
        ))}
      </div>

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
