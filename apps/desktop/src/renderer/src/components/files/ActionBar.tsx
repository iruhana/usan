import { Copy, MessageSquareText, FolderOpen, ShieldAlert, Trash2 } from 'lucide-react'
import type { FileEntry } from '@shared/types/ipc'
import { Button, Card } from '../ui'
import { t } from '../../i18n'
import { formatDate, getFileKindLabel, humanSize } from './file-metadata'

interface ActionBarProps {
  entry: FileEntry
  busyAction: string | null
  onOpen: () => void | Promise<void>
  onOpenFolder?: () => void | Promise<void>
  onAsk: () => void | Promise<void>
  onCopyPath: () => void | Promise<void>
  onDelete?: () => void | Promise<void>
  onSecureDelete?: () => void | Promise<void>
}

function getBusyState(activeAction: string | null, expected: string): boolean {
  return activeAction === expected
}

export function ActionBar({
  entry,
  busyAction,
  onOpen,
  onOpenFolder,
  onAsk,
  onCopyPath,
  onDelete,
  onSecureDelete,
}: ActionBarProps) {
  return (
    <Card
      variant="default"
      padding="sm"
      className="border border-[var(--color-panel-border)] bg-[var(--color-panel-bg-strong)]"
      data-testid="files-action-bar"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-[var(--color-text)]">{entry.name}</p>
          <p className="mt-1 truncate text-[13px] text-[var(--color-text-muted)]">{entry.path}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] font-medium text-[var(--color-text-secondary)]">
            <span>{getFileKindLabel(entry)}</span>
            <span>{entry.isDirectory ? t('files.folder') : humanSize(entry.size)}</span>
            <span>{formatDate(entry.modifiedAt)}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leftIcon={<FolderOpen size={14} />}
            loading={getBusyState(busyAction, 'open')}
            onClick={() => void onOpen()}
          >
            {t('files.action.open')}
          </Button>
          {onOpenFolder ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leftIcon={<FolderOpen size={14} />}
              loading={getBusyState(busyAction, 'folder')}
              onClick={() => void onOpenFolder()}
            >
              {t('files.action.openFolder')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leftIcon={<MessageSquareText size={14} />}
            loading={getBusyState(busyAction, 'ask')}
            onClick={() => void onAsk()}
          >
            {t('files.action.ask')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leftIcon={<Copy size={14} />}
            loading={getBusyState(busyAction, 'copy')}
            onClick={() => void onCopyPath()}
          >
            {t('files.action.copyPath')}
          </Button>
          {onDelete ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
              leftIcon={<Trash2 size={14} />}
              loading={getBusyState(busyAction, 'delete')}
              onClick={() => void onDelete()}
            >
              {t('files.action.delete')}
            </Button>
          ) : null}
          {onSecureDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leftIcon={<ShieldAlert size={14} />}
              loading={getBusyState(busyAction, 'secureDelete')}
              onClick={() => void onSecureDelete()}
            >
              {t('files.action.secureDelete')}
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  )
}
