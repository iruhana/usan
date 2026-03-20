import { extractAttachmentText, shouldPersistAttachmentDataUrl } from '../attachmentText'

const getDocumentMock = vi.fn()

vi.mock('pdfjs-dist/legacy/build/pdf.worker.mjs?url', () => ({
  default: 'mock-pdf-worker.js',
}))

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  GlobalWorkerOptions: {
    workerSrc: '',
  },
  getDocument: getDocumentMock,
}))

describe('extractAttachmentText', () => {
  beforeEach(() => {
    getDocumentMock.mockReset()
  })

  it('extracts plain text from supported text attachments', async () => {
    const file = new File(['# Notes\nLaunch checklist'], 'notes.md', { type: 'text/markdown' })

    await expect(extractAttachmentText(file)).resolves.toBe('# Notes\nLaunch checklist')
  })

  it('extracts pdf text with page markers through pdf.js', async () => {
    const destroy = vi.fn().mockResolvedValue(undefined)
    const getPage = vi.fn()
      .mockResolvedValueOnce({
        getTextContent: vi.fn().mockResolvedValue({
          items: [{ str: 'Launch' }, { str: 'plan' }],
        }),
      })
      .mockResolvedValueOnce({
        getTextContent: vi.fn().mockResolvedValue({
          items: [{ str: 'Budget' }, { str: 'review' }],
        }),
      })

    getDocumentMock.mockReturnValue({
      promise: Promise.resolve({
        numPages: 2,
        getPage,
      }),
      destroy,
    })

    const file = new File(['%PDF-1.7'], 'brief.pdf', { type: 'application/pdf' })
    Object.defineProperty(file, 'arrayBuffer', {
      value: vi.fn().mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer),
    })

    await expect(extractAttachmentText(file)).resolves.toBe(
      '[Page 1]\nLaunch plan\n\n[Page 2]\nBudget review',
    )
    expect(getDocumentMock).toHaveBeenCalledTimes(1)
    expect(getPage).toHaveBeenCalledTimes(2)
    expect(destroy).toHaveBeenCalledTimes(1)
  })

  it('preserves raw bytes for supported rich document attachments', () => {
    const file = new File(['docx-bytes'], 'brief.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })

    expect(shouldPersistAttachmentDataUrl(file)).toBe(true)
  })
})
