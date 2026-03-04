import { useEffect, useState } from 'react'
import { Play, Send, X } from 'lucide-react'
import { Button, Card, Input, SectionHeader } from '../ui'
import { useAppOrchestrationStore } from '../../stores/app-orchestration.store'
import registry from '../../data/app-registry.json'

type RegistryEntry = {
  id: string
  labelKey: string
  command: string
}

export default function AppLauncherHelper() {
  const { runningApps, loading, error, loadRunningApps, launchApp, closeApp, sendKeys } = useAppOrchestrationStore()
  const [keys, setKeys] = useState('')

  useEffect(() => {
    loadRunningApps().catch(() => {})
  }, [loadRunningApps])

  return (
    <Card variant="outline" className="space-y-3">
      <SectionHeader title="App Orchestration" indicator="var(--color-primary)" />

      {error && (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-3 py-2 text-[length:var(--text-sm)] text-[var(--color-danger)]">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {(registry as RegistryEntry[]).map((item) => (
          <Button
            key={item.id}
            size="sm"
            variant="secondary"
            leftIcon={<Play size={13} />}
            onClick={() => launchApp(item.command)}
          >
            {item.id}
          </Button>
        ))}
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
        <Input
          label="Keys"
          value={keys}
          onChange={(event) => setKeys(event.target.value)}
          placeholder="Ctrl+S"
        />
        <div className="flex items-end">
          <Button size="sm" leftIcon={<Send size={14} />} disabled={!keys.trim()} onClick={() => sendKeys(keys.trim())}>
            Send
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">Loading...</p>
      ) : runningApps.length === 0 ? (
        <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">No running apps</p>
      ) : (
        <div className="max-h-48 space-y-2 overflow-auto">
          {runningApps.map((app) => (
            <div key={`${app.name}-${app.pid ?? 'n/a'}`} className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[length:var(--text-sm)] text-[var(--color-text)]">{app.name}</p>
                <p className="truncate text-[length:var(--text-xs)] text-[var(--color-text-muted)]">{app.title || '-'}</p>
              </div>
              <Button size="sm" variant="danger" leftIcon={<X size={13} />} onClick={() => closeApp(app.name)}>
                Close
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
