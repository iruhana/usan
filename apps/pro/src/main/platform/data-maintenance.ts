import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { DEFAULT_APP_SETTINGS, type CacheClearResult, type ShellSnapshot, type WorkspaceResetResult } from '@shared/types'
import { closeSkillIndexCache, indexSkills } from '../skills/indexer'
import { createShellSnapshot } from './shell-snapshot'
import { getSettings } from './settings'
import { getShellSnapshot, replaceShellSnapshot } from './shell-state'
import { closeShellSnapshotDatabase, getShellSnapshotDatabasePath } from './storage/shell-db'

interface LocalDataPaths {
  dataDir: string
  settingsFile: string
  shellStateFile: string
  secretsFile: string
  skillsDb: string
  skillsRoot: string
}

interface CacheMaintenanceOptions extends LocalDataPaths {
  clearBrowserCaches?: () => Promise<void>
}

function createBackupDir(dataDir: string, label: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = join(dataDir, 'backups', `${stamp}-${label}`)
  mkdirSync(backupDir, { recursive: true })
  return backupDir
}

function copyFilesToBackup(backupDir: string, files: string[]): string[] {
  const copiedFiles: string[] = []

  for (const filePath of files) {
    if (!existsSync(filePath)) {
      continue
    }

    const targetPath = join(backupDir, basename(filePath))
    copyFileSync(filePath, targetPath)
    copiedFiles.push(targetPath)
  }

  return copiedFiles
}

function writeBackupManifest(
  backupDir: string,
  action: 'workspace-reset' | 'cache-clear',
  sourceFiles: string[],
): void {
  writeFileSync(join(backupDir, 'backup-manifest.json'), JSON.stringify({
    action,
    createdAt: new Date().toISOString(),
    files: sourceFiles,
  }, null, 2), 'utf8')
}

function getWorkspaceBackupFiles(paths: LocalDataPaths): string[] {
  const shellDb = getShellSnapshotDatabasePath(paths.shellStateFile)

  return [
    paths.settingsFile,
    paths.secretsFile,
    paths.shellStateFile,
    shellDb,
    `${shellDb}-wal`,
    `${shellDb}-shm`,
    paths.skillsDb,
    `${paths.skillsDb}-wal`,
    `${paths.skillsDb}-shm`,
  ]
}

function listCacheFiles(paths: LocalDataPaths): string[] {
  const shellDb = getShellSnapshotDatabasePath(paths.shellStateFile)
  const cacheFiles = new Set<string>([
    paths.shellStateFile,
    `${paths.shellStateFile}.tmp`,
    `${shellDb}-wal`,
    `${shellDb}-shm`,
    paths.skillsDb,
    `${paths.skillsDb}-wal`,
    `${paths.skillsDb}-shm`,
  ])

  if (existsSync(paths.dataDir)) {
    for (const entry of readdirSync(paths.dataDir, { withFileTypes: true })) {
      if (!entry.isFile()) {
        continue
      }

      const fullPath = join(paths.dataDir, entry.name)
      if (entry.name.includes('.corrupt-') || entry.name.endsWith('.tmp')) {
        cacheFiles.add(fullPath)
      }
    }
  }

  return [...cacheFiles]
}

function createEmptyWorkspaceSnapshot(currentSnapshot: ShellSnapshot, defaultModel: string): ShellSnapshot {
  const fallbackTemplates = createShellSnapshot().templates
  const templates = currentSnapshot.templates.length > 0 ? currentSnapshot.templates : fallbackTemplates

  return {
    activeSessionId: 'sess-001',
    sessions: [
      {
        id: 'sess-001',
        title: '새 세션',
        status: 'active',
        model: defaultModel,
        updatedAt: '방금',
        archivedAt: null,
        pinned: false,
        messageCount: 0,
        artifactCount: 0,
      },
    ],
    runSteps: [],
    attachments: [],
    artifacts: [],
    approvals: [],
    logs: [],
    templates,
    messages: [],
    references: [],
    previews: [],
  }
}

export function resetWorkspaceData(paths: LocalDataPaths): WorkspaceResetResult {
  closeShellSnapshotDatabase()
  closeSkillIndexCache()

  const backupFiles = getWorkspaceBackupFiles(paths)
  const backupDir = createBackupDir(paths.dataDir, 'workspace-reset')
  const copiedFiles = copyFilesToBackup(backupDir, backupFiles)
  writeBackupManifest(backupDir, 'workspace-reset', copiedFiles)

  const currentSnapshot = getShellSnapshot()
  const settings = getSettings(paths.settingsFile)
  const nextSnapshot = replaceShellSnapshot(
    createEmptyWorkspaceSnapshot(currentSnapshot, settings.defaultModel || DEFAULT_APP_SETTINGS.defaultModel),
  )

  return {
    backupDir,
    clearedSessionCount: currentSnapshot.sessions.length,
    clearedMessageCount: currentSnapshot.messages.length,
    clearedArtifactCount: currentSnapshot.artifacts.length,
    snapshot: nextSnapshot,
  }
}

export async function clearLocalCaches(options: CacheMaintenanceOptions): Promise<CacheClearResult> {
  const currentSnapshot = getShellSnapshot()
  const cacheFiles = listCacheFiles(options).filter((filePath) => existsSync(filePath))

  closeShellSnapshotDatabase()
  closeSkillIndexCache()

  const backupDir = cacheFiles.length > 0
    ? createBackupDir(options.dataDir, 'cache-clear')
    : null

  if (backupDir) {
    const copiedFiles = copyFilesToBackup(backupDir, cacheFiles)
    writeBackupManifest(backupDir, 'cache-clear', copiedFiles)
  }

  for (const filePath of cacheFiles) {
    rmSync(filePath, { force: true })
  }

  let browserCacheCleared = false
  if (options.clearBrowserCaches) {
    await options.clearBrowserCaches()
    browserCacheCleared = true
  }

  const reindexedSkillCount = indexSkills(options.skillsRoot, options.skillsDb)
  replaceShellSnapshot(currentSnapshot)

  return {
    backupDir,
    clearedPaths: cacheFiles,
    reindexedSkillCount,
    browserCacheCleared,
  }
}
