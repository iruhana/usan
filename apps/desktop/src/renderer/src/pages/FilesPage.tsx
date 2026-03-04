import { useEffect, useState, useMemo } from 'react'
import {
  FolderOpen,
  File,
  Folder,
  ChevronRight,
  Home,
  ArrowUp,
  Loader2,
  AlertCircle,
  Search,
  Image,
  FileText,
  Music,
  Film,
  Archive,
  Code,
} from 'lucide-react'
import type { FileEntry } from '@shared/types/ipc'
import { useFilesStore } from '../stores/files.store'
import { t } from '../i18n'

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'ico'])
const AUDIO_EXT = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'])
const VIDEO_EXT = new Set(['mp4', 'avi', 'mkv', 'mov', 'wmv', 'webm'])
const ARCHIVE_EXT = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2'])
const CODE_EXT = new Set(['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'c', 'cpp', 'rs', 'go', 'html', 'css', 'json'])
const DOC_EXT = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'hwp'])

function FileIcon({ name, size = 18 }: { name: string; size?: number }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (IMAGE_EXT.has(ext)) return <Image size={size} className="text-[var(--color-success)]" />
  if (AUDIO_EXT.has(ext)) return <Music size={size} className="text-[var(--color-primary)]" />
  if (VIDEO_EXT.has(ext)) return <Film size={size} className="text-purple-500" />
  if (ARCHIVE_EXT.has(ext)) return <Archive size={size} className="text-orange-500" />
  if (CODE_EXT.has(ext)) return <Code size={size} className="text-cyan-500" />
  if (DOC_EXT.has(ext)) return <FileText size={size} className="text-blue-500" />
  return <File size={size} className="text-[var(--color-text-muted)]" />
}

export default function FilesPage() {
  const currentPath = useFilesStore((s) => s.currentPath)
  const entries = useFilesStore((s) => s.entries)
  const loading = useFilesStore((s) => s.loading)
  const error = useFilesStore((s) => s.error)
  const loadDirectory = useFilesStore((s) => s.loadDirectory)
  const init = useFilesStore((s) => s.init)
  const [search, setSearch] = useState('')

  const filteredEntries = useMemo(() => {
    if (!search.trim()) return entries
    const q = search.toLowerCase()
    return entries.filter((e) => e.name.toLowerCase().includes(q))
  }, [entries, search])

  useEffect(() => {
    init()
  }, [init])

  const goUp = () => {
    const parent = currentPath.replace(/[\\/][^\\/]+$/, '')
    if (parent && parent !== currentPath) {
      loadDirectory(parent)
    }
  }

  const handleClick = (entry: FileEntry) => {
    if (entry.isDirectory) {
      loadDirectory(entry.path)
    } else {
      window.usan?.fsExtras.openPath(entry.path)
    }
  }

  const breadcrumbs = currentPath
    .replace(/^([A-Z]):\\/, '$1:\\')
    .split(/[\\/]/)
    .filter(Boolean)
    .map((seg, i, arr) => ({
      label: seg,
      path: arr.slice(0, i + 1).join('\\'),
    }))

  return (
    <div className="flex flex-col h-full p-6">
      {/* Header */}
      <div className="mb-4">
        <h1 className="font-semibold tracking-tight text-[length:var(--text-xl)] text-[var(--color-text)]">
          {t('files.title')}
        </h1>
      </div>

      {/* Breadcrumbs + up */}
      <div className="flex items-center gap-1 mb-4 flex-wrap bg-[var(--color-surface-soft)] rounded-[var(--radius-md)] px-2 py-1.5">
        <button
          onClick={() => loadDirectory('C:\\')}
          className="p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--color-bg-card)] transition-all text-[var(--color-text-muted)]"
          title={t('files.driveRoot')}
          aria-label={t('files.driveRoot')}
        >
          <Home size={15} />
        </button>
        <button
          onClick={goUp}
          className="p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--color-bg-card)] transition-all text-[var(--color-text-muted)]"
          title={t('files.parentFolder')}
          aria-label={t('files.parentFolder')}
        >
          <ArrowUp size={15} />
        </button>

        <div className="flex items-center gap-1 ml-1 overflow-x-auto">
          {breadcrumbs.map((bc, i) => (
            <div key={bc.path} className="flex items-center gap-1 shrink-0">
              {i > 0 && <ChevronRight size={12} className="text-[var(--color-text-muted)] opacity-50" />}
              <button
                onClick={() => loadDirectory(bc.path)}
                className="px-2 py-1 rounded-[var(--radius-sm)] hover:bg-[var(--color-bg-card)] transition-all text-[length:var(--text-sm)] text-[var(--color-text)] truncate max-w-[140px]"
                title={bc.path}
              >
                {bc.label}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('files.search')}
          className="w-full pl-9 pr-3 py-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[length:var(--text-md)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-primary)]"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-[var(--color-text-muted)]">
          <Loader2 size={20} className="animate-spin mr-2" />
          <span className="text-[length:var(--text-md)]">{t('files.loading')}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-[var(--radius-md)] bg-[var(--color-danger-bg)] text-[var(--color-danger)] mb-4">
          <AlertCircle size={16} />
          <span className="text-[length:var(--text-md)]">{error}</span>
        </div>
      )}

      {/* File list */}
      {!loading && !error && (
        <div className="flex-1 overflow-y-auto">
          {filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--color-text-muted)]">
              <FolderOpen size={40} className="mb-3 opacity-20" />
              <p className="text-[length:var(--text-md)]">{t('files.empty')}</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {filteredEntries.map((entry) => (
                <button
                  key={entry.path}
                  onClick={() => handleClick(entry)}
                  className="flex items-center gap-3 px-3 py-2 rounded-[var(--radius-md)] hover:bg-[var(--color-surface-soft)] transition-all text-left group"
                  style={{ minHeight: '48px' }}
                >
                  <div className="shrink-0">
                    {entry.isDirectory ? (
                      <Folder size={18} className="text-[var(--color-warning)]" />
                    ) : (
                      <FileIcon name={entry.name} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block truncate text-[length:var(--text-md)] text-[var(--color-text)] group-hover:text-[var(--color-primary)]">
                      {entry.name}
                    </span>
                  </div>
                  <span className="shrink-0 text-[length:var(--text-xs)] text-[var(--color-text-muted)] w-20 text-right">
                    {entry.isDirectory ? '' : humanSize(entry.size)}
                  </span>
                  <span className="shrink-0 text-[length:var(--text-xs)] text-[var(--color-text-muted)] w-24 text-right">
                    {formatDate(entry.modifiedAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
