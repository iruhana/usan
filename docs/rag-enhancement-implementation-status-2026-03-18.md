# RAG Enhancement Implementation Status

Date: 2026-03-18
Project: USAN Desktop
Scope: Task J from the Codex development guide

## 1. Summary

Task J has been implemented for the desktop RAG pipeline.

The knowledge base is no longer centered on an in-memory array plus JSON-only persistence. It now uses a SQLite-backed store with:

- `better-sqlite3` as the local storage engine
- FTS5 for keyword retrieval
- `sqlite-vec` for vector similarity search when the Electron runtime can load the extension
- reciprocal rank fusion (RRF) to combine keyword and vector rankings
- a safe JavaScript cosine-similarity fallback if `sqlite-vec` is unavailable at runtime

## 2. What Changed

The main storage path now keeps three synchronized layers:

1. `rag_documents`
   - one row per indexed document

2. `rag_chunks`
   - one row per chunk with chunk text, metadata, and the JSON copy of the embedding

3. retrieval indexes
   - `rag_chunks_fts` for FTS5 keyword search
   - `rag_chunk_embeddings` as a `vec0` virtual table when `sqlite-vec` loads successfully

Hybrid retrieval now works as follows:

- run FTS5 keyword search over chunk text
- run vector KNN search through `sqlite-vec` when available
- fall back to brute-force cosine similarity in JavaScript if the vector extension cannot be used
- merge both rankings with reciprocal rank fusion

## 3. Files Updated

### Core RAG implementation

- `apps/desktop/src/main/rag/vector-store.ts`
- `apps/desktop/src/main/rag/hybrid-ranking.ts`
- `apps/desktop/src/main/rag/document-indexer.ts`

### Validation

- `apps/desktop/tests/unit/hybrid-ranking.test.ts`
- `apps/desktop/tests/unit/document-indexer.test.ts`

### Dependency update

- `apps/desktop/package.json`
- `apps/desktop/package-lock.json`

## 4. Runtime Notes

The `sqlite-vec` package was added and the Electron-native dependency rebuild was executed with:

- `npx electron-builder install-app-deps`

After rebuilding native modules for Electron, a direct Electron runtime check succeeded for:

- `better-sqlite3` loading
- `sqlite-vec` extension loading
- `vec0` virtual table creation
- KNN query execution

This matters because the plain terminal Node.js runtime in this environment is not ABI-compatible with the Electron-native `better-sqlite3` binding after rebuild. The desktop app runtime is the relevant target for this feature, and that path was verified.

## 5. Validation Completed

The following checks passed for this task:

- `npx vitest run tests/unit/hybrid-ranking.test.ts tests/unit/document-indexer.test.ts`
- `npx eslint src/main/rag/vector-store.ts src/main/rag/hybrid-ranking.ts src/main/rag/document-indexer.ts tests/unit/hybrid-ranking.test.ts tests/unit/document-indexer.test.ts`
- targeted TypeScript verification for the RAG files with a temporary task-specific tsconfig
- Electron runtime smoke check for `better-sqlite3 + sqlite-vec`

## 6. Known Limits

- The repository-wide `npm run typecheck:node` still fails because unrelated `src/main/documents/*` files reference missing packages such as `docx`, `pdf-lib`, and `exceljs`. Those errors were not introduced by this task.
- The fallback JavaScript vector path remains intentionally available as a resilience measure. It is slower than `sqlite-vec`, but it keeps hybrid retrieval functional if extension loading fails on a target machine.
- Legacy JSON files are imported only when the new SQLite store is empty. They are left untouched on disk for safety.

## 7. Result

Task J is complete for the current architecture:

- SQLite-backed persistence is in place
- FTS5 retrieval is active
- `sqlite-vec` integration is wired in
- hybrid RRF ranking is implemented
- legacy JSON migration is handled
- indexing flow now preserves chunk metadata
