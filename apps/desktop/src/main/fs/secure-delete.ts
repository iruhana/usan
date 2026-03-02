/**
 * Secure file deletion — 3-pass overwrite (zeros → random → zeros → fsync → unlink)
 *
 * Prevents file recovery by overwriting data before unlinking.
 * Restrictions:
 * - Max 100MB per file
 * - Directories not allowed
 * - Uses validatePath() for safety
 * - 64KB chunk processing for memory efficiency
 */

import { open, unlink } from 'fs/promises'
import { randomBytes } from 'crypto'
import { validatePath } from '../security'

const MAX_SIZE = 100 * 1024 * 1024 // 100MB
const CHUNK_SIZE = 64 * 1024 // 64KB

export interface SecureDeleteResult {
  success: boolean
  path: string
  size: number
  error?: string
}

export async function secureDelete(filePath: string): Promise<SecureDeleteResult> {
  // Validate path
  const blocked = validatePath(filePath, 'delete')
  if (blocked) return { success: false, path: filePath, size: 0, error: blocked }

  // Open file first, then fstat on the handle to avoid TOCTOU race
  const fd = await open(filePath, 'r+')
  const info = await fd.stat()

  if (info.isDirectory()) {
    await fd.close()
    return { success: false, path: filePath, size: 0, error: '디렉토리는 안전 삭제할 수 없습니다' }
  }
  if (info.size > MAX_SIZE) {
    await fd.close()
    return {
      success: false,
      path: filePath,
      size: info.size,
      error: `파일이 너무 큽니다 (${Math.round(info.size / 1024 / 1024)}MB). 100MB 이하 파일만 가능합니다`,
    }
  }

  const fileSize = info.size

  try {
    // Pass 1: zeros
    await overwritePass(fd, fileSize, () => Buffer.alloc(CHUNK_SIZE, 0))

    // Pass 2: random data
    await overwritePass(fd, fileSize, () => randomBytes(CHUNK_SIZE))

    // Pass 3: zeros again
    await overwritePass(fd, fileSize, () => Buffer.alloc(CHUNK_SIZE, 0))

    // Flush to disk
    await fd.sync()
  } finally {
    await fd.close()
  }

  // Remove the file
  await unlink(filePath)

  return { success: true, path: filePath, size: fileSize }
}

async function overwritePass(
  fd: Awaited<ReturnType<typeof open>>,
  fileSize: number,
  makeChunk: () => Buffer,
): Promise<void> {
  let offset = 0
  while (offset < fileSize) {
    const remaining = fileSize - offset
    const chunk = makeChunk()
    const writeSize = Math.min(chunk.length, remaining)
    await fd.write(chunk, 0, writeSize, offset)
    offset += writeSize
  }
}
