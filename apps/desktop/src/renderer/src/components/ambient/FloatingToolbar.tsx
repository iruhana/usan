import {
  AlignLeft,
  CircleHelp,
  Quote,
  Sparkles,
  WandSparkles,
  X,
} from 'lucide-react'
import {
  useEffect,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import { t } from '../../i18n'
import type { AppPage } from '../../constants/navigation'
import { useChatStore } from '../../stores/chat.store'
import { queueFloatingToolbarComposerDraft } from './floating-toolbar-events'
import {
  getFloatingToolbarPosition,
  resolveFloatingSelection,
  type FloatingSelectionSnapshot,
  type FloatingSelectionSource,
} from './floating-toolbar-state'

interface FloatingToolbarProps {
  disabled?: boolean
  onNavigate: (page: AppPage) => void
}

type PromptAction = 'ask' | 'summarize' | 'explain' | 'rewrite'

interface ToolbarAction {
  id: PromptAction | 'compose'
  icon: typeof Sparkles
  label: string
  description: string
  disabled?: boolean
  onSelect: () => void | Promise<void>
}

function buildPrompt(action: PromptAction, selectionText: string): string {
  const instructionKeyMap: Record<PromptAction, string> = {
    ask: 'floatingToolbar.prompt.ask',
    summarize: 'floatingToolbar.prompt.summarize',
    explain: 'floatingToolbar.prompt.explain',
    rewrite: 'floatingToolbar.prompt.rewrite',
  }

  return `${t(instructionKeyMap[action])}\n\n${t('floatingToolbar.prompt.selectionLabel')}\n${selectionText.trim()}`
}

function isNodeInsideToolbar(root: HTMLElement | null, node: Node | null): boolean {
  if (!root || !node) return false
  return root.contains(node instanceof Element ? node : node.parentElement)
}

function createSourceLabel(source: FloatingSelectionSource): string {
  return source === 'editable'
    ? t('floatingToolbar.source.editable')
    : t('floatingToolbar.source.document')
}

function createSelectionPreview(text: string): string {
  return text.length > 160 ? `${text.slice(0, 157)}...` : text
}

export default function FloatingToolbar({
  disabled = false,
  onNavigate,
}: FloatingToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const selectionRef = useRef<FloatingSelectionSnapshot | null>(null)
  const [selection, setSelection] = useState<FloatingSelectionSnapshot | null>(null)
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const [placement, setPlacement] = useState<'above' | 'below'>('above')
  const isStreaming = useChatStore((state) => state.isStreaming)

  useEffect(() => {
    selectionRef.current = selection
  }, [selection])

  const hideToolbar = useCallback(() => {
    setSelection(null)
    setPosition(null)
  }, [])

  const refreshSelection = useCallback(() => {
    if (disabled) {
      hideToolbar()
      return
    }

    const currentSelection = window.getSelection()
    if (isNodeInsideToolbar(toolbarRef.current, currentSelection?.anchorNode ?? null)) {
      hideToolbar()
      return
    }

    const nextSelection = resolveFloatingSelection(document)
    if (!nextSelection) {
      hideToolbar()
      return
    }

    setSelection(nextSelection)
  }, [disabled, hideToolbar])

  const scheduleRefresh = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
    }

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      refreshSelection()
    })
  }, [refreshSelection])

  useEffect(() => {
    if (disabled) {
      hideToolbar()
      return
    }

    const handleSelectionChange = () => scheduleRefresh()
    const handlePointerUp = () => scheduleRefresh()
    const handleKeyUp = () => scheduleRefresh()
    const handleResize = () => scheduleRefresh()
    const handleScroll = () => scheduleRefresh()
    const handleMouseDown = (event: MouseEvent) => {
      if (toolbarRef.current?.contains(event.target as Node)) return
      scheduleRefresh()
    }
    const handleWindowBlur = () => hideToolbar()
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !selectionRef.current) return
      event.preventDefault()
      hideToolbar()
      window.getSelection()?.removeAllRanges()
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    document.addEventListener('mouseup', handlePointerUp)
    document.addEventListener('keyup', handleKeyUp)
    document.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('resize', handleResize)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('blur', handleWindowBlur)
    window.addEventListener('keydown', handleEscape)

    scheduleRefresh()

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      document.removeEventListener('mouseup', handlePointerUp)
      document.removeEventListener('keyup', handleKeyUp)
      document.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('blur', handleWindowBlur)
      window.removeEventListener('keydown', handleEscape)

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [disabled, hideToolbar, scheduleRefresh])

  useLayoutEffect(() => {
    if (!selection || !toolbarRef.current) return

    const rect = toolbarRef.current.getBoundingClientRect()
    const nextPosition = getFloatingToolbarPosition(selection.rect, {
      width: rect.width || 360,
      height: rect.height || 180,
    })

    setPosition((current) => {
      if (
        current &&
        current.left === nextPosition.left &&
        current.top === nextPosition.top
      ) {
        return current
      }

      return { left: nextPosition.left, top: nextPosition.top }
    })
    setPlacement((current) => (current === nextPosition.placement ? current : nextPosition.placement))
  }, [selection])

  const runPromptAction = useCallback(async (action: PromptAction) => {
    if (!selection?.text.trim() || isStreaming) return

    const { newConversation, sendMessage } = useChatStore.getState()
    const prompt = buildPrompt(action, selection.text)

    hideToolbar()
    onNavigate('home')
    newConversation()
    await sendMessage(prompt)
  }, [hideToolbar, isStreaming, onNavigate, selection])

  const handleCompose = useCallback(() => {
    if (!selection?.text.trim()) return

    queueFloatingToolbarComposerDraft({ text: selection.text })
    hideToolbar()
    onNavigate('home')
  }, [hideToolbar, onNavigate, selection])

  const actions: ToolbarAction[] = [
    {
      id: 'ask',
      icon: Sparkles,
      label: t('floatingToolbar.action.ask'),
      description: t('floatingToolbar.action.askDesc'),
      disabled: isStreaming,
      onSelect: () => runPromptAction('ask'),
    },
    {
      id: 'summarize',
      icon: AlignLeft,
      label: t('floatingToolbar.action.summarize'),
      description: t('floatingToolbar.action.summarizeDesc'),
      disabled: isStreaming,
      onSelect: () => runPromptAction('summarize'),
    },
    selection?.source === 'editable'
      ? {
          id: 'rewrite',
          icon: WandSparkles,
          label: t('floatingToolbar.action.rewrite'),
          description: t('floatingToolbar.action.rewriteDesc'),
          disabled: isStreaming,
          onSelect: () => runPromptAction('rewrite'),
        }
      : {
          id: 'explain',
          icon: CircleHelp,
          label: t('floatingToolbar.action.explain'),
          description: t('floatingToolbar.action.explainDesc'),
          disabled: isStreaming,
          onSelect: () => runPromptAction('explain'),
        },
    {
      id: 'compose',
      icon: Quote,
      label: t('floatingToolbar.action.compose'),
      description: t('floatingToolbar.action.composeDesc'),
      onSelect: handleCompose,
    },
  ]

  if (disabled || !selection) return null

  return (
    <div
      ref={toolbarRef}
      aria-label={t('floatingToolbar.ariaLabel')}
      className="glass fixed z-40 w-[min(92vw,400px)] rounded-[22px] border border-white/45 bg-white/88 p-3 shadow-[var(--shadow-xl)] backdrop-blur-2xl dark:border-white/10 dark:bg-[rgba(15,23,35,0.94)]"
      data-placement={placement}
      data-testid="floating-toolbar"
      role="toolbar"
      style={
        position
          ? { left: position.left, top: position.top }
          : { left: -9999, top: -9999, opacity: 0, pointerEvents: 'none' }
      }
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,rgba(37,99,235,0.16),rgba(124,58,237,0.14))] text-[var(--color-primary)]">
          <Sparkles size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[var(--color-text)]">
                {t('floatingToolbar.title')}
              </p>
              <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                {createSourceLabel(selection.source)}
              </p>
            </div>
            <button
              aria-label={t('floatingToolbar.close')}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[var(--color-panel-bg-strong)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-panel-muted)] hover:text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
              data-testid="floating-toolbar-close"
              type="button"
              onClick={hideToolbar}
            >
              <X size={15} />
            </button>
          </div>

          <div className="mt-3 rounded-[18px] bg-[var(--color-panel-muted)] px-3 py-3">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
              {t('floatingToolbar.previewLabel')}
            </p>
            <p
              className="text-[13px] leading-6 text-[var(--color-text)]"
              data-testid="floating-toolbar-preview"
            >
              {createSelectionPreview(selection.text)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {actions.map((action) => {
          const Icon = action.icon

          return (
            <button
              key={action.id}
              className="flex min-h-[68px] items-start gap-3 rounded-[18px] border border-[var(--color-panel-border)] bg-[var(--color-panel-bg-strong)] px-3 py-3 text-left transition-colors hover:bg-[var(--color-panel-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-50"
              data-testid={`floating-toolbar-action-${action.id}`}
              disabled={action.disabled}
              type="button"
              onClick={() => void action.onSelect()}
            >
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[var(--color-primary-light)] text-[var(--color-primary)]">
                <Icon size={15} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-[var(--color-text)]">
                  {action.label}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-[var(--color-text-secondary)]">
                  {action.description}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-[var(--color-text-secondary)]">
        <span>{isStreaming ? t('floatingToolbar.streamingHint') : t('floatingToolbar.hint')}</span>
        <kbd className="rounded-[10px] bg-[var(--color-panel-muted)] px-2 py-1">Esc</kbd>
      </div>
    </div>
  )
}
