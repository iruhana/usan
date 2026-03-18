import { useEffect, useState } from 'react'
import type { McpToolInfo } from '@shared/types/infrastructure'
import { Wrench } from 'lucide-react'
import { Button, Card, InlineNotice, Input, SectionHeader } from '../ui'
import { t } from '../../i18n'
import { toMcpErrorMessage } from '../../lib/user-facing-errors'

interface McpToolPanelProps {
  serverId: string | null
  serverName?: string | null
}

interface NoticeState {
  tone: 'error' | 'success'
  title: string
  body: string
}

export default function McpToolPanel({ serverId, serverName }: McpToolPanelProps) {
  const [tools, setTools] = useState<McpToolInfo[]>([])
  const [toolName, setToolName] = useState('')
  const [argsJson, setArgsJson] = useState('{}')
  const [result, setResult] = useState<string>('')
  const [notice, setNotice] = useState<NoticeState | null>(null)

  useEffect(() => {
    if (!serverId) {
      setTools([])
      return
    }
    setNotice(null)
    window.usan?.mcp.listTools(serverId)
      .then((next) => setTools(next ?? []))
      .catch((err) => setNotice({
        tone: 'error',
        title: t('mcp.noticeLoadToolsTitle'),
        body: toMcpErrorMessage(err, 'loadTools'),
      }))
  }, [serverId])

  return (
    <Card variant="outline" className="space-y-3">
      <SectionHeader title={t('mcp.tools')} icon={Wrench} indicator="var(--color-primary)" />
      {!serverId ? (
        <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('mcp.empty')}</p>
      ) : (
        <>
          <label className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
            {t('mcp.toolsFor')}: {serverName ?? serverId}
            <select
              className="mt-1 h-9 w-full rounded-[var(--radius-md)] ring-1 ring-transparent bg-[var(--color-surface-soft)] px-2 text-[length:var(--text-sm)] outline-none transition-all focus:ring-[var(--color-primary)] focus:shadow-[var(--shadow-primary)] focus:bg-[var(--color-bg-card)]"
              value={toolName}
              onChange={(event) => setToolName(event.target.value)}
            >
              <option value="">{t('mcp.selectToolPrompt')}</option>
              {tools.map((tool) => (
                <option key={`${tool.serverId}:${tool.name}`} value={tool.name}>
                  {tool.name}
                </option>
              ))}
            </select>
          </label>
          <Input
            label={t('mcp.argsJson')}
            value={argsJson}
            onChange={(event) => setArgsJson(event.target.value)}
          />
          <Button
            size="sm"
            disabled={!toolName}
            onClick={async () => {
              if (!serverId || !toolName) return
              setNotice(null)
              try {
                const args = JSON.parse(argsJson) as Record<string, unknown>
                const output = await window.usan?.mcp.callTool(serverId, toolName, args)
                setResult(JSON.stringify(output, null, 2))
                setNotice({
                  tone: 'success',
                  title: t('mcp.noticeCallToolSuccessTitle'),
                  body: toolName,
                })
              } catch (err) {
                setNotice({
                  tone: 'error',
                  title: t('mcp.noticeCallToolTitle'),
                  body: toMcpErrorMessage(err, 'callTool'),
                })
              }
            }}
          >
            {t('mcp.callTool')}
          </Button>

          {notice ? (
            <InlineNotice tone={notice.tone} title={notice.title}>
              {notice.body}
            </InlineNotice>
          ) : null}
          {result && (
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] p-3 text-[length:var(--text-xs)] text-[var(--color-text)]">
              {result}
            </pre>
          )}
        </>
      )}
    </Card>
  )
}
