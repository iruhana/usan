import { useEffect, useState } from 'react'
import type { McpToolInfo } from '@shared/types/infrastructure'
import { Wrench } from 'lucide-react'
import { Button, Card, Input, SectionHeader } from '../ui'
import { t } from '../../i18n'

interface McpToolPanelProps {
  serverId: string | null
}

export default function McpToolPanel({ serverId }: McpToolPanelProps) {
  const [tools, setTools] = useState<McpToolInfo[]>([])
  const [toolName, setToolName] = useState('')
  const [argsJson, setArgsJson] = useState('{}')
  const [result, setResult] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!serverId) {
      setTools([])
      return
    }
    window.usan?.mcp.listTools(serverId)
      .then((next) => setTools(next ?? []))
      .catch((err) => setError((err as Error).message))
  }, [serverId])

  return (
    <Card variant="outline" className="space-y-3">
      <SectionHeader title={t('mcp.tools')} icon={Wrench} indicator="var(--color-primary)" />
      {!serverId ? (
        <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">{t('mcp.empty')}</p>
      ) : (
        <>
          <label className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
            {t('mcp.toolsFor')}: {serverId}
            <select
              className="mt-1 h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-2 text-[length:var(--text-sm)]"
              value={toolName}
              onChange={(event) => setToolName(event.target.value)}
            >
              <option value="">Select tool</option>
              {tools.map((tool) => (
                <option key={`${tool.serverId}:${tool.name}`} value={tool.name}>
                  {tool.name}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Args (JSON)"
            value={argsJson}
            onChange={(event) => setArgsJson(event.target.value)}
          />
          <Button
            size="sm"
            disabled={!toolName}
            onClick={async () => {
              if (!serverId || !toolName) return
              setError(null)
              try {
                const args = JSON.parse(argsJson) as Record<string, unknown>
                const output = await window.usan?.mcp.callTool(serverId, toolName, args)
                setResult(JSON.stringify(output, null, 2))
              } catch (err) {
                setError((err as Error).message)
              }
            }}
          >
            Call Tool
          </Button>

          {error && (
            <p className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-3 py-2 text-[length:var(--text-sm)] text-[var(--color-danger)]">
              {error}
            </p>
          )}
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
