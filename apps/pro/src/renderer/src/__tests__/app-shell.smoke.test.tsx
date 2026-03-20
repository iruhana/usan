import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '@renderer/App'
import { useShellStore } from '@renderer/stores/shell.store'
import { installMockUsan } from '@renderer/test/mockUsan'
import { resetStores } from '@renderer/test/resetStores'
import type { ShellSnapshot } from '@shared/types'

describe('App shell', () => {
  beforeEach(() => {
    resetStores()
    installMockUsan()
  })

  it('hydrates the shell snapshot and renders the active workspace', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getAllByText('Cafe landing page build').length).toBeGreaterThan(0)
    })

    expect(screen.getByText('Build a landing page for our cafe.')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '대화' })).toBeInTheDocument()
    expect(screen.getByLabelText('명령 팔레트 (Ctrl+K)')).toBeInTheDocument()
  })

  it('creates and switches sessions through shell-owned controls', async () => {
    const api = installMockUsan()
    render(<App />)

    await waitFor(() => {
      expect(screen.getAllByText('Cafe landing page build').length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByRole('button', { name: '새 세션' }))

    await waitFor(() => {
      expect(api.shell.createSession).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(screen.getAllByText('새 세션').length).toBeGreaterThan(0)
    })

    expect(useShellStore.getState().activeSessionId).toBe('sess-002')
    expect(useShellStore.getState().sessions[0]?.title).toBe('새 세션')

    fireEvent.click(screen.getAllByText('Cafe landing page build')[0]!)

    await waitFor(() => {
      expect(api.shell.setActiveSession).toHaveBeenCalledWith('sess-001')
    })

    expect(useShellStore.getState().activeSessionId).toBe('sess-001')
  })

  it('archives sessions into history and restores them', async () => {
    const api = installMockUsan()
    render(<App />)

    await waitFor(() => {
      expect(screen.getAllByText('Cafe landing page build').length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByRole('button', { name: '새 세션' }))

    await waitFor(() => {
      expect(api.shell.createSession).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Cafe landing page build 보관' }))

    await waitFor(() => {
      expect(api.shell.archiveSession).toHaveBeenCalledWith('sess-001')
    })

    expect(screen.queryAllByText('Cafe landing page build')).toHaveLength(0)
    expect(useShellStore.getState().activeSessionId).toBe('sess-002')

    fireEvent.click(screen.getByRole('button', { name: '히스토리' }))

    await waitFor(() => {
      expect(screen.getByText('보관됨')).toBeInTheDocument()
      expect(screen.getAllByText('Cafe landing page build').length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Cafe landing page build 복원' }))

    await waitFor(() => {
      expect(api.shell.restoreSession).toHaveBeenCalledWith('sess-001')
    })

    expect(screen.queryByText('보관됨')).not.toBeInTheDocument()
    expect(screen.getAllByText('Cafe landing page build').length).toBeGreaterThan(0)
  })

  it('branches a session into a new active workspace', async () => {
    const api = installMockUsan()
    render(<App />)

    await waitFor(() => {
      expect(screen.getAllByText('Cafe landing page build').length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Cafe landing page build 분기' }))

    await waitFor(() => {
      expect(api.shell.branchSession).toHaveBeenCalledWith('sess-001', undefined)
    })

    expect(useShellStore.getState().activeSessionId).toBe('sess-002')
    expect(useShellStore.getState().sessions[0]?.branchedFromSessionId).toBe('sess-001')
    expect(screen.getAllByText('Cafe landing page build 분기본').length).toBeGreaterThan(0)
  })

  it('branches from a message and keeps only replay context up to that point', async () => {
    const snapshot: ShellSnapshot = {
      activeSessionId: 'sess-001',
      sessions: [
        {
          id: 'sess-001',
          title: 'Cafe landing page build',
          status: 'active',
          model: 'claude-sonnet-4-6',
          updatedAt: '2m ago',
          pinned: true,
          messageCount: 4,
          artifactCount: 1,
        },
      ],
      runSteps: [],
      artifacts: [
        {
          id: 'art-001',
          title: 'Hero.tsx',
          kind: 'code',
          sessionId: 'sess-001',
          createdAt: '5m ago',
          size: '2.4 KB',
          version: 1,
        },
      ],
      approvals: [],
      logs: [],
      templates: [],
      messages: [
        { id: 'msg-001', sessionId: 'sess-001', role: 'user', content: 'Build a landing page for our cafe.', ts: 1 },
        { id: 'msg-002', sessionId: 'sess-001', role: 'assistant', content: 'I will start with the hero and menu sections.', ts: 2 },
        { id: 'msg-003', sessionId: 'sess-001', role: 'user', content: 'Use a warmer palette and emphasize dessert cards.', ts: 3 },
        { id: 'msg-004', sessionId: 'sess-001', role: 'assistant', content: 'Done. Preview is ready.', ts: 4 },
      ],
      references: [
        {
          id: 'ref-001',
          sessionId: 'sess-001',
          type: 'file',
          title: 'src/App.tsx',
          detail: '42 lines - root component',
        },
      ],
      previews: [
        {
          sessionId: 'sess-001',
          title: 'page-preview',
          status: 'healthy',
          version: 1,
        },
      ],
    }
    const api = installMockUsan({ snapshot })
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Use a warmer palette and emphasize dessert cards.')).toBeInTheDocument()
    })

    fireEvent.click(screen.getAllByRole('button', { name: '이 메시지에서 분기' })[2]!)

    await waitFor(() => {
      expect(api.shell.branchSession).toHaveBeenCalledWith('sess-001', { sourceMessageId: 'msg-003' })
    })

    expect(useShellStore.getState().activeSessionId).toBe('sess-002')
    expect(useShellStore.getState().sessions[0]?.branchedFromMessageId).toBe('msg-003')
    expect(useShellStore.getState().messages.filter((message) => message.sessionId === 'sess-002')).toHaveLength(3)
    expect(screen.getByText('Use a warmer palette and emphasize dessert cards.')).toBeInTheDocument()
    expect(screen.queryByText('Done. Preview is ready.')).not.toBeInTheDocument()
  })

  it('shows branch provenance and jumps back to the source session', async () => {
    const snapshot: ShellSnapshot = {
      activeSessionId: 'sess-002',
      sessions: [
        {
          id: 'sess-001',
          title: 'Cafe landing page build',
          status: 'idle',
          model: 'claude-sonnet-4-6',
          updatedAt: '2m ago',
          pinned: true,
          messageCount: 4,
          artifactCount: 1,
        },
        {
          id: 'sess-002',
          title: 'Cafe landing page build 분기본',
          status: 'active',
          model: 'gpt-5.4',
          updatedAt: '방금',
          branchedFromSessionId: 'sess-001',
          branchedFromMessageId: 'msg-003',
          pinned: true,
          messageCount: 3,
          artifactCount: 0,
        },
      ],
      runSteps: [],
      artifacts: [],
      approvals: [],
      logs: [],
      templates: [],
      messages: [
        { id: 'msg-001', sessionId: 'sess-001', role: 'user', content: 'Build a landing page for our cafe.', ts: 1 },
        { id: 'msg-002', sessionId: 'sess-001', role: 'assistant', content: 'I will start with the hero and menu sections.', ts: 2 },
        { id: 'msg-003', sessionId: 'sess-001', role: 'user', content: 'Use a warmer palette and emphasize dessert cards.', ts: 3 },
        { id: 'msg-sess-002-1', sessionId: 'sess-002', role: 'user', content: 'Build a landing page for our cafe.', ts: 1 },
        { id: 'msg-sess-002-2', sessionId: 'sess-002', role: 'assistant', content: 'I will start with the hero and menu sections.', ts: 2 },
        { id: 'msg-sess-002-3', sessionId: 'sess-002', role: 'user', content: 'Use a warmer palette and emphasize dessert cards.', ts: 3 },
      ],
      references: [],
      previews: [],
    }
    const api = installMockUsan({ snapshot })
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('이 세션은 분기본입니다')).toBeInTheDocument()
    })

    expect(screen.getByText('원본 세션: Cafe landing page build')).toBeInTheDocument()
    expect(screen.getByText('모델 비교 컨텍스트: claude-sonnet-4-6 → gpt-5.4')).toBeInTheDocument()
    expect(screen.getByText(/분기 기준 메시지:/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '원본으로 이동' }))

    await waitFor(() => {
      expect(api.shell.setActiveSession).toHaveBeenCalledWith('sess-001')
    })

    expect(useShellStore.getState().activeSessionId).toBe('sess-001')
  })

  it('renders compare mode for a branched session', async () => {
    const snapshot: ShellSnapshot = {
      activeSessionId: 'sess-002',
      sessions: [
        {
          id: 'sess-001',
          title: 'Cafe landing page build',
          status: 'idle',
          model: 'claude-sonnet-4-6',
          updatedAt: '2m ago',
          pinned: true,
          messageCount: 4,
          artifactCount: 1,
        },
        {
          id: 'sess-002',
          title: 'Cafe landing page build 분기본',
          status: 'active',
          model: 'gpt-5.4',
          updatedAt: '방금',
          branchedFromSessionId: 'sess-001',
          branchedFromMessageId: 'msg-003',
          pinned: true,
          messageCount: 4,
          artifactCount: 0,
        },
      ],
      runSteps: [],
      artifacts: [
        {
          id: 'artifact-source-001',
          sessionId: 'sess-001',
          title: 'landing-plan.md',
          kind: 'markdown',
          createdAt: '2m ago',
          size: '3 KB',
          version: 2,
          content: '# Source artifact\n\nWarm amber palette with compact dessert cards.',
        },
        {
          id: 'artifact-branch-001',
          sessionId: 'sess-002',
          title: 'landing-plan.md',
          kind: 'markdown',
          createdAt: '방금',
          size: '4 KB',
          version: 3,
          content: '# Branch artifact\n\nDessert cards are pushed higher with stronger imagery.',
        },
      ],
      approvals: [],
      logs: [],
      templates: [],
      messages: [
        { id: 'msg-001', sessionId: 'sess-001', role: 'user', content: 'Build a landing page for our cafe.', ts: 1 },
        { id: 'msg-002', sessionId: 'sess-001', role: 'assistant', content: 'I will start with the hero and menu sections.', ts: 2 },
        { id: 'msg-003', sessionId: 'sess-001', role: 'user', content: 'Use a warmer palette and emphasize dessert cards.', ts: 3 },
        { id: 'msg-004', sessionId: 'sess-001', role: 'assistant', content: 'Original branch answer with warm amber palette.', ts: 4 },
        { id: 'msg-sess-002-1', sessionId: 'sess-002', role: 'user', content: 'Build a landing page for our cafe.', ts: 1 },
        { id: 'msg-sess-002-2', sessionId: 'sess-002', role: 'assistant', content: 'I will start with the hero and menu sections.', ts: 2 },
        { id: 'msg-sess-002-3', sessionId: 'sess-002', role: 'user', content: 'Use a warmer palette and emphasize dessert cards.', ts: 3 },
        { id: 'msg-sess-002-4', sessionId: 'sess-002', role: 'assistant', content: 'Compare branch answer with dessert cards pushed higher.', ts: 4 },
      ],
      references: [],
      previews: [
        {
          sessionId: 'sess-001',
          title: 'source-preview',
          status: 'healthy',
          version: 2,
        },
        {
          sessionId: 'sess-002',
          title: 'branch-preview',
          status: 'partial',
          version: 3,
        },
      ],
    }

    installMockUsan({ snapshot })
    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: '비교' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: '비교' }))

    expect(screen.getByText('분기 비교')).toBeInTheDocument()
    expect(screen.getByText('원본 응답')).toBeInTheDocument()
    expect(screen.getByText('분기 응답')).toBeInTheDocument()
    expect(screen.getByText('현재 프리뷰')).toBeInTheDocument()
    expect(screen.getByText('source-preview')).toBeInTheDocument()
    expect(screen.getByText('branch-preview')).toBeInTheDocument()
    expect(screen.getByText('정상')).toBeInTheDocument()
    expect(screen.getByText('부분')).toBeInTheDocument()
    expect(screen.getByText('저장된 결과')).toBeInTheDocument()
    expect(screen.getAllByText('landing-plan.md').length).toBeGreaterThan(0)
    expect(screen.getByText(/Warm amber palette with compact dessert cards\./)).toBeInTheDocument()
    expect(screen.getByText(/Dessert cards are pushed higher with stronger imagery\./)).toBeInTheDocument()
    expect(screen.getByText('Original branch answer with warm amber palette.')).toBeInTheDocument()
    expect(screen.getByText('Compare branch answer with dessert cards pushed higher.')).toBeInTheDocument()
  })

  it('promotes a compare branch back into the main thread', async () => {
    const snapshot: ShellSnapshot = {
      activeSessionId: 'sess-002',
      sessions: [
        {
          id: 'sess-001',
          title: 'Cafe landing page build',
          status: 'idle',
          model: 'claude-sonnet-4-6',
          updatedAt: '2m ago',
          pinned: true,
          messageCount: 4,
          artifactCount: 0,
        },
        {
          id: 'sess-002',
          title: 'Cafe landing page build 분기본',
          status: 'active',
          model: 'gpt-5.4',
          updatedAt: '방금',
          branchedFromSessionId: 'sess-001',
          branchedFromMessageId: 'msg-003',
          pinned: true,
          messageCount: 4,
          artifactCount: 0,
        },
      ],
      runSteps: [],
      artifacts: [],
      approvals: [],
      logs: [],
      templates: [],
      messages: [
        { id: 'msg-001', sessionId: 'sess-001', role: 'user', content: 'Build a landing page for our cafe.', ts: 1 },
        { id: 'msg-002', sessionId: 'sess-001', role: 'assistant', content: 'I will start with the hero and menu sections.', ts: 2 },
        { id: 'msg-003', sessionId: 'sess-001', role: 'user', content: 'Use a warmer palette and emphasize dessert cards.', ts: 3 },
        { id: 'msg-004', sessionId: 'sess-001', role: 'assistant', content: 'Original branch answer with warm amber palette.', ts: 4 },
        { id: 'msg-sess-002-1', sessionId: 'sess-002', role: 'user', content: 'Build a landing page for our cafe.', ts: 1 },
        { id: 'msg-sess-002-2', sessionId: 'sess-002', role: 'assistant', content: 'I will start with the hero and menu sections.', ts: 2 },
        { id: 'msg-sess-002-3', sessionId: 'sess-002', role: 'user', content: 'Use a warmer palette and emphasize dessert cards.', ts: 3 },
        { id: 'msg-sess-002-4', sessionId: 'sess-002', role: 'assistant', content: 'Compare branch answer with dessert cards pushed higher.', ts: 4 },
      ],
      references: [],
      previews: [],
    }

    const api = installMockUsan({ snapshot })
    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: '비교' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: '비교' }))
    fireEvent.click(screen.getByRole('button', { name: '메인 스레드로 승격' }))

    await waitFor(() => {
      expect(api.shell.promoteSession).toHaveBeenCalledWith('sess-002')
    })

    await waitFor(() => {
      expect(useShellStore.getState().activeSessionId).toBe('sess-001')
      expect(screen.queryByRole('tab', { name: '비교' })).not.toBeInTheDocument()
      expect(screen.getByText('Compare branch answer with dessert cards pushed higher.')).toBeInTheDocument()
      expect(screen.queryByText('Original branch answer with warm amber palette.')).not.toBeInTheDocument()
    })
  })
})
