export type ComposerMode = 'search' | 'deep-research' | 'files' | 'browser' | 'documents'

export const COMPOSER_MODES: ComposerMode[] = [
  'search',
  'deep-research',
  'files',
  'browser',
  'documents',
]

export type ComposerAttachmentKind = 'file' | 'folder' | 'screenshot' | 'selection'

export interface ComposerAttachment {
  id: string
  kind: ComposerAttachmentKind
  label: string
  value?: string
  previewImage?: string
  meta?: Record<string, string | number | boolean>
}

export interface ComposerSubmitPayload {
  text: string
  mode: ComposerMode
  attachments: ComposerAttachment[]
}
