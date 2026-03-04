/**
 * File system tools: read_file, write_file, list_directory, delete_file
 */
import type { ProviderTool } from '../providers/base'
import type { ToolHandler } from './types'
import { readFile, writeFile, readdir, stat, unlink, rename } from 'fs/promises'
import { join } from 'path'
import { validatePath } from '../../security'

const MAX_FILE_SIZE = 1 * 1024 * 1024

const BINARY_EXTS = new Set([
  'exe', 'dll', 'bin', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico',
  'mp3', 'mp4', 'wav', 'zip', 'rar', '7z', 'gz', 'tar', 'pdf',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'so', 'dylib',
  'o', 'obj', 'class', 'woff', 'woff2', 'ttf', 'eot',
])

export const definitions: ProviderTool[] = [
  {
    name: 'read_file',
    description: '파일의 내용을 읽습니다.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: '파일 경로' } },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: '파일에 내용을 씁니다.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '파일 경로' },
        content: { type: 'string', description: '파일 내용' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_directory',
    description: '디렉토리의 파일과 폴더 목록을 봅니다.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: '디렉토리 경로' } },
      required: ['path'],
    },
  },
  {
    name: 'delete_file',
    description: '파일을 삭제합니다.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: '삭제할 파일 경로' } },
      required: ['path'],
    },
  },
]

export const handlers: Record<string, ToolHandler> = {
  async read_file(args) {
    const path = args.path as string
    const blocked = validatePath(path, 'read')
    if (blocked) return { error: blocked }
    const info = await stat(path)
    if (info.size > MAX_FILE_SIZE) {
      return { error: `파일이 너무 큽니다 (${Math.round(info.size / 1024 / 1024)}MB). 1MB 이하 파일만 읽을 수 있습니다.` }
    }
    const ext = path.split('.').pop()?.toLowerCase() || ''
    if (BINARY_EXTS.has(ext)) {
      return { error: `바이너리 파일입니다 (.${ext}). 텍스트 파일만 읽을 수 있습니다.` }
    }
    const content = await readFile(path, 'utf-8')
    if (content.slice(0, 8192).includes('\0')) {
      return { error: '바이너리 파일입니다. 텍스트 파일만 읽을 수 있습니다.' }
    }
    const truncated = content.length > 50000
    return { content: content.slice(0, 50000), ...(truncated && { truncated: true, totalLength: content.length }) }
  },

  async write_file(args) {
    const filePath = args.path as string
    const content = args.content as string
    if (typeof content !== 'string') return { error: '파일 내용이 비어있습니다' }
    if (content.length > MAX_FILE_SIZE) {
      return { error: `내용이 너무 큽니다 (${Math.round(content.length / 1024)}KB). 1MB 이하만 쓸 수 있습니다.` }
    }
    const blocked = validatePath(filePath, 'write')
    if (blocked) return { error: blocked }
    const tmp = filePath + '.tmp'
    try {
      await writeFile(tmp, content, 'utf-8')
      await rename(tmp, filePath)
    } catch (err) {
      await unlink(tmp).catch(() => {})
      throw err
    }
    return { success: true }
  },

  async list_directory(args) {
    const dirPath = args.path as string
    const blocked = validatePath(dirPath, 'read')
    if (blocked) return { error: blocked }
    const entries = await readdir(dirPath, { withFileTypes: true })
    const results = await Promise.all(
      entries.slice(0, 100).map(async (entry) => {
        try {
          const fullPath = join(dirPath, entry.name)
          const info = await stat(fullPath)
          return { name: entry.name, isDirectory: entry.isDirectory(), size: info.size, modified: info.mtime.toISOString() }
        } catch { return null }
      })
    )
    return { entries: results.filter(Boolean) }
  },

  async delete_file(args) {
    const path = args.path as string
    const blocked = validatePath(path, 'delete')
    if (blocked) return { error: blocked }
    await unlink(path)
    return { success: true }
  },
}
