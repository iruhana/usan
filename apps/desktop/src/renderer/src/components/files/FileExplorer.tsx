import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ArrowUp,
  ChevronRight,
  Columns3,
  FolderOpen,
  Home,
  LayoutGrid,
  List,
} from 'lucide-react'
import type { FileEntry } from '@shared/types/ipc'
import { Button, Card, InlineNotice, Input } from '../ui'
import { SkeletonFileList } from '../ui/Skeleton'
import { t } from '../../i18n'
import { ActionBar } from './ActionBar'
import { ListView, type FilesVisualMode } from './ListView'
import { formatDate, getFileKindLabel, humanSize } from './file-metadata'

type ViewMode = FilesVisualMode | 'column'
type SortMode = 'name' | 'modified' | 'size'

interface NoticeState {
  tone: 'success' | 'error' | 'warning'
  title: string
  body: string
}

interface FileExplorerProps {
  currentPath: string
  entries: FileEntry[]
  loading: boolean
  error: string | null
  onLoadDirectory: (path: string) => Promise<void>
  onPickDirectory: () => Promise<void>
  onOpenEntry: (entry: FileEntry) => Promise<void>
  onAskEntry: (entry: FileEntry) => Promise<void>
  onDeleteEntry: (entry: FileEntry) => Promise<void>
  onSecureDeleteEntry: (entry: FileEntry) => Promise<void>
}

const ACTION_ERROR_TITLE: Record<string, string> = {
  open: 'files.noticeOpenErrorTitle',
  folder: 'files.noticeOpenErrorTitle',
  delete: 'files.noticeDeleteErrorTitle',
  secureDelete: 'files.noticeSecureDeleteErrorTitle',
}

