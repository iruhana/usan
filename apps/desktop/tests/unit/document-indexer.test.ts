import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  statMock,
  readdirMock,
  extractTextFromFileMock,
  chunkTextMock,
  generateEmbeddingMock,
  emitMock,
  vectorStoreMock,
} = vi.hoisted(() => ({
  statMock: vi.fn(),
  readdirMock: vi.fn(),
  extractTextFromFileMock: vi.fn(),
  chunkTextMock: vi.fn(),
  generateEmbeddingMock: vi.fn(),
  emitMock: vi.fn(),
  vectorStoreMock: {
    findDocumentByPath: vi.fn(),
    removeDocument: vi.fn(),
    addDocument: vi.fn(),
    addEntries: vi.fn(),
    saveToDisk: vi.fn(),
  },
}))

vi.mock('fs/promises', () => ({
  stat: statMock,
  readdir: readdirMock,
}))

vi.mock('../../src/main/rag/chunker', () => ({
  extractTextFromFile: extractTextFromFileMock,
  chunkText: chunkTextMock,
}))

vi.mock('../../src/main/rag/embeddings', () => ({
  generateEmbedding: generateEmbeddingMock,
}))

vi.mock('../../src/main/rag/vector-store', () => ({
  vectorStore: vectorStoreMock,
}))

vi.mock('../../src/main/infrastructure/event-bus', () => ({
  eventBus: {
    emit: emitMock,
  },
}))

import { indexFile, indexFolder } from '../../src/main/rag/document-indexer'

function normalizePath(input: string): string {
  return input.replace(/\\/g, '/')
}

describe('document-indexer', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    statMock.mockResolvedValue({ mtimeMs: 1000, size: 100 })
    readdirMock.mockResolvedValue([])
    extractTextFromFileMock.mockResolvedValue('sample text')
    chunkTextMock.mockReturnValue([{ text: 'chunk-1' }])
    generateEmbeddingMock.mockResolvedValue([0.12, 0.34])
    vectorStoreMock.findDocumentByPath.mockReturnValue(undefined)
    vectorStoreMock.saveToDisk.mockResolvedValue(undefined)
  })

  it('skips unchanged file indexing', async () => {
    vectorStoreMock.findDocumentByPath.mockReturnValue({
      id: 'doc-existing',
      name: 'same.txt',
      path: 'C:\\vault\\same.txt',
      chunks: 3,
      indexedAt: 1,
      fileModifiedAt: 1000,
      fileSize: 100,
    })

    const result = await indexFile('C:\\vault\\same.txt')

    expect(result).toEqual({
      documentId: 'doc-existing',
      chunks: 3,
      skipped: true,
    })
    expect(extractTextFromFileMock).not.toHaveBeenCalled()
    expect(vectorStoreMock.addDocument).not.toHaveBeenCalled()
    expect(vectorStoreMock.addEntries).not.toHaveBeenCalled()
    expect(vectorStoreMock.saveToDisk).not.toHaveBeenCalled()
  })

  it('returns indexed/skipped/failed counts for folder indexing', async () => {
    const root = 'C:\\vault'

    readdirMock.mockResolvedValueOnce([
      { name: 'a.txt', isDirectory: () => false },
      { name: 'b.txt', isDirectory: () => false },
      { name: 'c.txt', isDirectory: () => false },
    ])

    const statsByPath: Record<string, { mtimeMs: number; size: number }> = {
      'C:/vault/a.txt': { mtimeMs: 1100, size: 101 },
      'C:/vault/b.txt': { mtimeMs: 2000, size: 200 },
      'C:/vault/c.txt': { mtimeMs: 1300, size: 103 },
    }

    statMock.mockImplementation(async (path: string) => {
      const key = normalizePath(path)
      const info = statsByPath[key]
      if (!info) throw new Error(`unexpected path: ${path}`)
      return info
    })

    vectorStoreMock.findDocumentByPath.mockImplementation((path: string) => {
      if (normalizePath(path).endsWith('/b.txt')) {
        return {
          id: 'doc-b',
          name: 'b.txt',
          path,
          chunks: 2,
          indexedAt: 1,
          fileModifiedAt: 2000,
          fileSize: 200,
        }
      }
      return undefined
    })

    extractTextFromFileMock.mockImplementation(async (path: string) => {
      if (normalizePath(path).endsWith('/c.txt')) {
        throw new Error('unsupported file')
      }
      return `contents: ${path}`
    })

    chunkTextMock.mockReturnValue([{ text: 'chunk-a' }])

    const result = await indexFolder(root)

    expect(result).toEqual({
      indexedCount: 1,
      skippedCount: 1,
      failedCount: 1,
      totalChunks: 3,
    })
    expect(emitMock).toHaveBeenCalledTimes(3)
  })
})
