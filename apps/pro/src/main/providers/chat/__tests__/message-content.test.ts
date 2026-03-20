// @vitest-environment node

import type { ChatPayload, ShellAttachment } from '@shared/types'
import { describe, expect, it } from 'vitest'
import { normalizeProviderMessages } from '../message-content'

function createAttachment(overrides: Partial<ShellAttachment> = {}): ShellAttachment {
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
    ...overrides,
  }
}

function createPayload(attachments: ShellAttachment[]): ChatPayload {
  return {
    requestId: 'req-001',
    sessionId: 'sess-001',
    userMessage: {
      id: 'msg-user-001',
      content: 'Describe the image.',
      ts: 1,
    },
    messages: [
      {
        role: 'assistant',
        content: 'Earlier answer',
      },
      {
        role: 'user',
        content: 'Describe the image.\n\n[Attachments]\n- mock.png (image, 4 B)',
      },
    ],
    attachments,
    model: 'gpt-5.4',
  }
}

describe('normalizeProviderMessages', () => {
  it('converts supported image attachments into native multimodal inputs', () => {
    const normalized = normalizeProviderMessages(createPayload([createAttachment()]))

    expect(normalized).toHaveLength(2)
    expect(normalized[0]).toEqual({
      role: 'assistant',
      text: 'Earlier answer',
      imageAttachments: [],
      documentAttachments: [],
    })
    expect(normalized[1]).toEqual({
      role: 'user',
      text: 'Describe the image.',
      imageAttachments: [
        expect.objectContaining({
          id: 'attachment-001',
          mimeType: 'image/png',
          dataUrl: 'data:image/png;base64,AAAA',
          base64Data: 'AAAA',
        }),
      ],
      documentAttachments: [],
    })
  })

  it('keeps unsupported attachments as text summaries', () => {
    const normalized = normalizeProviderMessages(createPayload([
      createAttachment({
        id: 'attachment-file',
        kind: 'file',
        mimeType: 'application/pdf',
        name: 'brief.pdf',
        sizeLabel: '12 KB',
        dataUrl: undefined,
      }),
    ]))

    expect(normalized[1]).toEqual({
      role: 'user',
      text: 'Describe the image.\n\n[Attachments]\n- brief.pdf (file, 12 KB)',
      imageAttachments: [],
      documentAttachments: [],
    })
  })

  it('includes extracted text content for supported file attachments', () => {
    const normalized = normalizeProviderMessages(createPayload([
      createAttachment({
        id: 'attachment-text',
        kind: 'file',
        mimeType: 'text/markdown',
        name: 'brief.md',
        sizeLabel: '24 B',
        dataUrl: undefined,
        textContent: '# Brief\nLaunch checklist',
      }),
    ]))

    expect(normalized[1]).toEqual({
      role: 'user',
      text: [
        'Describe the image.',
        '[Attachments]\n- brief.md (file, 24 B)',
        '[Attachment Content: brief.md]\n# Brief\nLaunch checklist',
      ].join('\n\n'),
      imageAttachments: [],
      documentAttachments: [],
    })
  })

  it('ignores malformed image data urls and falls back to text summary', () => {
    const normalized = normalizeProviderMessages(createPayload([
      createAttachment({
        dataUrl: 'not-a-data-url',
      }),
    ]))

    expect(normalized[1]).toEqual({
      role: 'user',
      text: 'Describe the image.\n\n[Attachments]\n- mock.png (image, 4 B)',
      imageAttachments: [],
      documentAttachments: [],
    })
  })

  it('normalizes historical message attachments when they are attached per message', () => {
    const normalized = normalizeProviderMessages({
      requestId: 'req-001',
      sessionId: 'sess-001',
      userMessage: {
        id: 'msg-user-002',
        content: 'Use the previous screenshot too.',
        ts: 2,
      },
      messages: [
        {
          role: 'user',
          content: 'Analyze the screenshot.\n\n[Attachments]\n- mock.png (image, 4 B)',
          attachments: [createAttachment()],
        },
        {
          role: 'assistant',
          content: 'I analyzed it.',
        },
        {
          role: 'user',
          content: 'Use the previous screenshot too.',
        },
      ],
      model: 'gpt-5.4',
    })

    expect(normalized[0]).toEqual({
      role: 'user',
      text: 'Analyze the screenshot.',
      imageAttachments: [
        expect.objectContaining({
          id: 'attachment-001',
          mimeType: 'image/png',
          base64Data: 'AAAA',
        }),
      ],
      documentAttachments: [],
    })
    expect(normalized[2]).toEqual({
      role: 'user',
      text: 'Use the previous screenshot too.',
      imageAttachments: [],
      documentAttachments: [],
    })
  })

  it('promotes pdf attachments into native document inputs when requested', () => {
    const normalized = normalizeProviderMessages(createPayload([
      createAttachment({
        id: 'attachment-pdf',
        kind: 'file',
        mimeType: 'application/pdf',
        name: 'brief.pdf',
        sizeLabel: '12 KB',
        dataUrl: 'data:application/pdf;base64,UEZERGF0YQ==',
        textContent: '[Page 1]\nLaunch plan',
      }),
    ]), { nativeFileMode: 'pdf' })

    expect(normalized[1]).toEqual({
      role: 'user',
      text: 'Describe the image.',
      imageAttachments: [],
      documentAttachments: [
        expect.objectContaining({
          id: 'attachment-pdf',
          mimeType: 'application/pdf',
          dataUrl: 'data:application/pdf;base64,UEZERGF0YQ==',
          base64Data: 'UEZERGF0YQ==',
        }),
      ],
    })
  })

  it('promotes plain text attachments into native document inputs for pdf_text providers', () => {
    const normalized = normalizeProviderMessages(createPayload([
      createAttachment({
        id: 'attachment-text-plain',
        kind: 'file',
        mimeType: 'text/plain',
        name: 'brief.txt',
        sizeLabel: '18 B',
        dataUrl: 'data:text/plain;base64,TGF1bmNoIGNoZWNrbGlzdA==',
        textContent: 'Launch checklist',
      }),
    ]), { nativeFileMode: 'pdf_text' })

    expect(normalized[1]).toEqual({
      role: 'user',
      text: 'Describe the image.',
      imageAttachments: [],
      documentAttachments: [
        expect.objectContaining({
          id: 'attachment-text-plain',
          mimeType: 'text/plain',
          dataUrl: 'data:text/plain;base64,TGF1bmNoIGNoZWNrbGlzdA==',
          base64Data: 'TGF1bmNoIGNoZWNrbGlzdA==',
        }),
      ],
    })
  })

  it('keeps markdown attachments on the fallback text path for pdf_text providers', () => {
    const normalized = normalizeProviderMessages(createPayload([
      createAttachment({
        id: 'attachment-markdown-fallback',
        kind: 'file',
        mimeType: 'text/markdown',
        name: 'brief.md',
        sizeLabel: '24 B',
        dataUrl: 'data:text/markdown;base64,IyBCcmllZgpMYXVuY2ggY2hlY2tsaXN0',
        textContent: '# Brief\nLaunch checklist',
      }),
    ]), { nativeFileMode: 'pdf_text' })

    expect(normalized[1]).toEqual({
      role: 'user',
      text: [
        'Describe the image.',
        '[Attachments]\n- brief.md (file, 24 B)',
        '[Attachment Content: brief.md]\n# Brief\nLaunch checklist',
      ].join('\n\n'),
      imageAttachments: [],
      documentAttachments: [],
    })
  })

  it('promotes csv attachments into native document inputs for gemini document providers', () => {
    const normalized = normalizeProviderMessages(createPayload([
      createAttachment({
        id: 'attachment-csv-native',
        kind: 'file',
        mimeType: 'text/csv',
        name: 'sales.csv',
        sizeLabel: '42 B',
        dataUrl: 'data:text/csv;base64,bmFtZSx0b3RhbApjYWZlLDQy',
        textContent: 'name,total\ncafe,42',
      }),
    ]), { nativeFileMode: 'gemini_docs' })

    expect(normalized[1]).toEqual({
      role: 'user',
      text: 'Describe the image.',
      imageAttachments: [],
      documentAttachments: [
        expect.objectContaining({
          id: 'attachment-csv-native',
          mimeType: 'text/csv',
          dataUrl: 'data:text/csv;base64,bmFtZSx0b3RhbApjYWZlLDQy',
          base64Data: 'bmFtZSx0b3RhbApjYWZlLDQy',
        }),
      ],
    })
  })

  it('promotes json attachments into native document inputs for gemini document providers', () => {
    const normalized = normalizeProviderMessages(createPayload([
      createAttachment({
        id: 'attachment-json-native',
        kind: 'file',
        mimeType: 'application/json',
        name: 'config.json',
        sizeLabel: '36 B',
        dataUrl: 'data:application/json;base64,eyJ0aGVtZSI6ImFtYmVyIiwic2VjdGlvbnMiOjN9',
        textContent: '{"theme":"amber","sections":3}',
      }),
    ]), { nativeFileMode: 'gemini_docs' })

    expect(normalized[1]).toEqual({
      role: 'user',
      text: 'Describe the image.',
      imageAttachments: [],
      documentAttachments: [
        expect.objectContaining({
          id: 'attachment-json-native',
          mimeType: 'application/json',
          dataUrl: 'data:application/json;base64,eyJ0aGVtZSI6ImFtYmVyIiwic2VjdGlvbnMiOjN9',
          base64Data: 'eyJ0aGVtZSI6ImFtYmVyIiwic2VjdGlvbnMiOjN9',
        }),
      ],
    })
  })

  it('promotes text attachments into native file inputs when requested', () => {
    const normalized = normalizeProviderMessages(createPayload([
      createAttachment({
        id: 'attachment-text-native',
        kind: 'file',
        mimeType: 'text/markdown',
        name: 'brief.md',
        sizeLabel: '24 B',
        dataUrl: 'data:text/markdown;base64,IyBCcmllZgpMYXVuY2ggY2hlY2tsaXN0',
        textContent: '# Brief\nLaunch checklist',
      }),
    ]), { nativeFileMode: 'all' })

    expect(normalized[1]).toEqual({
      role: 'user',
      text: 'Describe the image.',
      imageAttachments: [],
      documentAttachments: [
        expect.objectContaining({
          id: 'attachment-text-native',
          mimeType: 'text/markdown',
          dataUrl: 'data:text/markdown;base64,IyBCcmllZgpMYXVuY2ggY2hlY2tsaXN0',
          base64Data: 'IyBCcmllZgpMYXVuY2ggY2hlY2tsaXN0',
        }),
      ],
    })
  })

  it('promotes rich document attachments into native file inputs when requested', () => {
    const normalized = normalizeProviderMessages(createPayload([
      createAttachment({
        id: 'attachment-docx',
        kind: 'file',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        name: 'brief.docx',
        sizeLabel: '18 KB',
        dataUrl: 'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,RE9DWERBVEE=',
      }),
    ]), { nativeFileMode: 'all' })

    expect(normalized[1]).toEqual({
      role: 'user',
      text: 'Describe the image.',
      imageAttachments: [],
      documentAttachments: [
        expect.objectContaining({
          id: 'attachment-docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          dataUrl: 'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,RE9DWERBVEE=',
          base64Data: 'RE9DWERBVEE=',
        }),
      ],
    })
  })
})
