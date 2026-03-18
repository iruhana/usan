import { useEffect, useState } from 'react'
import { ArrowUpRight, ListTodo, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import { Timeline } from '../components/agent'
import { ArtifactShelf, ArtifactView, deriveArtifactsFromMessages } from '../components/artifact'
import { Badge, Button, Card, InlineNotice, Input, PageIntro, ProgressSummary } from '../components/ui'
import { t } from '../i18n'
import { dispatchNavigate } from '../lib/navigation-events'
import { useChatStore } from '../stores/chat.store'
import { useUndoStore } from '../stores/undo.store'
import { countTasks, deriveTaskEntries, filterTaskEntries, type TaskFilter, type TaskStatus } from './tasks-page-state'

const FILTERS: Array<{ id: TaskFilter; labelKey: string }> = [
  { id: 'all', labelKey: 'tasks.filter.all' },
  { id: 'in_progress', labelKey: 'tasks.filter.inProgress' },
  { id: 'approval', labelKey: 'tasks.filter.approval' },
  { id: 'completed', labelKey: 'tasks.filter.completed' },
  { id: 'failed', labelKey: 'tasks.filter.failed' },
]

const STATUS_BADGE_VARIANT: Record<TaskStatus, 'info' | 'warning' | 'success' | 'danger'> = {
  in_progress: 'info',
  approval: 'warning',
  completed: 'success',
  failed: 'danger',
}

const STATUS_LABEL_KEY: Record<TaskStatus, string> = {
  in_progress: 'tasks.filter.inProgress',
  approval: 'tasks.filter.approval',
  completed: 'tasks.filter.completed',
  failed: 'tasks.filter.failed',
}

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

function trimPreview(value: string): string {
  const normalized = value.trim()
  if (!normalized) return ''
  if (normalized.length <= 140) return normalized
  return `${normalized.slice(0, 140)}...`
}

export default function TasksPage() {
  const [filter, setFilter] = useState<TaskFilter>('all')
  const [query, setQuery] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null)

  const conversations = useChatStore((state) => state.conversations)
  const activeConversationId = useChatStore((state) => state.activeConversationId)
  const streamingConversationId = useChatStore((state) => state.streamingConversationId)
  const isStreaming = useChatStore((state) => state.isStreaming)
  const streamingPhase = useChatStore((state) => state.streamingPhase)
  const streamingText = useChatStore((state) => state.streamingText)
  const activeToolName = useChatStore((state) => state.activeToolName)
  const loadFromDisk = useChatStore((state) => state.loadFromDisk)
  const newConversation = useChatStore((state) => state.newConversation)
  const setActiveConversation = useChatStore((state) => state.setActiveConversation)
  const deleteConversation = useChatStore((state) => state.deleteConversation)
  const showUndo = useUndoStore((state) => state.show)

  useEffect(() => {
    void loadFromDisk()
  }, [loadFromDisk])

  const allEntries = deriveTaskEntries(conversations, {
    streamingConversationId,
    isStreaming,
    streamingPhase,
    streamingText,
    activeToolName,
  })
  const counts = countTasks(allEntries)
  const visibleEntries = filterTaskEntries(allEntries, filter, query)
  const selectedEntry =
    visibleEntries.find((entry) => entry.id === activeConversationId) ?? visibleEntries[0] ?? null
  const selectedArtifacts = deriveArtifactsFromMessages(selectedEntry?.conversation.messages ?? [], {
    streamingText:
      selectedEntry?.isStreaming && selectedEntry.id === streamingConversationId ? streamingText : '',
    activeToolName:
      selectedEntry?.isStreaming && selectedEntry.id === streamingConversationId ? activeToolName : null,
  })
  const selectedArtifact =
    selectedArtifacts.find((artifact) => artifact.id === selectedArtifactId) ??
    selectedArtifacts[0] ??
    null
  const completionPercent =
    counts.all > 0 ? Math.round((counts.completed / counts.all) * 100) : 0
  const artifactSignature = selectedArtifacts.map((artifact) => artifact.id).join('|')
  const primaryArtifactId = selectedArtifacts[0]?.id ?? null
  const hasSelectedArtifact = selectedArtifactId
    ? selectedArtifacts.some((artifact) => artifact.id === selectedArtifactId)
    : false

  useEffect(() => {
    if (!selectedArtifacts.length) {
      if (selectedArtifactId !== null) {
        setSelectedArtifactId(null)
      }
      return
    }

    if (!selectedArtifactId || !hasSelectedArtifact) {
      setSelectedArtifactId(primaryArtifactId)
    }
  }, [artifactSignature, hasSelectedArtifact, primaryArtifactId, selectedArtifactId, selectedArtifacts.length])

  async function handleDeleteTask(conversationId: string): Promise<void> {
    setPendingDeleteId(null)

    try {
      await window.usan?.conversations.softDelete(conversationId)
    } catch {
      // Keep the in-memory path working even if persistence fails.
    }

    deleteConversation(conversationId)

    showUndo(t('undo.conversationDeleted'), async () => {
      try {
        const restored = await window.usan?.conversations.restore(conversationId)
        if (restored) {
          useChatStore.setState((state) => ({
            conversations: [restored, ...state.conversations],
          }))
        }
      } catch {
        // Ignore restore failures. The toast already communicates the action.
      }
    })
  }

  function handleOpenTask(conversationId: string): void {
    setActiveConversation(conversationId)
  }

  function handleResumeTask(conversationId: string): void {
    setActiveConversation(conversationId)
    dispatchNavigate({ page: 'home' })
  }

  function handleRetryTask(conversationId: string): void {
    const store = useChatStore.getState()
    store.setActiveConversation(conversationId)
    store.retryLastMessage()
    dispatchNavigate({ page: 'home' })
  }

  function handleStartNewTask(): void {
    newConversation()
    dispatchNavigate({ page: 'home' })
  }

  return (
    <div className="flex h-full min-w-0 flex-col bg-[var(--color-bg)]" data-testid="tasks-page">
      <div className="flex-1 overflow-hidden px-4 pb-4 pt-5 md:px-5 md:pb-5">
        <div className="mx-auto flex h-full w-full max-w-[1480px] flex-col gap-4">
          <PageIntro
            title={t('tasks.title')}
            description={t('tasks.subtitle')}
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={handleStartNewTask}
                data-testid="tasks-new-task-button"
              >
                {t('tasks.newTask')}
              </Button>
            }
          />

          <ProgressSummary
            title={t('tasks.summaryTitle')}
            footer={t('tasks.summaryFooter')}
            progressPercent={completionPercent}
            progressLabel={t('tasks.summaryTitle')}
            metrics={[
              { label: t('tasks.metric.total'), value: String(counts.all) },
              { label: t('tasks.metric.running'), value: String(counts.in_progress) },
              { label: t('tasks.metric.approval'), value: String(counts.approval) },
              { label: t('tasks.metric.completed'), value: String(counts.completed) },
              { label: t('tasks.metric.failed'), value: String(counts.failed) },
            ]}
            className="shrink-0"
          />

          <div
            className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]"
            data-testid="tasks-main-grid"
          >
            <Card
              variant="default"
              padding="md"
              className="flex min-h-[360px] min-w-0 flex-col overflow-hidden"
              data-testid="tasks-list-panel"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-[var(--color-primary-light)] text-[var(--color-primary)]">
                  <ListTodo size={18} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[18px] font-semibold text-[var(--color-text)]">
                    {t('tasks.listTitle')}
                  </h2>
                  <p className="mt-1 text-[13px] leading-6 text-[var(--color-text-secondary)]">
                    {t('tasks.listBody')}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('tasks.searchPlaceholder')}
                  aria-label={t('tasks.searchPlaceholder')}
                  leftIcon={<Search size={16} />}
                  data-testid="tasks-search-input"
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2" data-testid="tasks-filters">
                {FILTERS.map((item) => {
                  const isActive = filter === item.id
                  const count =
                    item.id === 'all'
                      ? counts.all
                      : counts[item.id]

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFilter(item.id)}
                      aria-pressed={isActive}
                      className={[
                        'inline-flex items-center gap-2 rounded-[16px] px-3 py-2 text-[13px] font-semibold transition-colors',
                        isActive
                          ? 'bg-[var(--color-primary)] text-white shadow-[var(--shadow-primary)]'
                          : 'bg-[var(--color-panel-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text)]',
                      ].join(' ')}
                      data-testid={`tasks-filter-${item.id}`}
                    >
                      <span>{t(item.labelKey)}</span>
                      <span
                        className={[
                          'inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px]',
                          isActive ? 'bg-white/18 text-white' : 'bg-[var(--color-bg-card)] text-[var(--color-text-muted)]',
                        ].join(' ')}
                      >
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>

              <div className="mt-4 min-h-0 flex-1 overflow-auto pr-1" data-testid="tasks-list">
                {visibleEntries.length === 0 ? (
                  <InlineNotice
                    tone={allEntries.length === 0 ? 'info' : 'warning'}
                    title={allEntries.length === 0 ? t('tasks.emptyTitle') : t('tasks.noMatchesTitle')}
                    className="mt-1"
                  >
                    {allEntries.length === 0 ? t('tasks.emptyBody') : t('tasks.noMatchesBody')}
                  </InlineNotice>
                ) : (
                  <div className="space-y-2">
                    {visibleEntries.map((entry) => {
                      const isSelected = selectedEntry?.id === entry.id

                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => handleOpenTask(entry.id)}
                          aria-pressed={isSelected}
                          className={[
                            'w-full rounded-[20px] px-4 py-3 text-left transition-all',
                            isSelected
                              ? 'bg-[var(--color-primary-light)] shadow-[var(--shadow-xs)] ring-1 ring-[rgba(49,130,246,0.14)]'
                              : 'bg-[var(--color-panel-muted)] hover:bg-[var(--color-surface-soft)]',
                          ].join(' ')}
                          data-testid={`tasks-row-${entry.id}`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-[14px] font-semibold text-[var(--color-text)]">
                                  {entry.title || t('chat.newConversation')}
                                </p>
                                <Badge variant={STATUS_BADGE_VARIANT[entry.status]}>
                                  {t(STATUS_LABEL_KEY[entry.status])}
                                </Badge>
                              </div>
                              <p className="mt-2 text-[12px] leading-5 text-[var(--color-text-secondary)]">
                                {trimPreview(entry.preview) || t('tasks.latestOutputEmpty')}
                              </p>
                            </div>

                            <div className="shrink-0 text-right text-[11px] text-[var(--color-text-muted)]">
                              <p>{formatTimestamp(entry.lastUpdatedAt)}</p>
                              <p className="mt-1">{`${entry.stepCount} ${t('tasks.steps')}`}</p>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </Card>

            <div className="flex min-h-[360px] min-w-0 flex-col gap-4" data-testid="tasks-detail-panel">
              {selectedEntry ? (
                <>
                  <Card
                    variant="elevated"
                    padding="md"
                    className="shrink-0"
                    data-testid="tasks-detail-summary"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-[22px] font-semibold tracking-[-0.02em] text-[var(--color-text)]">
                            {selectedEntry.title || t('chat.newConversation')}
                          </h2>
                          <Badge variant={STATUS_BADGE_VARIANT[selectedEntry.status]}>
                            {t(STATUS_LABEL_KEY[selectedEntry.status])}
                          </Badge>
                          {selectedEntry.activeToolName ? (
                            <Badge variant="info">{selectedEntry.activeToolName}</Badge>
                          ) : null}
                        </div>
                        <p className="mt-2 text-[13px] leading-6 text-[var(--color-text-secondary)]">
                          {t('tasks.detailTitle')}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          leftIcon={<ArrowUpRight size={14} />}
                          onClick={() => handleResumeTask(selectedEntry.id)}
                          data-testid="tasks-resume-button"
                        >
                          {t('tasks.resumeTask')}
                        </Button>
                        {selectedEntry.status === 'failed' ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            leftIcon={<RotateCcw size={14} />}
                            onClick={() => handleRetryTask(selectedEntry.id)}
                            data-testid="tasks-retry-button"
                          >
                            {t('error.retry')}
                          </Button>
                        ) : null}
                        {pendingDeleteId === selectedEntry.id ? (
                          <>
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() => void handleDeleteTask(selectedEntry.id)}
                              data-testid="tasks-confirm-delete-button"
                            >
                              {t('tasks.confirmDelete')}
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => setPendingDeleteId(null)}
                            >
                              {t('chat.cancel')}
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            leftIcon={<Trash2 size={14} />}
                            onClick={() => setPendingDeleteId(selectedEntry.id)}
                            data-testid="tasks-delete-button"
                          >
                            {t('chat.delete')}
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-[18px] bg-[var(--color-panel-muted)] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                          {t('tasks.startedAt')}
                        </p>
                        <p className="mt-1 text-[14px] font-semibold text-[var(--color-text)]">
                          {formatTimestamp(selectedEntry.createdAt)}
                        </p>
                      </div>
                      <div className="rounded-[18px] bg-[var(--color-panel-muted)] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                          {t('tasks.updatedAt')}
                        </p>
                        <p className="mt-1 text-[14px] font-semibold text-[var(--color-text)]">
                          {formatTimestamp(selectedEntry.lastUpdatedAt)}
                        </p>
                      </div>
                      <div className="rounded-[18px] bg-[var(--color-panel-muted)] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                          {t('chat.messages')}
                        </p>
                        <p className="mt-1 text-[14px] font-semibold text-[var(--color-text)]">
                          {selectedEntry.messageCount}
                        </p>
                      </div>
                      <div className="rounded-[18px] bg-[var(--color-panel-muted)] px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                          {t('tasks.steps')}
                        </p>
                        <p className="mt-1 text-[14px] font-semibold text-[var(--color-text)]">
                          {selectedEntry.completedStepCount}/{selectedEntry.stepCount}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-[20px] bg-[var(--color-panel-muted)] px-4 py-4">
                      <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                        {t('tasks.latestOutput')}
                      </p>
                      <p className="mt-2 text-[14px] leading-6 text-[var(--color-text-secondary)]">
                        {trimPreview(selectedEntry.preview) || t('tasks.latestOutputEmpty')}
                      </p>
                    </div>
                  </Card>

                  <Card
                    variant="default"
                    padding="md"
                    className="shrink-0"
                    data-testid="tasks-artifact-workspace"
                  >
                    <ArtifactShelf
                      artifacts={selectedArtifacts}
                      selectedArtifactId={selectedArtifact?.id ?? null}
                      onSelectArtifact={setSelectedArtifactId}
                    />
                    <ArtifactView artifact={selectedArtifact} className="mt-4" />
                  </Card>

                  <div className="min-h-0 flex-1 overflow-auto pr-1" data-testid="tasks-detail-timeline">
                    <Timeline
                      messages={selectedEntry.conversation.messages}
                      isStreaming={selectedEntry.isStreaming}
                      streamingPhase={
                        selectedEntry.isStreaming && selectedEntry.id === streamingConversationId
                          ? streamingPhase
                          : 'idle'
                      }
                      streamingText={
                        selectedEntry.isStreaming && selectedEntry.id === streamingConversationId
                          ? streamingText
                          : ''
                      }
                      activeToolName={
                        selectedEntry.isStreaming && selectedEntry.id === streamingConversationId
                          ? activeToolName
                          : null
                      }
                      onRetry={
                        selectedEntry.status === 'failed'
                          ? () => handleRetryTask(selectedEntry.id)
                          : undefined
                      }
                      className="min-h-full"
                    />
                  </div>
                </>
              ) : (
                <div data-testid="tasks-detail-placeholder">
                  <InlineNotice
                    tone="info"
                    title={t('tasks.detailPlaceholderTitle')}
                    className="mt-1"
                  >
                    {t('tasks.detailPlaceholderBody')}
                  </InlineNotice>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
