import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import {
  Archive,
  Code,
  File,
  FileText,
  Film,
  Folder,
  Image,
  Music,
} from 'lucide-react'
import { Grid, List } from 'react-window'
import type { FileEntry } from '@shared/types/ipc'
import { Badge } from '../ui'
import { t } from '../../i18n'
import {
  formatDate,
  getFileCategory,
  getFileKindLabel,
  humanSize,
} from './file-metadata'

const LIST_ROW_HEIGHT = 96
const GRID_ROW_HEIGHT = 216
const GRID_MIN_COLUMN_WIDTH = 232
const MIN_VIEWPORT = { width: 420, height: 320 }

export type FilesVisualMode = 'list' | 'grid'

interface ListViewProps {
  entries: FileEntry[]
  mode: FilesVisualMode
  selectedPath: string | null
  onSelect: (entry: FileEntry) => void
  onOpen: (entry: FileEntry) => void
}

interface SharedEntryProps {
  entries: FileEntry[]
  selectedPath: string | null
  onSelect: (entry: FileEntry) => void
  onOpen: (entry: FileEntry) => void
}

function getBadgeVariant(entry: FileEntry): 'default' | 'info' | 'success' | 'warning' {
  switch (getFileCategory(entry)) {
    case 'folder':
    case 'archive':
      return 'warning'
    case 'document':
      return 'info'
    case 'image':
      return 'success'
    default:
      return 'default'
  }
}

function FileTypeIcon({ entry, size = 18 }: { entry: FileEntry; size?: number }) {
  switch (getFileCategory(entry)) {
    case 'folder':
      return <Folder size={size} className="text-[var(--color-warning)]" />
    case 'image':
      return <Image size={size} className="text-[var(--color-success)]" />
    case 'audio':
      return <Music size={size} className="text-[var(--color-primary)]" />
    case 'video':
      return <Film size={size} className="text-[var(--color-primary)]" />
    case 'archive':
      return <Archive size={size} className="text-[var(--color-warning)]" />
    case 'code':
      return <Code size={size} className="text-[var(--color-primary)]" />
    case 'document':
      return <FileText size={size} className="text-[var(--color-primary)]" />
    default:
      return <File size={size} className="text-[var(--color-text-muted)]" />
  }
}

function useViewportSize() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [viewport, setViewport] = useState(MIN_VIEWPORT)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const update = () => {
      const rect = container.getBoundingClientRect()
      setViewport({
        width: Math.max(Math.floor(rect.width) || MIN_VIEWPORT.width, MIN_VIEWPORT.width),
        height: Math.max(Math.floor(rect.height) || MIN_VIEWPORT.height, MIN_VIEWPORT.height),
      })
    }

    update()

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(() => update())
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  return { containerRef, viewport }
}

function handleEntryKeyboard(
  event: React.KeyboardEvent<HTMLButtonElement>,
  entry: FileEntry,
  onSelect: (entry: FileEntry) => void,
  onOpen: (entry: FileEntry) => void,
): void {
  if (event.key === ' ') {
    event.preventDefault()
    onSelect(entry)
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    onOpen(entry)
  }
}

function EntryDetails({ entry }: { entry: FileEntry }) {
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold leading-6 text-[var(--color-text)]">
            {entry.name}
          </p>
          <p className="truncate text-[13px] leading-5 text-[var(--color-text-muted)]">
            {entry.path}
          </p>
        </div>
        <Badge variant={getBadgeVariant(entry)}>{getFileKindLabel(entry)}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px] font-medium text-[var(--color-text-secondary)]">
        <span>{entry.isDirectory ? t('files.folder') : humanSize(entry.size)}</span>
        <span>{formatDate(entry.modifiedAt)}</span>
      </div>
    </div>
  )
}

function ListRow({
  ariaAttributes,
  index,
  style,
  entries,
  selectedPath,
  onSelect,
  onOpen,
}: {
  ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' }
  index: number
  style: CSSProperties
} & SharedEntryProps) {
  const entry = entries[index]
  const selected = entry.path === selectedPath

  return (
    <div style={{ ...style, padding: '0 0 10px 0' }} {...ariaAttributes}>
      <button
        type="button"
        className={`flex h-[calc(100%-10px)] w-full items-center gap-3 rounded-[22px] border px-4 py-3 text-left transition-all ${
          selected
            ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] shadow-[var(--shadow-primary)]'
            : 'border-[var(--color-panel-border)] bg-[var(--color-panel-bg)] hover:bg-[var(--color-surface-soft)]'
        }`}
        aria-pressed={selected}
        onClick={() => (selected ? onOpen(entry) : onSelect(entry))}
        onDoubleClick={() => onOpen(entry)}
        onKeyDown={(event) => handleEntryKeyboard(event, entry, onSelect, onOpen)}
        data-testid={`files-entry-${index}`}
      >
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[var(--color-surface-soft)]">
          <FileTypeIcon entry={entry} size={20} />
        </div>
        <EntryDetails entry={entry} />
      </button>
    </div>
  )
}

