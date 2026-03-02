/**
 * Temp file cleaner — scans and removes stale temporary files.
 *
 * Targets: %TEMP%, %LOCALAPPDATA%\Temp
 * Criteria: files older than 7 days with extensions .tmp/.log/.bak/.old/.cache/.dmp
 */

import { readdir, lstat, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const STALE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const TEMP_EXTENSIONS = new Set(['.tmp', '.log', '.bak', '.old', '.cache', '.dmp'])

interface TempFileInfo {
  path: string
  size: number
  modifiedAt: number
}

export interface TempScanResult {
  files: TempFileInfo[]
  totalSize: number
  count: number
}

export interface TempCleanResult {
  deletedCount: number
  freedBytes: number
  errors: string[]
}

function getTempDirs(): string[] {
  const dirs: string[] = []
  const tmp = tmpdir()
  if (tmp) dirs.push(tmp)
  const localAppData = process.env.LOCALAPPDATA
  if (localAppData) {
    const localTemp = join(localAppData, 'Temp')
    if (localTemp !== tmp) dirs.push(localTemp)
  }
  return dirs
}

function isStaleTemp(fileName: string, mtime: Date): boolean {
  const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase()
  if (!TEMP_EXTENSIONS.has(ext)) return false
  return Date.now() - mtime.getTime() > STALE_MS
}

async function scanDir(dir: string): Promise<TempFileInfo[]> {
  const results: TempFileInfo[] = []
  try {
    const entries = await readdir(dir)
    for (const name of entries) {
      if (results.length >= 5000) break // Safety limit
      const fullPath = join(dir, name)
      try {
        const info = await lstat(fullPath) // lstat to avoid following symlinks
        if (info.isFile() && !info.isSymbolicLink() && isStaleTemp(name, info.mtime)) {
          results.push({ path: fullPath, size: info.size, modifiedAt: info.mtime.getTime() })
        }
      } catch {
        // Skip inaccessible files
      }
    }
  } catch {
    // Skip inaccessible directories
  }
  return results
}

/** Scan temp files (dry-run) */
export async function scanTempFiles(): Promise<TempScanResult> {
  const dirs = getTempDirs()
  const allFiles: TempFileInfo[] = []
  for (const dir of dirs) {
    const files = await scanDir(dir)
    allFiles.push(...files)
  }
  const totalSize = allFiles.reduce((sum, f) => sum + f.size, 0)
  return { files: allFiles, totalSize, count: allFiles.length }
}

/** Clean temp files (actual delete) */
export async function cleanTempFiles(): Promise<TempCleanResult> {
  const scan = await scanTempFiles()
  let deletedCount = 0
  let freedBytes = 0
  const errors: string[] = []

  for (const file of scan.files) {
    try {
      await unlink(file.path)
      deletedCount++
      freedBytes += file.size
    } catch (err) {
      errors.push(`${file.path}: ${(err as Error).message}`)
    }
  }

  return { deletedCount, freedBytes, errors: errors.slice(0, 20) }
}
