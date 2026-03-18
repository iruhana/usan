import { Card, Button, Badge } from '../ui'
import type { MarketplaceEntry, InstalledPlugin } from '@shared/types/infrastructure'
import { t } from '../../i18n'

interface PluginDetailProps {
  entry: MarketplaceEntry | null
  installed: InstalledPlugin | null
  onEnable: (id: string) => Promise<void>
  onDisable: (id: string) => Promise<void>
  onUninstall: (id: string) => Promise<void>
}

export default function PluginDetail({ entry, installed, onEnable, onDisable, onUninstall }: PluginDetailProps) {
  if (!entry) {
    return (
      <Card variant="outline" className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
        {t('marketplace.selectPlugin')}
      </Card>
    )
  }

  const installedEntry = installed && installed.manifest.id === entry.id ? installed : null

  return (
    <Card variant="outline" className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[length:var(--text-lg)] font-semibold text-[var(--color-text)]">{entry.name}</h3>
          <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{entry.description}</p>
        </div>
        <Badge variant={installedEntry ? 'success' : 'default'}>{installedEntry ? t('marketplace.installed') : t('marketplace.notInstalled')}</Badge>
      </div>

      <div className="grid gap-2 text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
        <p><strong>{t('marketplace.author')}:</strong> {entry.author}</p>
        <p><strong>{t('marketplace.version')}:</strong> {entry.version}</p>
        <p><strong>{t('marketplace.rating')}:</strong> {entry.rating.toFixed(1)}</p>
        <p><strong>{t('marketplace.downloads')}:</strong> {entry.downloads.toLocaleString()}</p>
        {entry.mcpServerCount > 0 ? <p><strong>MCP:</strong> {entry.mcpServerCount}</p> : null}
      </div>

      {installedEntry && (
        <div className="flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-3">
          {installedEntry.enabled ? (
            <Button variant="secondary" size="sm" onClick={() => onDisable(entry.id)}>{t('marketplace.disable')}</Button>
          ) : (
            <Button size="sm" onClick={() => onEnable(entry.id)}>{t('marketplace.enable')}</Button>
          )}
          <Button variant="danger" size="sm" onClick={() => onUninstall(entry.id)}>{t('marketplace.uninstall')}</Button>
        </div>
      )}
    </Card>
  )
}
