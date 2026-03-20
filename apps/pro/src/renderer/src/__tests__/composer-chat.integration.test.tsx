import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '@renderer/App'
import { useChatStore } from '@renderer/stores/chat.store'
import { useShellStore } from '@renderer/stores/shell.store'
import { useUiStore } from '@renderer/stores/ui.store'
import { installMockUsan } from '@renderer/test/mockUsan'
import { resetStores } from '@renderer/test/resetStores'
import { DEFAULT_APP_SETTINGS, type ChatPayload } from '@shared/types'

vi.mock('@renderer/utils/attachmentText', async () => {
  const actual = await vi.importActual<typeof import('@renderer/utils/attachmentText')>('@renderer/utils/attachmentText')

  return {
    ...actual,
    extractAttachmentText: vi.fn(async (file: File) => {
      if (file.name === 'brief.pdf') {
        return '[Page 1]\nLaunch plan\n\n[Page 2]\nBudget review'
      }

      return actual.extractAttachmentText(file)
    }),
  }
})

describe('Composer chat integration', () => {
  beforeEach(() => {
    resetStores()
  })

  it('sends session context and persists main-owned shell updates from streamed chunks', async () => {
    const api = installMockUsan()

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Build a landing page for our cafe.')).toBeInTheDocument()
    })

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Summarize the integration plan.' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(api.ai.chat).toHaveBeenCalledTimes(1)
    })

    const payload = api.ai.chat.mock.calls[0][0] as ChatPayload
    expect(payload).toMatchObject({
      sessionId: 'sess-001',
      model: 'claude-sonnet-4-6',
      useTools: true,
      userMessage: {
        content: 'Summarize the integration plan.',
      },
    })
    expect(payload.messages).toEqual([
      { role: 'user', content: 'Build a landing page for our cafe.' },
      { role: 'user', content: 'Summarize the integration plan.' },
    ])

    await waitFor(() => {
      const shellState = useShellStore.getState()
      expect(shellState.messages.some((message) => message.id === payload.userMessage.id)).toBe(true)
      expect(shellState.runSteps.some((step) => step.id === `step-${payload.requestId}` && step.status === 'running')).toBe(true)
    })

    expect(screen.getByText('Summarize the integration plan.')).toBeInTheDocument()

    await act(async () => {
      api.emitChunk({
        requestId: payload.requestId,
        type: 'tool_call',
        toolCall: {
          id: 'tool-1',
          name: 'read_file',
          input: { path: 'src/App.tsx' },
        },
      })
      api.emitChunk({
        requestId: payload.requestId,
        type: 'tool_result',
        toolResult: {
          id: 'tool-1',
          result: '42 lines read',
        },
      })
      api.emitChunk({
        requestId: payload.requestId,
        type: 'text_delta',
        text: 'First I will wire the IPC boundary and session persistence.',
      })
    })

    expect(screen.getByText('First I will wire the IPC boundary and session persistence.')).toBeInTheDocument()

    await act(async () => {
      api.emitChunk({
        requestId: payload.requestId,
        type: 'done',
      })
    })

    await waitFor(() => {
      expect(screen.getByText('First I will wire the IPC boundary and session persistence.')).toBeInTheDocument()
    })

    await waitFor(() => {
      const shellState = useShellStore.getState()
      expect(shellState.runSteps.some((step) => step.id === `step-${payload.requestId}` && step.status === 'success')).toBe(true)
      expect(shellState.runSteps.some((step) => step.label === 'Run tool: read_file' && step.status === 'success')).toBe(true)
      expect(shellState.logs.some((log) => log.message.includes('Tool call: read_file'))).toBe(true)
      expect(shellState.logs.some((log) => log.message.includes('Response completed'))).toBe(true)
      expect(shellState.artifacts.some((artifact) => artifact.id === `artifact-${payload.requestId}` && artifact.kind === 'markdown')).toBe(true)
      expect(shellState.sessions.find((session) => session.id === 'sess-001')?.status).toBe('active')
    })
  })

  it('stages a pasted image attachment, sends it, and binds it to the user message', async () => {
    const api = installMockUsan()

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Build a landing page for our cafe.')).toBeInTheDocument()
    })

    const input = screen.getByRole('textbox')
    const imageFile = new File(['image-bytes'], 'mock.png', { type: 'image/png' })

    fireEvent.paste(input, {
      clipboardData: {
        items: [
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => imageFile,
          },
        ],
      },
    })

    await waitFor(() => {
      expect(document.querySelector('[data-composer-attachments="staged"]')).not.toBeNull()
      expect(screen.getByText('mock.png')).toBeInTheDocument()
    })

    fireEvent.change(input, { target: { value: 'Check this screenshot and suggest fixes.' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(api.ai.chat).toHaveBeenCalledTimes(1)
    })

    const payload = api.ai.chat.mock.calls[0][0] as ChatPayload
    expect(payload.attachments).toHaveLength(1)
    expect(payload.attachments?.[0]).toMatchObject({
      name: 'mock.png',
      kind: 'image',
      source: 'clipboard',
      status: 'staged',
    })
    expect(payload.messages.at(-1)?.content).toContain('[Attachments]')
    expect(payload.messages.at(-1)?.content).toContain('mock.png')

    await waitFor(() => {
      const shellState = useShellStore.getState()
      expect(shellState.attachments.some((attachment) => (
        attachment.name === 'mock.png'
        && attachment.status === 'sent'
        && attachment.messageId === payload.userMessage.id
      ))).toBe(true)
    })

    await waitFor(() => {
      expect(document.querySelector('[data-composer-attachments="staged"]')).toBeNull()
    })
  })

  it('extracts text from supported file attachments and includes it in payload metadata', async () => {
    const api = installMockUsan()

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Build a landing page for our cafe.')).toBeInTheDocument()
    })

    const fileInput = document.querySelector('input[type="file"]:not([accept])') as HTMLInputElement | null
    expect(fileInput).not.toBeNull()

    const textFile = new File(['# Notes\nLaunch checklist'], 'notes.md', { type: 'text/markdown' })

    fireEvent.change(fileInput!, {
      target: {
        files: [textFile],
      },
    })

    await waitFor(() => {
      expect(screen.getByText('notes.md')).toBeInTheDocument()
    })
    expect(document.querySelector('[data-composer-attachment-text-preview="notes.md"]')?.textContent).toContain('Launch checklist')
    expect(document.querySelector('[data-attachment-delivery-context="composer"][data-attachment-delivery-name="notes.md"]')?.textContent).toContain('텍스트 추출')
    fireEvent.click(document.querySelector('[data-composer-attachment-text-toggle="notes.md"]') as HTMLButtonElement)
    expect(document.querySelector('[data-composer-attachment-text-content="notes.md"]')?.textContent).toContain('# Notes')

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Summarize this note.' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(api.ai.chat).toHaveBeenCalledTimes(1)
    })

    const payload = api.ai.chat.mock.calls[0][0] as ChatPayload
    expect(payload.attachments?.[0]).toMatchObject({
      name: 'notes.md',
      kind: 'file',
      dataUrl: expect.stringContaining('data:text/markdown;base64,'),
      textContent: '# Notes\nLaunch checklist',
    })

    await waitFor(() => {
      expect(document.querySelector('[data-message-attachment-text-preview="notes.md"]')?.textContent).toContain('Launch checklist')
    })
    expect(document.querySelector('[data-attachment-delivery-context="message"][data-attachment-delivery-name="notes.md"]')?.textContent).toContain('텍스트 추출')
    fireEvent.click(document.querySelector('[data-message-attachment-text-toggle="notes.md"]') as HTMLButtonElement)
    expect(document.querySelector('[data-message-attachment-text-content="notes.md"]')?.textContent).toContain('# Notes')
  })

  it('extracts text from pdf attachments and includes it in payload metadata', async () => {
    const api = installMockUsan()

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Build a landing page for our cafe.')).toBeInTheDocument()
    })

    const fileInput = document.querySelector('input[type="file"]:not([accept])') as HTMLInputElement | null
    expect(fileInput).not.toBeNull()

    const pdfFile = new File(['%PDF-1.7'], 'brief.pdf', { type: 'application/pdf' })

    fireEvent.change(fileInput!, {
      target: {
        files: [pdfFile],
      },
    })

    await waitFor(() => {
      expect(screen.getByText('brief.pdf')).toBeInTheDocument()
    })
    expect(document.querySelector('[data-composer-attachment-text-preview="brief.pdf"]')?.textContent).toContain('Launch plan')
    expect(document.querySelector('[data-attachment-delivery-context="composer"][data-attachment-delivery-name="brief.pdf"]')?.textContent).toContain('Anthropic 문서')

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Summarize this PDF.' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(api.ai.chat).toHaveBeenCalledTimes(1)
    })

    const payload = api.ai.chat.mock.calls[0][0] as ChatPayload
    expect(payload.attachments?.[0]).toMatchObject({
      name: 'brief.pdf',
      kind: 'file',
      dataUrl: expect.stringContaining('data:application/pdf;base64,'),
      textContent: '[Page 1]\nLaunch plan\n\n[Page 2]\nBudget review',
    })

    await waitFor(() => {
      expect(document.querySelector('[data-message-attachment-text-preview="brief.pdf"]')?.textContent).toContain('Launch plan')
    })
  })

  it('preserves raw bytes for supported rich document attachments', async () => {
    const api = installMockUsan()

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Build a landing page for our cafe.')).toBeInTheDocument()
    })

    const fileInput = document.querySelector('input[type="file"]:not([accept])') as HTMLInputElement | null
    expect(fileInput).not.toBeNull()

    const docxFile = new File(['docx-bytes'], 'brief.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })

    fireEvent.change(fileInput!, {
      target: {
        files: [docxFile],
      },
    })

    await waitFor(() => {
      expect(screen.getByText('brief.docx')).toBeInTheDocument()
    })
    expect(document.querySelector('[data-composer-attachment-text-preview="brief.docx"]')).toBeNull()

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'Summarize this brief.' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(api.ai.chat).toHaveBeenCalledTimes(1)
    })

    const payload = api.ai.chat.mock.calls[0][0] as ChatPayload
    expect(payload.attachments?.[0]).toMatchObject({
      name: 'brief.docx',
      kind: 'file',
      dataUrl: expect.stringContaining('data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,'),
      textContent: undefined,
    })
  })

  it('blocks send when the selected model provider key is missing and routes to settings', async () => {
    const api = installMockUsan({
      settings: {
        ...DEFAULT_APP_SETTINGS,
        defaultModel: 'gpt-5.4',
      },
      secrets: {
        encryptionAvailable: true,
        providers: [
          { provider: 'anthropic', configured: true, source: 'secure_store' },
          { provider: 'openai', configured: false, source: 'none' },
          { provider: 'google', configured: true, source: 'secure_store' },
        ],
      },
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Build a landing page for our cafe.')).toBeInTheDocument()
      expect(document.querySelector('[data-composer-provider-warning="openai"]')).not.toBeNull()
    })

    const input = screen.getByRole('textbox')
    const sendButton = screen.getByRole('button', { name: '전송' })

    fireEvent.change(input, { target: { value: 'Summarize the integration plan.' } })

    await waitFor(() => {
      expect(sendButton).toBeDisabled()
    })

    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(useChatStore.getState().error).toContain('OpenAI API 키가 설정되지 않아')
    })

    expect(api.ai.chat).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '설정 열기' }))

    await waitFor(() => {
      expect(useUiStore.getState().view).toBe('settings')
    })
  })

  it('includes sent attachments on historical messages in the next request payload', async () => {
    const api = installMockUsan()

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Build a landing page for our cafe.')).toBeInTheDocument()
    })

    const input = screen.getByRole('textbox')
    const imageFile = new File(['image-bytes'], 'history.png', { type: 'image/png' })

    fireEvent.paste(input, {
      clipboardData: {
        items: [
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => imageFile,
          },
        ],
      },
    })

    await waitFor(() => {
      expect(screen.getByText('history.png')).toBeInTheDocument()
    })

    fireEvent.change(input, { target: { value: 'Review this screenshot.' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(api.ai.chat).toHaveBeenCalledTimes(1)
    })

    const firstPayload = api.ai.chat.mock.calls[0][0] as ChatPayload

    await waitFor(() => {
      const shellState = useShellStore.getState()
      expect(shellState.attachments.some((attachment) => (
        attachment.name === 'history.png'
        && attachment.status === 'sent'
        && attachment.messageId === firstPayload.userMessage.id
      ))).toBe(true)
    })

    await act(async () => {
      api.emitChunk({
        requestId: firstPayload.requestId,
        type: 'done',
      })
    })

    fireEvent.change(input, { target: { value: 'Compare it with the earlier screenshot.' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(api.ai.chat).toHaveBeenCalledTimes(2)
    })

    const secondPayload = api.ai.chat.mock.calls[1][0] as ChatPayload
    expect(secondPayload.messages[1]).toMatchObject({
      role: 'user',
      content: expect.stringContaining('Review this screenshot.'),
      attachments: [
        expect.objectContaining({
          name: 'history.png',
          status: 'sent',
          messageId: firstPayload.userMessage.id,
        }),
      ],
    })
  })
})
