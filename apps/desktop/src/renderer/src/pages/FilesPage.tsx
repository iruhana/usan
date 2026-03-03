import { useEffect } from 'react'
import {
  FolderOpen,
  File,
  Folder,
  ChevronRight,
  Home,
  ArrowUp,
  Loader2,
  AlertCircle,
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

export default function FilesPage() {
  const currentPath = useFilesStore((s) => s.currentPath)
  const entries = useFilesStore((s) => s.entries)
  const loading = useFilesStore((s) => s.loading)
  const error = useFilesStore((s) => s.error)
  const loadDirectory = useFilesStore((s) => s.loadDirectory)
  const init = useFilesStore((s) => s.init)

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
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--color-text-muted)]">
              <FolderOpen size={40} className="mb-3 opacity-20" />
              <p className="text-[length:var(--text-md)]">{t('files.empty')}</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {entries.map((entry) => (
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
                      <File size={18} className="text-[var(--color-text-muted)]" />
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
