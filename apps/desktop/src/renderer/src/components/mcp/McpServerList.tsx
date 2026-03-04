import { useCallback, useEffect, useState } from 'react'
import type { McpServerConfig, McpServerStatus, McpToolInfo } from '@shared/types/infrastructure'
import { Plug, Link2, Unlink2, Trash2, Plus, RefreshCw } from 'lucide-react'
import { Card, Button, Input, SectionHeader } from '../ui'
import { t } from '../../i18n'
import McpToolPanel from './McpToolPanel'

type Transport = McpServerConfig['transport']

export default function McpServerList() {
  const [servers, setServers] = useState<McpServerStatus[]>([])
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null)
  const [tools, setTools] = useState<McpToolInfo[]>([])
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [transport, setTransport] = useState<Transport>('stdio')
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadServers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await window.usan?.mcp.listServers()
      setServers(next ?? [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadTools = useCallback(async (serverId: string) => {
    setError(null)
    try {
      const next = await window.usan?.mcp.listTools(serverId)
      setTools(next ?? [])
      setSelectedServerId(serverId)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  useEffect(() => {
    loadServers().catch(() => {})
  }, [loadServers])

  return (
    <Card variant="outline" className="space-y-3">
      <SectionHeader
        title={t('mcp.title')}
        icon={Plug}
        indicator="var(--color-primary)"
        action={(
          <Button size="sm" variant="ghost" leftIcon={<RefreshCw size={14} />} onClick={() => loadServers()}>
            {t('dashboard.refresh')}
          </Button>
        )}
      />

      {error && (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-3 py-2 text-[length:var(--text-sm)] text-[var(--color-danger)]">
          {error}
        </p>
      )}

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
        <p className="mb-2 text-[length:var(--text-sm)] font-medium text-[var(--color-text)]">{t('mcp.addServer')}</p>
        <div className="grid gap-2 md:grid-cols-2">
          <Input label={t('mcp.id')} value={id} onChange={(event) => setId(event.target.value)} placeholder="local-mcp" />
          <Input label={t('mcp.name')} value={name} onChange={(event) => setName(event.target.value)} placeholder="Local MCP" />
          <label className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
            {t('mcp.transport')}
            <select
              className="mt-1 h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-2 text-[length:var(--text-sm)]"
              value={transport}
              onChange={(event) => setTransport(event.target.value as Transport)}
            >
              <option value="stdio">stdio</option>
              <option value="sse">sse</option>
            </select>
          </label>
          {transport === 'stdio' ? (
            <>
              <Input label={t('mcp.command')} value={command} onChange={(event) => setCommand(event.target.value)} placeholder="node" />
              <Input label={t('mcp.args')} value={args} onChange={(event) => setArgs(event.target.value)} placeholder="server.js --stdio" />
            </>
          ) : (
            <Input label={t('mcp.url')} value={url} onChange={(event) => setUrl(event.target.value)} placeholder="http://localhost:3000/mcp" />
          )}
        </div>
        <Button
          size="sm"
          className="mt-2"
          leftIcon={<Plus size={14} />}
          disabled={id.trim().length === 0 || name.trim().length === 0}
          onClick={async () => {
            const config: McpServerConfig = {
              id: id.trim(),
              name: name.trim(),
              transport,
              command: transport === 'stdio' ? command.trim() : undefined,
              args: transport === 'stdio' && args.trim().length > 0 ? args.trim().split(/\s+/) : undefined,
              url: transport === 'sse' ? url.trim() : undefined,
            }
            await window.usan?.mcp.addServer(config)
            setId('')
            setName('')
            setCommand('')
            setArgs('')
            setUrl('')
            await loadServers()
          }}
        >
          {t('mcp.addServer')}
        </Button>
      </div>

      {loading ? (
        <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('files.loading')}</p>
      ) : servers.length === 0 ? (
        <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('mcp.empty')}</p>
      ) : (
        <div className="space-y-2">
          {servers.map((server) => (
            <div key={server.id} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[length:var(--text-sm)] font-medium text-[var(--color-text)]">{server.name}</p>
                  <p className="truncate text-[length:var(--text-xs)] text-[var(--color-text-muted)]">{server.id} • {server.toolCount} tools</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${server.connected ? 'bg-[var(--color-success)]/20 text-[var(--color-text)]' : 'bg-[var(--color-surface-soft)] text-[var(--color-text-muted)]'}`}>
                  {server.connected ? t('mcp.connected') : t('mcp.disconnected')}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {server.connected ? (
                  <Button size="sm" variant="secondary" leftIcon={<Unlink2 size={13} />} onClick={async () => {
                    await window.usan?.mcp.disconnectServer(server.id)
                    if (selectedServerId === server.id) setTools([])
                    await loadServers()
                  }}>
                    {t('mcp.disconnect')}
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" leftIcon={<Link2 size={13} />} onClick={async () => {
                    await window.usan?.mcp.connectServer(server.id)
                    await loadServers()
                    await loadTools(server.id)
                  }}>
                    {t('mcp.connect')}
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => loadTools(server.id)}>
                  {t('mcp.tools')}
                </Button>
                <Button size="sm" variant="danger" leftIcon={<Trash2 size={13} />} onClick={async () => {
                  await window.usan?.mcp.removeServer(server.id)
                  if (selectedServerId === server.id) {
                    setSelectedServerId(null)
                    setTools([])
                  }
                  await loadServers()
                }}>
                  {t('mcp.remove')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedServerId && (
        <>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
            <p className="mb-2 text-[length:var(--text-sm)] font-medium text-[var(--color-text)]">
              {t('mcp.toolsFor')}: {selectedServerId}
            </p>
            {tools.length === 0 ? (
              <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('mcp.noTools')}</p>
            ) : (
              <div className="max-h-40 space-y-1 overflow-auto">
                {tools.map((tool) => (
                  <p key={`${tool.serverId}:${tool.name}`} className="truncate text-[length:var(--text-sm)] text-[var(--color-text)]">
                    {tool.name}
                  </p>
                ))}
              </div>
            )}
          </div>
          <McpToolPanel serverId={selectedServerId} />
        </>
      )}
    </Card>
  )
}
