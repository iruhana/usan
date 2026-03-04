/**
 * Vector Store — local in-memory vector DB with persistence.
 * Stores document chunks and their embeddings for similarity search.
 */
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import { cosineSimilarity } from './embeddings'
import { eventBus } from '../infrastructure/event-bus'
import { combineHybridScore, computeKeywordScore, normalizeVectorScore, toConfidenceLabel, tokenizeSearchText } from './hybrid-ranking'

export interface VectorDocument {
  id: string
  name: string
  path: string
  chunks: number
  indexedAt: number
  fileModifiedAt?: number
  fileSize?: number
}

export interface VectorEntry {
  id: string
  documentId: string
  text: string
  embedding: number[]
  metadata?: Record<string, unknown>
}

export interface SearchResult {
  documentId: string
  documentName: string
  chunk: string
  score: number
  vectorScore: number
  keywordScore: number
  confidence: 'high' | 'medium' | 'low'
}

const STORE_FILE = 'vector-store.json'
const DOCS_FILE = 'vector-docs.json'
const MAX_ENTRIES = 10_000

export class VectorStore {
  private entries: VectorEntry[] = []
  private documents: Map<string, VectorDocument> = new Map()

  addDocument(doc: VectorDocument): void {
    this.documents.set(doc.id, doc)
  }

  addEntries(entries: VectorEntry[]): void {
    this.entries.push(...entries)
    this.enforceLimit()
  }

  /** Evict oldest entries (LRU by insertion order) when over limit */
  private enforceLimit(): void {
    if (this.entries.length <= MAX_ENTRIES) return

    const overflow = this.entries.length - MAX_ENTRIES
    const evicted = this.entries.splice(0, overflow)

    // Clean up orphaned documents (no entries left)
    const evictedDocIds = new Set(evicted.map((e) => e.documentId))
    const remainingDocIds = new Set(this.entries.map((e) => e.documentId))
    for (const docId of evictedDocIds) {
      if (!remainingDocIds.has(docId)) {
        this.documents.delete(docId)
      }
    }

    eventBus.emit('rag.limit', {
      evicted: overflow,
      remaining: this.entries.length,
      maxEntries: MAX_ENTRIES,
    }, 'vector-store')
  }

  removeDocument(docId: string): void {
    this.documents.delete(docId)
    this.entries = this.entries.filter((e) => e.documentId !== docId)
  }

  search(queryEmbedding: number[], topK = 5, queryText?: string): SearchResult[] {
    const queryTokens = queryText ? tokenizeSearchText(queryText) : []

    const scored = this.entries.map((entry) => {
      const vectorScoreRaw = cosineSimilarity(queryEmbedding, entry.embedding)
      const vectorScore = normalizeVectorScore(vectorScoreRaw)
      const keywordScore = computeKeywordScore(queryTokens, entry.text)
      const score = combineHybridScore(vectorScore, keywordScore)
      return {
        entry,
        vectorScore,
        keywordScore,
        score,
      }
    })

    scored.sort((a, b) => b.score - a.score)

    return scored.slice(0, topK).map((s) => {
      const doc = this.documents.get(s.entry.documentId)
      return {
        documentId: s.entry.documentId,
        documentName: doc?.name || 'Unknown',
        chunk: s.entry.text,
        score: Math.round(s.score * 100),
        vectorScore: Math.round(s.vectorScore * 100),
        keywordScore: Math.round(s.keywordScore * 100),
        confidence: toConfidenceLabel(s.score),
      }
    })
  }

  listDocuments(): VectorDocument[] {
    return Array.from(this.documents.values())
  }

  getDocument(id: string): VectorDocument | undefined {
    return this.documents.get(id)
  }

  findDocumentByPath(path: string): VectorDocument | undefined {
    for (const doc of this.documents.values()) {
      if (doc.path === path) return doc
    }
    return undefined
  }

  get totalEntries(): number {
    return this.entries.length
  }

  private getDataDir(): string {
    return join(app.getPath('userData'), 'rag')
  }

  async loadFromDisk(): Promise<void> {
    try {
      const dir = this.getDataDir()
      const docsData = await readFile(join(dir, DOCS_FILE), 'utf-8')
      const docs = JSON.parse(docsData) as VectorDocument[]
      for (const doc of docs) this.documents.set(doc.id, doc)

      const storeData = await readFile(join(dir, STORE_FILE), 'utf-8')
      this.entries = JSON.parse(storeData) as VectorEntry[]
    } catch { /* fresh start */ }
  }

  async saveToDisk(): Promise<void> {
    try {
      const dir = this.getDataDir()
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, DOCS_FILE), JSON.stringify(this.listDocuments()), 'utf-8')
      await writeFile(join(dir, STORE_FILE), JSON.stringify(this.entries), 'utf-8')
    } catch { /* silently fail */ }
  }

  destroy(): void {
    this.entries = []
    this.documents.clear()
  }
}

/** Singleton instance */
export const vectorStore = new VectorStore()
