/**
 * Conversation repository — SQLite-backed CRUD with soft delete.
 */
import { getDb } from '../database'
import type { StoredConversation, ChatMessage } from '@shared/types/ipc'

const TRASH_RETENTION_DAYS = 30

export function loadConversationsFromDb(): StoredConversation[] {
  const db = getDb()
  const rows = db.prepare(
    'SELECT id, title, created_at FROM conversations WHERE deleted_at IS NULL ORDER BY created_at DESC',
  ).all() as Array<{ id: string; title: string; created_at: number }>

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    messages: loadMessages(row.id),
    createdAt: row.created_at,
  }))
}

export function saveConversationsToDb(conversations: StoredConversation[]): void {
  const db = getDb()
  const upsertConv = db.prepare(`
    INSERT INTO conversations (id, title, created_at) VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET title = excluded.title
  `)
  const deleteMessages = db.prepare('DELETE FROM messages WHERE conversation_id = ?')
  const insertMessage = db.prepare(`
    INSERT INTO messages (id, conversation_id, role, content, tool_calls, tool_results, model_id, timestamp, is_error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const existingIds = new Set(
    (db.prepare('SELECT id FROM conversations WHERE deleted_at IS NULL').all() as Array<{ id: string }>)
      .map((r) => r.id),
  )
  const newIds = new Set(conversations.map((c) => c.id))

  const run = db.transaction(() => {
    // Hard-delete conversations that were removed (not in new set, not in trash)
    for (const id of existingIds) {
      if (!newIds.has(id)) {
        db.prepare('DELETE FROM conversations WHERE id = ?').run(id)
      }
    }

    for (const conv of conversations) {
      upsertConv.run(conv.id, conv.title, conv.createdAt)
      deleteMessages.run(conv.id)
      for (const msg of conv.messages) {
        insertMessage.run(
          msg.id,
          conv.id,
          msg.role,
          msg.content,
          msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
          msg.toolResults ? JSON.stringify(msg.toolResults) : null,
          msg.modelId ?? null,
          msg.timestamp,
          msg.isError ? 1 : 0,
        )
      }
    }
  })

  run()
}

export function softDeleteConversation(id: string): boolean {
  const db = getDb()
  const result = db.prepare('UPDATE conversations SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL')
    .run(Date.now(), id)
  return result.changes > 0
}

export function restoreConversation(id: string): StoredConversation | null {
  const db = getDb()
  const result = db.prepare('UPDATE conversations SET deleted_at = NULL WHERE id = ?').run(id)
  if (result.changes === 0) return null

  const row = db.prepare('SELECT id, title, created_at FROM conversations WHERE id = ?')
    .get(id) as { id: string; title: string; created_at: number } | undefined
  if (!row) return null

  return {
    id: row.id,
    title: row.title,
    messages: loadMessages(row.id),
    createdAt: row.created_at,
  }
}

export function listTrash(): Array<{ id: string; title: string; deletedAt: number; messageCount: number }> {
  const db = getDb()
  const rows = db.prepare(`
    SELECT c.id, c.title, c.deleted_at,
           (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
    FROM conversations c
    WHERE c.deleted_at IS NOT NULL
    ORDER BY c.deleted_at DESC
  `).all() as Array<{ id: string; title: string; deleted_at: number; message_count: number }>

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    deletedAt: r.deleted_at,
    messageCount: r.message_count,
  }))
}

export function permanentDeleteConversation(id: string): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM conversations WHERE id = ?').run(id)
  return result.changes > 0
}

export function pruneOldTrash(): number {
  const db = getDb()
  const cutoff = Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000
  const result = db.prepare('DELETE FROM conversations WHERE deleted_at IS NOT NULL AND deleted_at < ?').run(cutoff)
  return result.changes
}

function loadMessages(conversationId: string): ChatMessage[] {
  const db = getDb()
  const rows = db.prepare(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC',
  ).all(conversationId) as Array<{
    id: string; role: string; content: string; tool_calls: string | null
    tool_results: string | null; model_id: string | null; timestamp: number; is_error: number
  }>

  return rows.map((r) => ({
    id: r.id,
    role: r.role as ChatMessage['role'],
    content: r.content,
    toolCalls: r.tool_calls ? JSON.parse(r.tool_calls) : undefined,
    toolResults: r.tool_results ? JSON.parse(r.tool_results) : undefined,
    modelId: r.model_id ?? undefined,
    timestamp: r.timestamp,
    isError: r.is_error === 1 ? true : undefined,
  }))
}

/**
 * Migrate existing JSON conversations into SQLite.
 * Called once on first startup after upgrade.
 */
export function migrateFromJson(conversations: StoredConversation[]): void {
  const db = getDb()
  const count = (db.prepare('SELECT COUNT(*) AS c FROM conversations').get() as { c: number }).c
  if (count > 0) return // Already migrated

  saveConversationsToDb(conversations)
}
