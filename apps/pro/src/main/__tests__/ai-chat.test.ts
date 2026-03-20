// @vitest-environment node

import type Anthropic from '@anthropic-ai/sdk'
import type { ChatPayload, ShellSnapshot } from '@shared/types'
import type { WebContents } from 'electron'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { handleChat, resolveToolApproval, stopStream } from '../ai-chat'
import { initializeShellState, resetShellStateForTests, resolveShellApproval, getShellSnapshot } from '../platform/shell-state'
import {
  initializeSecretStore,
  resetSecretStoreForTests,
  setProviderSecret,
  setSecretStoreCryptoAdapterForTests,
} from '../platform/secret-store'

const { executeToolMock, anthropicResponses, anthropicStreamCalls } = vi.hoisted(() => ({
  executeToolMock: vi.fn(),
  anthropicResponses: [] as Array<{ text?: string; finalMessage: unknown }>,
  anthropicStreamCalls: [] as unknown[],
}))
const tempDirs: string[] = []

vi.mock('../tools/index', async () => {
  const actual = await vi.importActual<typeof import('../tools/index')>('../tools/index')
  return {
    ...actual,
    executeTool: executeToolMock,
  }
})

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = {
      stream: vi.fn((params: unknown) => {
        anthropicStreamCalls.push(params)
        const response = anthropicResponses.shift()
        if (!response) {
          throw new Error('No mocked Anthropic response available')
        }

        const stream = {
          on: (event: string, callback: (text: string) => void) => {
            if (event === 'text' && response.text) {
              callback(response.text)
            }
            return stream
          },
          finalMessage: async () => response.finalMessage,
        }

        return stream
      }),
    }
  }

  return { default: MockAnthropic }
})

function createTempShellStateFile(): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'usan-ai-chat-'))
  tempDirs.push(tempDir)
  return join(tempDir, 'shell-state.json')
}

function createTempSecretStoreFile(): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'usan-secret-store-'))
  tempDirs.push(tempDir)
  return join(tempDir, 'provider-secrets.json')
}

function createPayload(overrides: Partial<ChatPayload> = {}): ChatPayload {
  return {
    requestId: 'req-001',
    sessionId: 'sess-001',
    userMessage: {
      id: 'msg-user-001',
      content: 'Run a shell command if needed.',
      ts: 1234567890,
    },
    messages: [
      {
        role: 'user',
        content: 'Run a shell command if needed.',
      },
    ],
    model: 'claude-sonnet-4-6',
    useTools: true,
    ...overrides,
  }
}

function createImageAttachment() {
  return {
    id: 'attachment-001',
    sessionId: 'sess-001',
    kind: 'image',
    source: 'picker',
    status: 'sent',
    name: 'mock.png',
    mimeType: 'image/png',
    sizeBytes: 4,
    sizeLabel: '4 B',
    createdAt: '방금',
    dataUrl: 'data:image/png;base64,AAAA',
  } as const
}

function createTextAttachment(
  overrides: Partial<{
    id: string
    sessionId: string
    kind: 'file'
    source: 'picker'
    status: 'sent'
    name: string
    mimeType: string
    sizeBytes: number
    sizeLabel: string
    createdAt: string
    dataUrl?: string
    textContent?: string
  }> = {},
) {
  return {
    id: 'attachment-text-001',
    sessionId: 'sess-001',
    kind: 'file',
    source: 'picker',
    status: 'sent',
    name: 'notes.md',
    mimeType: 'text/markdown',
    sizeBytes: 24,
    sizeLabel: '24 B',
    createdAt: '방금',
    dataUrl: 'data:text/markdown;base64,IyBOb3RlcwpMYXVuY2ggY2hlY2tsaXN0',
    textContent: '# Notes\nLaunch checklist',
    ...overrides,
  } as const
}

function createPdfAttachment() {
  return {
    id: 'attachment-pdf-001',
    sessionId: 'sess-001',
    kind: 'file',
    source: 'picker',
    status: 'sent',
    name: 'brief.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 128,
    sizeLabel: '128 B',
    createdAt: '諛⑷툑',
    dataUrl: 'data:application/pdf;base64,UEZERGF0YQ==',
    textContent: '[Page 1]\nLaunch plan',
  } as const
}

function createDocxAttachment() {
  return {
    id: 'attachment-docx-001',
    sessionId: 'sess-001',
    kind: 'file',
    source: 'picker',
    status: 'sent',
    name: 'brief.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sizeBytes: 256,
    sizeLabel: '256 B',
    createdAt: '諛⑷툑',
    dataUrl: 'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,RE9DWERBVEE=',
  } as const
}

function createSender() {
  return {
    send: vi.fn<(channel: string, ...args: unknown[]) => void>(),
    isDestroyed: vi.fn(() => false),
  }
}

