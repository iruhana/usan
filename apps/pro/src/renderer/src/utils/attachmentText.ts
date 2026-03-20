import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url'

const MAX_TEXT_ATTACHMENT_BYTES = 256 * 1024
const MAX_PDF_ATTACHMENT_BYTES = 5 * 1024 * 1024
const MAX_NATIVE_FILE_ATTACHMENT_BYTES = 5 * 1024 * 1024
const MAX_PDF_ATTACHMENT_PAGES = 20
const MAX_ATTACHMENT_TEXT_CHARS = 12000

const SUPPORTED_TEXT_ATTACHMENT_MIME_TYPES = new Set([
  'application/json',
  'application/ld+json',
  'application/sql',
  'application/xml',
  'application/x-sh',
  'application/x-yaml',
])

const SUPPORTED_TEXT_ATTACHMENT_EXTENSIONS = new Set([
  '.c',
  '.cc',
  '.cpp',
  '.css',
  '.csv',
  '.go',
  '.h',
  '.html',
  '.java',
  '.js',
  '.json',
  '.jsx',
  '.log',
  '.md',
  '.pdf',
  '.ps1',
  '.py',
  '.rb',
  '.rs',
  '.scss',
  '.sh',
  '.sql',
  '.svg',
  '.toml',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
])

const SUPPORTED_NATIVE_FILE_ATTACHMENT_MIME_TYPES = new Set([
  'application/csv',
  'application/msword',
  'application/rtf',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.oasis.opendocument.presentation',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'text/rtf',
  'text/tsv',
])

const SUPPORTED_NATIVE_FILE_ATTACHMENT_EXTENSIONS = new Set([
  '.csv',
  '.doc',
  '.docx',
  '.iif',
  '.odt',
  '.odp',
  '.ods',
  '.ppt',
  '.pptx',
  '.rtf',
  '.tsv',
  '.xla',
  '.xlb',
  '.xlc',
  '.xlm',
  '.xls',
  '.xlsx',
  '.xlt',
  '.xlw',
])

type PdfJsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs')

let pdfJsModulePromise: Promise<PdfJsModule> | null = null

function getFileExtension(fileName: string): string {
  const normalized = fileName.trim().toLowerCase()
  const dotIndex = normalized.lastIndexOf('.')
  return dotIndex === -1 ? '' : normalized.slice(dotIndex)
}

function shouldExtractTextAttachment(file: File): boolean {
  if (file.size === 0 || file.size > MAX_TEXT_ATTACHMENT_BYTES) {
    return false
  }

  const normalizedType = file.type.trim().toLowerCase()
  if (normalizedType.startsWith('text/') || SUPPORTED_TEXT_ATTACHMENT_MIME_TYPES.has(normalizedType)) {
    return true
  }

  const extension = getFileExtension(file.name)
  return extension !== '.pdf' && SUPPORTED_TEXT_ATTACHMENT_EXTENSIONS.has(extension)
}

function shouldExtractPdfAttachment(file: File): boolean {
  if (file.size === 0 || file.size > MAX_PDF_ATTACHMENT_BYTES) {
    return false
  }

  const normalizedType = file.type.trim().toLowerCase()
  return normalizedType === 'application/pdf' || getFileExtension(file.name) === '.pdf'
}

function shouldPersistNativeFileAttachment(file: File): boolean {
  if (file.size === 0 || file.size > MAX_NATIVE_FILE_ATTACHMENT_BYTES) {
    return false
  }

  const normalizedType = file.type.trim().toLowerCase()
  if (SUPPORTED_NATIVE_FILE_ATTACHMENT_MIME_TYPES.has(normalizedType)) {
    return true
  }

  return SUPPORTED_NATIVE_FILE_ATTACHMENT_EXTENSIONS.has(getFileExtension(file.name))
}

export function shouldPersistAttachmentDataUrl(file: File): boolean {
  return shouldExtractPdfAttachment(file)
    || shouldExtractTextAttachment(file)
    || shouldPersistNativeFileAttachment(file)
}

function truncateAttachmentText(content: string): string {
  const normalized = content.replace(/\r\n/g, '\n').trim()
  if (normalized.length <= MAX_ATTACHMENT_TEXT_CHARS) {
    return normalized
  }

  return `${normalized.slice(0, MAX_ATTACHMENT_TEXT_CHARS).trimEnd()}\n...[truncated]`
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('Failed to read attachment text'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read attachment text'))
    reader.readAsText(file)
  })
}

async function getPdfJs(): Promise<PdfJsModule> {
  if (!pdfJsModulePromise) {
    pdfJsModulePromise = import('pdfjs-dist/legacy/build/pdf.mjs').then((module) => {
      if (module.GlobalWorkerOptions.workerSrc !== pdfWorkerUrl) {
        module.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
      }

      return module
    })
  }

  return pdfJsModulePromise
}

function resolvePdfPageText(items: unknown[]): string {
  return items
    .map((item) => {
      if (typeof item !== 'object' || item === null || !('str' in item)) {
        return ''
      }

      const value = item.str
      return typeof value === 'string' ? value : ''
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function extractPdfAttachmentText(file: File): Promise<string | undefined> {
  const pdfjs = await getPdfJs()
  const data = new Uint8Array(await file.arrayBuffer())
  const loadingTask = pdfjs.getDocument({ data })

  try {
    const document = await loadingTask.promise
    const sections: string[] = []
    const pageCount = Math.min(document.numPages, MAX_PDF_ATTACHMENT_PAGES)

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const textContent = await page.getTextContent()
      const pageText = resolvePdfPageText(textContent.items as unknown[])

      if (!pageText) {
        continue
      }

      sections.push(`[Page ${pageNumber}]\n${pageText}`)
    }

    if (sections.length === 0) {
      return undefined
    }

    const content = document.numPages > MAX_PDF_ATTACHMENT_PAGES
      ? `${sections.join('\n\n')}\n\n...[truncated after ${MAX_PDF_ATTACHMENT_PAGES} pages]`
      : sections.join('\n\n')

    return truncateAttachmentText(content)
  } finally {
    await loadingTask.destroy()
  }
}

export async function extractAttachmentText(file: File): Promise<string | undefined> {
  if (shouldExtractTextAttachment(file)) {
    const content = await readFileAsText(file)
    return truncateAttachmentText(content)
  }

  if (shouldExtractPdfAttachment(file)) {
    return extractPdfAttachmentText(file)
  }

  return undefined
}
