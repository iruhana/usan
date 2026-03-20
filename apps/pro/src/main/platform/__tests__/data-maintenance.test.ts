import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, afterEach } from 'vitest'
import { clearLocalCaches, resetWorkspaceData } from '../data-maintenance'
import {
  appendShellArtifact,
  appendShellMessage,
  createShellSession,
  getShellSnapshot,
  initializeShellState,
  resetShellStateForTests,
} from '../shell-state'
import { updateSettings } from '../settings'

interface TestPaths {
  dataDir: string
  settingsFile: string
  shellStateFile: string
  secretsFile: string
  skillsDb: string
  skillsRoot: string
}

const tempDirs: string[] = []

function createPaths(): TestPaths {
  const dataDir = mkdtempSync(join(tmpdir(), 'usan-data-maintenance-'))
  tempDirs.push(dataDir)

  return {
    dataDir,
    settingsFile: join(dataDir, 'settings.json'),
    shellStateFile: join(dataDir, 'shell-state.json'),
    secretsFile: join(dataDir, 'provider-secrets.json'),
    skillsDb: join(dataDir, 'skills.db'),
    skillsRoot: join(dataDir, 'skills-root'),
  }
}

afterEach(() => {
  resetShellStateForTests()

  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true })
  }
})

describe('data maintenance', () => {
  it('backs up persisted files before resetting the local workspace', () => {
    const paths = createPaths()

    initializeShellState(paths.shellStateFile)
    updateSettings(paths.settingsFile, { defaultModel: 'gpt-5.4' })
    writeFileSync(paths.secretsFile, JSON.stringify({ version: 1, secrets: {} }, null, 2), 'utf8')
    writeFileSync(paths.skillsDb, 'skills-cache', 'utf8')

    createShellSession({ title: 'Docs automation' })
    const activeSessionId = getShellSnapshot().activeSessionId!

    appendShellMessage(activeSessionId, {
      id: 'msg-reset-001',
      sessionId: activeSessionId,
      role: 'user',
      content: 'Export the project notes into one package.',
      ts: Date.now(),
    })
    appendShellArtifact({
      id: 'artifact-reset-001',
      title: 'notes.md',
      kind: 'markdown',
      sessionId: activeSessionId,
      createdAt: '방금',
      size: '1 KB',
      version: 1,
      content: '# Notes',
    })

    const result = resetWorkspaceData(paths)

    expect(result.clearedSessionCount).toBeGreaterThan(1)
    expect(result.clearedMessageCount).toBeGreaterThan(0)
    expect(result.clearedArtifactCount).toBeGreaterThan(0)
    expect(result.snapshot.sessions).toHaveLength(1)
    expect(result.snapshot.sessions[0]?.title).toBe('새 세션')
    expect(result.snapshot.sessions[0]?.model).toBe('gpt-5.4')
    expect(result.snapshot.messages).toHaveLength(0)
    expect(result.snapshot.artifacts).toHaveLength(0)
    expect(result.snapshot.templates.length).toBeGreaterThan(0)

    const backupFiles = readdirSync(result.backupDir)
    expect(backupFiles).toContain('backup-manifest.json')
    expect(backupFiles).toContain('settings.json')
    expect(backupFiles).toContain('provider-secrets.json')
    expect(backupFiles).toContain('shell-state.sqlite')
  })

  it('clears cache files and restores the shell mirror without dropping workspace data', async () => {
    const paths = createPaths()

    initializeShellState(paths.shellStateFile)
    writeFileSync(paths.skillsDb, 'skills-cache', 'utf8')
    writeFileSync(`${paths.shellStateFile}.corrupt-123`, 'stale-cache', 'utf8')
    const snapshotBefore = getShellSnapshot()
    let browserCacheCalls = 0

    const result = await clearLocalCaches({
      ...paths,
      clearBrowserCaches: async () => {
        browserCacheCalls += 1
      },
    })

    expect(browserCacheCalls).toBe(1)
    expect(result.reindexedSkillCount).toBe(0)
    expect(result.browserCacheCleared).toBe(true)
    expect(result.clearedPaths).toEqual(expect.arrayContaining([
      paths.skillsDb,
      `${paths.shellStateFile}.corrupt-123`,
    ]))
    expect(result.backupDir).not.toBeNull()
    expect(existsSync(paths.skillsDb)).toBe(false)
    expect(existsSync(paths.shellStateFile)).toBe(true)
    expect(getShellSnapshot()).toEqual(snapshotBefore)
  })
})
