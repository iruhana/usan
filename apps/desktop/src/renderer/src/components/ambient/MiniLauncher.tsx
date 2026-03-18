import { useEffect, useMemo, useState } from 'react'
import {
  Clock3,
  CornerDownLeft,
  FolderOpen,
  Globe,
  History,
  ScanSearch,
  Search,
  Sparkles,
  X,
} from 'lucide-react'

import type { StoredConversation } from '@shared/types/ipc'

import { t } from '../../i18n'
import type { AppPage } from '../../constants/navigation'
import { useChatStore } from '../../stores/chat.store'
import FocusTrap from '../accessibility/FocusTrap'
import { Button } from '../ui'

interface MiniLauncherProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (page: AppPage) => void
}

interface QuickAction {
  id: string
  label: string
  description: string
  kind: 'navigate' | 'prompt'
  page?: AppPage
  prompt?: string
  icon: typeof History
}

interface RecentTask {
  id: string
  title: string
  preview: string
  updatedAt: number
}

interface LauncherSuggestion {
  id: string
  label: string
  description: string
  icon: typeof Sparkles
  onSelect: () => void | Promise<void>
}

function formatRelativeTime(timestamp: number): string {
  const delta = Date.now() - timestamp

  if (delta < 60_000) return t('time.justNow')
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}${t('time.minutesAgo')}`
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}${t('time.hoursAgo')}`

  return `${Math.floor(delta / 86_400_000)}${t('time.daysAgo')}`
}

function buildRecentTasks(conversations: StoredConversation[]): RecentTask[] {
  return conversations
    .filter((conversation) => conversation.messages.length > 0)
    .slice(0, 4)
    .map((conversation) => {
      const lastMessage = conversation.messages[conversation.messages.length - 1]
      const previewSource =
        lastMessage?.content?.trim() || conversation.messages[0]?.content?.trim() || conversation.title

      return {
        id: conversation.id,
        title: conversation.title.trim() || t('chat.newConversation'),
        preview: previewSource.slice(0, 96),
        updatedAt: lastMessage?.timestamp ?? conversation.createdAt,
      }
    })
}