function createBroadcastCollector(): {
  broadcast: (snapshot: ShellSnapshot) => void
  snapshots: ShellSnapshot[]
} {
  const snapshots: ShellSnapshot[] = []
  return {
    snapshots,
    broadcast: (snapshot) => {
      snapshots.push(snapshot)
    },
  }
}

function createToolUseMessage(
  name = 'bash',
  input: Record<string, unknown> = { command: 'echo hello' },
): Anthropic.Messages.Message {
  return {
    id: 'msg-anthropic-tool',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-6',
    stop_reason: 'tool_use',
    stop_sequence: null,
    usage: {
      input_tokens: 10,
      output_tokens: 20,
    },
    content: [
      {
        type: 'tool_use',
        id: 'tool-001',
        name,
        input,
      },
    ],
  } as unknown as Anthropic.Messages.Message
}

function createDoneMessage(): Anthropic.Messages.Message {
  return {
    id: 'msg-anthropic-done',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-4-6',
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: 20,
      output_tokens: 30,
    },
    content: [
      {
        type: 'text',
        text: 'Command complete.',
      },
    ],
  } as unknown as Anthropic.Messages.Message
}

function createSseResponse(frames: string[]): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) {
        controller.enqueue(encoder.encode(frame))
      }
      controller.close()
    },
  })

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
    },
  })
}

afterEach(() => {
  resetShellStateForTests()
  resetSecretStoreForTests()
  anthropicResponses.length = 0
  anthropicStreamCalls.length = 0
  executeToolMock.mockReset()
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.OPENAI_API_KEY
  delete process.env.GEMINI_API_KEY
  vi.unstubAllGlobals()
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true })
  }
})

