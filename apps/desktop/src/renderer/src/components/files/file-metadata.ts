import type { FileEntry } from '@shared/types/ipc'
import { t } from '../../i18n'

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'ico'])
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'avi', 'mkv', 'mov', 'wmv', 'webm'])
const ARCHIVE_EXTENSIONS = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2'])
const CODE_EXTENSIONS = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'py',
  'java',
  'c',
  'cpp',
  'rs',
  'go',
  'html',
  'css',
  'scss',
  'json',
  'yml',
  'yaml',
  'xml',
  'md',
])
const DOCUMENT_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'rtf',
  'hwp',
  'hwpx',
])

function getExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

export type FileCategory =
  | 'folder'
  | 'document'
  | 'image'
  | 'audio'
  | 'video'
  | 'archive'
  | 'code'
  | 'file'

export function getFileCategory(entry: FileEntry): FileCategory {
  if (entry.isDirectory) return 'folder'

  const ext = getExtension(entry.name)
  if (DOCUMENT_EXTENSIONS.has(ext)) return 'document'
  if (IMAGE_EXTENSIONS.has(ext)) return 'image'
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio'
  if (VIDEO_EXTENSIONS.has(ext)) return 'video'
  if (ARCHIVE_EXTENSIONS.has(ext)) return 'archive'
  if (CODE_EXTENSIONS.has(ext)) return 'code'
  return 'file'
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp))
}

export function getFileKindLabel(entry: FileEntry): string {
  switch (getFileCategory(entry)) {
    case 'folder':
      return t('files.kind.folder')
    case 'document':
      return t('files.kind.document')
    case 'image':
      return t('files.kind.image')
    case 'audio':
      return t('files.kind.audio')
    case 'video':
      return t('files.kind.video')
    case 'archive':
      return t('files.kind.archive')
    case 'code':
      return t('files.kind.code')
    default:
      return t('files.kind.file')
  }
}
