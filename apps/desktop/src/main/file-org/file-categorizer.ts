/**
 * File Categorizer — categorize files by extension/type, detect duplicates, watch downloads.
 */
import { readdir, stat, readFile, rename, mkdir } from 'fs/promises'
import { join, extname, dirname } from 'path'
import { createHash } from 'crypto'

const CATEGORIES: Record<string, string[]> = {
  documents: ['pdf', 'doc', 'docx', 'txt', 'md', 'rtf', 'odt', 'xls', 'xlsx', 'csv', 'ppt', 'pptx'],
  images: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff'],
  videos: ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm'],
  audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a'],
  archives: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'],
  code: ['js', 'ts', 'py', 'java', 'c', 'cpp', 'h', 'cs', 'go', 'rs', 'rb', 'php', 'html', 'css', 'json', 'xml', 'yaml', 'yml'],
  executables: ['exe', 'msi', 'bat', 'cmd', 'ps1', 'sh'],
}

export interface FileCategory {
  name: string
  files: Array<{ path: string; name: string; size: number }>
}

export interface DuplicateGroup {
  hash: string
  size: number
  files: string[]
}

export interface OrganizationPlan {
  moves: Array<{ from: string; to: string; category: string }>
  totalFiles: number
}

export function categorizeFile(fileName: string): string {
  const ext = extname(fileName).slice(1).toLowerCase()
  for (const [category, exts] of Object.entries(CATEGORIES)) {
    if (exts.includes(ext)) return category
  }
  return 'other'
}

export async function analyzeFolder(dirPath: string): Promise<FileCategory[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const categories = new Map<string, FileCategory>()

  for (const entry of entries) {
    if (entry.isDirectory()) continue
    const fullPath = join(dirPath, entry.name)
    const info = await stat(fullPath).catch(() => null)
    if (!info) continue

    const cat = categorizeFile(entry.name)
    if (!categories.has(cat)) categories.set(cat, { name: cat, files: [] })
    categories.get(cat)!.files.push({ path: fullPath, name: entry.name, size: info.size })
  }

  return Array.from(categories.values())
}

export async function planOrganization(dirPath: string): Promise<OrganizationPlan> {
  const categories = await analyzeFolder(dirPath)
  const moves: OrganizationPlan['moves'] = []

  for (const cat of categories) {
    if (cat.name === 'other') continue
    for (const file of cat.files) {
      moves.push({
        from: file.path,
        to: join(dirPath, cat.name, file.name),
        category: cat.name,
      })
    }
  }

  return { moves, totalFiles: moves.length }
}

export interface OrganizationResult {
  moved: Array<{ from: string; to: string }>
  failed: Array<{ from: string; to: string; error: string }>
  rollbackMap: Array<{ from: string; to: string }>
}

export async function executeOrganization(plan: OrganizationPlan): Promise<OrganizationResult> {
  const moved: OrganizationResult['moved'] = []
  const failed: OrganizationResult['failed'] = []
  const rollbackMap: OrganizationResult['rollbackMap'] = []

  for (const move of plan.moves) {
    try {
      // Create category subdirectory if needed
      await mkdir(dirname(move.to), { recursive: true })
      await rename(move.from, move.to)
      moved.push({ from: move.from, to: move.to })
      // Store reverse mapping for rollback
      rollbackMap.push({ from: move.to, to: move.from })
    } catch (err) {
      failed.push({
        from: move.from,
        to: move.to,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { moved, failed, rollbackMap }
}

export async function rollbackOrganization(rollbackMap: OrganizationResult['rollbackMap']): Promise<{ restored: number; failed: number }> {
  let restored = 0
  let rollbackFailed = 0

  for (const entry of rollbackMap) {
    try {
      await rename(entry.from, entry.to)
      restored++
    } catch {
      rollbackFailed++
    }
  }

  return { restored, failed: rollbackFailed }
}

export async function findDuplicates(dirPath: string): Promise<DuplicateGroup[]> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  const sizeMap = new Map<number, string[]>()

  // Group by size first (fast filter)
  for (const entry of entries) {
    if (entry.isDirectory()) continue
    const fullPath = join(dirPath, entry.name)
    const info = await stat(fullPath).catch(() => null)
    if (!info || info.size === 0) continue
    const existing = sizeMap.get(info.size) || []
    existing.push(fullPath)
    sizeMap.set(info.size, existing)
  }

  // Hash files with same size
  const duplicates: DuplicateGroup[] = []
  for (const [size, files] of sizeMap) {
    if (files.length < 2) continue

    const hashMap = new Map<string, string[]>()
    for (const file of files) {
      try {
        const content = await readFile(file)
        const hash = createHash('sha256').update(content).digest('hex')
        const group = hashMap.get(hash) || []
        group.push(file)
        hashMap.set(hash, group)
      } catch { /* skip */ }
    }

    for (const [hash, dupeFiles] of hashMap) {
      if (dupeFiles.length >= 2) {
        duplicates.push({ hash, size, files: dupeFiles })
      }
    }
  }

  return duplicates
}
