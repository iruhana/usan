/**
 * Document Indexer — indexes files/folders into the vector store.
 */
import { readdir, stat } from 'fs/promises'
import { join, basename } from 'path'
import { chunkText, extractTextFromFile } from './chunker'
import { generateEmbedding, generateEmbeddings } from './embeddings'
import { vectorStore } from './vector-store'
import type { VectorEntry } from './vector-store'
import { eventBus } from '../infrastructure/event-bus'

export interface IndexProgress {
  current: number
  total: number
  fileName: string
}

export interface IndexFileResult {
  documentId: string
  chunks: number
  skipped: boolean
}

export interface IndexFolderResult {
  indexedCount: number
  skippedCount: number
  failedCount: number
  totalChunks: number
}

export async function indexFile(filePath: string, save = true): Promise<IndexFileResult> {
  const fileInfo = await stat(filePath)
  const existing = vectorStore.findDocumentByPath(filePath)
  const fileModifiedAt = Math.floor(fileInfo.mtimeMs)

  if (existing && existing.fileModifiedAt === fileModifiedAt && existing.fileSize === fileInfo.size) {
    return { documentId: existing.id, chunks: existing.chunks, skipped: true }
  }

  if (existing) {
    vectorStore.removeDocument(existing.id)
  }

  const text = await extractTextFromFile(filePath)
  const chunks = chunkText(text)
  const docId = crypto.randomUUID()

  vectorStore.addDocument({
    id: docId,
    name: basename(filePath),
    path: filePath,
    chunks: chunks.length,
    indexedAt: Date.now(),
    fileModifiedAt,
    fileSize: fileInfo.size,
  })

  // Batch embed all chunks at once
  const chunkTexts = chunks.map((c) => c.text)
  const embeddings = chunkTexts.length <= 1
    ? await Promise.all(chunkTexts.map((t) => generateEmbedding(t)))
    : await generateEmbeddings(chunkTexts)

  const entries: VectorEntry[] = embeddings.map((embedding, i) => ({
    id: crypto.randomUUID(),
    documentId: docId,
    text: chunkTexts[i],
    embedding,
  }))

  vectorStore.addEntries(entries)
  if (save) await vectorStore.saveToDisk()
  return { documentId: docId, chunks: chunks.length, skipped: false }
}

export async function indexFolder(dirPath: string): Promise<IndexFolderResult> {
  const files = await collectFiles(dirPath)
  let indexedCount = 0
  let skippedCount = 0
  let failedCount = 0
  let totalChunks = 0

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i]
    eventBus.emit('rag.progress', {
      current: i + 1,
      total: files.length,
      fileName: basename(filePath),
    }, 'document-indexer')

    try {
      const result = await indexFile(filePath, false)
      if (result.skipped) {
        skippedCount++
      } else {
        indexedCount++
      }
      totalChunks += result.chunks
    } catch {
      // Skip unsupported files
      failedCount++
    }
  }

  // Save once after all files are indexed
  if (indexedCount > 0) {
    await vectorStore.saveToDisk()
  }

  return { indexedCount, skippedCount, failedCount, totalChunks }
}

async function collectFiles(dirPath: string, maxDepth = 3, depth = 0): Promise<string[]> {
  if (depth >= maxDepth) return []
  const files: string[] = []
  const entries = await readdir(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const fullPath = join(dirPath, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath, maxDepth, depth + 1))
    } else {
      const info = await stat(fullPath).catch(() => null)
      if (info && info.size < 5 * 1024 * 1024) { // 5MB limit
        files.push(fullPath)
      }
    }
  }
  return files
}