function getParentPath(path: string): string | null {
  const normalized = path.replace(/\//g, '\\').replace(/\\+$/, '')
  if (/^[A-Za-z]:$/.test(normalized)) return `${normalized}\\`
  if (/^[A-Za-z]:\\$/.test(path.replace(/\//g, '\\'))) return null

  const lastSeparator = normalized.lastIndexOf('\\')
  if (lastSeparator < 0) return null
  if (lastSeparator <= 2) return `${normalized.slice(0, 2)}\\`
  return normalized.slice(0, lastSeparator)
}

function buildBreadcrumbs(path: string): Array<{ label: string; path: string }> {
  const normalized = path.replace(/\//g, '\\')
  const driveMatch = normalized.match(/^[A-Za-z]:\\?/)
  if (!driveMatch) {
    return normalized
      .split('\\')
      .filter(Boolean)
      .map((segment, index, segments) => ({
        label: segment,
        path: segments.slice(0, index + 1).join('\\'),
      }))
  }

  const driveRoot = driveMatch[0].endsWith('\\') ? driveMatch[0] : `${driveMatch[0]}\\`
  const remainder = normalized.slice(driveRoot.length).split('\\').filter(Boolean)
  const breadcrumbs = [{ label: driveRoot.replace('\\', ''), path: driveRoot }]
  let current = driveRoot.replace(/\\$/, '')

  for (const segment of remainder) {
    current = `${current}\\${segment}`
    breadcrumbs.push({ label: segment, path: current })
  }

  return breadcrumbs
}

function sortEntries(entries: FileEntry[], mode: SortMode): FileEntry[] {
  return [...entries].sort((left, right) => {
    if (left.isDirectory !== right.isDirectory) {
      return left.isDirectory ? -1 : 1
    }

    if (mode === 'modified') {
      return right.modifiedAt - left.modifiedAt || left.name.localeCompare(right.name)
    }

    if (mode === 'size') {
      return right.size - left.size || left.name.localeCompare(right.name)
    }

    return left.name.localeCompare(right.name)
  })
}

async function copyPathToClipboard(path: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(path)
    return
  }

  const input = document.createElement('textarea')
  input.value = path
  input.setAttribute('readonly', 'true')
  input.style.position = 'absolute'
  input.style.left = '-9999px'
  document.body.appendChild(input)
  input.select()
  const succeeded = document.execCommand('copy')
  document.body.removeChild(input)

  if (!succeeded) {
    throw new Error(t('files.noticeCopyFallbackError'))
  }
}

function ViewButton({
  mode,
  currentMode,
  label,
  icon,
  onClick,
}: {
  mode: ViewMode
  currentMode: ViewMode
  label: string
  icon: ReactNode
  onClick: (mode: ViewMode) => void
}) {
  const active = mode === currentMode
  return (
    <button
      type="button"
      className={`inline-flex h-10 items-center gap-2 rounded-[16px] px-3 text-[13px] font-semibold transition-all ${
        active
          ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]'
          : 'bg-[var(--color-panel-muted)] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
      }`}
      aria-pressed={active}
      onClick={() => onClick(mode)}
      data-testid={`files-view-${mode}`}
    >
      {icon}
      {label}
    </button>
  )
}

export function FileExplorer({
  currentPath,
  entries,
  loading,
  error,
  onLoadDirectory,
  onPickDirectory,
  onOpenEntry,
  onAskEntry,
  onDeleteEntry,
  onSecureDeleteEntry,
}: FileExplorerProps) {
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [sortMode, setSortMode] = useState<SortMode>('name')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [notice, setNotice] = useState<NoticeState | null>(null)

  const breadcrumbs = useMemo(() => buildBreadcrumbs(currentPath), [currentPath])
  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = query
      ? entries.filter((entry) => {
          const searchable = `${entry.name} ${entry.path}`.toLowerCase()
          return searchable.includes(query)
        })
      : entries
    return sortEntries(filtered, sortMode)
  }, [entries, search, sortMode])
  const selectedEntry = filteredEntries.find((entry) => entry.path === selectedPath) ?? null
  const parentPath = useMemo(() => getParentPath(currentPath), [currentPath])

  useEffect(() => {
    if (!filteredEntries.length) {
      if (selectedPath !== null) setSelectedPath(null)
      return
    }

    const hasSelectedEntry = filteredEntries.some((entry) => entry.path === selectedPath)
    if (!hasSelectedEntry) {
      setSelectedPath(filteredEntries[0]?.path ?? null)
    }
  }, [filteredEntries, selectedPath])

  const directoryCount = entries.filter((entry) => entry.isDirectory).length
  const fileCount = entries.length - directoryCount

  async function runAction(action: string, operation: () => Promise<void>): Promise<void> {
    setBusyAction(action)
    try {
      await operation()
    } catch (actionError) {
      const message =
        actionError instanceof Error && actionError.message
          ? actionError.message
          : t('files.actionErrorGeneric')
      setNotice({
        tone: 'error',
        title: t(ACTION_ERROR_TITLE[action] ?? 'files.noticeOpenErrorTitle'),
        body: message,
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleCopyPath(entry: FileEntry): Promise<void> {
    setBusyAction('copy')
    try {
      await copyPathToClipboard(entry.path)
      setNotice({
        tone: 'success',
        title: t('files.noticeCopyTitle'),
        body: t('files.noticeCopyBody'),
      })
    } catch (copyError) {
      setNotice({
        tone: 'error',
        title: t('files.noticeCopyErrorTitle'),
        body:
          copyError instanceof Error && copyError.message
            ? copyError.message
            : t('files.noticeCopyFallbackError'),
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleDelete(entry: FileEntry): Promise<void> {
    if (entry.isDirectory) {
      setNotice({
        tone: 'warning',
        title: t('files.noticeDeleteErrorTitle'),
        body: t('files.deleteDirectoryUnsupported'),
      })
      return
    }

    await runAction('delete', async () => {
      await onDeleteEntry(entry)
      setNotice({
        tone: 'success',
        title: t('files.noticeDeleteTitle'),
        body: t('files.noticeDeleteBody'),
      })
      setSelectedPath(null)
    })
  }

  async function handleSecureDelete(entry: FileEntry): Promise<void> {
    if (entry.isDirectory) {
      setNotice({
        tone: 'warning',
        title: t('files.noticeSecureDeleteErrorTitle'),
        body: t('files.deleteDirectoryUnsupported'),
      })
      return
    }

    await runAction('secureDelete', async () => {
      await onSecureDeleteEntry(entry)
      setNotice({
        tone: 'success',
        title: t('files.noticeSecureDeleteTitle'),
        body: t('files.noticeSecureDeleteBody'),
      })
      setSelectedPath(null)
    })
  }

  async function handleAsk(entry: FileEntry): Promise<void> {
    setBusyAction('ask')
    try {
      await onAskEntry(entry)
    } catch (actionError) {
      setNotice({
        tone: 'error',
        title: t('files.noticeAskErrorTitle'),
        body:
          actionError instanceof Error && actionError.message
            ? actionError.message
            : t('files.actionErrorGeneric'),
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleOpen(entry: FileEntry): Promise<void> {
    await runAction('open', async () => {
      await onOpenEntry(entry)
    })
  }

  async function handleOpenFolder(entry: FileEntry): Promise<void> {
    const targetPath = entry.isDirectory ? entry.path : getParentPath(entry.path)
    if (!targetPath) return
    await runAction('folder', async () => {
      await onLoadDirectory(targetPath)
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4" data-testid="files-explorer">
      <Card variant="default" padding="md" className="shrink-0">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leftIcon={<Home size={14} />}
              onClick={() => void onLoadDirectory('C:\\')}
            >
              {t('files.driveRoot')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leftIcon={<ArrowUp size={14} />}
              disabled={!parentPath}
              onClick={() => {
                if (parentPath) {
                  void onLoadDirectory(parentPath)
                }
              }}
            >
              {t('files.parentFolder')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<FolderOpen size={14} />}
              onClick={() => void onPickDirectory()}
            >
              {t('files.browseFolder')}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--color-text-secondary)]">
            {breadcrumbs.map((breadcrumb, index) => (
              <div key={breadcrumb.path} className="flex items-center gap-2">
                {index > 0 ? <ChevronRight size={12} className="opacity-60" /> : null}
                <button
                  type="button"
                  className="max-w-[220px] truncate rounded-[14px] px-2.5 py-1.5 hover:bg-[var(--color-panel-muted)]"
                  onClick={() => void onLoadDirectory(breadcrumb.path)}
                  title={breadcrumb.path}
                >
                  {breadcrumb.label}
                </button>
              </div>
            ))}
          </div>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto]">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('files.search')}
              aria-label={t('files.search')}
            />

            <div className="flex flex-wrap items-center gap-2 rounded-[20px] bg-[var(--color-panel-muted)] p-1.5">
              <ViewButton
                mode="list"
                currentMode={viewMode}
                label={t('files.view.badge.list')}
                icon={<List size={14} />}
                onClick={setViewMode}
              />
              <ViewButton
                mode="grid"
                currentMode={viewMode}
                label={t('files.view.badge.grid')}
                icon={<LayoutGrid size={14} />}
                onClick={setViewMode}
              />
              <ViewButton
                mode="column"
                currentMode={viewMode}
                label={t('files.view.badge.column')}
                icon={<Columns3 size={14} />}
                onClick={setViewMode}
              />
            </div>

            <label className="flex min-w-[170px] flex-col gap-2 text-[13px] font-semibold text-[var(--color-text-secondary)]">
              <span>{t('files.sortLabel')}</span>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="h-11 rounded-[16px] border border-[var(--color-panel-border)] bg-[var(--color-panel-bg)] px-3 text-[14px] text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-primary)]"
              >
                <option value="name">{t('files.sort.name')}</option>
                <option value="modified">{t('files.sort.modified')}</option>
                <option value="size">{t('files.sort.size')}</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[13px] text-[var(--color-text-secondary)]">
            <span>{currentPath}</span>
            <span>{`${filteredEntries.length} ${t('files.itemsCount')}`}</span>
            <span>{`${fileCount} ${t('files.kind.file')}`}</span>
            <span>{`${directoryCount} ${t('files.kind.folder')}`}</span>
          </div>
        </div>
      </Card>

      {notice ? (
        <InlineNotice tone={notice.tone} title={notice.title}>
          {notice.body}
        </InlineNotice>
      ) : null}

      {error ? (
        <InlineNotice tone="error" title={t('files.helpTitle')}>
          {error}
        </InlineNotice>
      ) : null}

      {selectedEntry ? (
        <ActionBar
          entry={selectedEntry}
          busyAction={busyAction}
          onOpen={() => handleOpen(selectedEntry)}
          onOpenFolder={
            selectedEntry.isDirectory
              ? undefined
              : () => handleOpenFolder(selectedEntry)
          }
          onAsk={() => handleAsk(selectedEntry)}
          onCopyPath={() => handleCopyPath(selectedEntry)}
          onDelete={selectedEntry.isDirectory ? undefined : () => handleDelete(selectedEntry)}
          onSecureDelete={
            selectedEntry.isDirectory ? undefined : () => handleSecureDelete(selectedEntry)
          }
        />
      ) : null}

      <Card variant="default" padding="md" className="min-h-0 flex-1 overflow-hidden" data-testid="files-browser-panel">
        {loading ? (
          <SkeletonFileList />
        ) : filteredEntries.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <FolderOpen size={42} className="mb-4 text-[var(--color-text-muted)] opacity-40" />
            <p className="text-[18px] font-semibold text-[var(--color-text)]">
              {search.trim() ? t('files.emptySearchTitle') : t('files.empty')}
            </p>
            <p className="mt-2 max-w-[440px] text-[14px] leading-6 text-[var(--color-text-secondary)]">
              {search.trim() ? t('files.emptySearchBody') : t('files.emptyFolderBody')}
            </p>
          </div>
        ) : viewMode === 'column' ? (
          <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,0.66fr)_minmax(280px,0.34fr)]">
            <div className="min-h-0 overflow-hidden rounded-[22px] border border-[var(--color-panel-border)] bg-[var(--color-panel-muted)] p-3">
              <ListView
                entries={filteredEntries}
                mode="list"
                selectedPath={selectedPath}
                onSelect={(entry) => setSelectedPath(entry.path)}
                onOpen={(entry) => void handleOpen(entry)}
              />
            </div>
            <div className="rounded-[22px] border border-[var(--color-panel-border)] bg-[var(--color-panel-muted)] p-5" data-testid="files-column-inspector">
              {selectedEntry ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                      {t('files.columnInspector')}
                    </p>
                    <p className="mt-3 text-[20px] font-semibold text-[var(--color-text)]">
                      {selectedEntry.name}
                    </p>
                  </div>
                  <div className="space-y-3 text-[14px] leading-6 text-[var(--color-text-secondary)]">
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                        {t('files.kindLabel')}
                      </p>
                      <p>{getFileKindLabel(selectedEntry)}</p>
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                        {t('files.sizeLabel')}
                      </p>
                      <p>{selectedEntry.isDirectory ? t('files.folder') : humanSize(selectedEntry.size)}</p>
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                        {t('files.modifiedLabel')}
                      </p>
                      <p>{formatDate(selectedEntry.modifiedAt)}</p>
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                        {t('files.action.copyPath')}
                      </p>
                      <p className="break-all">{selectedEntry.path}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <p className="text-[18px] font-semibold text-[var(--color-text)]">
                    {t('files.columnEmptyTitle')}
                  </p>
                  <p className="mt-2 max-w-[260px] text-[14px] leading-6 text-[var(--color-text-secondary)]">
                    {t('files.columnEmptyBody')}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <ListView
            entries={filteredEntries}
            mode={viewMode}
            selectedPath={selectedPath}
            onSelect={(entry) => setSelectedPath(entry.path)}
            onOpen={(entry) => void handleOpen(entry)}
          />
        )}
      </Card>
    </div>
  )
}
