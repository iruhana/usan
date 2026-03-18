/**
 * SQLite-backed RAG store with FTS5 hybrid retrieval.
 */
import Database from 'better-sqlite3'
import { app } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'
import * as sqliteVec from 'sqlite-vec'
import { cosineSimilarity } from './embeddings'
import { eventBus } from '../infrastructure/event-bus'
import {
  buildFtsQuery,
  computeKeywordScore,
  mergeHybridRanks,
  normalizeRrfScore,
  normalizeVectorScore,
  rankToScore,
  tokenizeSearchText,
  toConfidenceLabel,
  type RankedMatch,
} from './hybrid-ranking'

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

interface ChunkRow {
  rowid: number
  id: string
  documentId: string
  documentName: string
  text: string
}

interface FtsRow {
  rowid: number
  bm25: number
}

interface VectorRow {
  rowid: number
  distance?: number
  embeddingJson?: string
}

const DB_FILE = 'rag.sqlite'
const DOCS_FILE = 'vector-docs.json'
const STORE_FILE = 'vector-store.json'
const LEGACY_IMPORT_META_KEY = 'legacy_json_imported'
const EMBEDDING_DIM = 384
const MAX_ENTRIES = 10_000
const MIN_CANDIDATE_LIMIT = 20
const CANDIDATE_MULTIPLIER = 6

function toEmbeddingJson(embedding: number[]): string {
  return JSON.stringify(embedding)
}

function parseEmbeddingJson(value: string): number[] {
  const parsed = JSON.parse(value) as number[]
  return Array.isArray(parsed) ? parsed : []
}

export class VectorStore {
  private db: Database.Database | null = null
  private sqliteVecEnabled = false

  addDocument(doc: VectorDocument): void {
    const db = this.ensureDb()
    db.prepare(`
      INSERT INTO rag_documents (
        id, name, path, chunks, indexed_at, file_modified_at, file_size
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        path = excluded.path,
        chunks = excluded.chunks,
        indexed_at = excluded.indexed_at,
        file_modified_at = excluded.file_modified_at,
        file_size = excluded.file_size
    `).run(
      doc.id,
      doc.name,
      doc.path,
      doc.chunks,
      doc.indexedAt,
      doc.fileModifiedAt ?? null,
      doc.fileSize ?? null,
    )
  }

