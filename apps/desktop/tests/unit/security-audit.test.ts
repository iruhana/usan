import { describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { SECURITY_AUDIT_SQL, SecurityAuditTrail, createSqliteSecurityAuditSink } from '@main/security/index'

describe('security audit log', () => {
  it('persists audit records and enforces append-only triggers', () => {
    const db = new DatabaseSync(':memory:')
    db.exec(SECURITY_AUDIT_SQL)

    const trail = new SecurityAuditTrail()
    trail.attachSink(createSqliteSecurityAuditSink(db as never))
    trail.record({
      occurredAt: Date.now(),
      actorType: 'agent',
      actorId: 'conversation-1',
      source: 'test',
      sessionId: 'conversation-1',
      conversationId: 'conversation-1',
      toolName: 'read_file',
      ring: 1,
      status: 'completed',
      request: { path: 'C:\\Users\\admin\\Desktop\\note.txt' },
      response: { content: 'hello' },
    })

    const row = db.prepare('SELECT tool_name, status FROM security_audit_log LIMIT 1').get() as {
      tool_name: string
      status: string
    }
    expect(row.tool_name).toBe('read_file')
    expect(row.status).toBe('completed')

    expect(() => {
      db.prepare("UPDATE security_audit_log SET status = 'failed' WHERE id = 1").run()
    }).toThrow(/append-only/i)

    expect(() => {
      db.prepare('DELETE FROM security_audit_log WHERE id = 1').run()
    }).toThrow(/append-only/i)
  })
})
