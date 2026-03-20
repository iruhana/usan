import {
  canUseNativeDocumentAttachment,
  canUseNativeImageAttachment,
  parseBase64DataUrl,
  type AttachmentNativeFileMode,
} from '@shared/attachment-routing'
import type { ChatPayload, ShellAttachment } from '@shared/types'

const ATTACHMENT_MARKER = '[Attachments]'
const MAX_TEXT_ATTACHMENT_PROMPT_CHARS = 6000

export interface NativeImageAttachment {
  id: string
  name: string
  mimeType: string
  dataUrl: string
  base64Data: string
}

export interface NativeDocumentAttachment {
  id: string
  name: string
  mimeType: string
  dataUrl: string
  base64Data: string
}

export interface NormalizedProviderMessage {
  role: 'user' | 'assistant'
  text: string
  imageAttachments: NativeImageAttachment[]
  documentAttachments: NativeDocumentAttachment[]
}

interface TextAttachmentContext {
  id: string
  name: string
  content: string
}

function stripAttachmentSummary(content: string): string {
  const markerIndex = content.indexOf(ATTACHMENT_MARKER)
  if (markerIndex === -1) {
    return content.trim()
  }

  return content.slice(0, markerIndex).trim()
}

function summarizeAttachments(attachments: ShellAttachment[]): string {
  if (attachments.length === 0) {
    return ''
  }

  const summary = attachments
    .map((attachment) => `- ${attachment.name} (${attachment.kind}, ${attachment.sizeLabel})`)
    .join('\n')

  return `${ATTACHMENT_MARKER}\n${summary}`
}

function summarizeTextAttachmentContent(attachments: TextAttachmentContext[]): string {
  if (attachments.length === 0) {
    return ''
  }

  return attachments
    .map((attachment) => (
      `[Attachment Content: ${attachment.name}]\n${attachment.content}`
    ))
    .join('\n\n')
}

function toNativeImageAttachment(attachment: ShellAttachment): NativeImageAttachment | null {
  if (!canUseNativeImageAttachment(attachment) || !attachment.dataUrl) {
    return null
  }

  const parsed = parseBase64DataUrl(attachment.dataUrl)
  if (!parsed) {
    return null
  }

  return {
    id: attachment.id,
    name: attachment.name,
    mimeType: parsed.mimeType,
    dataUrl: attachment.dataUrl,
    base64Data: parsed.data,
  }
}

function toNativeDocumentAttachment(
  attachment: ShellAttachment,
  mode: AttachmentNativeFileMode,
): NativeDocumentAttachment | null {
  if (!canUseNativeDocumentAttachment(attachment, mode) || !attachment.dataUrl) {
    return null
  }

  const parsed = parseBase64DataUrl(attachment.dataUrl)
  if (!parsed) {
    return null
  }

  return {
    id: attachment.id,
    name: attachment.name,
    mimeType: parsed.mimeType,
    dataUrl: attachment.dataUrl,
    base64Data: parsed.data,
  }
}

function toTextAttachmentContext(attachment: ShellAttachment): TextAttachmentContext | null {
  const content = attachment.textContent?.trim()
  if (!content) {
    return null
  }

  if (content.length <= MAX_TEXT_ATTACHMENT_PROMPT_CHARS) {
    return {
      id: attachment.id,
      name: attachment.name,
      content,
    }
  }

  return {
    id: attachment.id,
    name: attachment.name,
    content: `${content.slice(0, MAX_TEXT_ATTACHMENT_PROMPT_CHARS).trimEnd()}\n...[truncated]`,
  }
}

export function normalizeProviderMessages(
  payload: ChatPayload,
  options?: { nativeFileMode?: AttachmentNativeFileMode },
): NormalizedProviderMessage[] {
  const lastMessageIndex = payload.messages.length - 1
  const nativeFileMode = options?.nativeFileMode

  return payload.messages.map((message, index) => {
    const currentAttachments = message.attachments ?? (
      index === lastMessageIndex ? payload.attachments ?? [] : []
    )

    if (message.role !== 'user' || currentAttachments.length === 0) {
      return {
        role: message.role,
        text: message.content,
        imageAttachments: [],
        documentAttachments: [],
      }
    }

    const imageAttachments: NativeImageAttachment[] = []
    const documentAttachments: NativeDocumentAttachment[] = []
    const nonImageAttachments: ShellAttachment[] = []
    const textAttachments: TextAttachmentContext[] = []

    for (const attachment of currentAttachments) {
      const normalizedAttachment = toNativeImageAttachment(attachment)
      if (normalizedAttachment) {
        imageAttachments.push(normalizedAttachment)
        continue
      }

      const normalizedDocument = nativeFileMode
        ? toNativeDocumentAttachment(attachment, nativeFileMode)
        : null
      if (normalizedDocument) {
        documentAttachments.push(normalizedDocument)
        continue
      }

      nonImageAttachments.push(attachment)

      const textAttachment = toTextAttachmentContext(attachment)
      if (textAttachment) {
        textAttachments.push(textAttachment)
      }
    }

    const strippedText = stripAttachmentSummary(message.content)
    const unsupportedSummary = summarizeAttachments(nonImageAttachments)
    const textAttachmentSummary = summarizeTextAttachmentContent(textAttachments)
    const text = [strippedText, unsupportedSummary, textAttachmentSummary].filter(Boolean).join('\n\n')

    return {
      role: message.role,
      text,
      imageAttachments,
      documentAttachments,
    }
  })
}
