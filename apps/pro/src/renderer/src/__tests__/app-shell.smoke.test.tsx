import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { vi } from 'vitest'
import App from '@renderer/App'
import { useShellStore } from '@renderer/stores/shell.store'
import { useUiStore } from '@renderer/stores/ui.store'
import { installMockUsan } from '@renderer/test/mockUsan'
import { resetStores } from '@renderer/test/resetStores'
import type { ProviderSecretsSnapshot, ShellSession, ShellSnapshot } from '@shared/types'

function createSession(
  overrides: Partial<ShellSession> & Pick<ShellSession, 'id' | 'title'>,
): ShellSession {
  const { id, title, ...rest } = overrides

  return {
    id,
    title,
    status: 'active',
    model: 'claude-sonnet-4-6',
    updatedAt: 'Just now',
    pinned: false,
    messageCount: 0,
    artifactCount: 0,
    ...rest,
  }
}

function createSnapshot(overrides: Partial<ShellSnapshot> = {}): ShellSnapshot {
  return {
    activeSessionId: 'sess-001',
    sessions: [
      createSession({
        id: 'sess-001',
        title: 'Cafe landing page build',
        updatedAt: '2m ago',
        pinned: true,
        messageCount: 4,
        artifactCount: 1,
      }),
    ],
    runSteps: [],
    attachments: [],
    artifacts: [],
    approvals: [],
    logs: [],
    templates: [],
    messages: [
      {
        id: 'msg-001',
        sessionId: 'sess-001',
        role: 'user',
        content: 'Build a landing page for our cafe.',
        ts: 1,
      },
    ],
    references: [],
    previews: [],
    ...overrides,
  }
}

