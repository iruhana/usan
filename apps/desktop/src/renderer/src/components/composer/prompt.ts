import { t } from '../../i18n'
import type { ComposerAttachment, ComposerMode, ComposerSubmitPayload } from './types'

const MAX_SELECTION_LENGTH = 1200

function getModePrompt(mode: ComposerMode): string {
  switch (mode) {
    case 'search':
      return t('composer.modePrompt.search')
    case 'deep-research':
      return t('composer.modePrompt.deepResearch')
    case 'files':
      return t('composer.modePrompt.files')
    case 'browser':
      return t('composer.modePrompt.browser')
    case 'documents':
      return t('composer.modePrompt.documents')
    default:
      return ''
  }
}

function formatAttachment(attachment: ComposerAttachment): string {
  switch (attachment.kind) {
    case 'file':
      return `${t('composer.attachmentLine.file')}: ${attachment.value ?? attachment.label}`
    case 'folder':
      return `${t('composer.attachmentLine.folder')}: ${attachment.value ?? attachment.label}`
    case 'selection': {
      const text = (attachment.value ?? '').trim().slice(0, MAX_SELECTION_LENGTH)
      return [`${t('composer.attachmentLine.selection')}:`, '"""', text, '"""'].join('\n')
    }
    case 'screenshot':
      return `${t('composer.attachmentLine.screenshot')}: ${attachment.label}`
    default:
      return attachment.label
  }
}

export function buildComposerPrompt(payload: ComposerSubmitPayload): string {
  const base = payload.text.trim()
  const sections: string[] = [base]
  const modePrompt = getModePrompt(payload.mode)
  const attachmentLines = payload.attachments.map(formatAttachment)

  if (modePrompt) {
    sections.push(modePrompt)
  }

  if (attachmentLines.length > 0) {
    sections.push(
      [t('composer.attachmentContextTitle'), ...attachmentLines.map((line) => `- ${line.replace(/\n/g, '\n  ')}`)].join('\n'),
    )
  }

  return sections.filter(Boolean).join('\n\n')
}
