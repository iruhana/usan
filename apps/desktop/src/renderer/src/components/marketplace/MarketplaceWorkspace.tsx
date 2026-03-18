import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Button, Card, InlineNotice, Input, PageIntro, SectionHeader } from '../ui'
import { useMarketplaceStore } from '../../stores/marketplace.store'
import { useSettingsStore } from '../../stores/settings.store'
import PluginCard from './PluginCard'
import PluginDetail from './PluginDetail'
import McpServerList from '../mcp/McpServerList'
import { t } from '../../i18n'

interface MarketplaceWorkspaceProps {
  embedded?: boolean
}

export default function MarketplaceWorkspace({ embedded = false }: MarketplaceWorkspaceProps) {
  const beginnerMode = useSettingsStore((state) => state.settings.beginnerMode)
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
  const [mcpReloadToken, setMcpReloadToken] = useState(0)

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

  const handlePluginMutation = async (action: () => Promise<void>) => {
    await action()
    setMcpReloadToken((value) => value + 1)
  }

  const searchCard = (
    <Card variant="default" className="space-y-4">
      {embedded ? (
        <SectionHeader
          title={t('marketplace.title')}
          indicator="var(--color-primary)"
          className="mb-0"
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[280px] flex-1">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('marketplace.searchPlaceholder')}
            aria-label={t('marketplace.searchPlaceholder')}
            leftIcon={<Search size={16} />}
          />
        </div>
        <Button data-action="marketplace-search" onClick={() => search(query)}>
          {t('marketplace.search')}
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-soft)]/70 px-4 py-4">
          <p className="text-[length:var(--text-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t('marketplace.availableSimple')}
          </p>
          <p className="mt-2 text-[length:var(--text-xl)] font-semibold tracking-tight text-[var(--color-text)]">
            {entries.length}
          </p>
        </div>
        <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-soft)]/70 px-4 py-4">
          <p className="text-[length:var(--text-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {t('marketplace.installedListSimple')}
          </p>
          <p className="mt-2 text-[length:var(--text-xl)] font-semibold tracking-tight text-[var(--color-text)]">
            {installed.length}
          </p>
        </div>
        <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-soft)]/70 px-4 py-4">
          <p className="text-[length:var(--text-xs)] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            MCP
          </p>
          <p className="mt-2 text-[length:var(--text-xl)] font-semibold tracking-tight text-[var(--color-text)]">
            {entries.reduce((total, entry) => total + entry.mcpServerCount, 0)}
          </p>
        </div>
      </div>
    </Card>
  )

  const content = (
    <>
      {embedded ? null : (
        <Card variant="elevated" className="mb-6 overflow-hidden p-0">
          <div className="bg-[linear-gradient(135deg,rgba(49,130,246,0.12),rgba(255,255,255,0.98))] p-5">
            <PageIntro
              title={t('marketplace.title')}
              description={t(beginnerMode ? 'marketplace.subtitleSimple' : 'marketplace.subtitle')}
            />
          </div>
        </Card>
      )}

      <div className={embedded ? '' : 'mb-4'}>
        {searchCard}
      </div>

      {error ? (
        <InlineNotice tone="error" title={t('marketplace.helpTitle')} className="mb-3">
          {error}
        </InlineNotice>
      ) : null}

      <div className="grid min-h-0 gap-4 xl:grid-cols-[1fr_360px]">
        <div className="min-h-0 space-y-4 overflow-auto">
          <Card variant="default" className="space-y-4">
            <SectionHeader
              title={t(beginnerMode ? 'marketplace.availableSimple' : 'marketplace.available')}
              indicator="var(--color-primary)"
              className="mb-0"
            />
            <div className="space-y-3">
              {entries.length === 0 ? (
                <Card variant="outline" className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                  {t('marketplace.empty')}
                </Card>
              ) : (
                entries.map((entry) => (
                  <PluginCard
                    key={entry.id}
                    entry={entry}
                    installed={installedMap.get(entry.id) ?? null}
                    loading={loading}
                    onInstall={(id) => handlePluginMutation(() => install(id))}
                    onUpdate={(id) => handlePluginMutation(() => update(id))}
                    onSelect={setSelectedEntry}
                    simpleMode={beginnerMode}
                  />
                ))
              )}
            </div>
          </Card>

          <Card variant="outline" className="space-y-4">
            <SectionHeader
              title={t(beginnerMode ? 'marketplace.installedListSimple' : 'marketplace.installedList')}
              indicator="var(--color-success)"
              className="mb-0"
            />
            <div className="space-y-2">
              {installed.length === 0 ? (
                <Card variant="outline" className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                  {t('marketplace.noInstalled')}
                </Card>
              ) : (
                installed.map((plugin) => (
                  <Card
                    key={plugin.manifest.id}
                    variant="default"
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[length:var(--text-md)] font-semibold text-[var(--color-text)]">
                        {plugin.manifest.name}
                      </p>
                      <p className="mt-1 truncate text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                        {plugin.manifest.description || `${t('marketplace.version')}: ${plugin.manifest.version}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {plugin.enabled ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handlePluginMutation(() => disable(plugin.manifest.id))}
                        >
                          {t('marketplace.disable')}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handlePluginMutation(() => enable(plugin.manifest.id))}
                        >
                          {t('marketplace.enable')}
                        </Button>
                      )}
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handlePluginMutation(() => uninstall(plugin.manifest.id))}
                      >
                        {t('marketplace.uninstall')}
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="min-h-0 space-y-4 overflow-auto">
          {!beginnerMode ? (
            <PluginDetail
              entry={selectedEntry}
              installed={selectedEntry ? installedMap.get(selectedEntry.id) ?? null : null}
              onEnable={(id) => handlePluginMutation(() => enable(id))}
              onDisable={(id) => handlePluginMutation(() => disable(id))}
              onUninstall={(id) => handlePluginMutation(() => uninstall(id))}
            />
          ) : null}
          <McpServerList reloadToken={mcpReloadToken} />
        </div>
      </div>
    </>
  )

  if (embedded) {
    return (
      <div className="space-y-4" data-view="marketplace-workspace">
        {content}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-5" data-view="marketplace-workspace">
      {content}
    </div>
  )
}
