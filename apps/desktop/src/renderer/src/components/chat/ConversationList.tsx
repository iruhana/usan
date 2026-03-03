import { useMemo, useState, useCallback } from 'react'
import { Plus, Trash2, MessageSquare } from 'lucide-react'
import { useChatStore } from '../../stores/chat.store'
import { useUndoStore } from '../../stores/undo.store'
import { t } from '../../i18n'
import { IconButton, Button } from '../ui'

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
  const showUndo = useUndoStore((s) => s.show)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [focusIndex, setFocusIndex] = useState(-1)

  const handleDelete = useCallback((convId: string) => {
    const conv = conversations.find((c) => c.id === convId)
    deleteConversation(convId)
    setPendingDeleteId(null)
    if (conv) {
      showUndo(t('undo.conversationDeleted'), () => {
        useChatStore.setState((s) => ({
          conversations: [conv, ...s.conversations],
        }))
      })
    }
  }, [conversations, deleteConversation, showUndo])

  const sorted = useMemo(
    () => [...conversations].sort((a, b) => getLastActivity(b) - getLastActivity(a)),
    [conversations]
  )

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (sorted.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusIndex((prev) => {
        const next = Math.min(prev + 1, sorted.length - 1)
        document.getElementById(`conv-${sorted[next].id}`)?.scrollIntoView({ block: 'nearest' })
        return next
      })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusIndex((prev) => {
        const next = Math.max(prev - 1, 0)
        document.getElementById(`conv-${sorted[next].id}`)?.scrollIntoView({ block: 'nearest' })
        return next
      })
    } else if (e.key === 'Enter' && focusIndex >= 0 && focusIndex < sorted.length) {
      e.preventDefault()
      setActiveConversation(sorted[focusIndex].id)
    } else if (e.key === 'Delete' && focusIndex >= 0 && focusIndex < sorted.length) {
      e.preventDefault()
      setPendingDeleteId(sorted[focusIndex].id)
    }
  }

  const activeDescendant = focusIndex >= 0 && focusIndex < sorted.length
    ? `conv-${sorted[focusIndex].id}`
    : undefined

  return (
    <div className="w-64 shrink-0 border-r border-[var(--color-border)] flex flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)]">
        <span className="text-[length:var(--text-md)] font-semibold text-[var(--color-text)]">
          {t('chat.conversations')}
        </span>
        <IconButton
          icon={Plus}
          size="sm"
          variant="subtle"
          label={t('chat.newChat')}
          onClick={() => newConversation()}
        />
      </div>

      {/* List */}
      <div
        className="flex-1 overflow-y-auto focus:outline-none"
        role="listbox"
        aria-label={t('chat.conversations')}
        tabIndex={0}
        onKeyDown={handleListKeyDown}
        aria-activedescendant={activeDescendant}
      >
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-[var(--color-text-muted)]">
            <MessageSquare size={28} className="mb-2 opacity-30" />
            <p className="text-[length:var(--text-sm)] text-center">
              {t('chat.noConversations')}
            </p>
            <Button
              size="sm"
              className="mt-3"
              onClick={() => newConversation()}
            >
              {t('chat.startNew')}
            </Button>
          </div>
        ) : (
          sorted.map((conv, idx) => {
            const isActive = conv.id === activeConversationId
            const isFocused = idx === focusIndex
            const lastTime = getLastActivity(conv)
            const msgCount = conv.messages.filter((m) => m.role === 'user').length
            const preview =
              conv.messages.length > 0
                ? conv.messages[conv.messages.length - 1].content.slice(0, 40)
                : ''

            return (
              <button
                key={conv.id}
                id={`conv-${conv.id}`}
                onClick={() => setActiveConversation(conv.id)}
                role="option"
                aria-selected={isActive}
                title={conv.title || t('chat.newConversation')}
                className={`w-full text-left px-3 py-2 transition-all group ${
                  isActive
                    ? 'bg-[var(--color-primary-light)] border-l-2 border-l-[var(--color-primary)]'
                    : isFocused
                      ? 'bg-[var(--color-surface-soft)] border-l-2 border-l-[var(--color-text-muted)]'
                      : 'hover:bg-[var(--color-surface-soft)] border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-[length:var(--text-md)] font-medium truncate ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]'}`}
                    >
                      {conv.title || t('chat.newConversation')}
                    </p>
                    {preview && (
                      <p className="text-[length:var(--text-xs)] text-[var(--color-text-muted)] truncate mt-0.5">
                        {preview}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                      <span>{formatRelativeTime(lastTime)}</span>
                      {msgCount > 0 && <span>· {msgCount} {t('chat.messages')}</span>}
                    </div>
                  </div>
                  {pendingDeleteId === conv.id ? (
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(conv.id)}
                        className="!px-2 !h-7"
                      >
                        {t('chat.delete')}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setPendingDeleteId(null)}
                        className="!px-2 !h-7"
                      >
                        {t('chat.cancel')}
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setPendingDeleteId(conv.id)
                      }}
                      className="p-1.5 rounded-[var(--radius-sm)] opacity-0 group-hover:opacity-100 hover:bg-[var(--color-danger-bg)] text-[var(--color-danger)] transition-all shrink-0"
                      aria-label={t('chat.delete')}
                    >
                      <Trash2 size={14} />
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
