import { getAttachmentDeliveryMode, getModelNativeFileMode } from '@shared/attachment-routing'
import {
  AI_MODELS,
  type AttachmentDeliveryMode,
  type ShellAttachment,
  type ShellLog,
} from '@shared/types'

interface AttachmentDeliveryPresentation {
  mode: AttachmentDeliveryMode
  label: string
  color: string
  background: string
}

function getProvider(modelId?: string) {
  return AI_MODELS.find((model) => model.id === modelId)?.provider ?? 'anthropic'
}

export function getAttachmentDeliveryModePresentation(
  mode: AttachmentDeliveryMode,
  modelId?: string,
): AttachmentDeliveryPresentation {
  const provider = getProvider(modelId)

  switch (mode) {
    case 'native_image':
      return {
        mode,
        label: '이미지 native',
        color: 'var(--accent)',
        background: 'var(--accent-soft)',
      }
    case 'native_document':
      return {
        mode,
        label: provider === 'openai'
          ? 'OpenAI 파일'
          : provider === 'google'
            ? 'Gemini 문서'
            : 'Anthropic 문서',
        color: 'var(--success)',
        background: 'var(--success-soft)',
      }
    case 'text_fallback':
      return {
        mode,
        label: '텍스트 추출',
        color: 'var(--warning)',
        background: 'var(--warning-soft)',
      }
    case 'summary_only':
    default:
      return {
        mode: 'summary_only',
        label: '요약만',
        color: 'var(--text-secondary)',
        background: 'var(--bg-hover)',
      }
  }
}

export function getAttachmentDeliveryPresentation(
  attachment: ShellAttachment,
  modelId?: string,
): AttachmentDeliveryPresentation {
  return getAttachmentDeliveryModePresentation(
    getAttachmentDeliveryMode(
      attachment,
      getModelNativeFileMode(modelId ?? 'claude-sonnet-4-6'),
    ),
    modelId,
  )
}

export function getResolvedAttachmentDeliveryPresentation(
  attachment: ShellAttachment,
  modelId?: string,
  log?: Pick<ShellLog, 'attachmentDeliveryMode' | 'modelId'> | null,
): AttachmentDeliveryPresentation {
  const resolvedModelId = log?.modelId ?? modelId

  return log?.attachmentDeliveryMode
    ? getAttachmentDeliveryModePresentation(log.attachmentDeliveryMode, resolvedModelId)
    : getAttachmentDeliveryPresentation(attachment, modelId)
}

export function findLatestAttachmentDeliveryLog(
  logs: readonly ShellLog[],
  sessionId: string,
  attachmentName: string,
): ShellLog | null {
  const matches = logs.filter((log) => (
    log.sessionId === sessionId
    && log.kind === 'attachment'
    && log.attachmentName === attachmentName
    && Boolean(log.attachmentDeliveryMode)
  ))

  return matches.at(-1) ?? null
}