describe('App shell', () => {
  beforeEach(() => {
    resetStores()
    vi.restoreAllMocks()
  })

  it('hydrates the shell snapshot and renders the active workspace', async () => {
    installMockUsan()
    render(<App />)

    await waitFor(() => {
      expect(screen.getAllByText('Cafe landing page build').length).toBeGreaterThan(0)
    })

    expect(screen.getByText('Build a landing page for our cafe.')).toBeInTheDocument()
    expect(document.querySelector('[data-shell-zone="workspace"]')).not.toBeNull()
    expect(screen.getByLabelText(/Ctrl\+K/)).toBeInTheDocument()
  })

  it('stores provider keys through the secure secret bridge from settings', async () => {
    const secrets: ProviderSecretsSnapshot = {
      encryptionAvailable: true,
      providers: [
        { provider: 'anthropic', configured: false, source: 'none' },
        { provider: 'openai', configured: false, source: 'none' },
        { provider: 'google', configured: false, source: 'none' },
      ],
    }
    const api = installMockUsan({ secrets })

    act(() => {
      useUiStore.getState().setView('settings')
    })

    render(<App />)

    const keysNav = document.querySelector('[data-settings-nav="keys"]')
    expect(keysNav).not.toBeNull()
    fireEvent.click(keysNav!)

    const input = document.querySelector<HTMLInputElement>('[data-provider-secret-input="openai"]')
    const saveButton = document.querySelector<HTMLButtonElement>('[data-provider-secret-save="openai"]')

    expect(input).not.toBeNull()
    expect(saveButton).not.toBeNull()

    fireEvent.change(input!, { target: { value: 'sk-test-openai' } })
    fireEvent.click(saveButton!)

    await waitFor(() => {
      expect(api.secrets.setProviderKey).toHaveBeenCalledWith('openai', 'sk-test-openai')
    })

    await waitFor(() => {
      expect(document.querySelector('[data-provider-secret-status="openai"]')?.textContent).toContain('로컬 보안 저장소')
    })
  })

  it('resets workspace data and clears caches from settings', async () => {
    const api = installMockUsan()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    act(() => {
      useUiStore.getState().setView('settings')
    })

    render(<App />)

    await waitFor(() => {
      expect(useShellStore.getState().hydrated).toBe(true)
    })

    const dataNav = document.querySelector('[data-settings-nav="data"]')
    expect(dataNav).not.toBeNull()
    fireEvent.click(dataNav!)

    const resetButton = document.querySelector<HTMLButtonElement>('[data-settings-reset-workspace]')
    expect(resetButton).not.toBeNull()
    fireEvent.click(resetButton!)

    await waitFor(() => {
      expect(api.data.resetWorkspace).toHaveBeenCalledTimes(1)
    })

    expect(confirmSpy).toHaveBeenCalled()

    await waitFor(() => {
      expect(useShellStore.getState().sessions).toHaveLength(1)
      expect(useShellStore.getState().sessions[0]?.title).toBe('새 세션')
    })

    await waitFor(() => {
      expect(document.querySelector('[data-settings-data-feedback]')?.textContent).toContain('로컬 백업')
    })

    const clearCacheButton = document.querySelector<HTMLButtonElement>('[data-settings-clear-cache]')
    expect(clearCacheButton).not.toBeNull()
    fireEvent.click(clearCacheButton!)

    await waitFor(() => {
      expect(api.data.clearCache).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(document.querySelector('[data-settings-data-feedback]')?.textContent).toContain('캐시를 초기화했습니다.')
    })

    confirmSpy.mockRestore()
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
      expect(useUiStore.getState().sessionHistoryOpen).toBe(true)
      expect(screen.getAllByText('Cafe landing page build').length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Cafe landing page build 복원' }))

    await waitFor(() => {
      expect(api.shell.restoreSession).toHaveBeenCalledWith('sess-001')
    })

    expect(screen.getAllByText('Cafe landing page build').length).toBeGreaterThan(0)
  })

  it('shows approval badges, log summaries, and activity filters in the work list and history', async () => {
    const snapshot = createSnapshot({
      sessions: [
        createSession({
          id: 'sess-001',
          title: 'Cafe landing page build',
          status: 'approval_pending',
          model: 'claude-sonnet-4-6',
          updatedAt: 'Just now',
          pinned: true,
          messageCount: 4,
          artifactCount: 1,
        }),
        createSession({
          id: 'sess-002',
          title: 'Launch checklist review',
          status: 'idle',
          model: 'gpt-5.4',
          updatedAt: '5m ago',
          archivedAt: '1m ago',
          pinned: false,
          messageCount: 3,
          artifactCount: 0,
        }),
      ],
      approvals: [
        {
          id: 'apv-001',
          sessionId: 'sess-001',
          action: 'Write src/components/Hero.tsx',
          detail: 'Apply the generated patch to the working tree.',
          capability: 'filesystem:write',
          risk: 'medium',
          status: 'pending',
          retryable: true,
          fallback: 'Keep the patch as an artifact only.',
          stepId: 'rs-5',
        },
        {
          id: 'apv-002',
          sessionId: 'sess-002',
          action: 'Run deployment command',
          detail: 'Execute the release command.',
          capability: 'shell:execute',
          risk: 'high',
          status: 'denied',
          retryable: true,
          fallback: 'Keep the release checklist only.',
          stepId: 'rs-8',
        },
      ],
      logs: [
        {
          id: 'log-source-compare-001',
          sessionId: 'sess-001',
          ts: '14:32:10',
          level: 'info',
          message: 'Approval approved: Review palette patch',
          kind: 'approval',
          status: 'approved',
          capability: 'filesystem:write',
          approvalId: 'approval-source-compare-001',
          stepId: 'step-source-compare-001',
        },
        {
          id: 'log-source-compare-002',
          sessionId: 'sess-001',
          ts: '14:32:12',
          level: 'info',
          message: 'Tool result: Source palette patch stored',
          kind: 'tool',
          status: 'success',
          toolName: 'write_file',
          stepId: 'step-source-compare-002',
        },
        {
          id: 'log-branch-compare-001',
          sessionId: 'sess-002',
          ts: '14:32:18',
          level: 'warn',
          message: 'Approval denied: Run shell deployment check',
          kind: 'approval',
          status: 'denied',
          capability: 'shell:execute',
          approvalId: 'approval-branch-compare-001',
          stepId: 'step-branch-compare-001',
        },
        {
          id: 'log-branch-compare-002',
          sessionId: 'sess-002',
          ts: '14:32:20',
          level: 'warn',
          message: 'Tool result: Execution skipped: approval denied for bash.',
          kind: 'tool',
          status: 'skipped',
          toolName: 'bash',
          stepId: 'step-branch-compare-002',
        },
      ],
      messages: [
        { id: 'msg-001', sessionId: 'sess-001', role: 'user', content: 'Build a landing page for our cafe.', ts: 1 },
        { id: 'msg-002', sessionId: 'sess-002', role: 'user', content: 'Review the launch checklist.', ts: 2 },
      ],
    })

    installMockUsan({ snapshot })
    useUiStore.getState().setSessionHistoryOpen(true)

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('승인 1')).toBeInTheDocument()
    })

    expect(screen.getByText('거부 1')).toBeInTheDocument()
    expect(screen.getByText('Launch checklist review')).toBeInTheDocument()
    expect(screen.getByText('Tool result: Source palette patch stored')).toBeInTheDocument()
    expect(screen.getByText('Tool result: Execution skipped: approval denied for bash.')).toBeInTheDocument()
    expect(screen.getByText('write_file')).toBeInTheDocument()
    expect(screen.getByText('bash')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '승인 대기 1' }))

    expect(screen.getByText('Tool result: Source palette patch stored')).toBeInTheDocument()
    expect(screen.queryByText('Tool result: Execution skipped: approval denied for bash.')).not.toBeInTheDocument()
    expect(useUiStore.getState().utilityTab).toBe('approvals')
    expect(useUiStore.getState().logFeedFilter).toBe('all')

    fireEvent.click(screen.getByRole('button', { name: '이슈 1' }))

    expect(screen.getByText('Tool result: Execution skipped: approval denied for bash.')).toBeInTheDocument()
    expect(screen.queryByText('Tool result: Source palette patch stored')).not.toBeInTheDocument()
    expect(useUiStore.getState().utilityTab).toBe('logs')
    expect(useUiStore.getState().logFeedFilter).toBe('issues')
  })

  it('shows latest attachment provenance in the work list', async () => {
    const snapshot = createSnapshot({
      sessions: [
        createSession({
          id: 'sess-001',
          title: 'Cafe landing page build',
          status: 'active',
          updatedAt: 'Just now',
          pinned: true,
          messageCount: 4,
          artifactCount: 1,
        }),
        createSession({
          id: 'sess-002',
          title: 'Moodboard review',
          status: 'idle',
          model: 'gpt-5.4',
          updatedAt: '3m ago',
          pinned: false,
          messageCount: 1,
          artifactCount: 0,
        }),
      ],
      attachments: [
        {
          id: 'att-001',
          sessionId: 'sess-001',
          kind: 'file',
          source: 'picker',
          status: 'sent',
          name: 'brief.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          sizeBytes: 24576,
          sizeLabel: '24 KB',
          createdAt: '4m ago',
          messageId: 'msg-001',
          dataUrl: 'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,AA==',
        },
        {
          id: 'att-002',
          sessionId: 'sess-001',
          kind: 'file',
          source: 'picker',
          status: 'sent',
          name: 'brand-notes.txt',
          mimeType: 'text/plain',
          sizeBytes: 512,
          sizeLabel: '512 B',
          createdAt: 'Just now',
          messageId: 'msg-001',
          textContent: 'Warm amber palette with compact dessert cards and pastry photography.',
        },
        {
          id: 'att-003',
          sessionId: 'sess-002',
          kind: 'image',
          source: 'clipboard',
          status: 'staged',
          name: 'moodboard.png',
          mimeType: 'image/png',
          sizeBytes: 2048,
          sizeLabel: '2 KB',
          createdAt: 'Just now',
          dataUrl: 'data:image/png;base64,AA==',
        },
      ],
      messages: [
        { id: 'msg-001', sessionId: 'sess-001', role: 'user', content: 'Build a landing page for our cafe.', ts: 1 },
        { id: 'msg-002', sessionId: 'sess-002', role: 'user', content: 'Review the visual moodboard.', ts: 2 },
      ],
      logs: [
        {
          id: 'log-worklist-attachment-001',
          sessionId: 'sess-001',
          ts: '14:32:08',
          level: 'info',
          message: 'Attachment route: brand-notes.txt -> text_fallback',
          kind: 'attachment',
          status: 'success',
          attachmentName: 'brand-notes.txt',
          attachmentDeliveryMode: 'text_fallback',
          modelId: 'claude-sonnet-4-6',
          stepId: 'step-worklist-attachment-001',
        },
      ],
    })

    installMockUsan({ snapshot })
    render(<App />)

    await waitFor(() => {
      expect(document.querySelector('[data-shell-session-attachment="sess-001"]')).not.toBeNull()
    })

    const sourceRow = document.querySelector<HTMLButtonElement>('[data-shell-session-row="sess-001"]')
    const moodboardRow = document.querySelector<HTMLButtonElement>('[data-shell-session-row="sess-002"]')

    expect(sourceRow).not.toBeNull()
    expect(moodboardRow).not.toBeNull()

    expect(within(sourceRow!).getByText(/첨부: brand-notes\.txt/)).toBeInTheDocument()
    expect(within(sourceRow!).getByText(/Warm amber palette with compact dessert cards/)).toBeInTheDocument()
    expect(within(sourceRow!).getByText('첨부 2')).toBeInTheDocument()
    expect(within(sourceRow!).getByText('전송')).toBeInTheDocument()
    expect(within(sourceRow!).getByText('파일')).toBeInTheDocument()
    const sourceDeliveryBadge = sourceRow!.querySelector('[data-attachment-delivery-context="worklist"][data-attachment-delivery-name="brand-notes.txt"]')
    expect(sourceDeliveryBadge?.getAttribute('data-attachment-delivery-source')).toBe('runtime')
    expect(sourceDeliveryBadge?.getAttribute('data-attachment-delivery-mode')).toBe('text_fallback')
    expect(sourceDeliveryBadge?.getAttribute('data-attachment-delivery-model')).toBe('claude-sonnet-4-6')
    expect(sourceRow!.querySelectorAll('[data-shell-session-attachment-route-row="sess-001"]').length).toBe(2)
    expect(sourceRow!.querySelector('[data-shell-session-attachment-route-row="sess-001"][data-shell-session-attachment-route-mode="text_fallback"]')).not.toBeNull()
    expect(sourceRow!.querySelector('[data-shell-session-attachment-route-row="sess-001"][data-shell-session-attachment-route-mode="summary_only"]')).not.toBeNull()

    expect(within(moodboardRow!).getByText('첨부: moodboard.png')).toBeInTheDocument()
    expect(within(moodboardRow!).getByText('첨부 1')).toBeInTheDocument()
    expect(within(moodboardRow!).getByText('이미지')).toBeInTheDocument()
    const moodboardDeliveryBadge = moodboardRow!.querySelector('[data-attachment-delivery-context="worklist"][data-attachment-delivery-name="moodboard.png"]')
    expect(moodboardDeliveryBadge?.getAttribute('data-attachment-delivery-source')).toBe('derived')
    expect(moodboardDeliveryBadge?.getAttribute('data-attachment-delivery-mode')).toBe('native_image')
    expect(moodboardRow!.querySelector('[data-shell-session-attachment-route-row="sess-002"][data-shell-session-attachment-route-mode="native_image"]')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /^첨부 2$/ }))

    expect(useUiStore.getState().workListFilter).toBe('attachments')
    expect(useUiStore.getState().utilityTab).toBe('logs')
    expect(useUiStore.getState().logFeedFilter).toBe('attachments')
    const utilityPanel = document.querySelector('[data-shell-zone="utility-panel"]') as HTMLElement | null
    expect(utilityPanel).not.toBeNull()
    expect(within(utilityPanel!).getByText('Attachment route: brand-notes.txt -> text_fallback')).toBeInTheDocument()
  })

  it('shows recent attachment details for active and archived sessions', async () => {
    const snapshot = createSnapshot({
      sessions: [
        createSession({
          id: 'sess-001',
          title: 'Cafe landing page build',
          status: 'active',
          updatedAt: 'Just now',
          pinned: true,
          messageCount: 4,
          artifactCount: 1,
        }),
        createSession({
          id: 'sess-002',
          title: 'Archived brief review',
          status: 'idle',
          model: 'gpt-5.4',
          updatedAt: '8m ago',
          archivedAt: '1m ago',
          pinned: false,
          messageCount: 2,
          artifactCount: 0,
        }),
      ],
      attachments: [
        {
          id: 'att-001',
          sessionId: 'sess-001',
          kind: 'file',
          source: 'picker',
          status: 'sent',
          name: 'brief.txt',
          mimeType: 'text/plain',
          sizeBytes: 512,
          sizeLabel: '512 B',
          createdAt: '4m ago',
          messageId: 'msg-001',
          textContent: 'Warm amber palette with compact dessert cards.',
        },
        {
          id: 'att-002',
          sessionId: 'sess-001',
          kind: 'image',
          source: 'clipboard',
          status: 'sent',
          name: 'dessert-moodboard.png',
          mimeType: 'image/png',
          sizeBytes: 2048,
          sizeLabel: '2 KB',
          createdAt: '2m ago',
          messageId: 'msg-001',
          dataUrl: 'data:image/png;base64,AA==',
        },
        {
          id: 'att-003',
          sessionId: 'sess-001',
          kind: 'file',
          source: 'picker',
          status: 'sent',
          name: 'research.csv',
          mimeType: 'text/csv',
          sizeBytes: 768,
          sizeLabel: '768 B',
          createdAt: 'Just now',
          messageId: 'msg-001',
          textContent: 'dessert,croissant,featured\\nmadeleine,true,false',
        },
        {
          id: 'att-004',
          sessionId: 'sess-002',
          kind: 'image',
          source: 'clipboard',
          status: 'sent',
          name: 'archived-board.png',
          mimeType: 'image/png',
          sizeBytes: 3072,
          sizeLabel: '3 KB',
          createdAt: '3m ago',
          messageId: 'msg-002',
          dataUrl: 'data:image/png;base64,AA==',
        },
        {
          id: 'att-005',
          sessionId: 'sess-002',
          kind: 'file',
          source: 'picker',
          status: 'sent',
          name: 'archived-notes.txt',
          mimeType: 'text/plain',
          sizeBytes: 640,
          sizeLabel: '640 B',
          createdAt: '2m ago',
          messageId: 'msg-002',
          textContent: 'Archived session notes with launch copy revisions.',
        },
      ],
      messages: [
        { id: 'msg-001', sessionId: 'sess-001', role: 'user', content: 'Build a landing page for our cafe.', ts: 1 },
        { id: 'msg-002', sessionId: 'sess-002', role: 'user', content: 'Review the archived brief.', ts: 2 },
      ],
      logs: [
        {
          id: 'log-attachment-runtime-001',
          sessionId: 'sess-001',
          ts: '14:32:08',
          level: 'info',
          message: 'Attachment route: research.csv -> native_document',
          kind: 'attachment',
          status: 'success',
          attachmentName: 'research.csv',
          attachmentDeliveryMode: 'native_document',
          modelId: 'gpt-5.4',
          stepId: 'step-attachment-runtime-001',
        },
      ],
    })

    installMockUsan({ snapshot })
    act(() => {
      useUiStore.getState().setSessionHistoryOpen(true)
    })

    render(<App />)

    await waitFor(() => {
      expect(document.querySelector('[data-shell-session-attachment-toggle="sess-001"]')).not.toBeNull()
      expect(document.querySelector('[data-shell-session-attachment-toggle="sess-002"]')).not.toBeNull()
    })

    fireEvent.click(document.querySelector('[data-shell-session-attachment-toggle="sess-001"]')!)

    const activePanel = document.querySelector('[data-shell-session-attachment-panel="sess-001"]') as HTMLElement | null
    expect(activePanel).not.toBeNull()
    expect(activePanel?.textContent).toContain('research.csv')
    expect(document.querySelector('[data-shell-session-attachment-item="att-003"]')).not.toBeNull()
    expect(within(activePanel!).getByText('research.csv')).toBeInTheDocument()
    expect(within(activePanel!).getByText('text/csv')).toBeInTheDocument()
    expect(document.querySelector('[data-shell-session-attachment-route-panel="sess-001"][data-shell-session-attachment-route-mode="native_document"]')).not.toBeNull()
    const researchBadge = document.querySelector('[data-attachment-delivery-context="worklist"][data-attachment-delivery-name="research.csv"]')
    expect(researchBadge?.getAttribute('data-attachment-delivery-mode')).toBe('native_document')
    expect(researchBadge?.getAttribute('data-attachment-delivery-source')).toBe('runtime')
    expect(researchBadge?.getAttribute('data-attachment-delivery-model')).toBe('gpt-5.4')
    expect(researchBadge?.getAttribute('data-attachment-delivery-ts')).toBe('14:32:08')

    fireEvent.click(document.querySelector('[data-worklist-attachment-text-toggle="research.csv"]')!)

    await waitFor(() => {
      expect(document.querySelector('[data-worklist-attachment-text-content="research.csv"]')).not.toBeNull()
    })

    fireEvent.click(document.querySelector('[data-shell-session-attachment-toggle="sess-002"]')!)

    const archivedPanel = document.querySelector('[data-shell-session-attachment-panel="sess-002"]') as HTMLElement | null
    expect(archivedPanel).not.toBeNull()
    expect(archivedPanel?.textContent).toContain('archived-board.png')
    expect(document.querySelector('[data-shell-session-attachment-item="att-005"]')).not.toBeNull()
    expect(within(archivedPanel!).getByText('archived-board.png')).toBeInTheDocument()
    expect(within(archivedPanel!).getByAltText('archived-board.png preview')).toBeInTheDocument()
    expect(document.querySelector('[data-shell-session-attachment-route-panel="sess-002"][data-shell-session-attachment-route-mode="native_image"]')).not.toBeNull()
    expect(document.querySelector('[data-attachment-delivery-context="worklist"][data-attachment-delivery-name="archived-board.png"]')?.getAttribute('data-attachment-delivery-mode')).toBe('native_image')

    fireEvent.click(document.querySelector('[data-worklist-attachment-text-toggle="archived-notes.txt"]')!)

    await waitFor(() => {
      expect(document.querySelector('[data-worklist-attachment-text-content="archived-notes.txt"]')?.textContent).toContain(
        'Archived session notes with launch copy revisions.',
      )
    })
  })

  it('shows session detail summaries and copies them', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const createObjectURL = vi.fn(() => 'blob:session-summary')
    const revokeObjectURL = vi.fn()
    const originalCreateElement = document.createElement.bind(document)
    let exportedDownload = ''
    let exportedHref = ''

    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    })
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    })

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName)
      if (tagName.toLowerCase() === 'a') {
        const anchor = element as HTMLAnchorElement
        vi.spyOn(anchor, 'click').mockImplementation(() => {
          exportedDownload = anchor.download
          exportedHref = anchor.href
        })
      }
      return element
    })

    const snapshot = createSnapshot({
      sessions: [
        createSession({
          id: 'sess-001',
          title: 'Cafe landing page build',
          status: 'approval_pending',
          updatedAt: 'Just now',
          pinned: true,
          messageCount: 4,
          artifactCount: 2,
        }),
        createSession({
          id: 'sess-002',
          title: 'Archived visual review',
          status: 'idle',
          model: 'gpt-5.4',
          updatedAt: '9m ago',
          archivedAt: '1m ago',
          pinned: false,
          messageCount: 2,
          artifactCount: 1,
        }),
      ],
      approvals: [
        {
          id: 'apv-detail-001',
          sessionId: 'sess-001',
          action: 'Write src/components/Hero.tsx',
          detail: 'Apply the generated patch to the working tree.',
          capability: 'filesystem:write',
          risk: 'medium',
          status: 'pending',
          retryable: true,
        },
      ],
      attachments: [
        {
          id: 'att-detail-001',
          sessionId: 'sess-001',
          kind: 'file',
          source: 'picker',
          status: 'sent',
          name: 'brief.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 4096,
          sizeLabel: '4 KB',
          createdAt: '2m ago',
          messageId: 'msg-001',
          textContent: 'Warm amber palette with compact dessert cards.',
        },
        {
          id: 'att-detail-002',
          sessionId: 'sess-002',
          kind: 'image',
          source: 'clipboard',
          status: 'sent',
          name: 'review-board.png',
          mimeType: 'image/png',
          sizeBytes: 2048,
          sizeLabel: '2 KB',
          createdAt: 'Just now',
          messageId: 'msg-002',
          dataUrl: 'data:image/png;base64,AA==',
        },
      ],
      artifacts: [
        {
          id: 'artifact-detail-001',
          sessionId: 'sess-001',
          title: 'landing-plan.md',
          kind: 'markdown',
          createdAt: '1m ago',
          size: '3 KB',
          version: 2,
          content: '# Landing plan\n\nWarm amber palette with compact dessert cards and pastry-first hero copy.',
        },
        {
          id: 'artifact-detail-002',
          sessionId: 'sess-002',
          title: 'review-summary.json',
          kind: 'json',
          createdAt: '4m ago',
          size: '1 KB',
          version: 1,
          content: '{"moodboard":"reviewed","status":"ready"}',
        },
      ],
      logs: [
        {
          id: 'log-detail-001',
          sessionId: 'sess-001',
          ts: '14:32:08',
          level: 'info',
          message: 'Attachment route: brief.pdf -> native_document',
          kind: 'attachment',
          status: 'success',
          attachmentName: 'brief.pdf',
          attachmentDeliveryMode: 'native_document',
          modelId: 'claude-sonnet-4-6',
          stepId: 'step-detail-001',
        },
        {
          id: 'log-detail-002',
          sessionId: 'sess-001',
          ts: '14:32:12',
          level: 'warn',
          message: 'Approval requested: Write src/components/Hero.tsx',
          kind: 'approval',
          status: 'pending',
          capability: 'filesystem:write',
          approvalId: 'apv-detail-001',
          stepId: 'step-detail-002',
        },
        {
          id: 'log-detail-003',
          sessionId: 'sess-002',
          ts: '14:32:16',
          level: 'info',
          message: 'Attachment route: review-board.png -> native_image',
          kind: 'attachment',
          status: 'success',
          attachmentName: 'review-board.png',
          attachmentDeliveryMode: 'native_image',
          modelId: 'gpt-5.4',
          stepId: 'step-detail-003',
        },
      ],
      messages: [
        { id: 'msg-001', sessionId: 'sess-001', role: 'user', content: 'Build a landing page for our cafe.', ts: 1 },
        { id: 'msg-002', sessionId: 'sess-002', role: 'user', content: 'Review the archived visual board.', ts: 2 },
      ],
      previews: [
        {
          sessionId: 'sess-001',
          title: 'cafe-preview',
          status: 'partial',
          version: 4,
        },
        {
          sessionId: 'sess-002',
          title: 'archived-review-preview',
          status: 'healthy',
          version: 1,
        },
      ],
    })

    installMockUsan({ snapshot })
    act(() => {
      useUiStore.getState().setSessionHistoryOpen(true)
    })

    render(<App />)

    await waitFor(() => {
      expect(document.querySelector('[data-shell-session-detail-toggle="sess-001"]')).not.toBeNull()
      expect(document.querySelector('[data-shell-session-detail-toggle="sess-002"]')).not.toBeNull()
    })

    fireEvent.click(document.querySelector('[data-shell-session-detail-toggle="sess-001"]')!)

    const activePanel = document.querySelector('[data-shell-session-detail-panel="sess-001"]') as HTMLElement | null
    expect(activePanel).not.toBeNull()
    expect(within(activePanel!).getByText('세션 개요')).toBeInTheDocument()
    expect(within(activePanel!).getByText('승인 대기 1')).toBeInTheDocument()
    expect(within(activePanel!).getByText('Approval requested: Write src/components/Hero.tsx')).toBeInTheDocument()
    expect(within(activePanel!).getByText('landing-plan.md')).toBeInTheDocument()
    expect(within(activePanel!).getByText('cafe-preview')).toBeInTheDocument()
    expect(within(activePanel!).getByText('부분')).toBeInTheDocument()
    expect(activePanel!.querySelector('[data-shell-session-detail-artifact="sess-001"]')).not.toBeNull()
    expect(activePanel!.querySelector('[data-shell-session-detail-preview="sess-001"]')).not.toBeNull()
    expect(activePanel!.querySelector('[data-shell-session-detail-route="sess-001"][data-shell-session-detail-route-mode="native_document"]')).not.toBeNull()

    fireEvent.click(within(activePanel!).getByRole('button', { name: 'Cafe landing page build 세션 요약 복사' }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1)
    })

    expect(writeText.mock.calls[0]?.[0]).toContain('# Cafe landing page build')
    expect(writeText.mock.calls[0]?.[0]).toContain('첨부 경로:')
    expect(writeText.mock.calls[0]?.[0]).toContain('최신 아티팩트: landing-plan.md')
    expect(writeText.mock.calls[0]?.[0]).toContain('프리뷰: cafe-preview · 부분 · v4')
    expect(writeText.mock.calls[0]?.[0]).toContain('Approval requested: Write src/components/Hero.tsx')
    expect(within(activePanel!).getByText('복사됨')).toBeInTheDocument()

    fireEvent.click(within(activePanel!).getByRole('button', { name: 'Cafe landing page build 세션 요약 내보내기' }))

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(exportedDownload).toBe('Cafe landing page build-summary.md')
    expect(exportedHref).toContain('blob:session-summary')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:session-summary')

    fireEvent.click(document.querySelector('[data-shell-session-detail-toggle="sess-002"]')!)

    const archivedPanel = document.querySelector('[data-shell-session-detail-panel="sess-002"]') as HTMLElement | null
    expect(archivedPanel).not.toBeNull()
    expect(within(archivedPanel!).getByText('보관됨 1m ago')).toBeInTheDocument()
    expect(within(archivedPanel!).getByText('review-summary.json')).toBeInTheDocument()
    expect(within(archivedPanel!).getByText('archived-review-preview')).toBeInTheDocument()
    expect(within(archivedPanel!).getByText('Attachment route: review-board.png -> native_image')).toBeInTheDocument()
    expect(archivedPanel!.querySelector('[data-shell-session-detail-route="sess-002"][data-shell-session-detail-route-mode="native_image"]')).not.toBeNull()
  })

  it('changes work list filters from the command palette', async () => {
    const snapshot = createSnapshot({
      sessions: [
        createSession({
          id: 'sess-001',
          title: 'Cafe landing page build',
          status: 'approval_pending',
          updatedAt: 'Just now',
          pinned: true,
          messageCount: 4,
          artifactCount: 1,
        }),
        createSession({
          id: 'sess-002',
          title: 'Docs export automation',
          status: 'active',
          model: 'gpt-5.4',
          updatedAt: '3m ago',
          messageCount: 2,
          artifactCount: 0,
        }),
        createSession({
          id: 'sess-003',
          title: 'Attachment provenance review',
          status: 'idle',
          model: 'claude-sonnet-4-6',
          updatedAt: '1m ago',
          messageCount: 2,
          artifactCount: 0,
        }),
      ],
      attachments: [
        {
          id: 'att-command-001',
          sessionId: 'sess-003',
          kind: 'file',
          source: 'picker',
          status: 'sent',
          name: 'reference-brief.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 4096,
          sizeLabel: '4 KB',
          createdAt: 'Just now',
          messageId: 'msg-003',
          textContent: 'Attachment-specific review context.',
        },
      ],
      approvals: [
        {
          id: 'apv-001',
          sessionId: 'sess-001',
          action: 'Write src/components/Hero.tsx',
          detail: 'Apply the generated patch to the working tree.',
          capability: 'filesystem:write',
          risk: 'medium',
          status: 'pending',
          retryable: true,
          fallback: 'Keep the patch as an artifact only.',
          stepId: 'rs-5',
        },
      ],
      logs: [
        {
          id: 'log-tool-002',
          sessionId: 'sess-002',
          ts: '14:32:20',
          level: 'info',
          message: 'Tool result: Exported docs package.',
          kind: 'tool',
          status: 'success',
          toolName: 'write_file',
          stepId: 'step-002',
        },
        {
          id: 'log-attachment-003',
          sessionId: 'sess-003',
          ts: '14:32:28',
          level: 'info',
          message: 'Attachment route: reference-brief.pdf -> native_document',
          kind: 'attachment',
          status: 'success',
          attachmentName: 'reference-brief.pdf',
          attachmentDeliveryMode: 'native_document',
          modelId: 'claude-sonnet-4-6',
          stepId: 'step-003',
        },
      ],
      messages: [
        { id: 'msg-001', sessionId: 'sess-001', role: 'user', content: 'Build a landing page for our cafe.', ts: 1 },
        { id: 'msg-002', sessionId: 'sess-002', role: 'user', content: 'Export docs into one package.', ts: 2 },
        { id: 'msg-003', sessionId: 'sess-003', role: 'user', content: 'Review how the reference brief was routed.', ts: 3 },
      ],
    })

    installMockUsan({ snapshot })
    act(() => {
      useUiStore.getState().setCommandPaletteOpen(true)
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    expect(screen.getByText('Ctrl+Shift+0')).toBeInTheDocument()
    expect(screen.getByText('Ctrl+Shift+A')).toBeInTheDocument()
    expect(screen.getByText('Ctrl+Shift+L')).toBeInTheDocument()
    expect(screen.getByText('Ctrl+Shift+F')).toBeInTheDocument()
    expect(screen.getByText('Ctrl+Shift+E')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /작업 목록: 승인 대기만 보기/ }))

    await waitFor(() => {
      expect(useUiStore.getState().workListFilter).toBe('approvals')
    })

    expect(useUiStore.getState().commandPaletteOpen).toBe(false)
    expect(useUiStore.getState().utilityPanelOpen).toBe(true)
    expect(useUiStore.getState().utilityTab).toBe('approvals')
    expect(useUiStore.getState().logFeedFilter).toBe('all')
    expect(screen.getByRole('button', { name: 'Cafe landing page build 승인 보기' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Docs export automation 로그 보기' })).not.toBeInTheDocument()

    act(() => {
      useUiStore.getState().setCommandPaletteOpen(true)
    })

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /작업 목록: 도구 실행만 보기/ }))

    await waitFor(() => {
      expect(useUiStore.getState().workListFilter).toBe('tools')
    })

    expect(useUiStore.getState().utilityPanelOpen).toBe(true)
    expect(useUiStore.getState().utilityTab).toBe('logs')
    expect(useUiStore.getState().logFeedFilter).toBe('tools')
    expect(screen.getByRole('button', { name: 'Docs export automation 로그 보기' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cafe landing page build 승인 보기' })).not.toBeInTheDocument()
    expect(screen.getByText('Tool result: Exported docs package.')).toBeInTheDocument()

    act(() => {
      useUiStore.getState().setCommandPaletteOpen(true)
    })

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /작업 목록: 첨부 세션만 보기/ }))

    await waitFor(() => {
      expect(useUiStore.getState().workListFilter).toBe('attachments')
    })

    expect(useUiStore.getState().utilityPanelOpen).toBe(true)
    expect(useUiStore.getState().utilityTab).toBe('logs')
    expect(useUiStore.getState().logFeedFilter).toBe('attachments')
    expect(screen.getByRole('button', { name: 'Attachment provenance review 로그 보기' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Docs export automation 로그 보기' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cafe landing page build 승인 보기' })).not.toBeInTheDocument()
    expect(screen.getByText('Attachment route: reference-brief.pdf -> native_document')).toBeInTheDocument()
    expect(screen.queryByText('Tool result: Exported docs package.')).not.toBeInTheDocument()
  })

  it('changes work list filters from global keyboard shortcuts', async () => {
    const snapshot = createSnapshot({
      sessions: [
        createSession({
          id: 'sess-001',
          title: 'Cafe landing page build',
          status: 'approval_pending',
          updatedAt: 'Just now',
          pinned: true,
          messageCount: 4,
          artifactCount: 1,
        }),
        createSession({
          id: 'sess-002',
          title: 'Docs export automation',
          status: 'active',
          model: 'gpt-5.4',
          updatedAt: '3m ago',
          messageCount: 2,
          artifactCount: 0,
        }),
        createSession({
          id: 'sess-003',
          title: 'Release incident follow-up',
          status: 'idle',
          model: 'gpt-5.4',
          updatedAt: '1m ago',
          messageCount: 3,
          artifactCount: 0,
        }),
        createSession({
          id: 'sess-004',
          title: 'Attachment provenance review',
          status: 'idle',
          model: 'claude-sonnet-4-6',
          updatedAt: '30s ago',
          messageCount: 2,
          artifactCount: 0,
        }),
      ],
      attachments: [
        {
          id: 'att-shortcut-001',
          sessionId: 'sess-004',
          kind: 'file',
          source: 'picker',
          status: 'sent',
          name: 'reference-brief.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 4096,
          sizeLabel: '4 KB',
          createdAt: 'Just now',
          messageId: 'msg-004',
          textContent: 'Attachment-specific review context.',
        },
      ],
      approvals: [
        {
          id: 'apv-001',
          sessionId: 'sess-001',
          action: 'Write src/components/Hero.tsx',
          detail: 'Apply the generated patch to the working tree.',
          capability: 'filesystem:write',
          risk: 'medium',
          status: 'pending',
          retryable: true,
          fallback: 'Keep the patch as an artifact only.',
          stepId: 'rs-5',
        },
      ],
      logs: [
        {
          id: 'log-tool-002',
          sessionId: 'sess-002',
          ts: '14:32:20',
          level: 'info',
          message: 'Tool result: Exported docs package.',
          kind: 'tool',
          status: 'success',
          toolName: 'write_file',
          stepId: 'step-002',
        },
        {
          id: 'log-approval-003',
          sessionId: 'sess-003',
          ts: '14:32:42',
          level: 'warn',
          message: 'Approval denied: Run deployment command',
          kind: 'approval',
          status: 'denied',
          capability: 'shell:execute',
          approvalId: 'apv-003',
          stepId: 'step-003',
        },
        {
          id: 'log-attachment-004',
          sessionId: 'sess-004',
          ts: '14:32:48',
          level: 'info',
          message: 'Attachment route: reference-brief.pdf -> native_document',
          kind: 'attachment',
          status: 'success',
          attachmentName: 'reference-brief.pdf',
          attachmentDeliveryMode: 'native_document',
          modelId: 'claude-sonnet-4-6',
          stepId: 'step-004',
        },
      ],
      messages: [
        { id: 'msg-001', sessionId: 'sess-001', role: 'user', content: 'Build a landing page for our cafe.', ts: 1 },
        { id: 'msg-002', sessionId: 'sess-002', role: 'user', content: 'Export docs into one package.', ts: 2 },
        { id: 'msg-003', sessionId: 'sess-003', role: 'user', content: 'Investigate the release incident.', ts: 3 },
        { id: 'msg-004', sessionId: 'sess-004', role: 'user', content: 'Review how the reference brief was routed.', ts: 4 },
      ],
    })

    installMockUsan({ snapshot })
    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cafe landing page build 승인 보기' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Docs export automation 로그 보기' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Release incident follow-up 로그 보기' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Attachment provenance review 로그 보기' })).toBeInTheDocument()
    })

    fireEvent.keyDown(window, { key: 'A', code: 'KeyA', ctrlKey: true, shiftKey: true })

    await waitFor(() => {
      expect(useUiStore.getState().workListFilter).toBe('approvals')
    })

    expect(useUiStore.getState().utilityTab).toBe('approvals')
    expect(useUiStore.getState().logFeedFilter).toBe('all')
    expect(screen.getByRole('button', { name: 'Cafe landing page build 승인 보기' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Docs export automation 로그 보기' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Release incident follow-up 로그 보기' })).not.toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'L', code: 'KeyL', ctrlKey: true, shiftKey: true })

    await waitFor(() => {
      expect(useUiStore.getState().workListFilter).toBe('tools')
    })

    expect(useUiStore.getState().utilityTab).toBe('logs')
    expect(useUiStore.getState().logFeedFilter).toBe('tools')
    expect(screen.queryByRole('button', { name: 'Cafe landing page build 승인 보기' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Docs export automation 로그 보기' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Release incident follow-up 로그 보기' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Attachment provenance review 로그 보기' })).not.toBeInTheDocument()
    expect(screen.getByText('Tool result: Exported docs package.')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'F', code: 'KeyF', ctrlKey: true, shiftKey: true })

    await waitFor(() => {
      expect(useUiStore.getState().workListFilter).toBe('attachments')
    })

    expect(useUiStore.getState().utilityTab).toBe('logs')
    expect(useUiStore.getState().logFeedFilter).toBe('attachments')
    expect(screen.queryByRole('button', { name: 'Cafe landing page build 승인 보기' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Docs export automation 로그 보기' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Release incident follow-up 로그 보기' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Attachment provenance review 로그 보기' })).toBeInTheDocument()
    expect(screen.getByText('Attachment route: reference-brief.pdf -> native_document')).toBeInTheDocument()
    expect(screen.queryByText('Tool result: Exported docs package.')).not.toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'E', code: 'KeyE', ctrlKey: true, shiftKey: true })

    await waitFor(() => {
      expect(useUiStore.getState().workListFilter).toBe('issues')
    })

    expect(useUiStore.getState().utilityTab).toBe('logs')
    expect(useUiStore.getState().logFeedFilter).toBe('issues')
    expect(screen.queryByRole('button', { name: 'Cafe landing page build 승인 보기' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Docs export automation 로그 보기' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Release incident follow-up 로그 보기' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Attachment provenance review 로그 보기' })).not.toBeInTheDocument()
    expect(screen.getByText('Approval denied: Run deployment command')).toBeInTheDocument()
    expect(screen.queryByText('Attachment route: reference-brief.pdf -> native_document')).not.toBeInTheDocument()

    fireEvent.keyDown(window, { key: ')', code: 'Digit0', ctrlKey: true, shiftKey: true })

    await waitFor(() => {
      expect(useUiStore.getState().workListFilter).toBe('all')
    })

    expect(useUiStore.getState().logFeedFilter).toBe('all')
    expect(screen.getByRole('button', { name: 'Cafe landing page build 승인 보기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Docs export automation 로그 보기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Release incident follow-up 로그 보기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Attachment provenance review 로그 보기' })).toBeInTheDocument()
    expect(screen.getByText('Tool result: Exported docs package.')).toBeInTheDocument()
    expect(screen.getByText('Attachment route: reference-brief.pdf -> native_document')).toBeInTheDocument()
  })

  it('opens approvals and logs directly from work list actions', async () => {
    const snapshot = createSnapshot({
      sessions: [
        createSession({
          id: 'sess-001',
          title: 'Cafe landing page build',
          status: 'approval_pending',
          updatedAt: 'Just now',
          pinned: true,
          messageCount: 4,
          artifactCount: 1,
        }),
        createSession({
          id: 'sess-002',
          title: 'Launch checklist review',
          status: 'idle',
          model: 'gpt-5.4',
          updatedAt: '5m ago',
          archivedAt: '1m ago',
          pinned: false,
          messageCount: 3,
          artifactCount: 0,
        }),
      ],
      approvals: [
        {
          id: 'apv-001',
          sessionId: 'sess-001',
          action: 'Write src/components/Hero.tsx',
          detail: 'Apply the generated patch to the working tree.',
          capability: 'filesystem:write',
          risk: 'medium',
          status: 'pending',
          retryable: true,
          fallback: 'Keep the patch as an artifact only.',
          stepId: 'rs-5',
        },
      ],
      logs: [
        {
          id: 'log-001',
          sessionId: 'sess-001',
          ts: '14:32:12',
          level: 'info',
          message: 'Tool result: Source palette patch stored',
          kind: 'tool',
          status: 'success',
          toolName: 'write_file',
          stepId: 'step-001',
        },
        {
          id: 'log-002',
          sessionId: 'sess-002',
          ts: '14:32:20',
          level: 'warn',
          message: 'Tool result: Execution skipped: approval denied for bash.',
          kind: 'tool',
          status: 'skipped',
          toolName: 'bash',
          stepId: 'step-002',
        },
      ],
      messages: [
        { id: 'msg-001', sessionId: 'sess-001', role: 'user', content: 'Build a landing page for our cafe.', ts: 1 },
        { id: 'msg-002', sessionId: 'sess-002', role: 'user', content: 'Review the launch checklist.', ts: 2 },
      ],
    })

    const api = installMockUsan({ snapshot })
    useUiStore.getState().setSessionHistoryOpen(true)

    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cafe landing page build 승인 보기' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Cafe landing page build 승인 보기' }))

    await waitFor(() => {
      expect(api.shell.setActiveSession).toHaveBeenCalledWith('sess-001')
    })

    expect(useUiStore.getState().utilityTab).toBe('approvals')
    expect(useUiStore.getState().logFeedFilter).toBe('all')

    fireEvent.click(screen.getByRole('button', { name: 'Launch checklist review 로그 보기' }))

    await waitFor(() => {
      expect(api.shell.restoreSession).toHaveBeenCalledWith('sess-002')
    })

    await waitFor(() => {
      expect(api.shell.setActiveSession).toHaveBeenCalledWith('sess-002')
    })

    expect(useUiStore.getState().utilityTab).toBe('logs')
    expect(useUiStore.getState().logFeedFilter).toBe('issues')
    expect(useShellStore.getState().activeSessionId).toBe('sess-002')
  })

  it('renders structured approval and tool metadata in the logs tab', async () => {
    const snapshot = createSnapshot({
      logs: [
        {
          id: 'log-approval-001',
          sessionId: 'sess-001',
          ts: '14:32:01',
          level: 'warn',
          message: 'Approval requested: Run deployment command',
          kind: 'approval',
          status: 'pending',
          capability: 'shell:execute',
          approvalId: 'apv-001',
          stepId: 'step-approval-001',
        },
        {
          id: 'log-tool-001',
          sessionId: 'sess-001',
          ts: '14:32:05',
          level: 'info',
          message: 'Tool result: 42 lines read',
          kind: 'tool',
          status: 'success',
          toolName: 'read_file',
          stepId: 'step-tool-001',
        },
        {
          id: 'log-attachment-001',
          sessionId: 'sess-001',
          ts: '14:32:08',
          level: 'info',
          message: 'Attachment route: route-log.png -> native_image',
          kind: 'attachment',
          status: 'success',
          attachmentName: 'route-log.png',
          attachmentDeliveryMode: 'native_image',
          modelId: 'gpt-5.4',
          stepId: 'step-attachment-001',
        },
      ],
      messages: [
        { id: 'msg-001', sessionId: 'sess-001', role: 'user', content: 'Review the current logs.', ts: 1 },
      ],
    })

    installMockUsan({ snapshot })
    useUiStore.getState().setUtilityTab('logs')

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Approval requested: Run deployment command')).toBeInTheDocument()
    })

    expect(screen.getByText('shell:execute')).toBeInTheDocument()
    expect(screen.getAllByText('read_file').length).toBeGreaterThan(0)
    expect(screen.getAllByText('route-log.png').length).toBeGreaterThan(0)
    expect(screen.getAllByText('gpt-5.4').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/native/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('shell:execute').length).toBeGreaterThan(0)
    expect(screen.getAllByText('완료').length).toBeGreaterThan(0)
  })

  it('shows attachment runtime log metadata in the work list summary', async () => {
    const snapshot = createSnapshot({
      logs: [
        {
          id: 'log-attachment-summary-001',
          sessionId: 'sess-001',
          ts: '14:32:08',
          level: 'info',
          message: 'Attachment route: route-log.png -> native_image',
          kind: 'attachment',
          status: 'success',
          attachmentName: 'route-log.png',
          attachmentDeliveryMode: 'native_image',
          modelId: 'gpt-5.4',
          stepId: 'step-attachment-summary-001',
        },
      ],
    })

    installMockUsan({ snapshot })
    render(<App />)

    await waitFor(() => {
      expect(document.querySelector('[data-shell-session-row="sess-001"]')).not.toBeNull()
    })

    const sessionRow = document.querySelector<HTMLButtonElement>('[data-shell-session-row="sess-001"]')
    expect(sessionRow).not.toBeNull()
    expect(within(sessionRow!).getByText('Attachment route: route-log.png -> native_image')).toBeInTheDocument()
    expect(within(sessionRow!).getByText('attachment')).toBeInTheDocument()
    expect(within(sessionRow!).getAllByText('route-log.png').length).toBeGreaterThan(0)
    expect(within(sessionRow!).getByText('gpt-5.4')).toBeInTheDocument()
    expect(within(sessionRow!).getAllByText(/native/).length).toBeGreaterThan(0)
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
    expect(screen.getAllByText(/Cafe landing page build/).length).toBeGreaterThan(0)
  })

  it('branches from a message and keeps only replay context up to that point', async () => {
    const snapshot = createSnapshot({
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
      attachments: [
        {
          id: 'att-before-branch',
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
        },
        {
          id: 'att-after-branch',
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
          textContent: 'This attachment should be trimmed out.',
        },
        {
          id: 'att-staged-branch',
          sessionId: 'sess-001',
          kind: 'image',
          source: 'clipboard',
          status: 'staged',
          name: 'scratch.png',
          mimeType: 'image/png',
          sizeBytes: 256,
          sizeLabel: '256 B',
          createdAt: 'Just now',
          dataUrl: 'data:image/png;base64,AA==',
        },
      ],
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
    })

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
    expect(useShellStore.getState().attachments.filter((attachment) => attachment.sessionId === 'sess-002')).toEqual([
      expect.objectContaining({
        name: 'brief.txt',
        messageId: 'msg-sess-002-3',
      }),
    ])
    expect(screen.getByText('Use a warmer palette and emphasize dessert cards.')).toBeInTheDocument()
    expect(screen.queryByText('Done. Preview is ready.')).not.toBeInTheDocument()
  })

  it('shows branch provenance and jumps back to the source session', async () => {
    const snapshot = createSnapshot({
      activeSessionId: 'sess-002',
      sessions: [
        createSession({
          id: 'sess-001',
          title: 'Cafe landing page build',
          status: 'idle',
          model: 'claude-sonnet-4-6',
          updatedAt: '2m ago',
          pinned: true,
          messageCount: 4,
          artifactCount: 1,
        }),
        createSession({
          id: 'sess-002',
          title: 'Cafe landing page build branch',
          status: 'active',
          model: 'gpt-5.4',
          updatedAt: '諛⑷툑',
          branchedFromSessionId: 'sess-001',
          branchedFromMessageId: 'msg-003',
          pinned: true,
          messageCount: 3,
          artifactCount: 0,
        }),
      ],
      messages: [
        { id: 'msg-001', sessionId: 'sess-001', role: 'user', content: 'Build a landing page for our cafe.', ts: 1 },
        { id: 'msg-002', sessionId: 'sess-001', role: 'assistant', content: 'I will start with the hero and menu sections.', ts: 2 },
        { id: 'msg-003', sessionId: 'sess-001', role: 'user', content: 'Use a warmer palette and emphasize dessert cards.', ts: 3 },
        { id: 'msg-sess-002-1', sessionId: 'sess-002', role: 'user', content: 'Build a landing page for our cafe.', ts: 1 },
        { id: 'msg-sess-002-2', sessionId: 'sess-002', role: 'assistant', content: 'I will start with the hero and menu sections.', ts: 2 },
        { id: 'msg-sess-002-3', sessionId: 'sess-002', role: 'user', content: 'Use a warmer palette and emphasize dessert cards.', ts: 3 },
      ],
    })

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
    const snapshot = createSnapshot({
      activeSessionId: 'sess-002',
      sessions: [
        createSession({
          id: 'sess-001',
          title: 'Cafe landing page build',
          status: 'idle',
          model: 'claude-sonnet-4-6',
          updatedAt: '2m ago',
          pinned: true,
          messageCount: 4,
          artifactCount: 1,
        }),
        createSession({
          id: 'sess-002',
          title: 'Cafe landing page build branch',
          status: 'active',
          model: 'gpt-5.4',
          updatedAt: '諛⑷툑',
          branchedFromSessionId: 'sess-001',
          branchedFromMessageId: 'msg-003',
          pinned: true,
          messageCount: 4,
          artifactCount: 0,
        }),
      ],
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
          createdAt: '諛⑷툑',
          size: '4 KB',
          version: 3,
          content: '# Branch artifact\n\nDessert cards are pushed higher with stronger imagery.',
        },
      ],
      approvals: [
        {
          id: 'approval-source-compare-001',
          sessionId: 'sess-001',
          action: 'Review palette patch',
          detail: 'Review the source patch before merge.',
          capability: 'filesystem:write',
          risk: 'medium',
          status: 'approved',
          retryable: true,
        },
        {
          id: 'approval-branch-compare-001',
          sessionId: 'sess-002',
          action: 'Run shell deployment check',
          detail: 'Run the branch deployment check.',
          capability: 'shell:execute',
          risk: 'high',
          status: 'denied',
          retryable: true,
          fallback: 'Skip the deployment check.',
        },
      ],
      logs: [
        {
          id: 'log-source-compare-001',
          sessionId: 'sess-001',
          ts: '14:32:10',
          level: 'info',
          message: 'Approval approved: Review palette patch',
          kind: 'approval',
          status: 'approved',
          capability: 'filesystem:write',
          approvalId: 'approval-source-compare-001',
          stepId: 'step-source-compare-001',
        },
        {
          id: 'log-source-compare-002',
          sessionId: 'sess-001',
          ts: '14:32:12',
          level: 'info',
          message: 'Tool result: Source palette patch stored',
          kind: 'tool',
          status: 'success',
          toolName: 'write_file',
          stepId: 'step-source-compare-002',
        },
        {
          id: 'log-source-compare-attachment-001',
          sessionId: 'sess-001',
          ts: '14:32:14',
          level: 'info',
          message: 'Attachment route: brief.pdf -> native_document',
          kind: 'attachment',
          status: 'success',
          attachmentName: 'brief.pdf',
          attachmentDeliveryMode: 'native_document',
          modelId: 'claude-sonnet-4-6',
          stepId: 'step-source-compare-attachment-001',
        },
        {
          id: 'log-branch-compare-001',
          sessionId: 'sess-002',
          ts: '14:32:18',
          level: 'warn',
          message: 'Approval denied: Run shell deployment check',
          kind: 'approval',
          status: 'denied',
          capability: 'shell:execute',
          approvalId: 'approval-branch-compare-001',
          stepId: 'step-branch-compare-001',
        },
        {
          id: 'log-branch-compare-002',
          sessionId: 'sess-002',
          ts: '14:32:20',
          level: 'warn',
          message: 'Tool result: Execution skipped: approval denied for bash.',
          kind: 'tool',
          status: 'skipped',
          toolName: 'bash',
          stepId: 'step-branch-compare-002',
        },
        {
          id: 'log-branch-compare-attachment-001',
          sessionId: 'sess-002',
          ts: '14:32:22',
          level: 'info',
          message: 'Attachment route: dessert-moodboard.png -> native_image',
          kind: 'attachment',
          status: 'success',
          attachmentName: 'dessert-moodboard.png',
          attachmentDeliveryMode: 'native_image',
          modelId: 'gpt-5.4',
          stepId: 'step-branch-compare-attachment-001',
        },
      ],
      attachments: [
        {
          id: 'attachment-source-compare-001',
          sessionId: 'sess-001',
          kind: 'file',
          source: 'picker',
          status: 'sent',
          name: 'brief.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 4096,
          sizeLabel: '4 KB',
          createdAt: '2m ago',
          messageId: 'msg-003',
          textContent: 'Source brief content with warm amber palette and compact dessert cards.',
        },
        {
          id: 'attachment-branch-compare-001',
          sessionId: 'sess-002',
          kind: 'image',
          source: 'clipboard',
          status: 'sent',
          name: 'dessert-moodboard.png',
          mimeType: 'image/png',
          sizeBytes: 6144,
          sizeLabel: '6 KB',
          createdAt: 'Just now',
          messageId: 'msg-sess-002-3',
          dataUrl: 'data:image/png;base64,AA==',
        },
        {
          id: 'attachment-branch-compare-002',
          sessionId: 'sess-002',
          kind: 'file',
          source: 'picker',
          status: 'staged',
          name: 'branch-notes.txt',
          mimeType: 'text/plain',
          sizeBytes: 512,
          sizeLabel: '512 B',
          createdAt: 'Just now',
          textContent: 'Branch attachment note with stronger imagery and dessert-first emphasis.',
        },
      ],
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
    })

    installMockUsan({ snapshot })
    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: '비교' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('tab', { name: '비교' }))

    expect(document.querySelector('[data-shell-tab="compare"]')).not.toBeNull()
    expect(screen.getByText('분기 비교')).toBeInTheDocument()
    expect(screen.getByText('원본 응답')).toBeInTheDocument()
    expect(screen.getByText('분기 응답')).toBeInTheDocument()
    expect(screen.getByText('source-preview')).toBeInTheDocument()
    expect(screen.getByText('승인 상태')).toBeInTheDocument()
    expect(screen.getByText('원본 승인')).toBeInTheDocument()
    expect(screen.getByText('분기 승인')).toBeInTheDocument()
    expect(screen.getByText('Review palette patch')).toBeInTheDocument()
    expect(screen.getByText('Run shell deployment check')).toBeInTheDocument()
    expect(screen.getByText('실행 로그')).toBeInTheDocument()
    expect(screen.getByText('원본 로그')).toBeInTheDocument()
    expect(screen.getByText('분기 로그')).toBeInTheDocument()
    expect(screen.getByText('Approval approved: Review palette patch')).toBeInTheDocument()
    expect(screen.getByText('Approval denied: Run shell deployment check')).toBeInTheDocument()
    expect(screen.getAllByText('write_file').length).toBeGreaterThan(0)
    expect(screen.getAllByText('bash').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Review palette patch').length).toBeGreaterThan(0)
    expect(screen.getAllByText('거부').length).toBeGreaterThan(0)
    expect(screen.getByText('source-preview')).toBeInTheDocument()
    expect(screen.getByText('branch-preview')).toBeInTheDocument()
    expect(screen.getAllByText('정상').length).toBeGreaterThan(0)
    expect(screen.getByText('branch-preview')).toBeInTheDocument()
    expect(screen.getAllByText('landing-plan.md').length).toBeGreaterThan(0)
    expect(document.querySelector('[data-compare-attachment="attachment-source-compare-001"]')).not.toBeNull()
    expect(document.querySelector('[data-compare-attachment="attachment-branch-compare-001"]')).not.toBeNull()
    expect(document.querySelector('[data-compare-attachment="attachment-branch-compare-002"]')).not.toBeNull()
    expect(screen.getAllByText('brief.pdf').length).toBeGreaterThan(1)
    expect(screen.getAllByText('dessert-moodboard.png').length).toBeGreaterThan(1)
    expect(screen.getByText('branch-notes.txt')).toBeInTheDocument()
    const sourceCompareBadge = document.querySelector('[data-attachment-delivery-context="compare"][data-attachment-delivery-name="brief.pdf"]')
    expect(sourceCompareBadge?.getAttribute('data-attachment-delivery-source')).toBe('runtime')
    expect(sourceCompareBadge?.getAttribute('data-attachment-delivery-mode')).toBe('native_document')
    expect(sourceCompareBadge?.getAttribute('data-attachment-delivery-model')).toBe('claude-sonnet-4-6')
    const branchCompareBadge = document.querySelector('[data-attachment-delivery-context="compare"][data-attachment-delivery-name="dessert-moodboard.png"]')
    expect(branchCompareBadge?.getAttribute('data-attachment-delivery-source')).toBe('runtime')
    expect(branchCompareBadge?.getAttribute('data-attachment-delivery-mode')).toBe('native_image')
    expect(branchCompareBadge?.getAttribute('data-attachment-delivery-model')).toBe('gpt-5.4')
    expect(screen.getAllByText(/Source brief content with warm amber palette/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Branch attachment note with stronger imagery/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Warm amber palette with compact dessert cards\./)).toBeInTheDocument()
    expect(screen.getByText(/Dessert cards are pushed higher with stronger imagery\./)).toBeInTheDocument()
    expect(screen.getByText('Original branch answer with warm amber palette.')).toBeInTheDocument()
    expect(screen.getByText('Compare branch answer with dessert cards pushed higher.')).toBeInTheDocument()
  })

  it('promotes a compare branch back into the main thread', async () => {
    const snapshot = createSnapshot({
      activeSessionId: 'sess-002',
      sessions: [
        createSession({
          id: 'sess-001',
          title: 'Cafe landing page build',
          status: 'idle',
          model: 'claude-sonnet-4-6',
          updatedAt: '2m ago',
          pinned: true,
          messageCount: 4,
          artifactCount: 0,
        }),
        createSession({
          id: 'sess-002',
          title: 'Cafe landing page build branch',
          status: 'active',
          model: 'gpt-5.4',
          updatedAt: '諛⑷툑',
          branchedFromSessionId: 'sess-001',
          branchedFromMessageId: 'msg-003',
          pinned: true,
          messageCount: 4,
          artifactCount: 0,
        }),
      ],
      attachments: [
        {
          id: 'attachment-source-promote-001',
          sessionId: 'sess-001',
          kind: 'file',
          source: 'picker',
          status: 'sent',
          name: 'source-brief.txt',
          mimeType: 'text/plain',
          sizeBytes: 128,
          sizeLabel: '128 B',
          createdAt: '2m ago',
          messageId: 'msg-003',
          textContent: 'Original source attachment that should be replaced on promote.',
        },
        {
          id: 'attachment-branch-promote-001',
          sessionId: 'sess-002',
          kind: 'file',
          source: 'picker',
          status: 'sent',
          name: 'branch-brief.txt',
          mimeType: 'text/plain',
          sizeBytes: 128,
          sizeLabel: '128 B',
          createdAt: 'Just now',
          messageId: 'msg-sess-002-3',
          textContent: 'Promoted shared-prefix attachment.',
        },
        {
          id: 'attachment-branch-promote-002',
          sessionId: 'sess-002',
          kind: 'file',
          source: 'picker',
          status: 'sent',
          name: 'branch-summary.md',
          mimeType: 'text/markdown',
          sizeBytes: 256,
          sizeLabel: '256 B',
          createdAt: 'Just now',
          messageId: 'msg-sess-002-4',
          textContent: 'Promoted attachment linked to the new branch message.',
        },
      ],
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
    })

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

    const promotedMessages = useShellStore.getState().messages.filter((message) => message.sessionId === 'sess-001')
    expect(useShellStore.getState().attachments.filter((attachment) => attachment.sessionId === 'sess-001')).toEqual([
      expect.objectContaining({
        name: 'branch-brief.txt',
        messageId: 'msg-003',
      }),
      expect.objectContaining({
        name: 'branch-summary.md',
        messageId: promotedMessages[3]?.id,
      }),
    ])
  })

  it('resolves approvals through the utility panel', async () => {
    const snapshot = createSnapshot({
      sessions: [
        createSession({
          id: 'sess-001',
          title: 'Cafe landing page build',
          status: 'approval_pending',
          updatedAt: 'Just now',
          pinned: true,
          messageCount: 4,
          artifactCount: 1,
        }),
      ],
      runSteps: [
        {
          id: 'rs-5',
          sessionId: 'sess-001',
          label: '?뚯씪 ?곌린',
          status: 'approval_needed',
          detail: 'src/components/Hero.tsx???곌린 沅뚰븳 ?꾩슂',
        },
      ],
      approvals: [
        {
          id: 'apv-001',
          sessionId: 'sess-001',
          action: 'Write src/components/Hero.tsx',
          detail: 'Apply the generated patch to the working tree.',
          capability: 'filesystem:write',
          risk: 'medium',
          status: 'pending',
          retryable: true,
          fallback: 'Keep the patch as an artifact only.',
          stepId: 'rs-5',
        },
      ],
      messages: [
        { id: 'msg-001', sessionId: 'sess-001', role: 'user', content: 'Build a landing page for our cafe.', ts: 1 },
      ],
    })

    const api = installMockUsan({ snapshot })
    render(<App />)

    await waitFor(() => {
      expect(screen.getAllByText('Write src/components/Hero.tsx').length).toBeGreaterThan(0)
    })

    expect(useUiStore.getState().utilityPanelOpen).toBe(true)
    expect(useUiStore.getState().utilityTab).toBe('approvals')

    const utilityPanel = document.querySelector('[data-shell-zone="utility-panel"]') as HTMLElement | null
    expect(utilityPanel).not.toBeNull()

    expect(within(utilityPanel!).getByText('capability: filesystem:write')).toBeInTheDocument()
    expect(within(utilityPanel!).getByText('거부 시 대안: Keep the patch as an artifact only.')).toBeInTheDocument()

    const approvalButtons = within(utilityPanel!).getAllByRole('button', { name: '승인' })
    fireEvent.click(approvalButtons[approvalButtons.length - 1]!)

    await waitFor(() => {
      expect(api.shell.resolveApproval).toHaveBeenCalledWith('apv-001', 'approved')
    })

    expect(useShellStore.getState().approvals.find((approval) => approval.id === 'apv-001')?.status).toBe('approved')
    expect(useShellStore.getState().runSteps.find((step) => step.id === 'rs-5')?.status).toBe('running')
    expect(useShellStore.getState().sessions.find((session) => session.id === 'sess-001')?.status).toBe('active')
  })

  it('resolves approvals directly from the workspace banner', async () => {
    const snapshot = createSnapshot({
      sessions: [
        createSession({
          id: 'sess-001',
          title: 'Cafe landing page build',
          status: 'approval_pending',
          updatedAt: 'Just now',
          pinned: true,
          messageCount: 4,
          artifactCount: 1,
        }),
      ],
      runSteps: [
        {
          id: 'rs-5',
          sessionId: 'sess-001',
          label: '?뚯씪 ?곌린',
          status: 'approval_needed',
          detail: 'src/components/Hero.tsx???곌린 沅뚰븳 ?꾩슂',
        },
      ],
      approvals: [
        {
          id: 'apv-001',
          sessionId: 'sess-001',
          action: 'Write src/components/Hero.tsx',
          detail: 'Apply the generated patch to the working tree.',
          capability: 'filesystem:write',
          risk: 'medium',
          status: 'pending',
          retryable: true,
          fallback: 'Keep the patch as an artifact only.',
          stepId: 'rs-5',
        },
      ],
      messages: [
        { id: 'msg-001', sessionId: 'sess-001', role: 'user', content: 'Build a landing page for our cafe.', ts: 1 },
      ],
    })

    const api = installMockUsan({ snapshot })
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText((content) => content.includes('승인 필요:') && content.includes('Write src/components/Hero.tsx'))).toBeInTheDocument()
    })

    expect(screen.getAllByText('Apply the generated patch to the working tree.').length).toBeGreaterThan(0)
    expect(screen.getAllByText('filesystem:write').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: '워크스페이스 승인 거부' }))

    await waitFor(() => {
      expect(api.shell.resolveApproval).toHaveBeenCalledWith('apv-001', 'denied')
    })

    expect(useShellStore.getState().approvals.find((approval) => approval.id === 'apv-001')?.status).toBe('denied')
    expect(useShellStore.getState().runSteps.find((step) => step.id === 'rs-5')?.status).toBe('skipped')
    expect(useShellStore.getState().sessions.find((session) => session.id === 'sess-001')?.status).toBe('active')
  })
})




