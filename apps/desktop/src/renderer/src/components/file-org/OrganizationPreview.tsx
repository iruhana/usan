import { useState } from 'react'
import type { FileOrgPreview } from '@shared/types/infrastructure'
import { FolderTree } from 'lucide-react'
import { Button, Card, Input, SectionHeader } from '../ui'

export default function OrganizationPreview() {
  const [path, setPath] = useState('')
  const [preview, setPreview] = useState<FileOrgPreview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  return (
    <Card variant="outline" className="space-y-3">
      <SectionHeader title="File Organization" icon={FolderTree} indicator="var(--color-primary)" />
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
            const result = await window.usan?.fileOrg.preview(path.trim())
            setPreview(result ?? null)
          } catch (err) {
            setError((err as Error).message)
          } finally {
            setLoading(false)
          }
        }}
      >
        Preview
      </Button>

      {preview && (
        <div className="space-y-2">
          <p className="text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
            Planned moves: {preview.moves.length}
          </p>
          <div className="max-h-60 space-y-1 overflow-auto">
            {preview.moves.map((move, index) => (
              <p key={`${move.from}-${index}`} className="truncate text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                {move.from} {'->'} {move.to}
              </p>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
