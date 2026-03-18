import { useCallback, useEffect, useState } from 'react'
import type { McpServerConfig, McpServerStatus, McpToolInfo } from '@shared/types/infrastructure'
import { Plug, Link2, Unlink2, Trash2, Plus, RefreshCw } from 'lucide-react'
import { Card, Button, InlineNotice, Input, SectionHeader } from '../ui'
import { t } from '../../i18n'
import { hasE2EQueryFlag } from '../../lib/e2e-flags'
import { toMcpErrorMessage } from '../../lib/user-facing-errors'
import McpToolPanel from './McpToolPanel'

type Transport = McpServerConfig['transport']

interface NoticeState {
  tone: 'error' | 'success' | 'info'
  title: string
  body: string
}

interface McpServerListProps {
  reloadToken?: number
}

export default function McpServerList({ reloadToken = 0 }: McpServerListProps) {
  const forceNotice = hasE2EQueryFlag('usan_e2e_force_mcp_notice')
  const [servers, setServers] = useState<McpServerStatus[]>([])
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null)
  const [selectedServerName, setSelectedServerName] = useState<string | null>(null)
  const [tools, setTools] = useState<McpToolInfo[]>([])
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [transport, setTransport] = useState<Transport>('stdio')
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<NoticeState | null>(null)

  const loadServers = useCallback(async () => {
    setLoading(true)
    setNotice(null)
    try {
      const next = await window.usan?.mcp.listServers()
      setServers(next ?? [])
    } catch (err) {
      setNotice({
        tone: 'error',
        title: t('mcp.noticeLoadServersTitle'),
        body: toMcpErrorMessage(err, 'loadServers'),
      })
    } finally {
      setLoading(false)
    }
  }, [])

  const loadTools = useCallback(async (serverId: string, serverName?: string) => {
    setNotice(null)
    try {
      const next = await window.usan?.mcp.listTools(serverId)
      setTools(next ?? [])
      setSelectedServerId(serverId)
      setSelectedServerName(serverName ?? servers.find((server) => server.id === serverId)?.name ?? serverId)
    } catch (err) {
      setNotice({
        tone: 'error',
        title: t('mcp.noticeLoadToolsTitle'),
        body: toMcpErrorMessage(err, 'loadTools'),
      })
    }
  }, [servers])

  useEffect(() => {
    if (forceNotice) return
    loadServers().catch(() => {})
  }, [forceNotice, loadServers, reloadToken])

  const effectiveNotice = forceNotice
    ? {
        tone: 'success' as const,
        title: t('mcp.noticeAddServerSuccessTitle'),
        body: 'Demo tool connection',
      }
    : notice

  return (
    <Card variant="outline" className="space-y-3" data-view="mcp-server-list">
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

      {effectiveNotice ? (
        <InlineNotice tone={effectiveNotice.tone} title={effectiveNotice.title}>
          {effectiveNotice.body}
        </InlineNotice>
      ) : null}

      <div className="rounded-[var(--radius-md)] ring-1 ring-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-3">
        <p className="mb-2 text-[length:var(--text-sm)] font-medium text-[var(--color-text)]">{t('mcp.addServer')}</p>
        <div className="grid gap-2 md:grid-cols-2">
          <Input label={t('mcp.id')} value={id} onChange={(event) => setId(event.target.value)} placeholder={t('mcp.idPlaceholder')} />
          <Input label={t('mcp.name')} value={name} onChange={(event) => setName(event.target.value)} placeholder={t('mcp.namePlaceholder')} />
          <label className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
            {t('mcp.transport')}
            <select
              className="mt-1 h-9 w-full rounded-[var(--radius-md)] ring-1 ring-transparent bg-[var(--color-surface-soft)] px-2 text-[length:var(--text-sm)] outline-none transition-all focus:ring-[var(--color-primary)] focus:shadow-[var(--shadow-primary)] focus:bg-[var(--color-bg-card)]"
              value={transport}
              onChange={(event) => setTransport(event.target.value as Transport)}
            >
              <option value="stdio">{t('mcp.transportStdio')}</option>
              <option value="sse">{t('mcp.transportSse')}</option>
            </select>
          </label>
          {transport === 'stdio' ? (
            <>
              <Input label={t('mcp.command')} value={command} onChange={(event) => setCommand(event.target.value)} placeholder={t('mcp.commandPlaceholder')} />
              <Input label={t('mcp.args')} value={args} onChange={(event) => setArgs(event.target.value)} placeholder={t('mcp.argsPlaceholder')} />
            </>
          ) : (
            <Input label={t('mcp.url')} value={url} onChange={(event) => setUrl(event.target.value)} placeholder={t('mcp.urlPlaceholder')} />
          )}
        </div>
        <Button
          size="sm"
          className="mt-2"
          leftIcon={<Plus size={14} />}
          disabled={id.trim().length === 0 || name.trim().length === 0}
          onClick={async () => {
            try {
              setNotice(null)
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
              setNotice({
                tone: 'success',
                title: t('mcp.noticeAddServerSuccessTitle'),
                body: name.trim(),
              })
              await loadServers()
            } catch (err) {
              setNotice({
                tone: 'error',
                title: t('mcp.noticeAddServerTitle'),
                body: toMcpErrorMessage(err, 'addServer'),
              })
            }
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
            <div key={server.id} className="rounded-[var(--radius-md)] ring-1 ring-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-3 transition-all hover:ring-[var(--color-border)]">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[length:var(--text-sm)] font-medium text-[var(--color-text)]">{server.name}</p>
                  <p className="truncate text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                    {t('mcp.availableToolsCount').replace('{count}', String(server.toolCount))}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${server.connected ? 'bg-[var(--color-success)]/20 text-[var(--color-text)]' : 'bg-[var(--color-surface-soft)] text-[var(--color-text-muted)]'}`}>
                  {server.connected ? t('mcp.connected') : t('mcp.disconnected')}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {server.connected ? (
                  <Button size="sm" variant="secondary" leftIcon={<Unlink2 size={13} />} onClick={async () => {
                    try {
                      setNotice(null)
                      await window.usan?.mcp.disconnectServer(server.id)
                      if (selectedServerId === server.id) {
                        setTools([])
                        setSelectedServerName(server.name)
                      }
                      setNotice({
                        tone: 'success',
                        title: t('mcp.noticeDisconnectSuccessTitle'),
                        body: server.name,
                      })
                      await loadServers()
                    } catch (err) {
                      setNotice({
                        tone: 'error',
                        title: t('mcp.noticeDisconnectTitle'),
                        body: toMcpErrorMessage(err, 'disconnect'),
                      })
                    }
                  }}>
                    {t('mcp.disconnect')}
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" leftIcon={<Link2 size={13} />} onClick={async () => {
                    try {
                      setNotice(null)
                      await window.usan?.mcp.connectServer(server.id)
                      setNotice({
                        tone: 'success',
                        title: t('mcp.noticeConnectSuccessTitle'),
                        body: server.name,
                      })
                      await loadServers()
                      await loadTools(server.id, server.name)
                    } catch (err) {
                      setNotice({
                        tone: 'error',
                        title: t('mcp.noticeConnectTitle'),
                        body: toMcpErrorMessage(err, 'connect'),
                      })
                    }
                  }}>
                    {t('mcp.connect')}
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => loadTools(server.id, server.name)}>
                  {t('mcp.tools')}
                </Button>
                <Button size="sm" variant="danger" leftIcon={<Trash2 size={13} />} onClick={async () => {
                  try {
                    setNotice(null)
                    await window.usan?.mcp.removeServer(server.id)
                    if (selectedServerId === server.id) {
                      setSelectedServerId(null)
                      setSelectedServerName(null)
                      setTools([])
                    }
                    setNotice({
                      tone: 'success',
                      title: t('mcp.noticeRemoveServerSuccessTitle'),
                      body: server.name,
                    })
                    await loadServers()
                  } catch (err) {
                    setNotice({
                      tone: 'error',
                      title: t('mcp.noticeRemoveServerTitle'),
                      body: toMcpErrorMessage(err, 'removeServer'),
                    })
                  }
                }}>
                  {t('mcp.remove')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedServerId ? (
        <>
          <div className="rounded-[var(--radius-md)] ring-1 ring-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-3">
            <p className="mb-2 text-[length:var(--text-sm)] font-medium text-[var(--color-text)]">
              {t('mcp.toolsFor')}: {selectedServerName ?? selectedServerId}
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
          <McpToolPanel serverId={selectedServerId} serverName={selectedServerName} />
        </>
      ) : null}
    </Card>
  )
}
