import { useState } from 'react'
import type { FileOrgPreview } from '@shared/types/infrastructure'
import { FolderTree } from 'lucide-react'
import { t } from '../../i18n'
import { hasE2EQueryFlag } from '../../lib/e2e-flags'
import { toFilesErrorMessage } from '../../lib/user-facing-errors'
import { Button, Card, InlineNotice, Input, SectionHeader } from '../ui'

type NoticeState = {
  tone: 'success' | 'error'
  title: string
  body: string
}

export default function OrganizationPreview() {
  const forceNotice = hasE2EQueryFlag('usan_e2e_force_file_org_notice')
  const [path, setPath] = useState('')
  const [preview, setPreview] = useState<FileOrgPreview | null>(null)
  const [notice, setNotice] = useState<NoticeState | null>(null)
  const [loading, setLoading] = useState(false)

  const effectiveNotice = forceNotice
    ? {
        tone: 'success' as const,
        title: t('files.noticePreviewSuccessTitle'),
        body: t('files.noticePreviewEmptyBody'),
      }
    : notice

  return (
    <Card variant="outline" className="space-y-3" data-view="organization-preview">
      <SectionHeader title={t('files.organizationTitle')} icon={FolderTree} indicator="var(--color-primary)" />
      {effectiveNotice ? (
        <InlineNotice tone={effectiveNotice.tone} title={effectiveNotice.title}>
          {effectiveNotice.body}
        </InlineNotice>
      ) : null}
      <Input
        label={t('files.folder')}
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
          setNotice(null)
          try {
            const result = await window.usan?.fileOrg.preview(path.trim())
            const nextPreview = result ?? null
            setPreview(nextPreview)
            setNotice({
              tone: 'success',
              title: t('files.noticePreviewSuccessTitle'),
              body:
                nextPreview && nextPreview.moves.length > 0
                  ? t('files.noticePreviewSuccessBody').replace('{count}', String(nextPreview.moves.length))
                  : t('files.noticePreviewEmptyBody'),
            })
          } catch (err) {
            setPreview(null)
            setNotice({
              tone: 'error',
              title: t('files.noticePreviewTitle'),
              body: toFilesErrorMessage(err),
            })
          } finally {
            setLoading(false)
          }
        }}
      >
        {t('files.previewPlan')}
      </Button>

      {!forceNotice && preview && (
        <div className="space-y-2">
          <p className="text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
            {t('files.plannedMoves').replace('{count}', String(preview.moves.length))}
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