describe('ai-chat approval gating', () => {
  it('waits for approval before running bash and resumes after approval', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    initializeShellState(createTempShellStateFile())
    executeToolMock.mockResolvedValue('hello')
    anthropicResponses.push(
      { finalMessage: createToolUseMessage() },
      { text: 'Command complete.', finalMessage: createDoneMessage() },
    )

    const sender = createSender()
    const { broadcast, snapshots } = createBroadcastCollector()
    const chatPromise = handleChat(sender as unknown as WebContents, createPayload(), broadcast)

    await vi.waitFor(() => {
      expect(getShellSnapshot().approvals.some((item) => item.id === 'approval-req-001-1')).toBe(true)
    })

    const approval = getShellSnapshot().approvals.find((item) => item.id === 'approval-req-001-1')
    expect(approval?.status).toBe('pending')
    expect(getShellSnapshot().sessions.find((session) => session.id === 'sess-001')?.status).toBe('approval_pending')
    expect(getShellSnapshot().logs).toContainEqual(expect.objectContaining({
      approvalId: 'approval-req-001-1',
      kind: 'approval',
      status: 'pending',
      capability: 'shell:execute',
      stepId: 'step-req-001-tool-1',
      message: expect.stringContaining('Approval requested'),
    }))
    expect(executeToolMock).not.toHaveBeenCalled()

    resolveShellApproval(approval!.id, 'approved')
    resolveToolApproval(approval!.id, 'approved')

    await chatPromise

    expect(executeToolMock).toHaveBeenCalledWith('bash', { command: 'echo hello' })
    expect(getShellSnapshot().approvals.find((item) => item.id === approval!.id)?.status).toBe('approved')
    expect(getShellSnapshot().sessions.find((session) => session.id === 'sess-001')?.status).toBe('active')
    expect(getShellSnapshot().runSteps.find((step) => step.id === 'step-req-001-tool-1')?.status).toBe('success')
    expect(getShellSnapshot().logs).toContainEqual(expect.objectContaining({
      kind: 'tool',
      status: 'success',
      toolName: 'bash',
      stepId: 'step-req-001-tool-1',
      message: expect.stringContaining('Tool result'),
    }))
    expect(sender.send).toHaveBeenCalledWith('ai:chunk', expect.objectContaining({ type: 'tool_call' }))
    expect(sender.send).toHaveBeenCalledWith('ai:chunk', expect.objectContaining({ type: 'tool_result' }))
    expect(sender.send).toHaveBeenCalledWith('ai:chunk', expect.objectContaining({ type: 'done' }))
    expect(snapshots.some((snapshot) => snapshot.approvals.some((item) => item.id === approval!.id && item.status === 'pending'))).toBe(true)
  })

  it('skips bash execution when approval is denied and returns fallback tool output', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    initializeShellState(createTempShellStateFile())
    anthropicResponses.push(
      { finalMessage: createToolUseMessage() },
      { text: 'Handled without running the command.', finalMessage: createDoneMessage() },
    )

    const sender = createSender()
    const { broadcast } = createBroadcastCollector()
    const chatPromise = handleChat(sender as unknown as WebContents, createPayload(), broadcast)

    await vi.waitFor(() => {
      expect(getShellSnapshot().approvals.some((item) => item.id === 'approval-req-001-1')).toBe(true)
    })

    const approval = getShellSnapshot().approvals.find((item) => item.id === 'approval-req-001-1')
    resolveShellApproval(approval!.id, 'denied')
    resolveToolApproval(approval!.id, 'denied')

    await chatPromise

    expect(executeToolMock).not.toHaveBeenCalled()
    expect(getShellSnapshot().approvals.find((item) => item.id === approval!.id)?.status).toBe('denied')
    expect(getShellSnapshot().runSteps.find((step) => step.id === 'step-req-001-tool-1')?.status).toBe('skipped')
    expect(sender.send).toHaveBeenCalledWith('ai:chunk', expect.objectContaining({
      type: 'tool_result',
      toolResult: expect.objectContaining({
        id: 'tool-001',
        result: expect.stringContaining('Execution skipped: approval denied for bash.'),
      }),
    }))
    expect(sender.send).toHaveBeenCalledWith('ai:chunk', expect.objectContaining({ type: 'done' }))
  })

  it('cleans up pending approvals when the request is stopped during approval wait', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    initializeShellState(createTempShellStateFile())
    anthropicResponses.push({ finalMessage: createToolUseMessage() })

    const sender = createSender()
    const { broadcast } = createBroadcastCollector()
    const chatPromise = handleChat(sender as unknown as WebContents, createPayload(), broadcast)

    await vi.waitFor(() => {
      expect(getShellSnapshot().approvals.some((item) => item.id === 'approval-req-001-1')).toBe(true)
    })

    stopStream('req-001')
    await chatPromise

    const approval = getShellSnapshot().approvals.find((item) => item.id === 'approval-req-001-1')
    expect(approval?.status).toBe('denied')
    expect(executeToolMock).not.toHaveBeenCalled()
    expect(getShellSnapshot().sessions.find((session) => session.id === 'sess-001')?.status).toBe('active')
    expect(getShellSnapshot().runSteps.find((step) => step.id === 'step-req-001')?.status).toBe('skipped')
    expect(getShellSnapshot().runSteps.find((step) => step.id === 'step-req-001-tool-1')?.status).toBe('skipped')
    expect(getShellSnapshot().logs).toContainEqual(expect.objectContaining({
      approvalId: 'approval-req-001-1',
      kind: 'approval',
      status: 'denied',
      capability: 'shell:execute',
      stepId: 'step-req-001-tool-1',
      message: expect.stringContaining('Approval denied'),
    }))
    expect(sender.send).toHaveBeenCalledWith('ai:chunk', expect.objectContaining({ type: 'tool_call' }))
    expect(sender.send).toHaveBeenCalledWith('ai:chunk', expect.objectContaining({ type: 'done' }))
    expect(
      sender.send.mock.calls.some((call: unknown[]) => call[1] && (call[1] as { type?: string }).type === 'tool_result'),
    ).toBe(false)
  })

  it('requires approval for write_file and persists the file after approval', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    initializeShellState(createTempShellStateFile())
    const outputDir = mkdtempSync(join(tmpdir(), 'usan-ai-chat-write-'))
    tempDirs.push(outputDir)
    const outputPath = join(outputDir, 'note.txt')
    executeToolMock.mockImplementation(async (name, input) => {
      if (name === 'write_file') {
        writeFileSync(String((input as { path: string }).path), String((input as { content: string }).content), 'utf8')
        return `Wrote 11 bytes to ${String((input as { path: string }).path)}`
      }

      return 'unexpected tool'
    })
    anthropicResponses.push(
      {
        finalMessage: createToolUseMessage('write_file', {
          path: outputPath,
          content: 'hello world',
        }),
      },
      { text: 'Saved the file.', finalMessage: createDoneMessage() },
    )

    const sender = createSender()
    const { broadcast } = createBroadcastCollector()
    const chatPromise = handleChat(sender as unknown as WebContents, createPayload(), broadcast)

    await vi.waitFor(() => {
      expect(getShellSnapshot().approvals.some((item) => item.id === 'approval-req-001-1')).toBe(true)
    })

    const approval = getShellSnapshot().approvals.find((item) => item.id === 'approval-req-001-1')
    expect(approval?.capability).toBe('filesystem:write')
    expect(approval?.action).toContain(outputPath)
    expect(getShellSnapshot().logs).toContainEqual(expect.objectContaining({
      approvalId: 'approval-req-001-1',
      kind: 'approval',
      status: 'pending',
      capability: 'filesystem:write',
      message: expect.stringContaining('Approval requested'),
    }))

    resolveShellApproval(approval!.id, 'approved')
    resolveToolApproval(approval!.id, 'approved')

    await chatPromise

    expect(readFileSync(outputPath, 'utf8')).toBe('hello world')
    expect(executeToolMock).toHaveBeenCalledWith('write_file', {
      path: outputPath,
      content: 'hello world',
    })
    expect(getShellSnapshot().logs).toContainEqual(expect.objectContaining({
      kind: 'tool',
      status: 'success',
      toolName: 'write_file',
      message: expect.stringContaining('Wrote 11 bytes'),
    }))
  })

  it('streams OpenAI responses through the provider adapter boundary', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    initializeShellState(createTempShellStateFile())
    const fetchMock = vi.fn().mockResolvedValue(
      createSseResponse([
        'data: {"choices":[{"delta":{"content":"Hello "}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"from GPT"}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)

    const sender = createSender()
    const { broadcast } = createBroadcastCollector()
    const payload = {
      ...createPayload(),
      model: 'gpt-5.4',
      useTools: false,
    }

    await handleChat(sender as unknown as WebContents, payload, broadcast)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        signal: expect.any(AbortSignal),
      }),
    )
    expect(sender.send).toHaveBeenCalledWith('ai:chunk', expect.objectContaining({
      type: 'text_delta',
      text: 'Hello ',
    }))
    expect(sender.send).toHaveBeenCalledWith('ai:chunk', expect.objectContaining({
      type: 'text_delta',
      text: 'from GPT',
    }))
    expect(sender.send).toHaveBeenCalledWith('ai:chunk', expect.objectContaining({ type: 'done' }))
    expect(getShellSnapshot().messages.find((message) => (
      message.id === 'msg-req-001-assistant'
    ))?.content).toBe('Hello from GPT')
  })

  it('uses a securely stored OpenAI key when environment variables are missing', async () => {
    initializeShellState(createTempShellStateFile())
    setSecretStoreCryptoAdapterForTests({
      isEncryptionAvailable: () => true,
      encryptString: (value) => Buffer.from(`enc:${value}`, 'utf8'),
      decryptString: (value) => value.toString('utf8').replace(/^enc:/, ''),
    })
    initializeSecretStore(createTempSecretStoreFile())
    setProviderSecret('openai', 'stored-openai-key')

    const fetchMock = vi.fn().mockResolvedValue(
      createSseResponse([
        'data: {"choices":[{"delta":{"content":"Hello from secure storage"}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)

    const sender = createSender()
    const { broadcast } = createBroadcastCollector()
    const payload = {
      ...createPayload(),
      model: 'gpt-5.4',
      useTools: false,
    }

    await handleChat(sender as unknown as WebContents, payload, broadcast)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer stored-openai-key',
        }),
      }),
    )
  })

  it('sends image attachments to OpenAI as image_url content parts', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    initializeShellState(createTempShellStateFile())
    const fetchMock = vi.fn().mockResolvedValue(
      createSseResponse([
        'data: {"choices":[{"delta":{"content":"Analyzed image."}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)

    const sender = createSender()
    const { broadcast } = createBroadcastCollector()

    await handleChat(
      sender as unknown as WebContents,
      createPayload({
        model: 'gpt-5.4',
        useTools: false,
        userMessage: {
          id: 'msg-user-001',
          content: 'Describe the attached image.',
          ts: 1234567890,
        },
        messages: [
          {
            role: 'user',
            content: 'Describe the attached image.\n\n[Attachments]\n- mock.png (image, 4 B)',
          },
        ],
        attachments: [createImageAttachment()],
      }),
      broadcast,
    )

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(requestBody.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe the attached image.' },
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,AAAA' },
          },
        ],
      },
    ])
  })

  it('appends attachment routing logs when a request starts', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    initializeShellState(createTempShellStateFile())
    const fetchMock = vi.fn().mockResolvedValue(
      createSseResponse([
        'data: {"choices":[{"delta":{"content":"Logged routes."}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)

    const sender = createSender()
    const { broadcast } = createBroadcastCollector()

    await handleChat(
      sender as unknown as WebContents,
      createPayload({
        model: 'gpt-5.4',
        useTools: false,
        userMessage: {
          id: 'msg-user-001',
          content: 'Review the attached assets.',
          ts: 1234567890,
        },
        messages: [
          {
            role: 'user',
            content: 'Review the attached assets.\n\n[Attachments]\n- mock.png (image, 4 B)\n- notes.md (file, 24 B)',
          },
        ],
        attachments: [createImageAttachment(), createTextAttachment()],
      }),
      broadcast,
    )

    expect(getShellSnapshot().logs).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'attachment',
        status: 'success',
        stepId: 'step-req-001',
        attachmentName: 'mock.png',
        attachmentDeliveryMode: 'native_image',
        modelId: 'gpt-5.4',
        message: 'Attachment route: mock.png -> native_image',
      }),
      expect.objectContaining({
        kind: 'attachment',
        status: 'success',
        stepId: 'step-req-001',
        attachmentName: 'notes.md',
        attachmentDeliveryMode: 'native_document',
        modelId: 'gpt-5.4',
        message: 'Attachment route: notes.md -> native_document',
      }),
    ]))
  })

  it('sends historical message attachments to OpenAI from message-scoped payload history', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    initializeShellState(createTempShellStateFile())
    const fetchMock = vi.fn().mockResolvedValue(
      createSseResponse([
        'data: {"choices":[{"delta":{"content":"Compared images."}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)

    const sender = createSender()
    const { broadcast } = createBroadcastCollector()

    await handleChat(
      sender as unknown as WebContents,
      createPayload({
        model: 'gpt-5.4',
        useTools: false,
        userMessage: {
          id: 'msg-user-002',
          content: 'Compare it with the earlier screenshot.',
          ts: 1234567891,
        },
        messages: [
          {
            role: 'user',
            content: 'Review this screenshot.\n\n[Attachments]\n- mock.png (image, 4 B)',
            attachments: [createImageAttachment()],
          },
          {
            role: 'assistant',
            content: 'I reviewed it.',
          },
          {
            role: 'user',
            content: 'Compare it with the earlier screenshot.',
          },
        ],
      }),
      broadcast,
    )

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(requestBody.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Review this screenshot.' },
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,AAAA' },
          },
        ],
      },
      {
        role: 'assistant',
        content: 'I reviewed it.',
      },
      {
        role: 'user',
        content: 'Compare it with the earlier screenshot.',
      },
    ])
  })

  it('injects extracted text attachment context into OpenAI prompt text', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    initializeShellState(createTempShellStateFile())
    const fetchMock = vi.fn().mockResolvedValue(
      createSseResponse([
        'data: {"choices":[{"delta":{"content":"Summarized note."}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)

    const sender = createSender()
    const { broadcast } = createBroadcastCollector()

    await handleChat(
      sender as unknown as WebContents,
      createPayload({
        model: 'gpt-5.4',
        useTools: false,
        userMessage: {
          id: 'msg-user-001',
          content: 'Summarize the note.',
          ts: 1234567890,
        },
        messages: [
          {
            role: 'user',
            content: 'Summarize the note.\n\n[Attachments]\n- notes.md (file, 24 B)',
            attachments: [createTextAttachment({ dataUrl: undefined })],
          },
        ],
        attachments: [createTextAttachment({ dataUrl: undefined })],
      }),
      broadcast,
    )

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(requestBody.messages).toEqual([
      {
        role: 'user',
        content: [
          'Summarize the note.',
          '[Attachments]\n- notes.md (file, 24 B)',
          '[Attachment Content: notes.md]\n# Notes\nLaunch checklist',
        ].join('\n\n'),
      },
    ])
  })

  it('sends text attachments to OpenAI via the Responses API file input path when raw bytes are available', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    initializeShellState(createTempShellStateFile())
    const fetchMock = vi.fn().mockResolvedValue(
      createSseResponse([
        'data: {"type":"response.created"}\n\n',
        'data: {"type":"response.output_text.delta","delta":"Summarized note."}\n\n',
        'data: {"type":"response.completed"}\n\n',
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)

    const sender = createSender()
    const { broadcast } = createBroadcastCollector()

    await handleChat(
      sender as unknown as WebContents,
      createPayload({
        model: 'gpt-5.4',
        useTools: false,
        userMessage: {
          id: 'msg-user-001',
          content: 'Summarize the note.',
          ts: 1234567890,
        },
        messages: [
          {
            role: 'user',
            content: 'Summarize the note.\n\n[Attachments]\n- notes.md (file, 24 B)',
          },
        ],
        attachments: [createTextAttachment()],
      }),
      broadcast,
    )

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        method: 'POST',
        signal: expect.any(AbortSignal),
      }),
    )

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(requestBody).toEqual(expect.objectContaining({
      model: 'gpt-5.4',
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Summarize the note.' },
            {
              type: 'input_file',
              filename: 'notes.md',
              file_data: 'data:text/markdown;base64,IyBOb3RlcwpMYXVuY2ggY2hlY2tsaXN0',
            },
          ],
        },
      ],
      stream: true,
    }))
  })

  it('sends pdf attachments to OpenAI via the Responses API file input path', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    initializeShellState(createTempShellStateFile())
    const fetchMock = vi.fn().mockResolvedValue(
      createSseResponse([
        'data: {"type":"response.created"}\n\n',
        'data: {"type":"response.output_text.delta","delta":"Summarized PDF."}\n\n',
        'data: {"type":"response.completed"}\n\n',
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)

    const sender = createSender()
    const { broadcast } = createBroadcastCollector()

    await handleChat(
      sender as unknown as WebContents,
      createPayload({
        model: 'gpt-5.4',
        useTools: false,
        userMessage: {
          id: 'msg-user-001',
          content: 'Summarize the attached PDF.',
          ts: 1234567890,
        },
        messages: [
          {
            role: 'user',
            content: 'Summarize the attached PDF.\n\n[Attachments]\n- brief.pdf (file, 128 B)',
          },
        ],
        attachments: [createPdfAttachment()],
      }),
      broadcast,
    )

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        method: 'POST',
        signal: expect.any(AbortSignal),
      }),
    )

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(requestBody).toEqual(expect.objectContaining({
      model: 'gpt-5.4',
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Summarize the attached PDF.' },
            {
              type: 'input_file',
              filename: 'brief.pdf',
              file_data: 'data:application/pdf;base64,UEZERGF0YQ==',
            },
          ],
        },
      ],
      stream: true,
    }))
  })

  it('sends rich document attachments to OpenAI via the Responses API file input path', async () => {
    process.env.OPENAI_API_KEY = 'test-key'
    initializeShellState(createTempShellStateFile())
    const fetchMock = vi.fn().mockResolvedValue(
      createSseResponse([
        'data: {"type":"response.created"}\n\n',
        'data: {"type":"response.output_text.delta","delta":"Summarized docx."}\n\n',
        'data: {"type":"response.completed"}\n\n',
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)

    const sender = createSender()
    const { broadcast } = createBroadcastCollector()

    await handleChat(
      sender as unknown as WebContents,
      createPayload({
        model: 'gpt-5.4',
        useTools: false,
        userMessage: {
          id: 'msg-user-001',
          content: 'Summarize the attached brief.',
          ts: 1234567890,
        },
        messages: [
          {
            role: 'user',
            content: 'Summarize the attached brief.\n\n[Attachments]\n- brief.docx (file, 256 B)',
          },
        ],
        attachments: [createDocxAttachment()],
      }),
      broadcast,
    )

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        method: 'POST',
        signal: expect.any(AbortSignal),
      }),
    )

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(requestBody).toEqual(expect.objectContaining({
      model: 'gpt-5.4',
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Summarize the attached brief.' },
            {
              type: 'input_file',
              filename: 'brief.docx',
              file_data: 'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,RE9DWERBVEE=',
            },
          ],
        },
      ],
      stream: true,
    }))
  })

  it('sends image attachments to Anthropic as base64 image blocks', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    initializeShellState(createTempShellStateFile())
    anthropicResponses.push({ text: 'Analyzed image.', finalMessage: createDoneMessage() })

    const sender = createSender()
    const { broadcast } = createBroadcastCollector()

    await handleChat(
      sender as unknown as WebContents,
      createPayload({
        useTools: false,
        userMessage: {
          id: 'msg-user-001',
          content: 'Describe the attached image.',
          ts: 1234567890,
        },
        messages: [
          {
            role: 'user',
            content: 'Describe the attached image.\n\n[Attachments]\n- mock.png (image, 4 B)',
          },
        ],
        attachments: [createImageAttachment()],
      }),
      broadcast,
    )

    expect(anthropicStreamCalls[0]).toEqual(expect.objectContaining({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe the attached image.' },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: 'AAAA',
              },
            },
          ],
        },
      ],
    }))
  })

  it('sends pdf attachments to Anthropic as native document blocks', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    initializeShellState(createTempShellStateFile())
    anthropicResponses.push({ text: 'Analyzed document.', finalMessage: createDoneMessage() })

    const sender = createSender()
    const { broadcast } = createBroadcastCollector()

    await handleChat(
      sender as unknown as WebContents,
      createPayload({
        useTools: false,
        userMessage: {
          id: 'msg-user-001',
          content: 'Summarize the attached PDF.',
          ts: 1234567890,
        },
        messages: [
          {
            role: 'user',
            content: 'Summarize the attached PDF.\n\n[Attachments]\n- brief.pdf (file, 128 B)',
          },
        ],
        attachments: [createPdfAttachment()],
      }),
      broadcast,
    )

    expect(anthropicStreamCalls[0]).toEqual(expect.objectContaining({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Summarize the attached PDF.' },
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: 'UEZERGF0YQ==',
              },
            },
          ],
        },
      ],
    }))
  })

  it('sends plain text attachments to Anthropic as native document blocks', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key'
    initializeShellState(createTempShellStateFile())
    anthropicResponses.push({ text: 'Analyzed text file.', finalMessage: createDoneMessage() })

    const sender = createSender()
    const { broadcast } = createBroadcastCollector()

    await handleChat(
      sender as unknown as WebContents,
      createPayload({
        useTools: false,
        userMessage: {
          id: 'msg-user-001',
          content: 'Summarize the attached text file.',
          ts: 1234567890,
        },
        messages: [
          {
            role: 'user',
            content: 'Summarize the attached text file.\n\n[Attachments]\n- brief.txt (file, 24 B)',
          },
        ],
        attachments: [
          createTextAttachment({
            name: 'brief.txt',
            mimeType: 'text/plain',
            dataUrl: 'data:text/plain;base64,TGF1bmNoIGNoZWNrbGlzdA==',
            textContent: 'Launch checklist',
          }),
        ],
      }),
      broadcast,
    )

    expect(anthropicStreamCalls[0]).toEqual(expect.objectContaining({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Summarize the attached text file.' },
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'text/plain',
                data: 'TGF1bmNoIGNoZWNrbGlzdA==',
              },
            },
          ],
        },
      ],
    }))
  })

  it('streams Gemini responses through the provider adapter boundary', async () => {
    process.env.GEMINI_API_KEY = 'test-key'
    initializeShellState(createTempShellStateFile())
    const fetchMock = vi.fn().mockResolvedValue(
      createSseResponse([
        'data: {"candidates":[{"content":{"parts":[{"text":"Hello "}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":"from Gemini"}]}}]}\n\n',
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)

    const sender = createSender()
    const { broadcast } = createBroadcastCollector()
    const payload = {
      ...createPayload(),
      model: 'gemini-2.5-pro',
      useTools: false,
    }

    await handleChat(sender as unknown as WebContents, payload, broadcast)

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('generativelanguage.googleapis.com'),
      expect.objectContaining({
        method: 'POST',
        signal: expect.any(AbortSignal),
      }),
    )
    expect(sender.send).toHaveBeenCalledWith('ai:chunk', expect.objectContaining({
      type: 'text_delta',
      text: 'Hello ',
    }))
    expect(sender.send).toHaveBeenCalledWith('ai:chunk', expect.objectContaining({
      type: 'text_delta',
      text: 'from Gemini',
    }))
    expect(sender.send).toHaveBeenCalledWith('ai:chunk', expect.objectContaining({ type: 'done' }))
    expect(getShellSnapshot().messages.find((message) => (
      message.id === 'msg-req-001-assistant'
    ))?.content).toBe('Hello from Gemini')
  })

  it('sends image attachments to Gemini as inline_data parts', async () => {
    process.env.GEMINI_API_KEY = 'test-key'
    initializeShellState(createTempShellStateFile())
    const fetchMock = vi.fn().mockResolvedValue(
      createSseResponse([
        'data: {"candidates":[{"content":{"parts":[{"text":"Analyzed image."}]}}]}\n\n',
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)

    const sender = createSender()
    const { broadcast } = createBroadcastCollector()

    await handleChat(
      sender as unknown as WebContents,
      createPayload({
        model: 'gemini-2.5-pro',
        useTools: false,
        userMessage: {
          id: 'msg-user-001',
          content: 'Describe the attached image.',
          ts: 1234567890,
        },
        messages: [
          {
            role: 'user',
            content: 'Describe the attached image.\n\n[Attachments]\n- mock.png (image, 4 B)',
          },
        ],
        attachments: [createImageAttachment()],
      }),
      broadcast,
    )

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(requestBody.contents).toEqual([
      {
        role: 'user',
        parts: [
          { text: 'Describe the attached image.' },
          {
            inline_data: {
              mime_type: 'image/png',
              data: 'AAAA',
            },
          },
        ],
      },
    ])
  })

  it('sends pdf attachments to Gemini as inline_data document parts', async () => {
    process.env.GEMINI_API_KEY = 'test-key'
    initializeShellState(createTempShellStateFile())
    const fetchMock = vi.fn().mockResolvedValue(
      createSseResponse([
        'data: {"candidates":[{"content":{"parts":[{"text":"Analyzed PDF."}]}}]}\n\n',
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)

    const sender = createSender()
    const { broadcast } = createBroadcastCollector()

    await handleChat(
      sender as unknown as WebContents,
      createPayload({
        model: 'gemini-2.5-pro',
        useTools: false,
        userMessage: {
          id: 'msg-user-001',
          content: 'Summarize the attached PDF.',
          ts: 1234567890,
        },
        messages: [
          {
            role: 'user',
            content: 'Summarize the attached PDF.\n\n[Attachments]\n- brief.pdf (file, 128 B)',
          },
        ],
        attachments: [createPdfAttachment()],
      }),
      broadcast,
    )

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(requestBody.contents).toEqual([
      {
        role: 'user',
        parts: [
          { text: 'Summarize the attached PDF.' },
          {
            inline_data: {
              mime_type: 'application/pdf',
              data: 'UEZERGF0YQ==',
            },
          },
        ],
      },
    ])
  })

  it('sends plain text attachments to Gemini as inline_data document parts', async () => {
    process.env.GEMINI_API_KEY = 'test-key'
    initializeShellState(createTempShellStateFile())
    const fetchMock = vi.fn().mockResolvedValue(
      createSseResponse([
        'data: {"candidates":[{"content":{"parts":[{"text":"Analyzed text file."}]}}]}\n\n',
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)

    const sender = createSender()
    const { broadcast } = createBroadcastCollector()

    await handleChat(
      sender as unknown as WebContents,
      createPayload({
        model: 'gemini-2.5-pro',
        useTools: false,
        userMessage: {
          id: 'msg-user-001',
          content: 'Summarize the attached text file.',
          ts: 1234567890,
        },
        messages: [
          {
            role: 'user',
            content: 'Summarize the attached text file.\n\n[Attachments]\n- brief.txt (file, 24 B)',
          },
        ],
        attachments: [
          createTextAttachment({
            name: 'brief.txt',
            mimeType: 'text/plain',
            dataUrl: 'data:text/plain;base64,TGF1bmNoIGNoZWNrbGlzdA==',
            textContent: 'Launch checklist',
          }),
        ],
      }),
      broadcast,
    )

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(requestBody.contents).toEqual([
      {
        role: 'user',
        parts: [
          { text: 'Summarize the attached text file.' },
          {
            inline_data: {
              mime_type: 'text/plain',
              data: 'TGF1bmNoIGNoZWNrbGlzdA==',
            },
          },
        ],
      },
    ])
  })

  it('sends csv attachments to Gemini as inline_data document parts', async () => {
    process.env.GEMINI_API_KEY = 'test-key'
    initializeShellState(createTempShellStateFile())
    const fetchMock = vi.fn().mockResolvedValue(
      createSseResponse([
        'data: {"candidates":[{"content":{"parts":[{"text":"Analyzed CSV."}]}}]}\n\n',
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)

    const sender = createSender()
    const { broadcast } = createBroadcastCollector()

    await handleChat(
      sender as unknown as WebContents,
      createPayload({
        model: 'gemini-2.5-pro',
        useTools: false,
        userMessage: {
          id: 'msg-user-001',
          content: 'Summarize the attached csv.',
          ts: 1234567890,
        },
        messages: [
          {
            role: 'user',
            content: 'Summarize the attached csv.\n\n[Attachments]\n- sales.csv (file, 42 B)',
          },
        ],
        attachments: [
          createTextAttachment({
            name: 'sales.csv',
            mimeType: 'text/csv',
            sizeLabel: '42 B',
            dataUrl: 'data:text/csv;base64,bmFtZSx0b3RhbApjYWZlLDQy',
            textContent: 'name,total\ncafe,42',
          }),
        ],
      }),
      broadcast,
    )

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(requestBody.contents).toEqual([
      {
        role: 'user',
        parts: [
          { text: 'Summarize the attached csv.' },
          {
            inline_data: {
              mime_type: 'text/csv',
              data: 'bmFtZSx0b3RhbApjYWZlLDQy',
            },
          },
        ],
      },
    ])
  })

  it('sends json attachments to Gemini as inline_data document parts', async () => {
    process.env.GEMINI_API_KEY = 'test-key'
    initializeShellState(createTempShellStateFile())
    const fetchMock = vi.fn().mockResolvedValue(
      createSseResponse([
        'data: {"candidates":[{"content":{"parts":[{"text":"Analyzed JSON."}]}}]}\n\n',
      ]),
    )
    vi.stubGlobal('fetch', fetchMock)

    const sender = createSender()
    const { broadcast } = createBroadcastCollector()

    await handleChat(
      sender as unknown as WebContents,
      createPayload({
        model: 'gemini-2.5-pro',
        useTools: false,
        userMessage: {
          id: 'msg-user-001',
          content: 'Summarize the attached json.',
          ts: 1234567890,
        },
        messages: [
          {
            role: 'user',
            content: 'Summarize the attached json.\n\n[Attachments]\n- config.json (file, 36 B)',
          },
        ],
        attachments: [
          createTextAttachment({
            name: 'config.json',
            mimeType: 'application/json',
            sizeLabel: '36 B',
            dataUrl: 'data:application/json;base64,eyJ0aGVtZSI6ImFtYmVyIiwic2VjdGlvbnMiOjN9',
            textContent: '{"theme":"amber","sections":3}',
          }),
        ],
      }),
      broadcast,
    )

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    expect(requestBody.contents).toEqual([
      {
        role: 'user',
        parts: [
          { text: 'Summarize the attached json.' },
          {
            inline_data: {
              mime_type: 'application/json',
              data: 'eyJ0aGVtZSI6ImFtYmVyIiwic2VjdGlvbnMiOjN9',
            },
          },
        ],
      },
    ])
  })
})
