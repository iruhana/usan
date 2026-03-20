// @vitest-environment node

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  archiveShellSession,
  appendShellApproval,
  appendShellAttachment,
  appendShellArtifact,
  appendShellLog,
  appendShellMessage,
  branchShellSession,
  commitShellAttachments,
  createShellSession,
  getShellSnapshot,
  initializeShellState,
  promoteShellSession,
  resetShellStateForTests,
  resolveShellApproval,
  restoreShellSession,
  setActiveShellSession,
} from '../shell-state'
import {
  getShellSnapshotDatabasePath,
  getShellStorageUserVersion,
  readShellSnapshotFromDatabase,
} from '../storage/shell-db'

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
    const dbPath = getShellSnapshotDatabasePath(filePath)

    const initialSnapshot = initializeShellState(filePath)
    expect(existsSync(filePath)).toBe(true)
    expect(existsSync(dbPath)).toBe(true)
    expect(getShellStorageUserVersion(dbPath)).toBe(4)
    expect(initialSnapshot.sessions.length).toBeGreaterThan(0)

    appendShellMessage('sess-001', {
      id: 'msg-persisted',
      sessionId: 'sess-001',
      role: 'user',
      content: 'Persist this message',
      ts: 1234567890,
    })
    appendShellAttachment({
      id: 'attachment-persisted',
      sessionId: 'sess-001',
      kind: 'image',
      source: 'clipboard',
      status: 'staged',
      name: 'clipboard.png',
      mimeType: 'image/png',
      sizeBytes: 128,
      sizeLabel: '128 B',
      createdAt: '방금',
      dataUrl: 'data:image/png;base64,AAAA',
      textContent: 'console.log("hello")',
    })
    commitShellAttachments('sess-001', ['attachment-persisted'], 'msg-persisted')
    appendShellLog({
      id: 'log-persisted',
      sessionId: 'sess-001',
      ts: '14:32:10',
      level: 'info',
      message: 'Attachment route: clipboard.png -> native_image',
      kind: 'attachment',
      status: 'success',
      attachmentName: 'clipboard.png',
      attachmentDeliveryMode: 'native_image',
      modelId: 'gpt-5.4',
    })

    const persisted = JSON.parse(readFileSync(filePath, 'utf8')) as ReturnType<typeof getShellSnapshot>
    expect(persisted.messages.some((message) => message.id === 'msg-persisted')).toBe(true)
    expect(persisted.attachments.some((attachment) => (
      attachment.id === 'attachment-persisted'
      && attachment.messageId === 'msg-persisted'
      && attachment.textContent === 'console.log("hello")'
    ))).toBe(true)
    expect(readShellSnapshotFromDatabase(dbPath)?.messages.some((message) => message.id === 'msg-persisted')).toBe(true)
    expect(readShellSnapshotFromDatabase(dbPath)?.attachments.some((attachment) => (
      attachment.id === 'attachment-persisted'
      && attachment.messageId === 'msg-persisted'
      && attachment.textContent === 'console.log("hello")'
    ))).toBe(true)
    expect(readShellSnapshotFromDatabase(dbPath)?.logs.some((log) => (
      log.id === 'log-persisted'
      && log.attachmentName === 'clipboard.png'
      && log.attachmentDeliveryMode === 'native_image'
      && log.modelId === 'gpt-5.4'
    ))).toBe(true)

    resetShellStateForTests()
    const restored = initializeShellState(filePath)
    expect(restored.messages.some((message) => message.id === 'msg-persisted')).toBe(true)
    expect(restored.attachments.some((attachment) => (
      attachment.id === 'attachment-persisted'
      && attachment.messageId === 'msg-persisted'
      && attachment.textContent === 'console.log("hello")'
    ))).toBe(true)
    expect(restored.logs.some((log) => (
      log.id === 'log-persisted'
      && log.attachmentName === 'clipboard.png'
      && log.attachmentDeliveryMode === 'native_image'
      && log.modelId === 'gpt-5.4'
    ))).toBe(true)
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

  it('archives a corrupt sqlite store and recreates it from a fresh snapshot', () => {
    const filePath = createTempShellStateFile()
    const dbPath = getShellSnapshotDatabasePath(filePath)
    writeFileSync(dbPath, 'not a sqlite database', 'utf8')

    const restored = initializeShellState(filePath)
    const files = readdirSync(join(dbPath, '..'))

    expect(existsSync(dbPath)).toBe(true)
    expect(files.some((name) => name.startsWith('shell-state.sqlite.corrupt-'))).toBe(true)
    expect(getShellStorageUserVersion(dbPath)).toBe(4)
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

    appendShellAttachment({
      id: 'attachment-source-sent',
      sessionId: 'sess-001',
      kind: 'file',
      source: 'picker',
      status: 'sent',
      name: 'brief.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 4096,
      sizeLabel: '4 KB',
      createdAt: '諛⑷툑',
      messageId: 'msg-003',
      textContent: 'Source branch brief',
    })
    appendShellAttachment({
      id: 'attachment-source-staged',
      sessionId: 'sess-001',
      kind: 'image',
      source: 'clipboard',
      status: 'staged',
      name: 'moodboard.png',
      mimeType: 'image/png',
      sizeBytes: 2048,
      sizeLabel: '2 KB',
      createdAt: '諛⑷툑',
      dataUrl: 'data:image/png;base64,AAAA',
    })

    const sourceSnapshot = getShellSnapshot()
    const sourceMessages = sourceSnapshot.messages.filter((message) => message.sessionId === 'sess-001')
    const sourceArtifacts = sourceSnapshot.artifacts.filter((artifact) => artifact.sessionId === 'sess-001')
    const sourceAttachments = sourceSnapshot.attachments.filter((attachment) => attachment.sessionId === 'sess-001')

    const branched = branchShellSession('sess-001')
    const branchedSessionId = branched.activeSessionId
    const branchedAttachments = branched.attachments.filter((attachment) => attachment.sessionId === branchedSessionId)

    expect(branchedSessionId).not.toBeNull()
    expect(branchedSessionId).not.toBe('sess-001')
    expect(branched.sessions[0]?.id).toBe(branchedSessionId)
    expect(branched.sessions[0]?.branchedFromSessionId).toBe('sess-001')
    expect(branched.sessions[0]?.title).toBe('카페 랜딩 페이지 빌드 분기본')
    expect(branched.runSteps.filter((step) => step.sessionId === branchedSessionId)).toHaveLength(0)
    expect(branched.logs.filter((log) => log.sessionId === branchedSessionId)).toHaveLength(0)
    expect(branched.messages.filter((message) => message.sessionId === branchedSessionId)).toHaveLength(sourceMessages.length)
    expect(branched.artifacts.filter((artifact) => artifact.sessionId === branchedSessionId)).toHaveLength(sourceArtifacts.length)
    expect(branchedAttachments).toHaveLength(sourceAttachments.length)
    expect(branchedAttachments.some((attachment) => attachment.name === 'brief.pdf' && attachment.messageId === `msg-${branchedSessionId}-3`)).toBe(true)
    expect(branchedAttachments.some((attachment) => attachment.name === 'moodboard.png' && attachment.messageId === undefined)).toBe(true)
  })

  it('branches from a prior message and truncates replay context to that point', () => {
    const filePath = createTempShellStateFile()
    initializeShellState(filePath)
    appendShellAttachment({
      id: 'attachment-before-branch',
      sessionId: 'sess-001',
      kind: 'file',
      source: 'picker',
      status: 'sent',
      name: 'brief.txt',
      mimeType: 'text/plain',
      sizeBytes: 128,
      sizeLabel: '128 B',
      createdAt: 'Just now',
      messageId: 'msg-003',
      textContent: 'Keep this attachment in the replay context.',
    })
    appendShellAttachment({
      id: 'attachment-after-branch',
      sessionId: 'sess-001',
      kind: 'file',
      source: 'picker',
      status: 'sent',
      name: 'after.txt',
      mimeType: 'text/plain',
      sizeBytes: 64,
      sizeLabel: '64 B',
      createdAt: 'Just now',
      messageId: 'msg-004',
      textContent: 'This attachment should not survive the truncation.',
    })
    appendShellAttachment({
      id: 'attachment-unbound',
      sessionId: 'sess-001',
      kind: 'image',
      source: 'clipboard',
      status: 'staged',
      name: 'scratch.png',
      mimeType: 'image/png',
      sizeBytes: 256,
      sizeLabel: '256 B',
      createdAt: 'Just now',
      dataUrl: 'data:image/png;base64,AAAA',
    })

    const branched = branchShellSession('sess-001', { sourceMessageId: 'msg-003' })
    const branchedSessionId = branched.activeSessionId
    const branchedSession = branched.sessions.find((session) => session.id === branchedSessionId)
    const branchedMessages = branched.messages.filter((message) => message.sessionId === branchedSessionId)
    const branchedAttachments = branched.attachments.filter((attachment) => attachment.sessionId === branchedSessionId)

    expect(branchedSessionId).not.toBeNull()
    expect(branchedSession?.branchedFromSessionId).toBe('sess-001')
    expect(branchedSession?.branchedFromMessageId).toBe('msg-003')
    expect(branchedSession?.messageCount).toBe(3)
    expect(branchedSession?.artifactCount).toBe(0)
    expect(branchedMessages).toHaveLength(3)
    expect(branchedAttachments).toHaveLength(1)
    expect(branchedAttachments[0]).toMatchObject({
      name: 'brief.txt',
      messageId: `msg-${branchedSessionId}-3`,
    })
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

    appendShellAttachment({
      id: 'attachment-branch-promote',
      sessionId: branchedSessionId!,
      kind: 'file',
      source: 'picker',
      status: 'sent',
      name: 'branch-brief.txt',
      mimeType: 'text/plain',
      sizeBytes: 128,
      sizeLabel: '128 B',
      createdAt: 'Just now',
      messageId: `msg-${branchedSessionId}-3`,
      textContent: 'Branch attachment kept on the shared prefix.',
    })
    appendShellMessage(branchedSessionId!, {
      id: 'msg-branch-promote',
      sessionId: branchedSessionId!,
      role: 'assistant',
      content: '분기된 결과를 메인으로 승격합니다.',
      ts: 1234567891,
    })
    appendShellAttachment({
      id: 'attachment-branch-promote-new',
      sessionId: branchedSessionId!,
      kind: 'file',
      source: 'picker',
      status: 'sent',
      name: 'branch-summary.md',
      mimeType: 'text/markdown',
      sizeBytes: 192,
      sizeLabel: '192 B',
      createdAt: 'Just now',
      messageId: 'msg-branch-promote',
      textContent: 'Promoted attachment linked to the new branch message.',
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
    const promotedSourceAttachments = promoted.attachments.filter((attachment) => attachment.sessionId === 'sess-001')

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
    expect(promotedSourceAttachments).toHaveLength(2)
    expect(promotedSourceAttachments).toContainEqual(expect.objectContaining({
      name: 'branch-brief.txt',
      messageId: 'msg-003',
    }))
    expect(promotedSourceAttachments).toContainEqual(expect.objectContaining({
      name: 'branch-summary.md',
      messageId: promotedSourceMessages[3]?.id,
    }))
    expect(promoted.logs.some((log) => (
      log.sessionId === 'sess-001' && log.message.includes('분기본 승격')
    ))).toBe(true)
  })

  it('records approvals with capability metadata and resolves them back into shell state', () => {
    const filePath = createTempShellStateFile()
    initializeShellState(filePath)

    appendShellApproval({
      id: 'apv-test',
      sessionId: 'sess-001',
      action: 'Write src/components/Hero.tsx',
      detail: 'Apply the generated patch to the working tree.',
      capability: 'filesystem:write',
      risk: 'medium',
      status: 'pending',
      retryable: true,
      fallback: 'Keep the patch as an artifact only.',
      stepId: 'rs-5',
    })

    const pendingSnapshot = getShellSnapshot()
    expect(pendingSnapshot.approvals.find((approval) => approval.id === 'apv-test')?.status).toBe('pending')
    expect(pendingSnapshot.sessions.find((session) => session.id === 'sess-001')?.status).toBe('approval_pending')
    expect(pendingSnapshot.runSteps.find((step) => step.id === 'rs-5')?.status).toBe('approval_needed')

    const resolvedSnapshot = resolveShellApproval('apv-test', 'approved')
    expect(resolvedSnapshot.approvals.find((approval) => approval.id === 'apv-test')?.status).toBe('approved')
    expect(resolvedSnapshot.sessions.find((session) => session.id === 'sess-001')?.status).toBe('active')
    expect(resolvedSnapshot.runSteps.find((step) => step.id === 'rs-5')?.status).toBe('running')
    expect(resolvedSnapshot.logs).toContainEqual(expect.objectContaining({
      approvalId: 'apv-test',
      kind: 'approval',
      status: 'approved',
      capability: 'filesystem:write',
      stepId: 'rs-5',
      message: expect.stringContaining('Approval approved'),
    }))
  })
})
