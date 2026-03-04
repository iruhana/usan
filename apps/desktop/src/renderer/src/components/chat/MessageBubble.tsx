/**
 * MessageBubble — single chat message display with markdown and copy
 */

import { memo, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Sparkles, CheckCircle, AlertCircle, Loader2, RefreshCw, Copy, Check } from 'lucide-react'
import type { ChatMessage } from '@shared/types/ipc'
import { useChatStore } from '../../stores/chat.store'
import { t } from '../../i18n'
import { Button } from '../ui'

interface Props {
  message: ChatMessage
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const period = h < 12 ? t('time.am') : t('time.pm')
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${period} ${h12}:${m}`
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        h1: ({ children }) => <h1 className="text-[length:var(--text-lg)] font-bold mb-2 mt-3 first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="text-[length:var(--text-md)] font-bold mb-2 mt-3 first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="text-[length:var(--text-md)] font-semibold mb-1 mt-2 first:mt-0">{children}</h3>,
        ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        code: ({ className, children }) => {
          const isBlock = className?.includes('language-')
          if (isBlock) {
            return (
              <code className="block bg-[var(--color-surface-soft)] border border-[var(--color-border)]/50 rounded-[var(--radius-md)] px-3 py-2 text-[length:var(--text-sm)] font-mono overflow-x-auto whitespace-pre my-2">
                {children}
              </code>
            )
          }
          return (
            <code className="bg-[var(--color-surface-soft)] border border-[var(--color-border)]/50 rounded px-1.5 py-0.5 text-[length:var(--text-sm)] font-mono">
              {children}
            </code>
          )
        },
        pre: ({ children }) => <pre className="overflow-x-auto my-2">{children}</pre>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] underline hover:opacity-80">
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-3 border-[var(--color-primary)]/40 pl-3 my-2 text-[var(--color-text-muted)] italic">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="w-full border-collapse text-[length:var(--text-sm)]">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-2 py-1 text-left font-semibold">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-[var(--color-border)] px-2 py-1">{children}</td>
        ),
        hr: () => <hr className="border-[var(--color-border)] my-3" />,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
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
            <MarkdownContent content={message.content} />
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
