import { useMemo, useState, useCallback, useEffect } from 'react'
import { MessageSquare, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useChatStore } from '../../stores/chat.store'
import { useUndoStore } from '../../stores/undo.store'
import { t } from '../../i18n'
import { Button } from '../ui'

interface TrashItem {
  id: string
  title: string
  deletedAt: number
  messageCount: number
}

interface ConversationListProps {
  variant?: 'inline' | 'dropdown'
  onSelectConversation?: () => void
  className?: string
}

function getLastActivity(conv: { messages: { timestamp: number }[]; createdAt: number }): number {
  if (conv.messages.length === 0) return conv.createdAt
  return conv.messages[conv.messages.length - 1].timestamp
}

function formatActivity(ts: number): string {
  const date = new Date(ts)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

export default function ConversationList({
  variant = 'inline',
  onSelectConversation,
  className = '',
}: ConversationListProps) {
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

  const isDropdown = variant === 'dropdown'

  const loadTrash = useCallback(async () => {
    try {
      const items = (await window.usan?.conversations.trashList()) as TrashItem[]
      setTrashItems(items || [])
    } catch {
      setTrashItems([])
    }
  }, [])

  useEffect(() => {
    if (isDropdown) {
      loadTrash()
    }
  }, [isDropdown, loadTrash])

  useEffect(() => {
    if (showTrash) loadTrash()
  }, [showTrash, loadTrash])

  const handleDelete = useCallback(
    async (convId: string) => {
      setPendingDeleteId(null)
      try {
        await window.usan?.conversations.softDelete(convId)
      } catch {
        // ignore and rely on in-memory delete
      }
      deleteConversation(convId)
      showUndo(t('undo.conversationDeleted'), async () => {
        try {
          const restored = await window.usan?.conversations.restore(convId)
          if (restored) {
            useChatStore.setState((s) => ({
              conversations: [restored, ...s.conversations],
            }))
          }
        } catch {
          // restore failed
        }
      })
      onSelectConversation?.()
    },
    [deleteConversation, onSelectConversation, showUndo],
  )

  const handleRestore = useCallback(
    async (id: string) => {
      try {
        const restored = await window.usan?.conversations.restore(id)
        if (restored) {
          useChatStore.setState((s) => ({
            conversations: [restored, ...s.conversations],
          }))
          loadTrash()
        }
      } catch {
        // restore failed
      }
    },
    [loadTrash],
  )

  const handlePermanentDelete = useCallback(
    async (id: string) => {
      try {
        await window.usan?.conversations.trashPermanentDelete(id)
        loadTrash()
      } catch {
        // delete failed
      }
    },
    [loadTrash],
  )

  const sorted = useMemo(
    () =>
      [...conversations]
        .filter((conversation) => conversation.messages.length > 0)
        .sort((a, b) => getLastActivity(b) - getLastActivity(a)),
    [conversations],
  )

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (sorted.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusIndex((prev) => {
        const next = Math.min(prev + 1, sorted.length - 1)
        document.getElementById(`conv-${variant}-${sorted[next].id}`)?.scrollIntoView({
          block: 'nearest',
        })
        return next
      })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusIndex((prev) => {
        const next = Math.max(prev - 1, 0)
        document.getElementById(`conv-${variant}-${sorted[next].id}`)?.scrollIntoView({
          block: 'nearest',
        })
        return next
      })
    } else if (e.key === 'Enter' && focusIndex >= 0 && focusIndex < sorted.length) {
      e.preventDefault()
      setActiveConversation(sorted[focusIndex].id)
      onSelectConversation?.()
    }
  }

  const activeDescendant =
    focusIndex >= 0 && focusIndex < sorted.length
      ? `conv-${variant}-${sorted[focusIndex].id}`
      : undefined

  const wrapperClassName = isDropdown
    ? 'flex w-[340px] max-h-[420px] flex-col overflow-hidden rounded-[18px] bg-[var(--color-bg-card)]/96 shadow-[var(--shadow-sm)]'
    : 'flex w-full flex-col'

  const headerClassName = isDropdown
    ? 'flex items-start justify-between gap-3 px-4 py-3'
    : 'mb-3 flex items-start justify-between gap-3'

  const listClassName = isDropdown
    ? 'max-h-[292px] overflow-y-auto p-2 focus:outline-none'
    : 'max-h-[320px] overflow-y-auto focus:outline-none'

  return (
    <div className={`${wrapperClassName} ${className}`.trim()}>
      <div className={headerClassName}>
        <div>
          <p className="text-[15px] font-semibold text-[var(--color-text)]">
            {isDropdown ? t('chat.conversations') : t('chat.recentConversations')}
          </p>
          {!isDropdown ? (
            <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{t('chat.resumeHint')}</p>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={t('chat.newChat')}
          title={t('chat.newChat')}
          onClick={() => {
            newConversation()
            onSelectConversation?.()
          }}
          className="flex h-9 w-9 min-h-0 shrink-0 items-center justify-center rounded-[12px] bg-[var(--color-primary)] text-white shadow-[var(--shadow-xs)] transition-colors hover:bg-[var(--color-primary-hover)]"
        >
          <Plus size={18} />
        </button>
      </div>

      <div
        className={listClassName}
        role={sorted.length > 0 ? 'listbox' : undefined}
        aria-label={sorted.length > 0 ? t('chat.conversations') : undefined}
        tabIndex={sorted.length > 0 ? 0 : -1}
        onKeyDown={sorted.length > 0 ? handleListKeyDown : undefined}
        aria-activedescendant={sorted.length > 0 ? activeDescendant : undefined}
      >
        {sorted.length === 0 ? (
          <div
            className={`flex flex-col items-center justify-center rounded-[18px] border border-dashed border-[var(--color-border-subtle)] px-5 py-8 text-center ${
              isDropdown ? 'mx-1 my-1' : ''
            }`}
          >
            <MessageSquare size={20} className="mb-2 text-[var(--color-text-muted)] opacity-60" />
            <p className="text-[13px] font-medium text-[var(--color-text-secondary)]">
              {t('chat.noSavedConversations')}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {sorted.map((conv, idx) => {
              const isActive = conv.id === activeConversationId
              const isFocused = idx === focusIndex

              return (
                <div
                  key={conv.id}
                  id={`conv-${variant}-${conv.id}`}
                  onClick={() => {
                    setActiveConversation(conv.id)
                    onSelectConversation?.()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setActiveConversation(conv.id)
                      onSelectConversation?.()
                    }
                  }}
                  role="option"
                  tabIndex={-1}
                  aria-selected={isActive}
                  aria-label={conv.title || t('chat.newConversation')}
                  className={`group relative cursor-pointer rounded-[16px] px-4 py-3 text-left transition-colors ${
                    isActive
                      ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]'
                      : isFocused
                        ? 'bg-[var(--color-surface-soft)]'
                        : 'hover:bg-[var(--color-surface-soft)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] ${
                        isActive
                          ? 'bg-white text-[var(--color-primary)]'
                          : 'bg-[var(--color-surface-soft)] text-[var(--color-text-muted)]'
                      }`}
                    >
                      <MessageSquare size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-[14px] ${
                          isActive
                            ? 'font-semibold text-[var(--color-text)]'
                            : 'font-medium text-[var(--color-text-secondary)]'
                        }`}
                      >
                        {conv.title || t('chat.newConversation')}
                      </p>
                      <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                        {formatActivity(getLastActivity(conv))}
                      </p>
                    </div>
                    {pendingDeleteId === conv.id ? (
                      <div
                        className="flex shrink-0 items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(conv.id)}
                          className="!h-8 !rounded-[12px] !px-3"
                        >
                          {t('chat.delete')}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setPendingDeleteId(null)}
                          className="!h-8 !rounded-[12px] !px-3"
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
                        className="rounded-[10px] p-2 opacity-0 transition-all group-hover:opacity-100 hover:bg-[var(--color-danger-light)] hover:text-[var(--color-danger)]"
                        aria-label={t('chat.delete')}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {isDropdown && (trashItems.length > 0 || showTrash) ? (
        <div className="px-2 py-2">
          <button
            type="button"
            onClick={() => setShowTrash((current) => !current)}
            className="w-full rounded-[12px] px-3 py-2 text-left text-[12px] font-medium text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-soft)]"
          >
            {t('chat.trash')}
          </button>
          {showTrash ? (
            trashItems.length === 0 ? (
              <p className="px-3 py-2 text-center text-[12px] text-[var(--color-text-muted)]">
                {t('chat.trashEmpty')}
              </p>
            ) : (
              trashItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 rounded-[12px] px-3 py-2 hover:bg-[var(--color-surface-soft)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] text-[var(--color-text-muted)]">
                      {item.title || t('chat.newConversation')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRestore(item.id)}
                    className="rounded-[10px] p-1.5 hover:bg-[var(--color-success-light)] hover:text-[var(--color-success)]"
                    title={t('chat.restore')}
                    aria-label={t('chat.restore')}
                  >
                    <RotateCcw size={12} />
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(item.id)}
                    className="rounded-[10px] p-1.5 hover:bg-[var(--color-danger-light)] hover:text-[var(--color-danger)]"
                    title={t('chat.permanentDelete')}
                    aria-label={t('chat.permanentDelete')}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
