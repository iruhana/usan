// @vitest-environment node

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { initializeShellState, resetShellStateForTests } from '../../shell-state'
import {
  getShellSnapshotDatabasePath,
  getShellStorageUserVersion,
  readShellSnapshotFromDatabase,
  setShellStorageMigrationsForTests,
  type ShellStorageMigration,
} from '../shell-db'

const tempDirs: string[] = []

function createTempShellStateFile(): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'usan-shell-db-'))
  tempDirs.push(tempDir)
  return join(tempDir, 'shell-state.json')
}

afterEach(() => {
  setShellStorageMigrationsForTests(null)
  resetShellStateForTests()

  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true })
  }
})

describe('shell-db migrations', () => {
  it('creates a backup before applying a destructive pending migration', () => {
    const filePath = createTempShellStateFile()
    initializeShellState(filePath)

    const dbPath = getShellSnapshotDatabasePath(filePath)
    const baseVersion = getShellStorageUserVersion(dbPath)
    const db = new DatabaseSync(dbPath)
    db.exec(`
      CREATE TABLE IF NOT EXISTS legacy_probe (id TEXT PRIMARY KEY);
      INSERT INTO legacy_probe (id) VALUES ('probe-1');
    `)
    db.close()

    resetShellStateForTests()

    const migrations: ShellStorageMigration[] = [
      {
        version: baseVersion + 1,
        destructive: true,
        up: (database) => {
          database.exec(`
            DROP TABLE IF EXISTS legacy_probe;
            CREATE TABLE IF NOT EXISTS migrated_probe (id TEXT PRIMARY KEY);
          `)
        },
      },
    ]
    setShellStorageMigrationsForTests(migrations)

    const restored = readShellSnapshotFromDatabase(dbPath)
    const backupRoot = join(dbPath, '..', 'migration-backups')
    const backupDirs = readdirSync(backupRoot)
    const backupDir = join(backupRoot, backupDirs[0]!)
    const manifest = JSON.parse(readFileSync(join(backupDir, 'manifest.json'), 'utf8')) as {
      currentVersion: number
      targetVersion: number
      migrations: Array<{ version: number; destructive: boolean }>
    }
    const migratedDb = new DatabaseSync(dbPath)
    const legacyTable = migratedDb.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name = 'legacy_probe'
    `).get()
    const newTable = migratedDb.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name = 'migrated_probe'
    `).get()
    migratedDb.close()

    expect(restored?.sessions.length).toBeGreaterThan(0)
    expect(getShellStorageUserVersion(dbPath)).toBe(baseVersion + 1)
    expect(backupDirs).toHaveLength(1)
    expect(existsSync(join(backupDir, 'shell-state.sqlite'))).toBe(true)
    expect(manifest.currentVersion).toBe(baseVersion)
    expect(manifest.targetVersion).toBe(baseVersion + 1)
    expect(manifest.migrations).toEqual([{ version: baseVersion + 1, destructive: true }])
    expect(legacyTable).toBeUndefined()
    expect(newTable).toBeDefined()
  })

  it('skips migration backup when pending migrations are not destructive', () => {
    const filePath = createTempShellStateFile()
    initializeShellState(filePath)

    const dbPath = getShellSnapshotDatabasePath(filePath)
    const baseVersion = getShellStorageUserVersion(dbPath)
    resetShellStateForTests()

    const migrations: ShellStorageMigration[] = [
      {
        version: baseVersion + 1,
        up: (database) => {
          database.exec(`
            CREATE TABLE IF NOT EXISTS additive_probe (id TEXT PRIMARY KEY);
          `)
        },
      },
    ]
    setShellStorageMigrationsForTests(migrations)

    const restored = readShellSnapshotFromDatabase(dbPath)
    const backupRoot = join(dbPath, '..', 'migration-backups')

    expect(restored?.sessions.length).toBeGreaterThan(0)
    expect(getShellStorageUserVersion(dbPath)).toBe(baseVersion + 1)
    expect(existsSync(backupRoot)).toBe(false)
  })
})
