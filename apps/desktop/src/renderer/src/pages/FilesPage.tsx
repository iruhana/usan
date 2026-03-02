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

/** Bytes to human-readable size */
function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/** Timestamp to date string */
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

  /** Go to parent folder */
  const goUp = () => {
    const parent = currentPath.replace(/[\\/][^\\/]+$/, '')
    if (parent && parent !== currentPath) {
      loadDirectory(parent)
    }
  }

  /** Handle item click */
  const handleClick = (entry: FileEntry) => {
    if (entry.isDirectory) {
      loadDirectory(entry.path)
    } else {
      window.usan?.fsExtras.openPath(entry.path)
    }
  }

  /** Breadcrumb segments */
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
      <div className="flex items-center gap-3 mb-4">
        <FolderOpen size={28} className="text-[var(--color-primary)]" />
        <h1 className="font-bold" style={{ fontSize: 'var(--font-size-xl)' }}>
          {t('files.title')}
        </h1>
      </div>

      {/* Breadcrumbs + up */}
      <div className="flex items-center gap-1 mb-4 flex-wrap bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] px-4 py-2">
        <button
          onClick={() => loadDirectory('C:\\')}
          className="p-3 rounded-lg hover:bg-[var(--color-bg-sidebar)] transition-all text-[var(--color-text-muted)]"
          title={t('files.driveRoot')}
        >
          <Home size={18} />
        </button>
        <button
          onClick={goUp}
          className="p-3 rounded-lg hover:bg-[var(--color-bg-sidebar)] transition-all text-[var(--color-text-muted)]"
          title={t('files.parentFolder')}
        >
          <ArrowUp size={18} />
        </button>

        <div className="flex items-center gap-0.5 ml-2 overflow-x-auto">
          {breadcrumbs.map((bc, i) => (
            <div key={bc.path} className="flex items-center gap-0.5 shrink-0">
              {i > 0 && <ChevronRight size={14} className="text-[var(--color-text-muted)]" />}
              <button
                onClick={() => loadDirectory(bc.path)}
                className="px-3 py-2 rounded-lg hover:bg-[var(--color-bg-sidebar)] transition-all text-[var(--color-text)] truncate max-w-[160px]"
                style={{ fontSize: 'var(--font-size-sm)' }}
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
          <Loader2 size={24} className="animate-spin mr-3" />
          <span style={{ fontSize: 'var(--font-size-sm)' }}>{t('files.loading')}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 mb-4">
          <AlertCircle size={20} />
          <span style={{ fontSize: 'var(--font-size-sm)' }}>{error}</span>
        </div>
      )}

      {/* File list */}
      {!loading && !error && (
        <div className="flex-1 overflow-y-auto">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--color-text-muted)]">
              <FolderOpen size={48} className="mb-3 opacity-40" />
              <p style={{ fontSize: 'var(--font-size-sm)' }}>{t('files.empty')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {entries.map((entry) => (
                <button
                  key={entry.path}
                  onClick={() => handleClick(entry)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--color-bg-card)] transition-all text-left group"
                  style={{ minHeight: 'var(--min-target)' }}
                >
                  {/* Icon */}
                  <div className="shrink-0">
                    {entry.isDirectory ? (
                      <Folder size={22} className="text-amber-500" />
                    ) : (
                      <File size={22} className="text-[var(--color-text-muted)]" />
                    )}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <span
                      className="block truncate text-[var(--color-text)] group-hover:text-[var(--color-primary)]"
                      style={{ fontSize: 'var(--font-size-sm)' }}
                    >
                      {entry.name}
                    </span>
                  </div>

                  {/* Size (files only) */}
                  <span
                    className="shrink-0 text-[var(--color-text-muted)] w-20 text-right"
                    style={{ fontSize: 'calc(12px * var(--font-scale))' }}
                  >
                    {entry.isDirectory ? '' : humanSize(entry.size)}
                  </span>

                  {/* Modified date */}
                  <span
                    className="shrink-0 text-[var(--color-text-muted)] w-24 text-right"
                    style={{ fontSize: 'calc(12px * var(--font-scale))' }}
                  >
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
