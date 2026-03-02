import { useMemo, useState } from 'react'
import { Plus, Trash2, MessageSquare } from 'lucide-react'
import { useChatStore } from '../../stores/chat.store'
import { t } from '../../i18n'

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return t('time.justNow')
  if (minutes < 60) return `${minutes}${t('time.minutesAgo')}`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}${t('time.hoursAgo')}`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}${t('time.daysAgo')}`
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function getLastActivity(conv: { messages: { timestamp: number }[]; createdAt: number }): number {
  if (conv.messages.length === 0) return conv.createdAt
  return conv.messages[conv.messages.length - 1].timestamp
}

export default function ConversationList() {
  const conversations = useChatStore((s) => s.conversations)
  const activeConversationId = useChatStore((s) => s.activeConversationId)
  const newConversation = useChatStore((s) => s.newConversation)
  const setActiveConversation = useChatStore((s) => s.setActiveConversation)
  const deleteConversation = useChatStore((s) => s.deleteConversation)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const sorted = useMemo(
    () => [...conversations].sort((a, b) => getLastActivity(b) - getLastActivity(a)),
    [conversations]
  )

  return (
    <div className="w-72 shrink-0 border-r border-[var(--color-border)] flex flex-col bg-[var(--color-bg-sidebar)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <span className="font-semibold" style={{ fontSize: 'var(--font-size-base)' }}>
          {t('chat.conversations')}
        </span>
        <button
          onClick={() => newConversation()}
          className="p-3 rounded-lg hover:bg-[var(--color-bg-card)] transition-all text-[var(--color-primary)]"
          style={{ minWidth: '44px', minHeight: '44px' }}
          aria-label={t('chat.newChat')}
        >
          <Plus size={20} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-[var(--color-text-muted)]">
            <MessageSquare size={32} className="mb-2 opacity-40" />
            <p className="text-center" style={{ fontSize: 'var(--font-size-sm)' }}>
              {t('chat.noConversations')}
            </p>
            <button
              onClick={() => newConversation()}
              className="mt-3 px-4 py-2 rounded-xl bg-[var(--color-primary)] text-white font-medium hover:opacity-90 transition-all"
              style={{ fontSize: 'var(--font-size-sm)' }}
            >
              {t('chat.startNew')}
            </button>
          </div>
        ) : (
          sorted.map((conv) => {
            const isActive = conv.id === activeConversationId
            const lastTime = getLastActivity(conv)
            const msgCount = conv.messages.filter((m) => m.role === 'user').length
            const preview =
              conv.messages.length > 0
                ? conv.messages[conv.messages.length - 1].content.slice(0, 40)
                : ''

            return (
              <button
                key={conv.id}
                onClick={() => setActiveConversation(conv.id)}
                className={`w-full text-left px-4 py-3 border-b border-[var(--color-border)] transition-all group ${
                  isActive
                    ? 'bg-[var(--color-primary-light)]'
                    : 'hover:bg-[var(--color-bg-card)]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p
                      className="font-medium truncate text-[var(--color-text)]"
                      style={{ fontSize: 'var(--font-size-sm)' }}
                    >
                      {conv.title || t('chat.newConversation')}
                    </p>
                    {preview && (
                      <p
                        className="text-[var(--color-text-muted)] truncate mt-0.5"
                        style={{ fontSize: 'calc(12px * var(--font-scale))' }}
                      >
                        {preview}
                      </p>
                    )}
                    <div
                      className="flex items-center gap-2 mt-1 text-[var(--color-text-muted)]"
                      style={{ fontSize: 'calc(11px * var(--font-scale))' }}
                    >
                      <span>{formatRelativeTime(lastTime)}</span>
                      {msgCount > 0 && <span>· {msgCount} {t('chat.messages')}</span>}
                    </div>
                  </div>
                  {pendingDeleteId === conv.id ? (
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => { deleteConversation(conv.id); setPendingDeleteId(null) }}
                        className="px-3 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 transition-all"
                        style={{ fontSize: 'calc(13px * var(--font-scale))', minHeight: '44px' }}
                      >
                        {t('chat.delete')}
                      </button>
                      <button
                        onClick={() => setPendingDeleteId(null)}
                        className="px-3 rounded-lg bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-sidebar)] transition-all"
                        style={{ fontSize: 'calc(13px * var(--font-scale))', minHeight: '44px' }}
                      >
                        {t('chat.cancel')}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setPendingDeleteId(conv.id)
                      }}
                      className="p-2.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-all shrink-0"
                      style={{ minWidth: '44px', minHeight: '44px' }}
                      aria-label={t('chat.delete')}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
