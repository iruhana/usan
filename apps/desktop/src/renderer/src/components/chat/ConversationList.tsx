import { useMemo, useState, useCallback, useEffect } from 'react'
import { Plus, Trash2, MessageSquare, RotateCcw, Archive } from 'lucide-react'
import { useChatStore } from '../../stores/chat.store'
import { useUndoStore } from '../../stores/undo.store'
import { t } from '../../i18n'
import { IconButton, Button } from '../ui'

interface TrashItem {
  id: string
  title: string
  deletedAt: number
  messageCount: number
}

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
  const [showTrash, setShowTrash] = useState(false)
  const [trashItems, setTrashItems] = useState<TrashItem[]>([])

  const loadTrash = useCallback(async () => {
    try {
      const items = await window.usan?.conversations.trashList() as TrashItem[]
      setTrashItems(items || [])
    } catch { setTrashItems([]) }
  }, [])

  useEffect(() => {
    if (showTrash) loadTrash()
  }, [showTrash, loadTrash])

  const handleDelete = useCallback(async (convId: string) => {
    setPendingDeleteId(null)
    try {
      await window.usan?.conversations.softDelete(convId)
    } catch { /* fallback */ }
    deleteConversation(convId)
    showUndo(t('undo.conversationDeleted'), async () => {
      try {
        const restored = await window.usan?.conversations.restore(convId)
        if (restored) {
          useChatStore.setState((s) => ({
            conversations: [restored, ...s.conversations],
          }))
        }
      } catch { /* restore failed */ }
    })
  }, [deleteConversation, showUndo])

  const handleRestore = useCallback(async (id: string) => {
    try {
      const restored = await window.usan?.conversations.restore(id)
      if (restored) {
        useChatStore.setState((s) => ({
          conversations: [restored, ...s.conversations],
        }))
        loadTrash()
      }
    } catch { /* restore failed */ }
  }, [loadTrash])

  const handlePermanentDelete = useCallback(async (id: string) => {
    try {
      await window.usan?.conversations.trashPermanentDelete(id)
      loadTrash()
    } catch { /* delete failed */ }
  }, [loadTrash])

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
    <div className="w-64 shrink-0 border-r border-[var(--color-border-subtle)] flex flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-11 shrink-0">
        <span className="text-[length:var(--text-sm)] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
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
        className="flex-1 overflow-y-auto px-1.5 focus:outline-none"
        role={sorted.length > 0 ? 'listbox' : undefined}
        aria-label={sorted.length > 0 ? t('chat.conversations') : undefined}
        tabIndex={sorted.length > 0 ? 0 : -1}
        onKeyDown={sorted.length > 0 ? handleListKeyDown : undefined}
        aria-activedescendant={sorted.length > 0 ? activeDescendant : undefined}
      >
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-[var(--color-text-muted)]">
            <div className="w-12 h-12 rounded-[var(--radius-lg)] bg-[var(--color-surface-soft)] flex items-center justify-center mb-3">
              <MessageSquare size={22} className="text-[var(--color-text-muted)] opacity-50" />
            </div>
            <p className="text-[length:var(--text-sm)] text-center mb-3">
              {t('chat.noConversations')}
            </p>
            <Button
              size="sm"
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
              <div
                key={conv.id}
                id={`conv-${conv.id}`}
                onClick={() => setActiveConversation(conv.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setActiveConversation(conv.id)
                  }
                }}
                role="option"
                tabIndex={-1}
                aria-selected={isActive}
                aria-label={conv.title || t('chat.newConversation')}
                title={conv.title || t('chat.newConversation')}
                className={`w-full text-left px-3 py-2.5 rounded-[var(--radius-md)] mb-0.5 transition-all group cursor-pointer ${
                  isActive
                    ? 'bg-[var(--color-bg-card)] shadow-[var(--shadow-sm)] ring-1 ring-[var(--color-border)]'
                    : isFocused
                      ? 'bg-[var(--color-surface-soft)]'
                      : 'hover:bg-[var(--color-surface-soft)]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-[length:var(--text-md)] truncate ${isActive ? 'font-semibold text-[var(--color-text)]' : 'font-medium text-[var(--color-text)]'}`}
                    >
                      {conv.title || t('chat.newConversation')}
                    </p>
                    {preview && (
                      <p className="text-[length:var(--text-xs)] text-[var(--color-text-muted)] truncate mt-0.5">
                        {preview}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1 text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                      <span>{formatRelativeTime(lastTime)}</span>
                      {msgCount > 0 && (
                        <>
                          <span className="w-0.5 h-0.5 rounded-full bg-[var(--color-text-muted)] opacity-50" />
                          <span>{msgCount} {t('chat.messages')}</span>
                        </>
                      )}
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
                      className="p-1.5 rounded-[var(--radius-sm)] opacity-0 group-hover:opacity-100 hover:bg-[var(--color-danger-light)] text-[var(--color-danger)] transition-all shrink-0"
                      aria-label={t('chat.delete')}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Trash toggle */}
      <div className="border-t border-[var(--color-border-subtle)] mx-1.5">
        <button
          onClick={() => setShowTrash(!showTrash)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] text-[length:var(--text-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-soft)] transition-all mt-1"
        >
          <Archive size={14} />
          <span>{t('chat.trash')}</span>
          {trashItems.length > 0 && (
            <span className="ml-auto text-[length:var(--text-xs)] bg-[var(--color-surface-soft)] px-1.5 py-0.5 rounded-full font-medium">
              {trashItems.length}
            </span>
          )}
        </button>

        {showTrash && (
          <div className="max-h-48 overflow-y-auto pb-1">
            {trashItems.length === 0 ? (
              <p className="px-3 py-3 text-center text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                {t('chat.trashEmpty')}
              </p>
            ) : (
              trashItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-sm)] group hover:bg-[var(--color-surface-soft)] transition-all mx-1">
                  <div className="flex-1 min-w-0">
                    <p className="text-[length:var(--text-xs)] text-[var(--color-text-muted)] truncate">
                      {item.title || t('chat.newConversation')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRestore(item.id)}
                    className="p-1 rounded-[var(--radius-sm)] opacity-0 group-hover:opacity-100 hover:bg-[var(--color-success-light)] text-[var(--color-success)] transition-all"
                    title={t('chat.restore')}
                    aria-label={t('chat.restore')}
                  >
                    <RotateCcw size={12} />
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(item.id)}
                    className="p-1 rounded-[var(--radius-sm)] opacity-0 group-hover:opacity-100 hover:bg-[var(--color-danger-light)] text-[var(--color-danger)] transition-all"
                    title={t('chat.permanentDelete')}
                    aria-label={t('chat.permanentDelete')}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
