// @vitest-environment node

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  archiveShellSession,
  appendShellArtifact,
  appendShellMessage,
  branchShellSession,
  createShellSession,
  getShellSnapshot,
  initializeShellState,
  promoteShellSession,
  resetShellStateForTests,
  restoreShellSession,
  setActiveShellSession,
} from '../shell-state'

const tempDirs: string[] = []

function createTempShellStateFile(): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'usan-shell-state-'))
  tempDirs.push(tempDir)
  return join(tempDir, 'shell-state.json')
}

afterEach(() => {
  resetShellStateForTests()
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true })
  }
})

describe('shell-state persistence', () => {
  it('persists shell mutations and restores them after reinitialization', () => {
    const filePath = createTempShellStateFile()

    const initialSnapshot = initializeShellState(filePath)
    expect(existsSync(filePath)).toBe(true)
    expect(initialSnapshot.sessions.length).toBeGreaterThan(0)

    appendShellMessage('sess-001', {
      id: 'msg-persisted',
      sessionId: 'sess-001',
      role: 'user',
      content: 'Persist this message',
      ts: 1234567890,
    })

    const persisted = JSON.parse(readFileSync(filePath, 'utf8')) as ReturnType<typeof getShellSnapshot>
    expect(persisted.messages.some((message) => message.id === 'msg-persisted')).toBe(true)

    resetShellStateForTests()
    const restored = initializeShellState(filePath)
    expect(restored.messages.some((message) => message.id === 'msg-persisted')).toBe(true)
  })

  it('archives corrupt persisted state and falls back to a fresh snapshot', () => {
    const filePath = createTempShellStateFile()
    writeFileSync(filePath, '{not valid json', 'utf8')

    const restored = initializeShellState(filePath)
    const files = readdirSync(join(filePath, '..'))

    expect(existsSync(filePath)).toBe(true)
    expect(files.some((name) => name.startsWith('shell-state.json.corrupt-'))).toBe(true)
    expect(restored.sessions.length).toBeGreaterThan(0)
  })

  it('creates a new session and persists active session selection', () => {
    const filePath = createTempShellStateFile()
    initializeShellState(filePath)

    const created = createShellSession({ model: 'claude-sonnet-4-6' })
    const createdSessionId = created.activeSessionId

    expect(createdSessionId).not.toBeNull()
    expect(created.sessions[0]?.id).toBe(createdSessionId)
    expect(created.sessions[0]?.title).toBe('새 세션')
    expect(created.sessions[0]?.status).toBe('active')
    expect(created.sessions.find((session) => session.id === 'sess-001')?.status).toBe('idle')

    const selected = setActiveShellSession('sess-003')
    expect(selected.activeSessionId).toBe('sess-003')
    expect(selected.sessions.find((session) => session.id === createdSessionId)?.status).toBe('idle')

    resetShellStateForTests()
    const restored = initializeShellState(filePath)
    expect(restored.activeSessionId).toBe('sess-003')
  })

  it('derives a new session title from the first user message', () => {
    const filePath = createTempShellStateFile()
    initializeShellState(filePath)

    const created = createShellSession()
    const createdSessionId = created.activeSessionId
    expect(createdSessionId).not.toBeNull()

    appendShellMessage(createdSessionId!, {
      id: 'msg-title',
      sessionId: createdSessionId!,
      role: 'user',
      content: '새로운 결제 대시보드 정보를 한눈에 보는 관리자 화면을 설계해줘',
      ts: 1234567890,
    })

    const session = getShellSnapshot().sessions.find((item) => item.id === createdSessionId)
    expect(session?.title).toBe('새로운 결제 대시보드 정보를 한눈에 보는 관리자 화면을 설계해줘')
  })

  it('archives the active session and restores it back into history', () => {
    const filePath = createTempShellStateFile()
    initializeShellState(filePath)

    const archived = archiveShellSession('sess-001')
    expect(archived.sessions.find((session) => session.id === 'sess-001')?.archivedAt).toBe('방금')
    expect(archived.activeSessionId).toBe('sess-002')

    const restored = restoreShellSession('sess-001')
    expect(restored.sessions.find((session) => session.id === 'sess-001')?.archivedAt).toBeNull()
    expect(restored.activeSessionId).toBe('sess-002')
  })

  it('branches a session into a new active session with replay context', () => {
    const filePath = createTempShellStateFile()
    initializeShellState(filePath)

    const sourceSnapshot = getShellSnapshot()
    const sourceMessages = sourceSnapshot.messages.filter((message) => message.sessionId === 'sess-001')
    const sourceArtifacts = sourceSnapshot.artifacts.filter((artifact) => artifact.sessionId === 'sess-001')

    const branched = branchShellSession('sess-001')
    const branchedSessionId = branched.activeSessionId

    expect(branchedSessionId).not.toBeNull()
    expect(branchedSessionId).not.toBe('sess-001')
    expect(branched.sessions[0]?.id).toBe(branchedSessionId)
    expect(branched.sessions[0]?.branchedFromSessionId).toBe('sess-001')
    expect(branched.sessions[0]?.title).toBe('카페 랜딩 페이지 빌드 분기본')
    expect(branched.runSteps.filter((step) => step.sessionId === branchedSessionId)).toHaveLength(0)
    expect(branched.logs.filter((log) => log.sessionId === branchedSessionId)).toHaveLength(0)
    expect(branched.messages.filter((message) => message.sessionId === branchedSessionId)).toHaveLength(sourceMessages.length)
    expect(branched.artifacts.filter((artifact) => artifact.sessionId === branchedSessionId)).toHaveLength(sourceArtifacts.length)
  })

  it('branches from a prior message and truncates replay context to that point', () => {
    const filePath = createTempShellStateFile()
    initializeShellState(filePath)

    const branched = branchShellSession('sess-001', { sourceMessageId: 'msg-003' })
    const branchedSessionId = branched.activeSessionId
    const branchedSession = branched.sessions.find((session) => session.id === branchedSessionId)
    const branchedMessages = branched.messages.filter((message) => message.sessionId === branchedSessionId)

    expect(branchedSessionId).not.toBeNull()
    expect(branchedSession?.branchedFromSessionId).toBe('sess-001')
    expect(branchedSession?.branchedFromMessageId).toBe('msg-003')
    expect(branchedSession?.messageCount).toBe(3)
    expect(branchedSession?.artifactCount).toBe(0)
    expect(branchedMessages).toHaveLength(3)
    expect(branchedMessages[2]?.content).toContain('좋아, 진행해줘')
    expect(branchedMessages.some((message) => message.content.includes('프리뷰가 준비되면'))).toBe(false)
    expect(branched.references.filter((reference) => reference.sessionId === branchedSessionId).length).toBeGreaterThan(0)
    expect(branched.previews.filter((preview) => preview.sessionId === branchedSessionId)).toHaveLength(0)
  })

  it('promotes a branch back into the source session while preserving shared prefix ids', () => {
    const filePath = createTempShellStateFile()
    initializeShellState(filePath)

    const sourceSnapshot = getShellSnapshot()
    const sourceMessages = sourceSnapshot.messages.filter((message) => message.sessionId === 'sess-001')
    const branched = branchShellSession('sess-001', {
      sourceMessageId: 'msg-003',
      model: 'gpt-5.4',
    })
    const branchedSessionId = branched.activeSessionId

    expect(branchedSessionId).not.toBeNull()

    appendShellMessage(branchedSessionId!, {
      id: 'msg-branch-promote',
      sessionId: branchedSessionId!,
      role: 'assistant',
      content: '분기된 결과를 메인으로 승격합니다.',
      ts: 1234567891,
    })
    appendShellArtifact({
      id: 'artifact-branch-promote',
      sessionId: branchedSessionId!,
      title: 'branch-output.md',
      kind: 'markdown',
      createdAt: '방금',
      size: '1 KB',
      version: 1,
      content: '분기된 결과를 메인으로 승격합니다.',
    })

    const promoted = promoteShellSession(branchedSessionId!)
    const promotedSourceMessages = promoted.messages.filter((message) => message.sessionId === 'sess-001')
    const promotedSourceArtifacts = promoted.artifacts.filter((artifact) => artifact.sessionId === 'sess-001')

    expect(promoted.activeSessionId).toBe('sess-001')
    expect(promoted.sessions.find((session) => session.id === 'sess-001')?.model).toBe('gpt-5.4')
    expect(promoted.sessions.find((session) => session.id === 'sess-001')?.messageCount).toBe(4)
    expect(promoted.sessions.find((session) => session.id === 'sess-001')?.artifactCount).toBe(1)
    expect(promoted.sessions.find((session) => session.id === branchedSessionId)?.status).toBe('idle')
    expect(promotedSourceMessages).toHaveLength(4)
    expect(promotedSourceMessages.slice(0, 3).map((message) => message.id)).toEqual(
      sourceMessages.slice(0, 3).map((message) => message.id),
    )
    expect(promotedSourceMessages[3]?.id).not.toBe(sourceMessages[3]?.id)
    expect(promotedSourceMessages[3]?.content).toBe('분기된 결과를 메인으로 승격합니다.')
    expect(promotedSourceArtifacts).toHaveLength(1)
    expect(promotedSourceArtifacts[0]?.title).toBe('branch-output.md')
    expect(promoted.logs.some((log) => (
      log.sessionId === 'sess-001' && log.message.includes('분기본 승격')
    ))).toBe(true)
  })
})
