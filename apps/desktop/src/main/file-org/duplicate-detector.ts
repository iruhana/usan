import { createHash } from 'crypto'
import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'
import type { DuplicateGroup } from '@shared/types/infrastructure'

async function collectFiles(
  dirPath: string,
  recursive: boolean,
  depth: number,
  maxDepth: number,
): Promise<string[]> {
  if (depth > maxDepth) return []
  const entries = await readdir(dirPath, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const fullPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      if (recursive) {
        files.push(...await collectFiles(fullPath, recursive, depth + 1, maxDepth))
      }
      continue
    }
    files.push(fullPath)
  }

  return files
}

export interface DuplicateScanOptions {
  recursive?: boolean
  maxDepth?: number
  minSizeBytes?: number
}

export async function findDuplicateGroups(
  dirPath: string,
  options: DuplicateScanOptions = {},
): Promise<DuplicateGroup[]> {
  const recursive = options.recursive ?? true
  const maxDepth = Math.max(0, options.maxDepth ?? 5)
  const minSizeBytes = Math.max(0, options.minSizeBytes ?? 1)
  const files = await collectFiles(dirPath, recursive, 0, maxDepth)

  const bySize = new Map<number, string[]>()
  for (const file of files) {
    const info = await stat(file).catch(() => null)
    if (!info || !info.isFile()) continue
    if (info.size < minSizeBytes) continue

    const list = bySize.get(info.size) ?? []
    list.push(file)
    bySize.set(info.size, list)
  }

  const groups: DuplicateGroup[] = []
  for (const [size, sameSizeFiles] of bySize.entries()) {
    if (sameSizeFiles.length < 2) continue

    const byHash = new Map<string, string[]>()
    for (const file of sameSizeFiles) {
      const content = await readFile(file).catch(() => null)
      if (!content) continue

      const hash = createHash('sha256').update(content).digest('hex')
      const list = byHash.get(hash) ?? []
      list.push(file)
      byHash.set(hash, list)
    }

    for (const [hash, duplicateFiles] of byHash.entries()) {
      if (duplicateFiles.length < 2) continue
      groups.push({ hash, size, files: duplicateFiles })
    }
  }

  return groups
}
