import { useEffect, useMemo } from 'react'
import { Search } from 'lucide-react'
import { Button, Card, Input, SectionHeader } from '../components/ui'
import { useMarketplaceStore } from '../stores/marketplace.store'
import PluginCard from '../components/marketplace/PluginCard'
import PluginDetail from '../components/marketplace/PluginDetail'
import McpServerList from '../components/mcp/McpServerList'
import { t } from '../i18n'

export default function MarketplacePage() {
  const {
    query,
    entries,
    installed,
    selectedEntryId,
    loading,
    error,
    setQuery,
    setSelectedEntry,
    loadInstalled,
    search,
    install,
    update,
    uninstall,
    enable,
    disable,
  } = useMarketplaceStore()

  useEffect(() => {
    search('').catch(() => {})
    loadInstalled().catch(() => {})
  }, [search, loadInstalled])

  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId) ?? null

  const installedMap = useMemo(() => {
    const map = new Map<string, typeof installed[number]>()
    for (const plugin of installed) {
      map.set(plugin.manifest.id, plugin)
    }
    return map
  }, [installed])

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
        <div>
          <h1 className="text-[length:var(--text-xl)] font-semibold text-[var(--color-text)]">{t('marketplace.title')}</h1>
          <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('marketplace.subtitle')}</p>
        </div>

        <div className="flex min-w-[300px] items-center gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('marketplace.searchPlaceholder')}
            leftIcon={<Search size={16} />}
          />
          <Button onClick={() => search(query)}>{t('marketplace.search')}</Button>
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-[var(--radius-md)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-3 py-2 text-[length:var(--text-sm)] text-[var(--color-danger)]">
          {error}
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[1fr_360px]">
        <div className="min-h-0 overflow-auto">
          <SectionHeader title={t('marketplace.available')} indicator="var(--color-primary)" className="mb-3" />
          <div className="space-y-3">
            {entries.length === 0 ? (
              <Card variant="outline" className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('marketplace.empty')}</Card>
            ) : (
              entries.map((entry) => (
                <PluginCard
                  key={entry.id}
                  entry={entry}
                  installed={installedMap.get(entry.id) ?? null}
                  loading={loading}
                  onInstall={install}
                  onUpdate={update}
                  onSelect={setSelectedEntry}
                />
              ))
            )}
          </div>

          <SectionHeader title={t('marketplace.installedList')} indicator="var(--color-success)" className="mb-3 mt-5" />
          <div className="space-y-2">
            {installed.length === 0 ? (
              <Card variant="outline" className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('marketplace.noInstalled')}</Card>
            ) : (
              installed.map((plugin) => (
                <Card key={plugin.manifest.id} variant="outline" className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[length:var(--text-md)] font-medium text-[var(--color-text)]">{plugin.manifest.name}</p>
                    <p className="truncate text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{plugin.manifest.id} • v{plugin.manifest.version}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {plugin.enabled ? (
                      <Button variant="secondary" size="sm" onClick={() => disable(plugin.manifest.id)}>{t('marketplace.disable')}</Button>
                    ) : (
                      <Button size="sm" onClick={() => enable(plugin.manifest.id)}>{t('marketplace.enable')}</Button>
                    )}
                    <Button variant="danger" size="sm" onClick={() => uninstall(plugin.manifest.id)}>{t('marketplace.uninstall')}</Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        <div className="min-h-0 space-y-4 overflow-auto">
          <PluginDetail
            entry={selectedEntry}
            installed={selectedEntry ? installedMap.get(selectedEntry.id) ?? null : null}
            onEnable={enable}
            onDisable={disable}
            onUninstall={uninstall}
          />
          <McpServerList />
        </div>
      </div>
    </div>
  )
}
