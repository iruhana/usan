import {
  AI_MODELS,
  type AIModelProvider,
  type AttachmentDeliveryMode,
  type ShellAttachment,
} from './types'

export type AttachmentNativeFileMode = 'pdf' | 'pdf_text' | 'gemini_docs' | 'all'

export const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
])

const PDF_NATIVE_DOCUMENT_MIME_TYPES = new Set(['application/pdf'])
const PDF_TEXT_NATIVE_DOCUMENT_MIME_TYPES = new Set(['application/pdf', 'text/plain'])
const GEMINI_NATIVE_DOCUMENT_MIME_TYPES = new Set([
  'application/json',
  'application/pdf',
  'text/css',
  'text/csv',
  'text/html',
  'text/javascript',
  'text/plain',
  'text/rtf',
  'text/xml',
])

export function parseBase64DataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl)
  if (!match) {
    return null
  }

  return {
    mimeType: match[1],
    data: match[2],
  }
}

export function getProviderNativeFileMode(provider: AIModelProvider): AttachmentNativeFileMode {
  switch (provider) {
    case 'openai':
      return 'all'
    case 'google':
      return 'gemini_docs'
    case 'anthropic':
    default:
      return 'pdf_text'
  }
}

export function getModelNativeFileMode(modelId: string): AttachmentNativeFileMode {
  const provider = AI_MODELS.find((model) => model.id === modelId)?.provider ?? 'anthropic'
  return getProviderNativeFileMode(provider)
}

export function supportsNativeDocumentMimeType(
  mimeType: string,
  nativeFileMode: AttachmentNativeFileMode,
): boolean {
  const normalizedMimeType = mimeType.trim().toLowerCase()

  if (nativeFileMode === 'all') {
    return true
  }

  const allowedMimeTypes = nativeFileMode === 'pdf'
    ? PDF_NATIVE_DOCUMENT_MIME_TYPES
    : nativeFileMode === 'pdf_text'
      ? PDF_TEXT_NATIVE_DOCUMENT_MIME_TYPES
      : GEMINI_NATIVE_DOCUMENT_MIME_TYPES

  return allowedMimeTypes.has(normalizedMimeType)
}

export function canUseNativeImageAttachment(attachment: ShellAttachment): boolean {
  if (
    (attachment.kind !== 'image' && attachment.kind !== 'screenshot')
    || !attachment.dataUrl
  ) {
    return false
  }

  const parsed = parseBase64DataUrl(attachment.dataUrl)
  return Boolean(parsed && SUPPORTED_IMAGE_MIME_TYPES.has(parsed.mimeType))
}

export function canUseNativeDocumentAttachment(
  attachment: ShellAttachment,
  nativeFileMode: AttachmentNativeFileMode,
): boolean {
  if (attachment.kind !== 'file' || !attachment.dataUrl) {
    return false
  }

  const parsed = parseBase64DataUrl(attachment.dataUrl)
  if (!parsed) {
    return false
  }

  return supportsNativeDocumentMimeType(parsed.mimeType, nativeFileMode)
}

export function getAttachmentDeliveryMode(
  attachment: ShellAttachment,
  nativeFileMode: AttachmentNativeFileMode,
): AttachmentDeliveryMode {
  if (canUseNativeImageAttachment(attachment)) {
    return 'native_image'
  }

  if (canUseNativeDocumentAttachment(attachment, nativeFileMode)) {
    return 'native_document'
  }

  if (attachment.textContent?.trim()) {
    return 'text_fallback'
  }

  return 'summary_only'
}
