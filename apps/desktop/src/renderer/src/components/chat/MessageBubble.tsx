/**
 * MessageBubble — single chat message display with markdown and copy
 */

import { lazy, memo, Suspense, useState, useCallback } from 'react'
import { Sparkles, CheckCircle, AlertCircle, Loader2, RefreshCw, Copy, Check } from 'lucide-react'
import type { ChatMessage } from '@shared/types/ipc'
import { useChatStore } from '../../stores/chat.store'
import { t } from '../../i18n'
import { Button } from '../ui'

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
      className="opacity-0 group-hover:opacity-100 p-1 rounded-[var(--radius-sm)] hover:bg-[var(--color-surface-soft)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-all"
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

  // Tool result message
  if (isTool) {
    const isError = message.content.startsWith('\u274C') || message.content.startsWith('Error')
    const screenshot = message.toolResults?.[0]?.result as { image?: string } | null
    const hasImage = screenshot?.image && typeof screenshot.image === 'string'
    return (
      <div className="flex justify-start">
        <div className="flex flex-col gap-2">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] border text-[length:var(--text-md)] ${
              isError
                ? 'bg-[var(--color-danger-bg)] border-[var(--color-danger)]/20'
                : 'bg-[var(--color-surface-soft)] border-[var(--color-border)]'
            }`}
          >
            {isError ? (
              <AlertCircle size={16} className="text-[var(--color-danger)] shrink-0" />
            ) : (
              <CheckCircle size={16} className="text-[var(--color-success)] shrink-0" />
            )}
            <span className={`font-medium ${isError ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]'}`}>
              {message.content}
            </span>
          </div>
          {hasImage && (
            <img
              src={`data:image/png;base64,${screenshot?.image}`}
              alt={t('tool.screenshot')}
              className="max-w-sm rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-sm)]"
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
        <div className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)] bg-[var(--color-primary-light)] border border-[var(--color-primary)]/15 text-[length:var(--text-md)]">
          <Loader2 size={18} className="text-[var(--color-primary)] shrink-0 animate-spin" />
          <div className="flex flex-col">
            <span className="font-semibold text-[var(--color-primary)]">
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
        <div className="max-w-[80%] rounded-[var(--radius-lg)] bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/20 px-4 py-3 text-[length:var(--text-md)]">
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
        <div
          className={`px-4 py-3 text-[length:var(--text-md)] ${
            isUser
              ? 'bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] text-[var(--color-text-inverse)] rounded-xl rounded-br-sm shadow-[var(--shadow-md)]'
              : 'bg-[var(--color-surface-soft)] border border-[var(--color-border)]/50 rounded-xl rounded-bl-sm'
          }`}
          style={{ lineHeight: 'var(--line-height-base)' }}
        >
          {isAssistant && (
            <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-[var(--color-primary)]/15">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
                  <Sparkles size={11} className="text-[var(--color-text-inverse)]" />
                </div>
                <span className="text-[length:var(--text-xs)] font-semibold text-[var(--color-primary)]">
                  {t('app.name')}
                </span>
              </div>
              <CopyButton text={message.content} />
            </div>
          )}
          {isAssistant ? (
            <Suspense fallback={<div className="whitespace-pre-wrap">{message.content}</div>}>
              <MarkdownContent content={message.content} />
            </Suspense>
          ) : (
            <div className="whitespace-pre-wrap">{message.content}</div>
          )}
        </div>
        {timeLabel && (
          <span className="text-[length:var(--text-xs)] text-[var(--color-text-muted)] mt-1 px-1">
            {timeLabel}
          </span>
        )}
      </div>
    </div>
  )
})
