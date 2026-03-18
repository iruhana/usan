import { Check, Quote, Send, Square, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { t } from '../../i18n'
import { useSettingsStore } from '../../stores/settings.store'
import AttachMenu from './AttachMenu'
import ModeChips from './ModeChips'
import {
  COMPOSER_MODES,
  type ComposerAttachment,
  type ComposerAttachmentKind,
  type ComposerMode,
  type ComposerSubmitPayload,
} from './types'

const RECENT_PROMPTS_KEY = 'usan:composer:recent-prompts'
const RECENT_PROMPTS_LIMIT = 5

interface ComposerProps {
  value: string
  onValueChange: (value: string) => void
  onSubmit: (payload: ComposerSubmitPayload) => Promise<void> | void
  onStop?: () => void
  onToggleVoice?: () => void
  isStreaming?: boolean
  isListening?: boolean
}

function makeAttachmentId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getAttachmentLabel(kind: ComposerAttachmentKind, value?: string): string {
  switch (kind) {
    case 'file':
      return value ? value.split(/[\\/]/).pop() ?? value : t('composer.attach.file')
    case 'folder':
      return value ? value.split(/[\\/]/).pop() ?? value : t('composer.attach.folder')
    case 'selection':
      return t('composer.attachment.selectionChip')
    case 'screenshot':
      return t('composer.attachment.screenshotChip')
    default:
      return t('composer.attachButton')
  }
}

function loadRecentPrompts(): string[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(RECENT_PROMPTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is string => typeof value === 'string')
  } catch {
    return []
  }
}

function saveRecentPrompt(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed || typeof window === 'undefined') {
    return loadRecentPrompts()
  }

  const next = [trimmed, ...loadRecentPrompts().filter((item) => item !== trimmed)].slice(
    0,
    RECENT_PROMPTS_LIMIT,
  )
  window.localStorage.setItem(RECENT_PROMPTS_KEY, JSON.stringify(next))
  return next
}

async function readSelectionText(): Promise<string> {
  if (navigator.clipboard?.readText) {
    const text = await navigator.clipboard.readText()
    if (text.trim()) return text.trim()
  }

  const history = await window.usan?.clipboardManager.history()
  const latest = history?.find((entry) => entry.text?.trim())
  return latest?.text?.trim() ?? ''
}

