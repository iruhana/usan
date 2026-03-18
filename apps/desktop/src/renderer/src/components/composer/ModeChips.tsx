import { FileText, FolderOpen, Globe, Search, Sparkles } from 'lucide-react'
import { t } from '../../i18n'
import { COMPOSER_MODES, type ComposerMode } from './types'

interface ModeChipsProps {
  activeMode: ComposerMode
  onSelectMode: (mode: ComposerMode) => void
}

const MODES: Array<{ id: ComposerMode; icon: typeof Search; labelKey: string }> = [
  { id: 'search', icon: Search, labelKey: 'composer.mode.search' },
  { id: 'deep-research', icon: Sparkles, labelKey: 'composer.mode.deepResearch' },
  { id: 'files', icon: FolderOpen, labelKey: 'composer.mode.files' },
  { id: 'browser', icon: Globe, labelKey: 'composer.mode.browser' },
  { id: 'documents', icon: FileText, labelKey: 'composer.mode.documents' },
]

export default function ModeChips({ activeMode, onSelectMode }: ModeChipsProps) {
  return (
    <div data-testid="composer-mode-chips" className="flex flex-wrap items-center gap-2">
      {COMPOSER_MODES.map((modeId) => {
        const mode = MODES.find((item) => item.id === modeId)!
        const Icon = mode.icon
        const active = mode.id === activeMode

        return (
          <button
            key={mode.id}
            type="button"
            data-testid={`composer-mode-${mode.id}`}
            onClick={() => onSelectMode(mode.id)}
            aria-pressed={active}
            className={[
              'no-drag inline-flex min-h-[34px] items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors',
              active
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white shadow-[0_10px_20px_rgba(37,99,235,0.22)]'
                : 'border-white/40 bg-white/60 text-[var(--color-text-secondary)] hover:bg-white/85 hover:text-[var(--color-text)] dark:border-white/10 dark:bg-white/6 dark:hover:bg-white/10',
            ].join(' ')}
          >
            <Icon size={14} strokeWidth={2} />
            <span>{t(mode.labelKey)}</span>
          </button>
        )
      })}
    </div>
  )
}
