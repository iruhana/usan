import { Minus, Square, X } from 'lucide-react'
import { t } from '../../i18n'

export default function TitleBar() {
  return (
    <div className="drag-region flex items-center justify-between h-16 bg-[var(--color-bg-card)] border-b border-[var(--color-border)] px-4 select-none shrink-0">
      {/* App name */}
      <div className="flex items-center gap-2">
        <span className="text-xl">🤖</span>
        <span className="font-bold" style={{ fontSize: 'var(--font-size-sm)' }}>
          {t('titlebar.title')}
        </span>
      </div>

      {/* Window controls */}
      <div className="no-drag flex items-center gap-1">
        <button
          onClick={() => window.usan?.window.minimize()}
          className="w-14 h-14 flex items-center justify-center rounded-lg hover:bg-[var(--color-bg)] transition-colors"
          aria-label={t('titlebar.minimize')}
        >
          <Minus size={18} />
        </button>
        <button
          onClick={() => window.usan?.window.maximize()}
          className="w-14 h-14 flex items-center justify-center rounded-lg hover:bg-[var(--color-bg)] transition-colors"
          aria-label={t('titlebar.maximize')}
        >
          <Square size={14} />
        </button>
        <button
          onClick={() => window.usan?.window.close()}
          className="w-14 h-14 flex items-center justify-center rounded-lg hover:bg-[var(--color-danger-light,#fef2f2)] hover:text-[var(--color-danger)] transition-colors"
          aria-label={t('titlebar.close')}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
