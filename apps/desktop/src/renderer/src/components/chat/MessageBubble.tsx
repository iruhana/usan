/**
 * MessageBubble — single chat message display with markdown and copy
 */

import { lazy, memo, Suspense, useState, useCallback } from 'react'
import { Umbrella, CheckCircle, AlertCircle, Loader2, RefreshCw, Copy, Check } from 'lucide-react'
import type { ChatMessage } from '@shared/types/ipc'
import { useChatStore } from '../../stores/chat.store'
import { t } from '../../i18n'
import { Button } from '../ui'
import { shouldRenderMarkdown } from './markdown-heuristics'

interface Props {
  message: ChatMessage
}

const MarkdownContent = lazy(() => import('./MarkdownContent'))

function formatTime(ts: number): string {
  const d = new Date(ts)
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const period = h < 12 ? t('time.am') : t('time.pm')
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${period} ${h12}:${m}`
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 p-1 rounded-[var(--radius-sm)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-all"
      aria-label={copied ? t('chat.copied') : t('chat.copy')}
      title={copied ? t('chat.copied') : t('chat.copy')}
    >
      {copied ? <Check size={14} className="text-[var(--color-success)]" /> : <Copy size={14} />}
    </button>
  )
}

export default memo(function MessageBubble({ message }: Props) {
  const retryLastMessage = useChatStore((s) => s.retryLastMessage)
  const isStreaming = useChatStore((s) => s.isStreaming)

  const isUser = message.role === 'user'
  const isTool = message.role === 'tool'
  const isAssistant = message.role === 'assistant'
  const renderMarkdown = isAssistant && shouldRenderMarkdown(message.content)

  // Tool result message
  if (isTool) {
    const isError = message.content.startsWith('\u274C') || message.content.startsWith('Error')
    const screenshot = message.toolResults?.[0]?.result as { image?: string } | null
    const hasImage = screenshot?.image && typeof screenshot.image === 'string'
    return (
      <div className="flex justify-start">
        <div className="flex flex-col gap-2">
          <div
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-[var(--radius-lg)] text-[length:var(--text-md)] ${
              isError
                ? 'bg-[var(--color-danger-light)] text-[var(--color-danger)]'
                : 'bg-[var(--color-success-light)] text-[var(--color-success)]'
            }`}
          >
            {isError ? (
              <AlertCircle size={16} className="shrink-0" />
            ) : (
              <CheckCircle size={16} className="shrink-0" />
            )}
            <span className="font-medium">{message.content}</span>
          </div>
          {hasImage && (
            <img
              src={`data:image/png;base64,${screenshot?.image}`}
              alt={t('tool.screenshot')}
              className="max-w-sm rounded-[var(--radius-lg)] shadow-[var(--shadow-md)]"
            />
          )}
        </div>
      </div>
    )
  }

  // Tool call in-progress
  if (isAssistant && message.toolCalls?.length) {
    return (
      <div className="flex justify-start">
        <div className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)] bg-[var(--color-primary-muted)] text-[length:var(--text-md)]">
          <Loader2 size={16} className="text-[var(--color-primary)] shrink-0 animate-spin" />
          <div className="flex flex-col">
            <span className="font-medium text-[var(--color-primary)]">
              {(() => {
                const name = message.toolCalls?.[0]?.name
                if (!name) return ''
                const key = `tool.${name}`
                const label = t(key)
                return label !== key ? label : name
              })()}
            </span>
            <span className="text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
              {t('tool.running')}
            </span>
          </div>
        </div>
      </div>
    )
  }

  // Error message — with retry
  if (isAssistant && message.isError) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[80%] rounded-[var(--radius-lg)] bg-[var(--color-danger-light)] px-4 py-3 text-[length:var(--text-md)]">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={16} className="text-[var(--color-danger)] shrink-0" />
            <span className="font-medium text-[var(--color-danger)]">
              {t('error.title')}
            </span>
          </div>
          <p className="text-[var(--color-text)] mb-3" style={{ lineHeight: 'var(--line-height-base)' }}>
            {message.content}
          </p>
          <Button
            size="sm"
            onClick={retryLastMessage}
            disabled={isStreaming}
            leftIcon={<RefreshCw size={15} />}
          >
            {t('error.chatRetry')}
          </Button>
        </div>
      </div>
    )
  }

  // Regular message
  const timeLabel = message.timestamp ? formatTime(message.timestamp) : ''

  return (
    <div className={`group flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[80%]`}>
        {/* Assistant avatar row */}
        {isAssistant && (
          <div className="flex items-center gap-2 mb-1.5 px-1">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] flex items-center justify-center shadow-[var(--shadow-xs)]">
              <Umbrella size={10} className="text-white" strokeWidth={2.2} />
            </div>
            <span className="text-[length:var(--text-xs)] font-semibold text-[var(--color-text-secondary)]">
              {t('app.name')}
            </span>
            <CopyButton text={message.content} />
          </div>
        )}

        <div
          className={`px-4 py-3 text-[length:var(--text-md)] ${
            isUser
              ? 'bg-[var(--color-primary)] text-white rounded-[var(--radius-xl)] rounded-br-[var(--radius-sm)] shadow-[var(--shadow-primary)]'
              : 'bg-[var(--color-bg-card)] rounded-[var(--radius-xl)] rounded-bl-[var(--radius-sm)] shadow-[var(--shadow-sm)] ring-1 ring-[var(--color-border-subtle)]'
          }`}
          style={{ lineHeight: 'var(--line-height-base)' }}
        >
          {renderMarkdown ? (
            <Suspense fallback={<div className="whitespace-pre-wrap">{message.content}</div>}>
              <MarkdownContent content={message.content} />
            </Suspense>
          ) : (
            <div className="whitespace-pre-wrap">{message.content}</div>
          )}
        </div>
        {timeLabel && (
          <span className="text-[length:var(--text-xs)] text-[var(--color-text-muted)] mt-1 px-1 opacity-60">
            {timeLabel}
          </span>
        )}
      </div>
    </div>
  )
})
