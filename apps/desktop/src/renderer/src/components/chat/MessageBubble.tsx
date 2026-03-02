/**
 * MessageBubble — single chat message display
 * 컴맹 친화: large text, clear bubbles, glassmorphism, tool call cards
 */

import { memo } from 'react'
import { Sparkles, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import type { ChatMessage } from '@shared/types/ipc'
import { t } from '../../i18n'

interface Props {
  message: ChatMessage
}

export default memo(function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user'
  const isTool = message.role === 'tool'
  const isAssistant = message.role === 'assistant'

  // Tool result message (compact card + optional screenshot preview)
  if (isTool) {
    const isError = message.content.startsWith('❌')
    const screenshot = message.toolResults?.[0]?.result as { image?: string } | null
    const hasImage = screenshot?.image && typeof screenshot.image === 'string'
    return (
      <div className="flex justify-start">
        <div className="flex flex-col gap-2">
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-muted)]"
            style={{ fontSize: 'calc(14px * var(--font-scale))' }}
          >
            {isError ? (
              <AlertCircle size={16} className="text-[var(--color-danger)] shrink-0" />
            ) : (
              <CheckCircle size={16} className="text-[var(--color-success)] shrink-0" />
            )}
            {message.content}
          </div>
          {hasImage && (
            <img
              src={`data:image/png;base64,${screenshot!.image}`}
              alt={t('tool.screenshot')}
              className="max-w-md rounded-xl border border-[var(--color-border)] shadow-sm"
            />
          )}
        </div>
      </div>
    )
  }

  // Tool call in-progress (assistant message with tool calls)
  if (isAssistant && message.toolCalls?.length) {
    return (
      <div className="flex justify-start">
        <div
          className="flex items-center gap-3 px-5 py-3 rounded-xl bg-[var(--color-primary-light)] border border-[var(--color-border)]"
          style={{ fontSize: 'calc(14px * var(--font-scale))' }}
        >
          <Loader2 size={18} className="text-[var(--color-primary)] shrink-0 animate-spin" />
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-[var(--color-primary)]">
              {(() => {
                const name = message.toolCalls![0].name
                if (!name) return ''
                const key = `tool.${name}`
                const label = t(key)
                return label !== key ? label : name
              })()}
            </span>
            <span className="text-[var(--color-text-muted)]" style={{ fontSize: 'calc(12px * var(--font-scale))' }}>
              {t('tool.running')}
            </span>
          </div>
        </div>
      </div>
    )
  }

  // Regular user/assistant message
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-5 py-4 ${
          isUser
            ? 'bg-[var(--color-primary)] text-white'
            : 'glass'
        }`}
        style={{ fontSize: 'var(--font-size-base)', lineHeight: 'var(--line-height-base)' }}
      >
        {isAssistant && (
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={18} className="text-[var(--color-primary)]" />
            <span
              className="font-semibold text-[var(--color-primary)]"
              style={{ fontSize: 'calc(14px * var(--font-scale))' }}
            >
              {t('app.name')}
            </span>
          </div>
        )}
        <div className="whitespace-pre-wrap">{message.content}</div>
      </div>
    </div>
  )
})
