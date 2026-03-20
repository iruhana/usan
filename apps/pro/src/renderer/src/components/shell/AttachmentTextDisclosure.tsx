import { useId, useState } from 'react'
import { getAttachmentTextPreview } from '../../utils/attachmentPreview'

type AttachmentTextDisclosureScope = 'composer' | 'message' | 'compare' | 'worklist'

export default function AttachmentTextDisclosure({
  attachmentName,
  textContent,
  previewChars = 140,
  scope,
}: {
  attachmentName: string
  textContent?: string
  previewChars?: number
  scope: AttachmentTextDisclosureScope
}) {
  const [expanded, setExpanded] = useState(false)
  const content = textContent?.trim()
  const previewText = getAttachmentTextPreview(content, previewChars)
  const panelId = useId()

  if (!content || !previewText) {
    return null
  }

  const previewProps = scope === 'composer'
    ? { 'data-composer-attachment-text-preview': attachmentName }
    : scope === 'compare'
      ? { 'data-compare-attachment-text-preview': attachmentName }
      : scope === 'worklist'
        ? { 'data-worklist-attachment-text-preview': attachmentName }
      : { 'data-message-attachment-text-preview': attachmentName }
  const toggleProps = scope === 'composer'
    ? { 'data-composer-attachment-text-toggle': attachmentName }
    : scope === 'compare'
      ? { 'data-compare-attachment-text-toggle': attachmentName }
      : scope === 'worklist'
        ? { 'data-worklist-attachment-text-toggle': attachmentName }
      : { 'data-message-attachment-text-toggle': attachmentName }
  const contentProps = scope === 'composer'
    ? { 'data-composer-attachment-text-content': attachmentName }
    : scope === 'compare'
      ? { 'data-compare-attachment-text-content': attachmentName }
      : scope === 'worklist'
        ? { 'data-worklist-attachment-text-content': attachmentName }
      : { 'data-message-attachment-text-content': attachmentName }

  return (
    <div style={{ marginTop: 4 }}>
      <div
        {...previewProps}
        style={{
          fontSize: '11px',
          lineHeight: 1.4,
          color: 'var(--text-secondary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {previewText}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="focus-ring"
        {...toggleProps}
        style={{
          marginTop: 4,
          padding: 0,
          border: 'none',
          background: 'transparent',
          color: 'var(--accent)',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {expanded ? '접기' : '전문 보기'}
      </button>
      {expanded && (
        <pre
          id={panelId}
          {...contentProps}
          style={{
            margin: '6px 0 0',
            padding: '8px 10px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-base)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 180,
            overflow: 'auto',
          }}
        >
          {content}
        </pre>
      )}
    </div>
  )
}
