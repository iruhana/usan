import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Badge, InlineNotice } from '../ui'
import { t } from '../../i18n'
import MarkdownContent from '../chat/MarkdownContent'
import CodeBlock from './CodeBlock'
import type { ArtifactItem } from './types'

interface ArtifactViewProps {
  artifact: ArtifactItem | null
  className?: string
}

function parseTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

function ArtifactTable({ artifact }: { artifact: ArtifactItem }) {
  if (!artifact.table) {
    return null
  }

  return (
    <div className="overflow-x-auto rounded-[20px] bg-[var(--color-bg-card)] shadow-[var(--shadow-xs)] ring-1 ring-[var(--color-border-subtle)]">
      <table className="min-w-full border-collapse text-left text-[13px]">
        <thead className="bg-[var(--color-panel-muted)]">
          <tr>
            {artifact.table.headers.map((header) => (
              <th
                key={header}
                className="border-b border-[var(--color-border-subtle)] px-4 py-3 font-semibold text-[var(--color-text)]"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {artifact.table.rows.map((row, rowIndex) => (
            <tr key={`${artifact.id}-row-${rowIndex}`} className="odd:bg-white/40 dark:odd:bg-white/[0.02]">
              {row.map((cell, cellIndex) => (
                <td
                  key={`${artifact.id}-cell-${rowIndex}-${cellIndex}`}
                  className="border-b border-[var(--color-border-subtle)] px-4 py-3 align-top text-[var(--color-text-secondary)] last:border-b-0"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ArtifactView({ artifact, className = '' }: ArtifactViewProps) {
  const [copied, setCopied] = useState(false)

  const copyText = artifact?.copyText || artifact?.content || ''
  const canCopy = copyText.trim().length > 0

  const headerBadges: Array<{
    id: string
    text: string
    variant: 'default' | 'success' | 'warning' | 'info'
  }> = artifact
    ? [
        {
          id: 'source',
          text: artifact.sourceLabel || t(`artifact.source.${artifact.source}`),
          variant: artifact.source === 'tool' ? 'warning' : artifact.source === 'draft' ? 'info' : 'success',
        },
        {
          id: 'kind',
          text: t(`artifact.kind.${artifact.kind}`),
          variant: 'default',
        },
      ]
    : []

  async function handleCopy(): Promise<void> {
    if (!canCopy) return

    try {
      await navigator.clipboard.writeText(copyText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Ignore clipboard failures.
    }
  }

  if (!artifact) {
    return (
      <InlineNotice tone="info" title={t('artifact.emptyTitle')} className={className}>
        {t('artifact.emptyBody')}
      </InlineNotice>
    )
  }

  return (
    <section
      className={`rounded-[24px] bg-[var(--color-panel-bg-strong)] px-5 py-5 shadow-[var(--shadow-sm)] ring-1 ring-[var(--color-border-subtle)] ${className}`.trim()}
      aria-label={t('artifact.viewTitle')}
      data-testid="artifact-view"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {headerBadges.map((badge) => (
              <Badge key={badge.id} variant={badge.variant}>
                {badge.text}
              </Badge>
            ))}
          </div>
          <h3 className="mt-3 truncate text-[20px] font-semibold tracking-[-0.02em] text-[var(--color-text)]">
            {artifact.title}
          </h3>
          <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
            {`${t('artifact.generatedAt')} ${parseTimestamp(artifact.createdAt)}`}
          </p>
        </div>

        {canCopy ? (
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="inline-flex items-center gap-1.5 rounded-[16px] bg-[var(--color-panel-muted)] px-3 py-2 text-[12px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text)]"
            data-testid="artifact-copy-button"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? t('chat.copied') : t('chat.copy')}</span>
          </button>
        ) : null}
      </div>

      <div className="mt-5">
        {artifact.kind === 'image' && artifact.image ? (
          <div className="overflow-hidden rounded-[22px] bg-[var(--color-bg-card)] shadow-[var(--shadow-xs)] ring-1 ring-[var(--color-border-subtle)]">
            <img
              src={`data:image/png;base64,${artifact.image}`}
              alt={artifact.title}
              className="max-h-[420px] w-full object-contain bg-[var(--color-panel-muted)]"
            />
          </div>
        ) : null}

        {artifact.kind === 'markdown' && artifact.content ? (
          <div className="rounded-[22px] bg-[var(--color-bg-card)] px-5 py-5 shadow-[var(--shadow-xs)] ring-1 ring-[var(--color-border-subtle)]">
            <MarkdownContent content={artifact.content} />
          </div>
        ) : null}

        {artifact.kind === 'table' ? <ArtifactTable artifact={artifact} /> : null}

        {(artifact.kind === 'code' || artifact.kind === 'json') && artifact.content ? (
          <CodeBlock code={artifact.content} language={artifact.language || artifact.kind} />
        ) : null}

        {artifact.kind === 'text' && artifact.content ? (
          <div className="rounded-[22px] bg-[var(--color-bg-card)] px-5 py-5 shadow-[var(--shadow-xs)] ring-1 ring-[var(--color-border-subtle)]">
            <pre className="whitespace-pre-wrap text-[14px] leading-7 text-[var(--color-text-secondary)]">
              {artifact.content}
            </pre>
          </div>
        ) : null}
      </div>
    </section>
  )
}
