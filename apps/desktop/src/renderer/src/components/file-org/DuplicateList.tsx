import { useState } from 'react'
import type { DuplicateGroup } from '@shared/types/infrastructure'
import { Files } from 'lucide-react'
import { Button, Card, Input, SectionHeader } from '../ui'

export default function DuplicateList() {
  const [path, setPath] = useState('')
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <Card variant="outline" className="space-y-3">
      <SectionHeader title="Duplicate Files" icon={Files} indicator="var(--color-warning)" />
      {error && (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-3 py-2 text-[length:var(--text-sm)] text-[var(--color-danger)]">
          {error}
        </p>
      )}
      <Input
        label="Folder"
        value={path}
        onChange={(event) => setPath(event.target.value)}
        placeholder="C:\\Users\\admin\\Downloads"
      />
      <Button
        size="sm"
        loading={loading}
        disabled={!path.trim()}
        onClick={async () => {
          setLoading(true)
          setError(null)
          try {
            const result = await window.usan?.fileOrg.findDuplicates(path.trim())
            setGroups(result ?? [])
          } catch (err) {
            setError((err as Error).message)
          } finally {
            setLoading(false)
          }
        }}
      >
        Find Duplicates
      </Button>
      {groups.length > 0 && (
        <div className="max-h-64 space-y-2 overflow-auto">
          {groups.map((group) => (
            <div key={group.hash} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3">
              <p className="text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                Hash: {group.hash.slice(0, 12)}..., Size: {Math.round(group.size / 1024)} KB
              </p>
              {group.files.map((file) => (
                <p key={file} className="truncate text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                  {file}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