  addEntries(entries: VectorEntry[]): void {
    if (entries.length === 0) return

    const db = this.ensureDb()
    const insertChunk = db.prepare(`
      INSERT INTO rag_chunks (
        id, document_id, chunk_index, text, embedding_json, start_offset, end_offset, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertFts = db.prepare(`
      INSERT INTO rag_chunks_fts (rowid, chunk_id, document_id, text)
      VALUES (?, ?, ?, ?)
    `)
    const insertVec = this.sqliteVecEnabled
      ? db.prepare(`
          INSERT INTO rag_chunk_embeddings (chunk_rowid, embedding)
          VALUES (?, ?)
        `)
      : null

    const nextChunkIndexByDoc = new Map<string, number>()
    const getNextChunkIndex = (documentId: string): number => {
      const cached = nextChunkIndexByDoc.get(documentId)
      if (cached != null) return cached
      const row = db.prepare(`
        SELECT COALESCE(MAX(chunk_index), -1) + 1 AS next_index
        FROM rag_chunks
        WHERE document_id = ?
      `).get(documentId) as { next_index: number } | undefined
      const nextIndex = row?.next_index ?? 0
      nextChunkIndexByDoc.set(documentId, nextIndex)
      return nextIndex
    }

    const transaction = db.transaction((rows: VectorEntry[]) => {
      for (const entry of rows) {
        const metadata = entry.metadata ?? {}
        const providedIndex = typeof metadata['chunkIndex'] === 'number' ? metadata['chunkIndex'] as number : null
        const chunkIndex = providedIndex ?? getNextChunkIndex(entry.documentId)
        nextChunkIndexByDoc.set(entry.documentId, chunkIndex + 1)

        const startOffset = typeof metadata['startOffset'] === 'number' ? metadata['startOffset'] as number : null
        const endOffset = typeof metadata['endOffset'] === 'number' ? metadata['endOffset'] as number : null
        const metadataJson = Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null

        const result = insertChunk.run(
          entry.id,
          entry.documentId,
          chunkIndex,
          entry.text,
          toEmbeddingJson(entry.embedding),
          startOffset,
          endOffset,
          metadataJson,
        )

        const rowid = Number(result.lastInsertRowid)
        insertFts.run(rowid, entry.id, entry.documentId, entry.text)
        if (insertVec) {
          insertVec.run(rowid, toEmbeddingJson(entry.embedding))
        }
      }
    })

    transaction(entries)
    this.enforceLimit()
  }

  private enforceLimit(): void {
    const db = this.ensureDb()
    const totalEntries = this.totalEntries
    if (totalEntries <= MAX_ENTRIES) return

    const overflow = totalEntries - MAX_ENTRIES
    const rows = db.prepare(`
      SELECT rowid, document_id
      FROM rag_chunks
      ORDER BY rowid ASC
      LIMIT ?
    `).all(overflow) as Array<{ rowid: number; document_id: string }>

    if (rows.length === 0) return

    const deleteChunk = db.prepare('DELETE FROM rag_chunks WHERE rowid = ?')
    const deleteFts = db.prepare('DELETE FROM rag_chunks_fts WHERE rowid = ?')
    const deleteVec = this.sqliteVecEnabled
      ? db.prepare('DELETE FROM rag_chunk_embeddings WHERE chunk_rowid = ?')
      : null

    const evictedDocIds = new Set<string>()
    const transaction = db.transaction(() => {
      for (const row of rows) {
        evictedDocIds.add(row.document_id)
        deleteFts.run(row.rowid)
        if (deleteVec) {
          deleteVec.run(row.rowid)
        }
        deleteChunk.run(row.rowid)
      }

      for (const docId of evictedDocIds) {
        const hasChunks = db.prepare(`
          SELECT 1
          FROM rag_chunks
          WHERE document_id = ?
          LIMIT 1
        `).get(docId)
        if (!hasChunks) {
          db.prepare('DELETE FROM rag_documents WHERE id = ?').run(docId)
        }
      }
    })

    transaction()

    eventBus.emit('rag.limit', {
      evicted: rows.length,
      remaining: this.totalEntries,
      maxEntries: MAX_ENTRIES,
    }, 'vector-store')
  }

  removeDocument(docId: string): void {
    const db = this.ensureDb()
    const rowIds = db.prepare(`
      SELECT rowid
      FROM rag_chunks
      WHERE document_id = ?
      ORDER BY rowid ASC
    `).all(docId) as Array<{ rowid: number }>

    const deleteChunk = db.prepare('DELETE FROM rag_chunks WHERE rowid = ?')
    const deleteFts = db.prepare('DELETE FROM rag_chunks_fts WHERE rowid = ?')
    const deleteVec = this.sqliteVecEnabled
      ? db.prepare('DELETE FROM rag_chunk_embeddings WHERE chunk_rowid = ?')
      : null

    const transaction = db.transaction(() => {
      for (const row of rowIds) {
        deleteFts.run(row.rowid)
        if (deleteVec) {
          deleteVec.run(row.rowid)
        }
        deleteChunk.run(row.rowid)
      }
      db.prepare('DELETE FROM rag_documents WHERE id = ?').run(docId)
    })

    transaction()
  }

  search(queryEmbedding: number[], topK = 5, queryText?: string): SearchResult[] {
    if (topK <= 0 || this.totalEntries === 0) return []

    const db = this.ensureDb()
    const candidateLimit = Math.max(MIN_CANDIDATE_LIMIT, topK * CANDIDATE_MULTIPLIER)
    const queryTokens = tokenizeSearchText(queryText ?? '')
    const ftsMatches = this.findFtsMatches(db, queryText ?? '', queryTokens, candidateLimit)
    const vectorMatches = this.findVectorMatches(db, queryEmbedding, candidateLimit) as RankedMatch[]
    const merged = mergeHybridRanks(ftsMatches, vectorMatches).slice(0, topK)

    if (merged.length === 0) return []

    const chunkRows = this.getChunkRows(db, merged.map((match) => match.rowid))
    const chunkRowById = new Map(chunkRows.map((row) => [row.rowid, row]))

    const vectorDistanceByRow = new Map<number, number>()
    for (const row of this.findVectorMatches(db, queryEmbedding, candidateLimit, true) as VectorRow[]) {
      if (row.distance != null) {
        vectorDistanceByRow.set(row.rowid, row.distance)
      }
    }

    return merged.flatMap((match) => {
      const chunkRow = chunkRowById.get(match.rowid)
      if (!chunkRow) return []

      const keywordScore = match.keywordRank != null
        ? Math.max(rankToScore(match.keywordRank, candidateLimit), computeKeywordScore(queryTokens, chunkRow.text))
        : computeKeywordScore(queryTokens, chunkRow.text)

      const vectorDistance = vectorDistanceByRow.get(match.rowid)
      const vectorSimilarity = vectorDistance != null
        ? 1 - vectorDistance
        : this.getVectorSimilarityFromChunkRow(db, match.rowid, queryEmbedding)
      const vectorScore = normalizeVectorScore(vectorSimilarity)

      const normalizedScore = normalizeRrfScore(match.rrfScore, match.sourceCount)

      return [{
        documentId: chunkRow.documentId,
        documentName: chunkRow.documentName,
        chunk: chunkRow.text,
        score: Math.round(normalizedScore * 100),
        vectorScore: Math.round(vectorScore * 100),
        keywordScore: Math.round(keywordScore * 100),
        confidence: toConfidenceLabel(normalizedScore),
      }]
    })
  }

  listDocuments(): VectorDocument[] {
    const db = this.ensureDb()
    return db.prepare(`
      SELECT
        id,
        name,
        path,
        chunks,
        indexed_at AS indexedAt,
        file_modified_at AS fileModifiedAt,
        file_size AS fileSize
      FROM rag_documents
      ORDER BY indexed_at DESC
    `).all() as VectorDocument[]
  }

  getDocument(id: string): VectorDocument | undefined {
    const db = this.ensureDb()
    return db.prepare(`
      SELECT
        id,
        name,
        path,
        chunks,
        indexed_at AS indexedAt,
        file_modified_at AS fileModifiedAt,
        file_size AS fileSize
      FROM rag_documents
      WHERE id = ?
      LIMIT 1
    `).get(id) as VectorDocument | undefined
  }

  findDocumentByPath(path: string): VectorDocument | undefined {
    const db = this.ensureDb()
    return db.prepare(`
      SELECT
        id,
        name,
        path,
        chunks,
        indexed_at AS indexedAt,
        file_modified_at AS fileModifiedAt,
        file_size AS fileSize
      FROM rag_documents
      WHERE path = ?
      LIMIT 1
    `).get(path) as VectorDocument | undefined
  }

  get totalEntries(): number {
    const db = this.ensureDb()
    const row = db.prepare('SELECT COUNT(*) AS count FROM rag_chunks').get() as { count: number }
    return row.count
  }

  private getDataDir(): string {
    return join(app.getPath('userData'), 'rag')
  }

  async loadFromDisk(): Promise<void> {
    this.ensureDb()
    await this.importLegacyJsonIfNeeded()
    this.rebuildAuxiliaryTablesIfNeeded()
  }

  async saveToDisk(): Promise<void> {
    const db = this.ensureDb()
    db.pragma('wal_checkpoint(PASSIVE)')
  }

  destroy(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
    this.sqliteVecEnabled = false
  }

  private ensureDb(): Database.Database {
    if (this.db) {
      return this.db
    }

    const dir = this.getDataDir()
    mkdirSync(dir, { recursive: true })
    const dbPath = join(dir, DB_FILE)
    const db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    db.pragma('busy_timeout = 5000')

    this.sqliteVecEnabled = this.tryLoadSqliteVec(db)
    this.createSchema(db)

    this.db = db
    return db
  }

  private tryLoadSqliteVec(db: Database.Database): boolean {
    try {
      sqliteVec.load(db)
      return true
    } catch {
      return false
    }
  }

  private createSchema(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS rag_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rag_documents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        chunks INTEGER NOT NULL,
        indexed_at INTEGER NOT NULL,
        file_modified_at INTEGER,
        file_size INTEGER
      );

      CREATE TABLE IF NOT EXISTS rag_chunks (
        rowid INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        document_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        text TEXT NOT NULL,
        embedding_json TEXT NOT NULL,
        start_offset INTEGER,
        end_offset INTEGER,
        metadata_json TEXT,
        FOREIGN KEY (document_id) REFERENCES rag_documents(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_rag_documents_path ON rag_documents(path);
      CREATE INDEX IF NOT EXISTS idx_rag_chunks_document ON rag_chunks(document_id);
      CREATE INDEX IF NOT EXISTS idx_rag_chunks_document_chunk_index ON rag_chunks(document_id, chunk_index);

      CREATE VIRTUAL TABLE IF NOT EXISTS rag_chunks_fts USING fts5(
        chunk_id UNINDEXED,
        document_id UNINDEXED,
        text,
        tokenize='unicode61'
      );
    `)

    if (this.sqliteVecEnabled) {
      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS rag_chunk_embeddings USING vec0(
          chunk_rowid INTEGER PRIMARY KEY,
          embedding FLOAT[${EMBEDDING_DIM}] distance_metric=cosine
        );
      `)
    }
  }

  private rebuildAuxiliaryTablesIfNeeded(): void {
    const db = this.ensureDb()
    const chunkCount = (db.prepare('SELECT COUNT(*) AS count FROM rag_chunks').get() as { count: number }).count
    const ftsCount = (db.prepare('SELECT COUNT(*) AS count FROM rag_chunks_fts').get() as { count: number }).count

    if (chunkCount !== ftsCount) {
      const clearFts = db.prepare('DELETE FROM rag_chunks_fts')
      const insertFts = db.prepare(`
        INSERT INTO rag_chunks_fts (rowid, chunk_id, document_id, text)
        VALUES (?, ?, ?, ?)
      `)
      const rows = db.prepare(`
        SELECT rowid, id, document_id, text
        FROM rag_chunks
        ORDER BY rowid ASC
      `).all() as Array<{ rowid: number; id: string; document_id: string; text: string }>

      const transaction = db.transaction(() => {
        clearFts.run()
        for (const row of rows) {
          insertFts.run(row.rowid, row.id, row.document_id, row.text)
        }
      })
      transaction()
    }

    if (this.sqliteVecEnabled) {
      const vectorCount = (db.prepare('SELECT COUNT(*) AS count FROM rag_chunk_embeddings').get() as { count: number }).count
      if (chunkCount !== vectorCount) {
        const clearVec = db.prepare('DELETE FROM rag_chunk_embeddings')
        const insertVec = db.prepare(`
          INSERT INTO rag_chunk_embeddings (chunk_rowid, embedding)
          VALUES (?, ?)
        `)
        const rows = db.prepare(`
          SELECT rowid, embedding_json
          FROM rag_chunks
          ORDER BY rowid ASC
        `).all() as Array<{ rowid: number; embedding_json: string }>

        const transaction = db.transaction(() => {
          clearVec.run()
          for (const row of rows) {
            insertVec.run(row.rowid, row.embedding_json)
          }
        })
        transaction()
      }
    }
  }

  private getMeta(key: string): string | null {
    const db = this.ensureDb()
    const row = db.prepare('SELECT value FROM rag_meta WHERE key = ?').get(key) as { value: string } | undefined
    return row?.value ?? null
  }

  private setMeta(key: string, value: string): void {
    const db = this.ensureDb()
    db.prepare(`
      INSERT INTO rag_meta (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value)
  }

  private async importLegacyJsonIfNeeded(): Promise<void> {
    if (this.getMeta(LEGACY_IMPORT_META_KEY) === '1') {
      return
    }

    if (this.listDocuments().length > 0 || this.totalEntries > 0) {
      this.setMeta(LEGACY_IMPORT_META_KEY, '1')
      return
    }

    const dir = this.getDataDir()
    const docsPath = join(dir, DOCS_FILE)
    const storePath = join(dir, STORE_FILE)
    if (!existsSync(docsPath) || !existsSync(storePath)) {
      this.setMeta(LEGACY_IMPORT_META_KEY, '1')
      return
    }

    try {
      const [docsRaw, entriesRaw] = await Promise.all([
        readFile(docsPath, 'utf-8'),
        readFile(storePath, 'utf-8'),
      ])

      const docs = JSON.parse(docsRaw) as VectorDocument[]
      const entries = JSON.parse(entriesRaw) as VectorEntry[]

      const db = this.ensureDb()
      const transaction = db.transaction(() => {
        for (const doc of docs) {
          this.addDocument(doc)
        }
        this.addEntries(entries)
      })

      transaction()
      this.setMeta(LEGACY_IMPORT_META_KEY, '1')
    } catch {
      // Leave the legacy files untouched if import fails.
    }
  }

  private findFtsMatches(
    db: Database.Database,
    queryText: string,
    queryTokens: string[],
    limit: number,
  ): RankedMatch[] {
    if (!queryText.trim() || queryTokens.length === 0) {
      return []
    }

    const ftsQuery = buildFtsQuery(queryText)
    if (!ftsQuery) {
      return []
    }

    try {
      const rows = db.prepare(`
        SELECT rowid, bm25(rag_chunks_fts) AS bm25
        FROM rag_chunks_fts
        WHERE rag_chunks_fts MATCH ?
        ORDER BY bm25(rag_chunks_fts)
        LIMIT ?
      `).all(ftsQuery, limit) as FtsRow[]

      return rows.map((row, index) => ({
        rowid: row.rowid,
        rank: index + 1,
      }))
    } catch {
      const rows = db.prepare(`
        SELECT rowid, text
        FROM rag_chunks
      `).all() as Array<{ rowid: number; text: string }>

      return rows
        .map((row) => ({
          rowid: row.rowid,
          keywordScore: computeKeywordScore(queryTokens, row.text),
        }))
        .filter((row) => row.keywordScore > 0)
        .sort((a, b) => b.keywordScore - a.keywordScore)
        .slice(0, limit)
        .map((row, index) => ({
          rowid: row.rowid,
          rank: index + 1,
        }))
    }
  }

  private findVectorMatches(
    db: Database.Database,
    queryEmbedding: number[],
    limit: number,
    includeDistance = false,
  ): RankedMatch[] | VectorRow[] {
    if (this.sqliteVecEnabled) {
      try {
        const rows = db.prepare(`
          SELECT chunk_rowid AS rowid, distance
          FROM rag_chunk_embeddings
          WHERE embedding MATCH ?
            AND k = ?
        `).all(toEmbeddingJson(queryEmbedding), limit) as VectorRow[]

        if (includeDistance) {
          return rows
        }

        return rows.map((row, index) => ({
          rowid: row.rowid,
          rank: index + 1,
        }))
      } catch {
        this.sqliteVecEnabled = false
      }
    }

    const rows = db.prepare(`
      SELECT rowid, embedding_json AS embeddingJson
      FROM rag_chunks
    `).all() as VectorRow[]

    const ranked = rows
      .map((row) => {
        const similarity = cosineSimilarity(queryEmbedding, parseEmbeddingJson(row.embeddingJson ?? '[]'))
        return { rowid: row.rowid, distance: 1 - similarity }
      })
      .sort((a, b) => (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY))
      .slice(0, limit)

    if (includeDistance) {
      return ranked
    }

    return ranked.map((row, index) => ({
      rowid: row.rowid,
      rank: index + 1,
    }))
  }

  private getChunkRows(db: Database.Database, rowIds: number[]): ChunkRow[] {
    if (rowIds.length === 0) return []
    const placeholders = rowIds.map(() => '?').join(', ')
    return db.prepare(`
      SELECT
        rag_chunks.rowid AS rowid,
        rag_chunks.id AS id,
        rag_chunks.document_id AS documentId,
        rag_documents.name AS documentName,
        rag_chunks.text AS text
      FROM rag_chunks
      JOIN rag_documents ON rag_documents.id = rag_chunks.document_id
      WHERE rag_chunks.rowid IN (${placeholders})
    `).all(...rowIds) as ChunkRow[]
  }

  private getVectorSimilarityFromChunkRow(
    db: Database.Database,
    rowid: number,
    queryEmbedding: number[],
  ): number {
    const row = db.prepare(`
      SELECT embedding_json AS embeddingJson
      FROM rag_chunks
      WHERE rowid = ?
      LIMIT 1
    `).get(rowid) as { embeddingJson: string } | undefined

    if (!row?.embeddingJson) {
      return 0
    }

    return cosineSimilarity(queryEmbedding, parseEmbeddingJson(row.embeddingJson))
  }
}

/** Singleton instance */
export const vectorStore = new VectorStore()