function GridCell({
  ariaAttributes,
  columnIndex,
  rowIndex,
  style,
  entries,
  selectedPath,
  onSelect,
  onOpen,
  columnCount,
}: {
  ariaAttributes: { 'aria-colindex': number; role: 'gridcell' }
  columnIndex: number
  rowIndex: number
  style: CSSProperties
  columnCount: number
} & SharedEntryProps) {
  const entry = entries[rowIndex * columnCount + columnIndex]
  if (!entry) return null

  const selected = entry.path === selectedPath

  return (
    <div style={{ ...style, padding: '0 10px 12px 0' }} {...ariaAttributes}>
      <button
        type="button"
        className={`flex h-[calc(100%-12px)] w-full flex-col items-start rounded-[24px] border px-4 py-4 text-left transition-all ${
          selected
            ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] shadow-[var(--shadow-primary)]'
            : 'border-[var(--color-panel-border)] bg-[var(--color-panel-bg)] hover:bg-[var(--color-surface-soft)]'
        }`}
        aria-pressed={selected}
        onClick={() => (selected ? onOpen(entry) : onSelect(entry))}
        onDoubleClick={() => onOpen(entry)}
        onKeyDown={(event) => handleEntryKeyboard(event, entry, onSelect, onOpen)}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[var(--color-surface-soft)]">
          <FileTypeIcon entry={entry} size={22} />
        </div>
        <div className="mt-4 min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold leading-6 text-[var(--color-text)]">
            {entry.name}
          </p>
          <p className="mt-1 line-clamp-2 min-h-[40px] text-[13px] leading-5 text-[var(--color-text-muted)]">
            {entry.path}
          </p>
        </div>
        <div className="mt-4 flex w-full flex-wrap items-center justify-between gap-2">
          <Badge variant={getBadgeVariant(entry)}>{getFileKindLabel(entry)}</Badge>
          <span className="text-[12px] font-medium text-[var(--color-text-secondary)]">
            {entry.isDirectory ? t('files.folder') : humanSize(entry.size)}
          </span>
        </div>
      </button>
    </div>
  )
}

export function ListView({
  entries,
  mode,
  selectedPath,
  onSelect,
  onOpen,
}: ListViewProps) {
  const { containerRef, viewport } = useViewportSize()
  const listProps = useMemo(
    () => ({ entries, selectedPath, onSelect, onOpen }),
    [entries, selectedPath, onSelect, onOpen],
  )
  const columnCount = Math.max(1, Math.floor(viewport.width / GRID_MIN_COLUMN_WIDTH))
  const rowCount = Math.max(1, Math.ceil(entries.length / columnCount))
  const columnWidth = Math.max(Math.floor(viewport.width / columnCount), GRID_MIN_COLUMN_WIDTH)

  return (
    <div ref={containerRef} className="h-full min-h-[320px] w-full">
      {mode === 'list' ? (
        <List<SharedEntryProps>
          rowComponent={ListRow}
          rowCount={entries.length}
          rowHeight={LIST_ROW_HEIGHT}
          rowProps={listProps}
          overscanCount={8}
          defaultHeight={viewport.height}
          style={{ height: viewport.height, width: '100%' }}
          data-testid="files-virtual-list"
        />
      ) : (
        <Grid<SharedEntryProps & { columnCount: number }>
          cellComponent={GridCell}
          cellProps={{ ...listProps, columnCount }}
          columnCount={columnCount}
          columnWidth={columnWidth}
          rowCount={rowCount}
          rowHeight={GRID_ROW_HEIGHT}
          overscanCount={2}
          defaultHeight={viewport.height}
          defaultWidth={viewport.width}
          style={{ height: viewport.height, width: '100%' }}
          data-testid="files-virtual-grid"
        />
      )}
    </div>
  )
}
