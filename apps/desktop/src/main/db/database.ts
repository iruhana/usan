/**
 * SQLite database connection and migration runner.
 * Uses better-sqlite3 for synchronous, fast access.
 */
import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync } from 'fs'
import { SECURITY_AUDIT_SQL } from '../security/audit-log'

const DB_NAME = 'usan.db'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    const dir = join(app.getPath('userData'), 'data')
    mkdirSync(dir, { recursive: true })
    const dbPath = join(dir, DB_NAME)
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
  }
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}

function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)

  const applied = new Set(
    database.prepare('SELECT name FROM _migrations').all()
      .map((r) => (r as { name: string }).name),
  )

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.name)) continue
    database.exec(migration.sql)
    database.prepare('INSERT INTO _migrations (name) VALUES (?)').run(migration.name)
  }
}

const MIGRATIONS = [
  {
    name: '001_conversations',
    sql: `
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        deleted_at INTEGER DEFAULT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'tool')),
        content TEXT NOT NULL DEFAULT '',
        tool_calls TEXT DEFAULT NULL,
        tool_results TEXT DEFAULT NULL,
        model_id TEXT DEFAULT NULL,
        timestamp INTEGER NOT NULL,
        is_error INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_deleted ON conversations(deleted_at);
    `,
  },
  {
    name: '002_security_audit_log',
    sql: SECURITY_AUDIT_SQL,
  },
]
