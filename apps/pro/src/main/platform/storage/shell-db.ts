import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type {
  ShellApproval,
  ShellAttachment,
  ShellArtifact,
  ShellChatMessage,
  ShellLog,
  ShellPreview,
  ShellReference,
  ShellRunStep,
  ShellSession,
  ShellSnapshot,
  ShellTemplate,
} from '@shared/types'

interface SqliteStatement {
  run(params?: unknown): unknown
  all(params?: unknown): unknown[]
  get(params?: unknown): Record<string, unknown> | undefined
}

interface SqliteDatabase {
  exec(sql: string): void
  prepare(sql: string): SqliteStatement
  transaction<TArgs extends unknown[], TResult>(fn: (...args: TArgs) => TResult): (...args: TArgs) => TResult
  pragma(query: string, options?: { simple?: boolean }): unknown
  close(): void
}

let cachedDb: SqliteDatabase | null = null
let cachedDbPath: string | null = null

export interface ShellStorageMigration {
  version: number
  destructive?: boolean
  up: (db: SqliteDatabase) => void
}

interface SessionRow {
  id: string
  title: string
  status: ShellSession['status']
  model: string
  updated_at: string
  archived_at: string | null
  branched_from_session_id: string | null
  branched_from_message_id: string | null
  pinned: number
  message_count: number
  artifact_count: number
  preview: string | null
}

interface RunStepRow {
  id: string
  session_id: string
  label: string
  status: ShellRunStep['status']
  detail: string | null
  duration_ms: number | null
}

interface ArtifactRow {
  id: string
  title: string
  kind: ShellArtifact['kind']
  session_id: string
  created_at: string
  size: string
  version: number
  content: string | null
}

interface AttachmentRow {
  id: string
  session_id: string
  kind: ShellAttachment['kind']
  source: ShellAttachment['source']
  status: ShellAttachment['status']
  name: string
  mime_type: string
  size_bytes: number
  size_label: string
  created_at: string
  message_id: string | null
  path: string | null
  data_url: string | null
  text_content: string | null
}

interface ApprovalRow {
  id: string
  session_id: string
  action: string
  detail: string
  capability: ShellApproval['capability']
  risk: ShellApproval['risk']
  status: ShellApproval['status']
  retryable: number
  fallback: string | null
  step_id: string | null
}

interface LogRow {
  id: string
  session_id: string
  ts: string
  level: ShellLog['level']
  message: string
  kind: ShellLog['kind'] | null
  status: ShellLog['status'] | null
  capability: ShellLog['capability'] | null
  step_id: string | null
  approval_id: string | null
  tool_name: string | null
  attachment_name: string | null
  attachment_delivery_mode: ShellLog['attachmentDeliveryMode'] | null
  model_id: string | null
}

interface MessageRow {
  id: string
  session_id: string
  role: ShellChatMessage['role']
  content: string
  ts: number
}

interface ReferenceRow {
  id: string
  session_id: string
  type: ShellReference['type']
  title: string
  detail: string
}

interface PreviewRow {
  session_id: string
  title: string
  status: ShellPreview['status']
  version: number
}

interface TemplateRow {
  id: string
  emoji: string
  title: string
  description: string
  category: ShellTemplate['category']
}

