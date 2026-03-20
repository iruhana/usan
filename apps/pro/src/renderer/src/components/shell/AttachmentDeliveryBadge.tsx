import type { ShellAttachment, ShellLog } from '@shared/types'
import {
  getResolvedAttachmentDeliveryPresentation,
} from '../../utils/attachmentDelivery'

export default function AttachmentDeliveryBadge({
  attachment,
  modelId,
  context,
  log,
}: {
  attachment: ShellAttachment
  modelId?: string
  context: 'composer' | 'message' | 'compare' | 'worklist'
  log?: ShellLog | null
}) {
  const resolvedModelId = log?.modelId ?? modelId
  const badge = getResolvedAttachmentDeliveryPresentation(attachment, modelId, log)
  const source = log?.attachmentDeliveryMode ? 'runtime' : 'derived'
  const runtimeTitle = log?.attachmentDeliveryMode
    ? `실제 전송 경로${resolvedModelId ? ` · ${resolvedModelId}` : ''}${log.ts ? ` · ${log.ts}` : ''}`
    : undefined

  return (
    <span
      data-attachment-delivery-context={context}
      data-attachment-delivery-name={attachment.name}
      data-attachment-delivery-mode={badge.mode}
      data-attachment-delivery-source={source}
      data-attachment-delivery-model={resolvedModelId ?? ''}
      data-attachment-delivery-ts={log?.ts ?? ''}
      title={runtimeTitle}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: '999px',
        padding: '2px 8px',
        fontSize: 'var(--fs-xs)',
        fontWeight: 600,
        color: badge.color,
        background: badge.background,
      }}
    >
      {badge.label}
    </span>
  )
}
