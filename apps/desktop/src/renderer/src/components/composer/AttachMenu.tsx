import { FileText, FolderOpen, ImagePlus, Mic, Paperclip, Quote, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { t } from '../../i18n'
import type { ComposerAttachmentKind } from './types'

type AttachAction = ComposerAttachmentKind | 'voice'

interface AttachMenuProps {
  onSelectAction: (action: AttachAction) => Promise<void> | void
  disabled?: boolean
  isListening?: boolean
}

const ITEMS: Array<{ action: AttachAction; icon: typeof FileText; labelKey: string }> = [
  { action: 'file', icon: FileText, labelKey: 'composer.attach.file' },
  { action: 'folder', icon: FolderOpen, labelKey: 'composer.attach.folder' },
  { action: 'screenshot', icon: ImagePlus, labelKey: 'composer.attach.screenshot' },
  { action: 'selection', icon: Quote, labelKey: 'composer.attach.selection' },
  { action: 'voice', icon: Mic, labelKey: 'composer.attach.voice' },
]

export default function AttachMenu({
  onSelectAction,
  disabled = false,
  isListening = false,
}: AttachMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      setOpen(false)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  return (
    <div ref={rootRef} data-testid="composer-attach-menu" className="relative">
      <button
        type="button"
        disabled={disabled}
        data-testid="composer-attach-button"
        aria-label={t('composer.attachButton')}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="no-drag flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/40 bg-white/70 text-[var(--color-text-secondary)] transition-colors hover:bg-white hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/6 dark:hover:bg-white/10"
      >
        {open ? <X size={18} /> : <Paperclip size={18} />}
      </button>

      {open && (
        <div
          data-testid="composer-attach-popover"
          className="absolute bottom-[calc(100%+10px)] left-0 z-30 w-[220px] rounded-[18px] border border-white/45 bg-white/92 p-2 shadow-[var(--shadow-lg)] backdrop-blur-2xl dark:border-white/10 dark:bg-[rgba(15,23,35,0.94)]"
        >
          {ITEMS.map((item) => {
            const Icon = item.icon
            const isVoiceItem = item.action === 'voice'

            return (
              <button
                key={item.action}
                type="button"
                data-testid={`composer-attach-${item.action}`}
                onClick={async () => {
                  await onSelectAction(item.action)
                  setOpen(false)
                }}
                className="no-drag flex min-h-[44px] w-full items-center gap-3 rounded-[14px] px-3 py-2 text-left text-[13px] font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-soft)]"
              >
                <span
                  className={[
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]',
                    isVoiceItem && isListening
                      ? 'bg-[var(--color-danger)] text-white'
                      : 'bg-[var(--color-surface-soft)] text-[var(--color-text-secondary)]',
                  ].join(' ')}
                >
                  <Icon size={16} />
                </span>
                <span>{t(item.labelKey)}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