const MIGRATIONS: ShellStorageMigration[] = [
  {
    version: 1,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS app_meta (
          key TEXT PRIMARY KEY,
          value TEXT
        );

        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          status TEXT NOT NULL,
          model TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          archived_at TEXT,
          branched_from_session_id TEXT,
          branched_from_message_id TEXT,
          pinned INTEGER NOT NULL DEFAULT 0,
          message_count INTEGER NOT NULL DEFAULT 0,
          artifact_count INTEGER NOT NULL DEFAULT 0,
          preview TEXT
        );

        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          ts INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);

        CREATE TABLE IF NOT EXISTS run_steps (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          label TEXT NOT NULL,
          status TEXT NOT NULL,
          detail TEXT,
          duration_ms INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_run_steps_session_id ON run_steps(session_id);

        CREATE TABLE IF NOT EXISTS artifacts (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          kind TEXT NOT NULL,
          session_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          size TEXT NOT NULL,
          version INTEGER NOT NULL,
          content TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_artifacts_session_id ON artifacts(session_id);

        CREATE TABLE IF NOT EXISTS approvals (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          action TEXT NOT NULL,
          detail TEXT NOT NULL,
          capability TEXT NOT NULL,
          risk TEXT NOT NULL,
          status TEXT NOT NULL,
          retryable INTEGER NOT NULL DEFAULT 0,
          fallback TEXT,
          step_id TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_approvals_session_id ON approvals(session_id);

        CREATE TABLE IF NOT EXISTS logs (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          ts TEXT NOT NULL,
          level TEXT NOT NULL,
          message TEXT NOT NULL,
          kind TEXT,
          status TEXT,
          capability TEXT,
          step_id TEXT,
          approval_id TEXT,
          tool_name TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_logs_session_id ON logs(session_id);

        CREATE TABLE IF NOT EXISTS session_references (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          detail TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_session_references_session_id ON session_references(session_id);

        CREATE TABLE IF NOT EXISTS previews (
          session_id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          status TEXT NOT NULL,
          version INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS templates (
          id TEXT PRIMARY KEY,
          emoji TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          category TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS runs (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TEXT NOT NULL DEFAULT '',
          updated_at TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_runs_session_id ON runs(session_id);

        CREATE TABLE IF NOT EXISTS memories (
          id TEXT PRIMARY KEY,
          session_id TEXT,
          type TEXT NOT NULL DEFAULT 'fact',
          title TEXT NOT NULL DEFAULT '',
          content TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_memories_session_id ON memories(session_id);
      `)
    },
  },
  {
    version: 2,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS attachments (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          source TEXT NOT NULL,
          status TEXT NOT NULL,
          name TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          size_label TEXT NOT NULL,
          created_at TEXT NOT NULL,
          message_id TEXT,
          path TEXT,
          data_url TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_attachments_session_id ON attachments(session_id);
      `)
    },
  },
  {
    version: 3,
    up: (db) => {
      db.exec(`
        ALTER TABLE attachments ADD COLUMN text_content TEXT;
      `)
    },
  },
  {
    version: 4,
    up: (db) => {
      db.exec(`
        ALTER TABLE logs ADD COLUMN attachment_name TEXT;
        ALTER TABLE logs ADD COLUMN attachment_delivery_mode TEXT;
        ALTER TABLE logs ADD COLUMN model_id TEXT;
      `)
    },
  },
]

let migrationsOverride: readonly ShellStorageMigration[] | null = null

export function getShellSnapshotDatabasePath(legacySnapshotPath: string): string {
  return join(dirname(legacySnapshotPath), 'shell-state.sqlite')
}

function isRecoverableSqliteError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  return /SQLITE_CORRUPT|SQLITE_NOTADB|malformed|disk image is malformed|corrupt|not a database|file is not a database/i.test(text)
}

function closeCachedDb(): void {
  if (!cachedDb) {
    return
  }

  try {
    cachedDb.close()
  } catch {
    // Ignore close failures while resetting or recovering.
  } finally {
    cachedDb = null
    cachedDbPath = null
  }
}

function archiveCorruptDatabase(dbPath: string): void {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  mkdirSync(dirname(dbPath), { recursive: true })

  for (const suffix of ['', '-wal', '-shm']) {
    const source = `${dbPath}${suffix}`
    if (!existsSync(source)) {
      continue
    }

    if (suffix === '') {
      const backup = `${dbPath}.corrupt-${stamp}.bak`
      try {
        renameSync(source, backup)
      } catch {
        rmSync(source, { force: true })
      }
      continue
    }

    rmSync(source, { force: true })
  }
}

function getMigrations(): readonly ShellStorageMigration[] {
  return migrationsOverride ?? MIGRATIONS
}

function createMigrationBackup(
  dbPath: string,
  currentVersion: number,
  targetVersion: number,
  migrations: readonly ShellStorageMigration[],
): void {
  if (currentVersion <= 0 || !existsSync(dbPath)) {
    return
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = join(dirname(dbPath), 'migration-backups', `${stamp}-v${currentVersion}-to-v${targetVersion}`)
  mkdirSync(backupDir, { recursive: true })

  const sourceFiles = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`].filter((filePath) => existsSync(filePath))
  for (const filePath of sourceFiles) {
    copyFileSync(filePath, join(backupDir, filePath.slice(dirname(dbPath).length + 1)))
  }

  writeFileSync(join(backupDir, 'manifest.json'), JSON.stringify({
    createdAt: new Date().toISOString(),
    currentVersion,
    targetVersion,
    migrations: migrations.map((migration) => ({
      version: migration.version,
      destructive: Boolean(migration.destructive),
    })),
  }, null, 2), 'utf8')
}

function applyMigrations(db: SqliteDatabase, dbPath: string): void {
  const currentVersion = db.pragma('user_version', { simple: true }) as number
  const migrations = [...getMigrations()].sort((left, right) => left.version - right.version)
  const pendingMigrations = migrations.filter((migration) => migration.version > currentVersion)
  const destructivePendingMigrations = pendingMigrations.filter((migration) => migration.destructive)

  if (destructivePendingMigrations.length > 0) {
    const targetVersion = pendingMigrations[pendingMigrations.length - 1]?.version ?? currentVersion
    createMigrationBackup(dbPath, currentVersion, targetVersion, pendingMigrations)
  }

  for (const migration of migrations) {
    if (migration.version <= currentVersion) {
      continue
    }

    const migrate = db.transaction(() => {
      migration.up(db)
      db.pragma(`user_version = ${migration.version}`)
    })

    migrate()
  }
}

function createPragmaHelper(db: Pick<SqliteDatabase, 'exec' | 'prepare'>): SqliteDatabase['pragma'] {
  return (query, options) => {
    const trimmed = query.trim()
    if (trimmed.includes('=')) {
      db.exec(`PRAGMA ${trimmed}`)
      return undefined
    }

    const row = db.prepare(`PRAGMA ${trimmed}`).get()
    if (!options?.simple) {
      return row
    }

    return row ? Object.values(row)[0] : undefined
  }
}

function wrapBetterSqliteDatabase(db: import('better-sqlite3').Database): SqliteDatabase {
  return {
    exec(sql) {
      db.exec(sql)
    },
    prepare(sql) {
      const statement = db.prepare(sql)
      return {
        run(params) {
          return params === undefined ? statement.run() : statement.run(params as never)
        },
        all(params) {
          return params === undefined ? statement.all() : statement.all(params as never)
        },
        get(params) {
          return (params === undefined ? statement.get() : statement.get(params as never)) as Record<string, unknown> | undefined
        },
      }
    },
    transaction(fn) {
      return db.transaction(fn)
    },
    pragma: createPragmaHelper({
      exec(sql) {
        db.exec(sql)
      },
      prepare(sql) {
        const statement = db.prepare(sql)
        return {
          run(params) {
            return params === undefined ? statement.run() : statement.run(params as never)
          },
          all(params) {
            return params === undefined ? statement.all() : statement.all(params as never)
          },
          get(params) {
            return (params === undefined ? statement.get() : statement.get(params as never)) as Record<string, unknown> | undefined
          },
        }
      },
    }),
    close() {
      db.close()
    },
  }
}

function wrapNodeSqliteDatabase(db: import('node:sqlite').DatabaseSync): SqliteDatabase {
  return {
    exec(sql) {
      db.exec(sql)
    },
    prepare(sql) {
      const statement = db.prepare(sql)
      statement.setAllowBareNamedParameters(true)
      return {
        run(params) {
          return params === undefined ? statement.run() : statement.run(params as never)
        },
        all(params) {
          return params === undefined ? statement.all() : statement.all(params as never)
        },
        get(params) {
          return (params === undefined ? statement.get() : statement.get(params as never)) as Record<string, unknown> | undefined
        },
      }
    },
    transaction(fn) {
      return (...args) => {
        db.exec('BEGIN IMMEDIATE')
        try {
          const result = fn(...args)
          db.exec('COMMIT')
          return result
        } catch (error) {
          db.exec('ROLLBACK')
          throw error
        }
      }
    },
    pragma: createPragmaHelper({
      exec(sql) {
        db.exec(sql)
      },
      prepare(sql) {
        const statement = db.prepare(sql)
        statement.setAllowBareNamedParameters(true)
        return {
          run(params) {
            return params === undefined ? statement.run() : statement.run(params as never)
          },
          all(params) {
            return params === undefined ? statement.all() : statement.all(params as never)
          },
          get(params) {
            return (params === undefined ? statement.get() : statement.get(params as never)) as Record<string, unknown> | undefined
          },
        }
      },
    }),
    close() {
      db.close()
    },
  }
}

function loadDatabase(dbPath: string): SqliteDatabase {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3') as typeof import('better-sqlite3')
    return wrapBetterSqliteDatabase(new Database(dbPath))
  } catch (error) {
    if (!isRecoverableSqliteError(error) && !(error instanceof Error && /NODE_MODULE_VERSION|better_sqlite3\.node/i.test(error.message))) {
      throw error
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite')
    return wrapNodeSqliteDatabase(new DatabaseSync(dbPath))
  }
}

function createDb(dbPath: string): SqliteDatabase {
  mkdirSync(dirname(dbPath), { recursive: true })
  const db = loadDatabase(dbPath)
  try {
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    applyMigrations(db, dbPath)
    db.prepare('PRAGMA integrity_check').get()
    cachedDb = db
    cachedDbPath = dbPath
    return db
  } catch (error) {
    try {
      db.close()
    } catch {
      // Ignore cleanup failures while handling initialization errors.
    }
    throw error
  }
}

function getDb(dbPath: string): SqliteDatabase {
  if (cachedDb && cachedDbPath === dbPath) {
    return cachedDb
  }

  closeCachedDb()

  try {
    return createDb(dbPath)
  } catch (error) {
    if (!isRecoverableSqliteError(error)) {
      throw error
    }

    archiveCorruptDatabase(dbPath)
    return createDb(dbPath)
  }
}

function withDbRecovery<T>(dbPath: string, action: (db: SqliteDatabase) => T): T {
  try {
    return action(getDb(dbPath))
  } catch (error) {
    if (!isRecoverableSqliteError(error)) {
      throw error
    }

    closeCachedDb()
    archiveCorruptDatabase(dbPath)
    return action(getDb(dbPath))
  }
}

export function persistShellSnapshotToDatabase(dbPath: string, snapshot: ShellSnapshot): void {
  withDbRecovery(dbPath, (db) => {
    const persist = db.transaction((nextSnapshot: ShellSnapshot) => {
      db.prepare(`
        INSERT INTO app_meta (key, value)
        VALUES ('activeSessionId', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(nextSnapshot.activeSessionId)

      db.exec(`
        DELETE FROM sessions;
        DELETE FROM messages;
        DELETE FROM run_steps;
        DELETE FROM attachments;
        DELETE FROM artifacts;
        DELETE FROM approvals;
        DELETE FROM logs;
        DELETE FROM session_references;
        DELETE FROM previews;
        DELETE FROM templates;
      `)

      const insertSession = db.prepare(`
        INSERT INTO sessions (
          id, title, status, model, updated_at, archived_at, branched_from_session_id,
          branched_from_message_id, pinned, message_count, artifact_count, preview
        ) VALUES (
          @id, @title, @status, @model, @updatedAt, @archivedAt, @branchedFromSessionId,
          @branchedFromMessageId, @pinned, @messageCount, @artifactCount, @preview
        )
      `)
      const insertMessage = db.prepare(`
        INSERT INTO messages (id, session_id, role, content, ts)
        VALUES (@id, @sessionId, @role, @content, @ts)
      `)
      const insertRunStep = db.prepare(`
        INSERT INTO run_steps (id, session_id, label, status, detail, duration_ms)
        VALUES (@id, @sessionId, @label, @status, @detail, @durationMs)
      `)
      const insertAttachment = db.prepare(`
        INSERT INTO attachments (
          id, session_id, kind, source, status, name, mime_type, size_bytes,
          size_label, created_at, message_id, path, data_url, text_content
        ) VALUES (
          @id, @sessionId, @kind, @source, @status, @name, @mimeType, @sizeBytes,
          @sizeLabel, @createdAt, @messageId, @path, @dataUrl, @textContent
        )
      `)
      const insertArtifact = db.prepare(`
        INSERT INTO artifacts (id, title, kind, session_id, created_at, size, version, content)
        VALUES (@id, @title, @kind, @sessionId, @createdAt, @size, @version, @content)
      `)
      const insertApproval = db.prepare(`
        INSERT INTO approvals (
          id, session_id, action, detail, capability, risk, status, retryable, fallback, step_id
        ) VALUES (
          @id, @sessionId, @action, @detail, @capability, @risk, @status, @retryable, @fallback, @stepId
        )
      `)
      const insertLog = db.prepare(`
        INSERT INTO logs (
          id, session_id, ts, level, message, kind, status, capability, step_id, approval_id, tool_name,
          attachment_name, attachment_delivery_mode, model_id
        ) VALUES (
          @id, @sessionId, @ts, @level, @message, @kind, @status, @capability, @stepId, @approvalId, @toolName,
          @attachmentName, @attachmentDeliveryMode, @modelId
        )
      `)
      const insertReference = db.prepare(`
        INSERT INTO session_references (id, session_id, type, title, detail)
        VALUES (@id, @sessionId, @type, @title, @detail)
      `)
      const insertPreview = db.prepare(`
        INSERT INTO previews (session_id, title, status, version)
        VALUES (@sessionId, @title, @status, @version)
      `)
      const insertTemplate = db.prepare(`
        INSERT INTO templates (id, emoji, title, description, category)
        VALUES (@id, @emoji, @title, @description, @category)
      `)

      for (const session of nextSnapshot.sessions) {
        insertSession.run({
          id: session.id,
          title: session.title,
          status: session.status,
          model: session.model,
          updatedAt: session.updatedAt,
          archivedAt: session.archivedAt ?? null,
          branchedFromSessionId: session.branchedFromSessionId ?? null,
          branchedFromMessageId: session.branchedFromMessageId ?? null,
          pinned: session.pinned ? 1 : 0,
          messageCount: session.messageCount,
          artifactCount: session.artifactCount,
          preview: session.preview ?? null,
        })
      }

      for (const message of nextSnapshot.messages) {
        insertMessage.run(message)
      }

      for (const runStep of nextSnapshot.runSteps) {
        insertRunStep.run({
          id: runStep.id,
          sessionId: runStep.sessionId,
          label: runStep.label,
          status: runStep.status,
          detail: runStep.detail ?? null,
          durationMs: runStep.durationMs ?? null,
        })
      }

      for (const attachment of nextSnapshot.attachments) {
        insertAttachment.run({
          id: attachment.id,
          sessionId: attachment.sessionId,
          kind: attachment.kind,
          source: attachment.source,
          status: attachment.status,
          name: attachment.name,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          sizeLabel: attachment.sizeLabel,
          createdAt: attachment.createdAt,
          messageId: attachment.messageId ?? null,
          path: attachment.path ?? null,
          dataUrl: attachment.dataUrl ?? null,
          textContent: attachment.textContent ?? null,
        })
      }

      for (const artifact of nextSnapshot.artifacts) {
        insertArtifact.run({
          ...artifact,
          content: artifact.content ?? null,
        })
      }

      for (const approval of nextSnapshot.approvals) {
        insertApproval.run({
          ...approval,
          retryable: approval.retryable ? 1 : 0,
          fallback: approval.fallback ?? null,
          stepId: approval.stepId ?? null,
        })
      }

      for (const log of nextSnapshot.logs) {
        insertLog.run({
          ...log,
          kind: log.kind ?? null,
          status: log.status ?? null,
          capability: log.capability ?? null,
          stepId: log.stepId ?? null,
          approvalId: log.approvalId ?? null,
          toolName: log.toolName ?? null,
          attachmentName: log.attachmentName ?? null,
          attachmentDeliveryMode: log.attachmentDeliveryMode ?? null,
          modelId: log.modelId ?? null,
        })
      }

      for (const reference of nextSnapshot.references) {
        insertReference.run(reference)
      }

      for (const preview of nextSnapshot.previews) {
        insertPreview.run(preview)
      }

      for (const template of nextSnapshot.templates) {
        insertTemplate.run(template)
      }
    })

    persist(snapshot)
  })
}

export function readShellSnapshotFromDatabase(dbPath: string): ShellSnapshot | null {
  return withDbRecovery(dbPath, (db) => {
    const sessionRows = db.prepare(`
      SELECT
        id,
        title,
        status,
        model,
        updated_at,
        archived_at,
        branched_from_session_id,
        branched_from_message_id,
        pinned,
        message_count,
        artifact_count,
        preview
      FROM sessions
      ORDER BY rowid
    `).all() as SessionRow[]

    if (sessionRows.length === 0) {
      return null
    }

    const activeSessionRow = db.prepare(`
      SELECT value FROM app_meta WHERE key = 'activeSessionId'
    `).get()
    const activeSessionId = (activeSessionRow?.value as string | null | undefined) ?? null

    const messages = db.prepare(`
      SELECT id, session_id, role, content, ts
      FROM messages
      ORDER BY rowid
    `).all() as MessageRow[]
    const runSteps = db.prepare(`
      SELECT id, session_id, label, status, detail, duration_ms
      FROM run_steps
      ORDER BY rowid
    `).all() as RunStepRow[]
    const attachments = db.prepare(`
      SELECT
        id,
        session_id,
        kind,
        source,
        status,
        name,
        mime_type,
        size_bytes,
        size_label,
        created_at,
        message_id,
        path,
        data_url,
        text_content
      FROM attachments
      ORDER BY rowid
    `).all() as AttachmentRow[]
    const artifacts = db.prepare(`
      SELECT id, title, kind, session_id, created_at, size, version, content
      FROM artifacts
      ORDER BY rowid
    `).all() as ArtifactRow[]
    const approvals = db.prepare(`
      SELECT id, session_id, action, detail, capability, risk, status, retryable, fallback, step_id
      FROM approvals
      ORDER BY rowid
    `).all() as ApprovalRow[]
    const logs = db.prepare(`
      SELECT
        id,
        session_id,
        ts,
        level,
        message,
        kind,
        status,
        capability,
        step_id,
        approval_id,
        tool_name,
        attachment_name,
        attachment_delivery_mode,
        model_id
      FROM logs
      ORDER BY rowid
    `).all() as LogRow[]
    const references = db.prepare(`
      SELECT id, session_id, type, title, detail
      FROM session_references
      ORDER BY rowid
    `).all() as ReferenceRow[]
    const previews = db.prepare(`
      SELECT session_id, title, status, version
      FROM previews
      ORDER BY rowid
    `).all() as PreviewRow[]
    const templates = db.prepare(`
      SELECT id, emoji, title, description, category
      FROM templates
      ORDER BY rowid
    `).all() as TemplateRow[]

    return {
      activeSessionId,
      sessions: sessionRows.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        model: row.model,
        updatedAt: row.updated_at,
        archivedAt: row.archived_at,
        branchedFromSessionId: row.branched_from_session_id,
        branchedFromMessageId: row.branched_from_message_id,
        pinned: Boolean(row.pinned),
        messageCount: row.message_count,
        artifactCount: row.artifact_count,
        preview: row.preview ?? undefined,
      })),
      messages: messages.map((row) => ({
        id: row.id,
        sessionId: row.session_id,
        role: row.role,
        content: row.content,
        ts: row.ts,
      })),
      runSteps: runSteps.map((row) => ({
        id: row.id,
        sessionId: row.session_id,
        label: row.label,
        status: row.status,
        detail: row.detail ?? undefined,
        durationMs: row.duration_ms ?? undefined,
      })),
      attachments: attachments.map((row) => ({
        id: row.id,
        sessionId: row.session_id,
        kind: row.kind,
        source: row.source,
        status: row.status,
        name: row.name,
        mimeType: row.mime_type,
        sizeBytes: row.size_bytes,
        sizeLabel: row.size_label,
        createdAt: row.created_at,
        messageId: row.message_id ?? undefined,
        path: row.path ?? undefined,
        dataUrl: row.data_url ?? undefined,
        textContent: row.text_content ?? undefined,
      })),
      artifacts: artifacts.map((row) => ({
        id: row.id,
        title: row.title,
        kind: row.kind,
        sessionId: row.session_id,
        createdAt: row.created_at,
        size: row.size,
        version: row.version,
        content: row.content ?? undefined,
      })),
      approvals: approvals.map((row) => ({
        id: row.id,
        sessionId: row.session_id,
        action: row.action,
        detail: row.detail,
        capability: row.capability,
        risk: row.risk,
        status: row.status,
        retryable: Boolean(row.retryable),
        fallback: row.fallback ?? undefined,
        stepId: row.step_id ?? undefined,
      })),
      logs: logs.map((row) => ({
        id: row.id,
        sessionId: row.session_id,
        ts: row.ts,
        level: row.level,
        message: row.message,
        kind: row.kind ?? undefined,
        status: row.status ?? undefined,
        capability: row.capability ?? undefined,
        stepId: row.step_id ?? undefined,
        approvalId: row.approval_id ?? undefined,
        toolName: row.tool_name ?? undefined,
        attachmentName: row.attachment_name ?? undefined,
        attachmentDeliveryMode: row.attachment_delivery_mode ?? undefined,
        modelId: row.model_id ?? undefined,
      })),
      references: references.map((row) => ({
        id: row.id,
        sessionId: row.session_id,
        type: row.type,
        title: row.title,
        detail: row.detail,
      })),
      previews: previews.map((row) => ({
        sessionId: row.session_id,
        title: row.title,
        status: row.status,
        version: row.version,
      })),
      templates: templates.map((row) => ({
        id: row.id,
        emoji: row.emoji,
        title: row.title,
        description: row.description,
        category: row.category,
      })),
    }
  })
}

export function getShellStorageUserVersion(dbPath: string): number {
  return withDbRecovery(dbPath, (db) => db.pragma('user_version', { simple: true }) as number)
}

export function closeShellSnapshotDatabase(): void {
  closeCachedDb()
}

export function setShellStorageMigrationsForTests(migrations: readonly ShellStorageMigration[] | null): void {
  migrationsOverride = migrations
  closeCachedDb()
}

export function resetShellSnapshotDatabaseForTests(): void {
  migrationsOverride = null
  closeCachedDb()
}
