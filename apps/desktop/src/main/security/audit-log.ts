import type { SecurityAuditRecord } from './types'

export const SECURITY_AUDIT_SQL = `
  CREATE TABLE IF NOT EXISTS security_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at INTEGER NOT NULL,
    actor_type TEXT NOT NULL,
    actor_id TEXT,
    source TEXT NOT NULL,
    session_id TEXT,
    conversation_id TEXT,
    workflow_run_id TEXT,
    tool_name TEXT NOT NULL,
    ring INTEGER NOT NULL CHECK (ring BETWEEN 0 AND 3),
    status TEXT NOT NULL CHECK (status IN ('allowed', 'blocked', 'completed', 'failed', 'sanitized')),
    reason TEXT,
    request_json TEXT,
    response_json TEXT,
    capability_id TEXT,
    capability_expires_at INTEGER,
    session_public_key TEXT,
    session_fingerprint TEXT,
    guard_kind TEXT,
    guard_severity TEXT,
    guard_score INTEGER,
    guard_findings_json TEXT,
    scope_path TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_security_audit_log_time
    ON security_audit_log(occurred_at DESC);

  CREATE INDEX IF NOT EXISTS idx_security_audit_log_session
    ON security_audit_log(session_id, occurred_at DESC);

  CREATE TRIGGER IF NOT EXISTS security_audit_log_no_update
  BEFORE UPDATE ON security_audit_log
  BEGIN
    SELECT RAISE(ABORT, 'security_audit_log is append-only');
  END;

  CREATE TRIGGER IF NOT EXISTS security_audit_log_no_delete
  BEFORE DELETE ON security_audit_log
  BEGIN
    SELECT RAISE(ABORT, 'security_audit_log is append-only');
  END;
`

export interface SecurityAuditSink {
  append(record: SecurityAuditRecord): void
}

function redactSecrets(input: string): string {
  return input
    .replace(/("?(?:api[_-]?key|token|secret|password|authorization)"?\s*:\s*")([^"]+)(")/gi, '$1[REDACTED]$3')
    .replace(/\b(sk-[A-Za-z0-9_-]{16,})\b/g, '[REDACTED_OPENAI_KEY]')
    .replace(/\b(szn_[A-Za-z0-9_-]{16,})\b/g, '[REDACTED_SEIZN_KEY]')
    .replace(/\b(Bearer\s+[A-Za-z0-9._-]{16,})\b/gi, 'Bearer [REDACTED]')
}

function safeJson(value: unknown, maxChars = 4000): string | null {
  if (value === undefined) return null
  try {
    const json = redactSecrets(JSON.stringify(value))
    if (json.length <= maxChars) return json
    return `${json.slice(0, maxChars)}...[truncated]`
  } catch {
    return JSON.stringify({ error: 'serialize_failed' })
  }
}

export function createSqliteSecurityAuditSink<TDatabase extends {
  prepare: (sql: string) => unknown
}>(database: TDatabase): SecurityAuditSink {
  const statement = database.prepare(`
    INSERT INTO security_audit_log (
      occurred_at,
      actor_type,
      actor_id,
      source,
      session_id,
      conversation_id,
      workflow_run_id,
      tool_name,
      ring,
      status,
      reason,
      request_json,
      response_json,
      capability_id,
      capability_expires_at,
      session_public_key,
      session_fingerprint,
      guard_kind,
      guard_severity,
      guard_score,
      guard_findings_json,
      scope_path
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `) as { run: (...values: unknown[]) => unknown }

  return {
    append(record) {
      statement.run(
        record.occurredAt,
        record.actorType,
        record.actorId ?? null,
        record.source,
        record.sessionId ?? null,
        record.conversationId ?? null,
        record.workflowRunId ?? null,
        record.toolName,
        record.ring,
        record.status,
        record.reason ?? null,
        record.requestJson ?? null,
        record.responseJson ?? null,
        record.capabilityId ?? null,
        record.capabilityExpiresAt ?? null,
        record.sessionPublicKey ?? null,
        record.sessionFingerprint ?? null,
        record.guardKind ?? null,
        record.guardSeverity ?? null,
        record.guardScore ?? null,
        record.guardFindingsJson ?? null,
        record.scopePath ?? null,
      )
    },
  }
}

export class SecurityAuditTrail {
  private sinks: SecurityAuditSink[] = []
  private inMemory: SecurityAuditRecord[] = []

  attachSink(sink: SecurityAuditSink): void {
    this.sinks.push(sink)
  }

  record(record: Omit<SecurityAuditRecord, 'requestJson' | 'responseJson' | 'guardFindingsJson'> & {
    request?: unknown
    response?: unknown
    guardFindings?: unknown
  }): void {
    const normalized: SecurityAuditRecord = {
      ...record,
      requestJson: safeJson(record.request),
      responseJson: safeJson(record.response),
      guardFindingsJson: safeJson(record.guardFindings),
    }
    this.inMemory.push(normalized)
    if (this.inMemory.length > 200) {
      this.inMemory.splice(0, this.inMemory.length - 200)
    }

    for (const sink of this.sinks) {
      sink.append(normalized)
    }
  }

  recent(limit = 20): SecurityAuditRecord[] {
    return this.inMemory.slice(-limit)
  }
}