export default function MiniLauncher({ open, onOpenChange, onNavigate }: MiniLauncherProps) {
  const conversations = useChatStore((state) => state.conversations)
  const isStreaming = useChatStore((state) => state.isStreaming)
  const setActiveConversation = useChatStore((state) => state.setActiveConversation)

  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!open) {
      setQuery('')
    }
  }, [open])

  const submitPrompt = async (prompt: string) => {
    const normalizedPrompt = prompt.trim()
    if (!normalizedPrompt || isStreaming) return

    const { newConversation, sendMessage } = useChatStore.getState()

    onNavigate('home')
    onOpenChange(false)
    newConversation()
    await sendMessage(normalizedPrompt)
  }

  const recentTasks = useMemo(() => buildRecentTasks(conversations), [conversations])

  const quickActions: QuickAction[] = [
    {
      id: 'recent',
      label: t('miniLauncher.action.recent'),
      description: t('miniLauncher.action.recentDesc'),
      kind: 'navigate',
      page: 'tasks',
      icon: History,
    },
    {
      id: 'files',
      label: t('miniLauncher.action.files'),
      description: t('miniLauncher.action.filesDesc'),
      kind: 'prompt',
      prompt: t('miniLauncher.action.filesPrompt'),
      icon: FolderOpen,
    },
    {
      id: 'browser',
      label: t('miniLauncher.action.browser'),
      description: t('miniLauncher.action.browserDesc'),
      kind: 'prompt',
      prompt: t('miniLauncher.action.browserPrompt'),
      icon: Globe,
    },
    {
      id: 'screenshot',
      label: t('miniLauncher.action.screenshot'),
      description: t('miniLauncher.action.screenshotDesc'),
      kind: 'prompt',
      prompt: t('miniLauncher.action.screenshotPrompt'),
      icon: ScanSearch,
    },
  ]

  const runQuickAction = async (action: QuickAction) => {
    if (action.kind === 'navigate' && action.page) {
      onNavigate(action.page)
      onOpenChange(false)
      return
    }

    if (action.prompt) {
      await submitPrompt(action.prompt)
    }
  }

  const normalizedQuery = query.trim()
  const suggestions: LauncherSuggestion[] = normalizedQuery
    ? (() => {
        const lowerQuery = normalizedQuery.toLowerCase()
        const nextSuggestions: LauncherSuggestion[] = [
          {
            id: 'ask-now',
            label: normalizedQuery,
            description: t('miniLauncher.askNow'),
            icon: CornerDownLeft,
            onSelect: () => submitPrompt(normalizedQuery),
          },
        ]

        for (const action of quickActions) {
          const haystack = `${action.label} ${action.description} ${action.prompt ?? ''}`.toLowerCase()
          if (!haystack.includes(lowerQuery)) continue

          nextSuggestions.push({
            id: `action-${action.id}`,
            label: action.label,
            description: action.description,
            icon: action.icon,
            onSelect: () => runQuickAction(action),
          })
        }

        for (const task of recentTasks) {
          const haystack = `${task.title} ${task.preview}`.toLowerCase()
          if (!haystack.includes(lowerQuery)) continue

          nextSuggestions.push({
            id: `recent-${task.id}`,
            label: task.title,
            description: t('miniLauncher.resumeTask'),
            icon: History,
            onSelect: () => {
              setActiveConversation(task.id)
              onNavigate('home')
              onOpenChange(false)
            },
          })
        }

        return nextSuggestions.slice(0, 4)
      })()
    : []

  if (!open) return null

  return (
    <FocusTrap active={open}>
      <div
        className="fixed inset-0 z-50 flex items-start justify-center px-4 pb-8 pt-[10vh]"
        data-testid="mini-launcher"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[color:var(--color-backdrop)]/80 backdrop-blur-sm"
          data-testid="mini-launcher-backdrop"
          onClick={() => onOpenChange(false)}
        />

        <section
          aria-describedby="mini-launcher-subtitle"
          aria-labelledby="mini-launcher-title"
          aria-modal="true"
          className="glass relative flex w-full max-w-[720px] flex-col gap-5 rounded-[28px] border border-white/45 bg-white/88 p-5 shadow-[var(--shadow-xl)] dark:border-white/10 dark:bg-[rgba(15,23,35,0.92)]"
          role="dialog"
        >
          <header className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,rgba(37,99,235,0.16),rgba(124,58,237,0.14))] text-[var(--color-primary)]">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h2
                    className="text-[length:var(--text-lg)] font-semibold tracking-tight text-[var(--color-text)]"
                    id="mini-launcher-title"
                  >
                    {t('miniLauncher.title')}
                  </h2>
                  <p
                    className="text-[length:var(--text-sm)] text-[var(--color-text-secondary)]"
                    id="mini-launcher-subtitle"
                  >
                    {t('miniLauncher.subtitle')}
                  </p>
                </div>
              </div>
              <kbd className="rounded-[12px] bg-[var(--color-panel-muted)] px-2 py-1 text-[11px] font-medium text-[var(--color-text-secondary)]">
                Esc
              </kbd>
            </div>

            <form
              className="mt-2 flex items-center gap-3 rounded-[22px] border border-[var(--color-panel-border)] bg-[var(--color-panel-bg-strong)] px-4 py-3 shadow-[var(--shadow-xs)]"
              data-testid="mini-launcher-form"
              onSubmit={(event) => {
                event.preventDefault()
                void submitPrompt(query)
              }}
            >
              <Search className="shrink-0 text-[var(--color-text-secondary)]" size={18} />
              <input
                aria-label={t('miniLauncher.inputPlaceholder')}
                className="min-w-0 flex-1 bg-transparent text-[length:var(--text-md)] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-secondary)]"
                data-testid="mini-launcher-input"
                placeholder={t('miniLauncher.inputPlaceholder')}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <Button
                className="shrink-0"
                data-testid="mini-launcher-submit"
                disabled={isStreaming || query.trim().length === 0}
                leftIcon={<CornerDownLeft size={14} />}
                size="sm"
                type="submit"
              >
                {t('miniLauncher.submit')}
              </Button>
            </form>

            <button
              aria-label={t('miniLauncher.close')}
              className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-[16px] bg-[var(--color-panel-bg-strong)] text-[var(--color-text-secondary)] shadow-[var(--shadow-xs)] transition-colors duration-150 hover:bg-[var(--color-panel-muted)] hover:text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
              data-testid="mini-launcher-close"
              type="button"
              onClick={() => onOpenChange(false)}
            >
              <X size={16} />
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <span className="pr-1 text-[length:var(--text-xs)] font-medium uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
                {t('miniLauncher.quickActions')}
              </span>
              {quickActions.map((action) => {
                const Icon = action.icon
                return (
                  <button
                    key={action.id}
                    className="inline-flex items-center gap-2 rounded-[999px] border border-[var(--color-panel-border)] bg-[var(--color-panel-bg-strong)] px-3 py-2 text-[length:var(--text-sm)] font-medium text-[var(--color-text)] shadow-[var(--shadow-xs)] transition-colors duration-150 hover:bg-[var(--color-panel-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                    data-testid={`mini-launcher-chip-${action.id}`}
                    type="button"
                    onClick={() => void runQuickAction(action)}
                  >
                    <Icon className="text-[var(--color-primary)]" size={14} />
                    {action.label}
                  </button>
                )
              })}
            </div>
          </header>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <section className="rounded-[24px] border border-[var(--color-panel-border)] bg-[var(--color-panel-bg-strong)] p-4 shadow-[var(--shadow-xs)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-[length:var(--text-sm)] font-semibold text-[var(--color-text)]">
                  {t('miniLauncher.section.suggestions')}
                </h3>
                {isStreaming && (
                  <span className="text-[length:var(--text-xs)] text-[var(--color-warning)]">
                    {t('miniLauncher.streamingHint')}
                  </span>
                )}
              </div>

              {suggestions.length > 0 ? (
                <div className="space-y-2">
                  {suggestions.map((suggestion) => {
                    const Icon = suggestion.icon

                    return (
                      <button
                        key={suggestion.id}
                        className="flex w-full items-start gap-3 rounded-[20px] px-3 py-3 text-left transition-colors duration-150 hover:bg-[var(--color-panel-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                        data-testid={`mini-launcher-suggestion-${suggestion.id}`}
                        type="button"
                        onClick={() => void suggestion.onSelect()}
                      >
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[16px] bg-[var(--color-primary-light)] text-[var(--color-primary)]">
                          <Icon size={15} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[length:var(--text-sm)] font-semibold text-[var(--color-text)]">
                            {suggestion.label}
                          </p>
                          <p className="mt-1 text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
                            {suggestion.description}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-[20px] bg-[var(--color-panel-muted)] px-4 py-5 text-[length:var(--text-sm)] text-[var(--color-text-secondary)]">
                  {t('miniLauncher.noSuggestions')}
                </div>
              )}
            </section>

            <section className="rounded-[24px] border border-[var(--color-panel-border)] bg-[var(--color-panel-bg-strong)] p-4 shadow-[var(--shadow-xs)]">
              <div className="mb-3 flex items-center gap-2">
                <Clock3 className="text-[var(--color-text-secondary)]" size={15} />
                <h3 className="text-[length:var(--text-sm)] font-semibold text-[var(--color-text)]">
                  {t('miniLauncher.section.recent')}
                </h3>
              </div>

              {recentTasks.length > 0 ? (
                <div className="space-y-2">
                  {recentTasks.map((task) => (
                    <button
                      key={task.id}
                      className="w-full rounded-[20px] border border-transparent bg-[var(--color-panel-muted)] px-3 py-3 text-left transition-colors duration-150 hover:border-[var(--color-panel-border)] hover:bg-[var(--color-panel-bg-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
                      data-testid={`mini-launcher-recent-${task.id}`}
                      type="button"
                      onClick={() => {
                        setActiveConversation(task.id)
                        onNavigate('home')
                        onOpenChange(false)
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[length:var(--text-sm)] font-semibold text-[var(--color-text)]">
                            {task.title}
                          </p>
                          <p className="mt-1 max-h-[2.8em] overflow-hidden text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
                            {task.preview}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-[999px] bg-[var(--color-panel-bg-strong)] px-2 py-1 text-[11px] text-[var(--color-text-secondary)]">
                          {formatRelativeTime(task.updatedAt)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-[20px] bg-[var(--color-panel-muted)] px-4 py-5 text-[length:var(--text-sm)] text-[var(--color-text-secondary)]">
                  {t('miniLauncher.emptyRecent')}
                </div>
              )}
            </section>
          </div>

          <footer className="flex flex-wrap items-center gap-2 text-[length:var(--text-xs)] text-[var(--color-text-secondary)]">
            <span>{t('miniLauncher.openHint')}</span>
            <kbd className="rounded-[10px] bg-[var(--color-panel-muted)] px-2 py-1">Ctrl+Space</kbd>
            <kbd className="rounded-[10px] bg-[var(--color-panel-muted)] px-2 py-1">Alt+U</kbd>
          </footer>
        </section>
      </div>
    </FocusTrap>
  )
}
