import { useState } from 'react'
import type { DuplicateGroup } from '@shared/types/infrastructure'
import { Files } from 'lucide-react'
import { t } from '../../i18n'
import { hasE2EQueryFlag } from '../../lib/e2e-flags'
import { toFilesErrorMessage } from '../../lib/user-facing-errors'
import { Button, Card, InlineNotice, Input, SectionHeader } from '../ui'

type NoticeState = {
  tone: 'success' | 'error'
  title: string
  body: string
}

export default function DuplicateList() {
  const forceNotice = hasE2EQueryFlag('usan_e2e_force_file_org_notice')
  const [path, setPath] = useState('')
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<NoticeState | null>(null)

  const effectiveNotice = forceNotice
    ? {
        tone: 'success' as const,
        title: t('files.noticeDuplicateSuccessTitle'),
        body: t('files.noticeDuplicateEmptyBody'),
      }
    : notice

  return (
    <Card variant="outline" className="space-y-3" data-view="duplicate-list">
      <SectionHeader title={t('files.duplicatesTitle')} icon={Files} indicator="var(--color-warning)" />
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
            const result = await window.usan?.fileOrg.findDuplicates(path.trim())
            const nextGroups = result ?? []
            setGroups(nextGroups)
            setNotice({
              tone: 'success',
              title: t('files.noticeDuplicateSuccessTitle'),
              body:
                nextGroups.length > 0
                  ? t('files.noticeDuplicateSuccessBody').replace('{count}', String(nextGroups.length))
                  : t('files.noticeDuplicateEmptyBody'),
            })
          } catch (err) {
            setGroups([])
            setNotice({
              tone: 'error',
              title: t('files.noticeDuplicateTitle'),
              body: toFilesErrorMessage(err),
            })
          } finally {
            setLoading(false)
          }
        }}
      >
        {t('files.findDuplicates')}
      </Button>
      {!forceNotice && groups.length > 0 && (
        <div className="max-h-64 space-y-2 overflow-auto">
          {groups.map((group) => (
            <div key={group.hash} className="rounded-[var(--radius-md)] ring-1 ring-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-3">
              <p className="text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                {t('files.groupSummary')
                  .replace('{hash}', `${group.hash.slice(0, 12)}...`)
                  .replace('{size}', String(Math.round(group.size / 1024)))}
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
