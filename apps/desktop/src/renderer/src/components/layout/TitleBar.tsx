import { Minus, Square, X } from 'lucide-react'
import { IconButton } from '../ui'
import { t } from '../../i18n'

export default function TitleBar() {
  return (
    <div className="drag-region flex items-center justify-between h-11 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-4 chrome-no-select shrink-0">
      {/* App brand */}
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary)]" />
        <span className="font-semibold tracking-tight text-[length:var(--text-md)] text-[var(--color-text)]">
          {t('titlebar.title')}
        </span>
      </div>

      {/* Window controls */}
      <div className="no-drag flex items-center gap-1">
        <IconButton
          icon={Minus}
          size="sm"
          label={t('titlebar.minimize')}
          onClick={() => window.usan?.window.minimize()}
        />
        <IconButton
          icon={Square}
          size="sm"
          label={t('titlebar.maximize')}
          onClick={() => window.usan?.window.maximize()}
        />
        <IconButton
          icon={X}
          size="sm"
          variant="danger"
          label={t('titlebar.close')}
          onClick={() => window.usan?.window.close()}
        />
      </div>
    </div>
  )
}