export default function Composer({
  value,
  onValueChange,
  onSubmit,
  onStop,
  onToggleVoice,
  isStreaming = false,
  isListening = false,
}: ComposerProps) {
  const [mode, setMode] = useState<ComposerMode>('search')
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const [recentOpen, setRecentOpen] = useState(false)
  const [recentPrompts, setRecentPrompts] = useState<string[]>(() => loadRecentPrompts())
  const [notice, setNotice] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const enterToSend = useSettingsStore((s) => s.settings.enterToSend)
  const canSubmit = Boolean(value.trim() || attachments.length > 0)

  useEffect(() => {
    const element = textareaRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 300)}px`
  }, [value])

  const cycleMode = useCallback(() => {
    setMode((current) => {
      const index = COMPOSER_MODES.indexOf(current)
      return COMPOSER_MODES[(index + 1) % COMPOSER_MODES.length] ?? COMPOSER_MODES[0]!
    })
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || isStreaming) return

    await onSubmit({
      text: value.trim(),
      mode,
      attachments,
    })

    setRecentPrompts(saveRecentPrompt(value))
    onValueChange('')
    setAttachments([])
    setRecentOpen(false)
    setNotice(null)
  }, [attachments, canSubmit, isStreaming, mode, onSubmit, onValueChange, value])

  const handlePlainTextPaste = useCallback(async () => {
    const text = await navigator.clipboard.readText()
    if (!text) return

    const element = textareaRef.current
    if (!element) {
      onValueChange(value ? `${value}${text}` : text)
      return
    }

    const start = element.selectionStart ?? value.length
    const end = element.selectionEnd ?? value.length
    const nextValue = `${value.slice(0, start)}${text}${value.slice(end)}`
    onValueChange(nextValue)

    requestAnimationFrame(() => {
      element.focus()
      const caret = start + text.length
      element.setSelectionRange(caret, caret)
    })
  }, [onValueChange, value])

  const handleAttachAction = async (action: ComposerAttachmentKind | 'voice') => {
    try {
      if (action === 'voice') {
        onToggleVoice?.()
        return
      }

      if (action === 'file' || action === 'folder') {
        const selection = await window.usan?.fs.pick({
          mode: action === 'file' ? 'file' : 'directory',
          title: action === 'file' ? t('composer.attach.file') : t('composer.attach.folder'),
        })

        const nextPaths = selection?.paths ?? []
        if (selection?.canceled || nextPaths.length === 0) return

        setAttachments((current) => [
          ...current,
          ...nextPaths.map((path) => ({
            id: makeAttachmentId(),
            kind: action,
            label: getAttachmentLabel(action, path),
            value: path,
          })),
        ])
        setNotice(action === 'file' ? t('composer.notice.fileAttached') : t('composer.notice.folderAttached'))
        return
      }

      if (action === 'screenshot') {
        const screenshot = await window.usan?.computer.screenshot()
        if (!screenshot?.image) return

        const label = `${t('composer.attachment.screenshotChip')} ${screenshot.width}x${screenshot.height}`
        setAttachments((current) => [
          ...current,
          {
            id: makeAttachmentId(),
            kind: 'screenshot',
            label,
            previewImage: screenshot.image,
            meta: { width: screenshot.width, height: screenshot.height },
          },
        ])
        setNotice(t('composer.notice.screenshotAttached'))
        return
      }

      if (action === 'selection') {
        const text = await readSelectionText()
        if (!text) {
          setNotice(t('composer.notice.selectionEmpty'))
          return
        }

        setAttachments((current) => [
          ...current,
          {
            id: makeAttachmentId(),
            kind: 'selection',
            label: getAttachmentLabel('selection'),
            value: text,
          },
        ])
        setNotice(t('composer.notice.selectionAttached'))
      }
    } catch {
      setNotice(t('composer.notice.attachFailed'))
    }
  }

  return (
    <div
      data-testid="composer"
      className="w-full rounded-[22px] border border-white/45 bg-white/86 p-3 shadow-[var(--shadow-md)] backdrop-blur-2xl dark:border-white/10 dark:bg-[rgba(15,23,35,0.82)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ModeChips activeMode={mode} onSelectMode={setMode} />
        <div className="rounded-full bg-[var(--color-surface-soft)] px-3 py-1 text-[11px] font-medium text-[var(--color-text-muted)]">
          Ctrl+K {t('composer.shortcut.modeCycle')}
        </div>
      </div>

      {attachments.length > 0 && (
        <div data-testid="composer-attachments" className="mt-3 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              data-testid={`composer-attachment-${attachment.kind}`}
              className="flex items-center gap-2 rounded-full border border-white/50 bg-white/65 px-3 py-2 text-[12px] text-[var(--color-text)] dark:border-white/10 dark:bg-white/8"
            >
              {attachment.kind === 'selection' && <Quote size={13} className="text-[var(--color-primary)]" />}
              {attachment.kind === 'screenshot' && attachment.previewImage ? (
                <img
                  src={`data:image/png;base64,${attachment.previewImage}`}
                  alt={attachment.label}
                  className="h-6 w-6 rounded-[8px] object-cover"
                />
              ) : null}
              <span className="max-w-[220px] truncate">{attachment.label}</span>
              <button
                type="button"
                aria-label={t('composer.removeAttachment')}
                onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                className="no-drag text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-end gap-3">
        <AttachMenu disabled={isStreaming} isListening={isListening} onSelectAction={handleAttachAction} />
        <label className="flex min-h-[var(--usan-composer-min-height)] flex-1 rounded-[18px] border border-white/45 bg-white/72 px-4 py-3 shadow-[var(--shadow-xs)] focus-within:border-[var(--color-primary)] focus-within:bg-white dark:border-white/10 dark:bg-white/5 dark:focus-within:bg-white/8">
          <textarea
            ref={textareaRef}
            data-testid="composer-textarea"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault()
                event.stopPropagation()
                cycleMode()
                return
              }

              if ((event.ctrlKey || event.metaKey) && event.key === '/') {
                event.preventDefault()
                event.stopPropagation()
                setRecentOpen((current) => !current)
                return
              }

              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault()
                void handleSubmit()
                return
              }

              if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'v') {
                event.preventDefault()
                void handlePlainTextPaste()
                return
              }

              if (event.key === 'Enter' && !event.shiftKey && enterToSend) {
                event.preventDefault()
                void handleSubmit()
              }
            }}
            rows={1}
            placeholder={isListening ? t('home.listening') : t('composer.placeholder')}
            className="max-h-[var(--usan-composer-max-height)] min-h-[56px] flex-1 resize-none border-none bg-transparent text-[14px] leading-6 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
            disabled={isStreaming}
          />
        </label>
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            data-testid="composer-stop-button"
            className="no-drag flex h-11 w-11 items-center justify-center rounded-[16px] bg-[var(--color-danger)] text-white shadow-[var(--shadow-xs)]"
            aria-label={t('home.stop')}
            title={t('home.stop')}
          >
            <Square size={15} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleSubmit()}
            data-testid="composer-send-button"
            disabled={!canSubmit}
            className="no-drag flex h-11 w-11 items-center justify-center rounded-[16px] bg-[var(--color-primary)] text-white shadow-[var(--shadow-primary)] transition-colors hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={t('home.send')}
            title={t('home.send')}
          >
            <Send size={16} />
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-[var(--color-text-muted)]">
        <div className="flex flex-wrap items-center gap-3">
          <span>
            <span className="font-semibold text-[var(--color-text-secondary)]">Ctrl+Enter</span> {t('composer.shortcut.send')}
          </span>
          <span>
            <span className="font-semibold text-[var(--color-text-secondary)]">Ctrl+/</span> {t('composer.shortcut.recent')}
          </span>
        </div>
        {notice ? (
          <span
            data-testid="composer-notice"
            aria-live="polite"
            className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-light)] px-2 py-1 text-[var(--color-success)]"
          >
            <Check size={12} />
            {notice}
          </span>
        ) : (
          <span>{t('composer.footerHint')}</span>
        )}
      </div>

      {(recentOpen || (!value && recentPrompts.length > 0)) && (
        <div
          data-testid="composer-recent-prompts"
          className="mt-3 rounded-[18px] border border-white/40 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5"
        >
          <div className="mb-2 text-[12px] font-semibold text-[var(--color-text-secondary)]">
            {t('composer.recentPrompts')}
          </div>
          {recentPrompts.length === 0 ? (
            <div className="text-[12px] text-[var(--color-text-muted)]">{t('composer.recentEmpty')}</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {recentPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    onValueChange(prompt)
                    setRecentOpen(false)
                    textareaRef.current?.focus()
                  }}
                  className="no-drag rounded-full border border-white/45 bg-white/78 px-3 py-2 text-[12px] text-[var(--color-text)] transition-colors hover:bg-white dark:border-white/10 dark:bg-white/6 dark:hover:bg-white/10"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
