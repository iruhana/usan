/**
 * UndoToast — floating toast with undo button for destructive actions
 */

import { Undo2, X } from 'lucide-react'
import { useUndoStore } from '../stores/undo.store'
import { t } from '../i18n'

export default function UndoToast() {
  const visible = useUndoStore((s) => s.visible)
  const message = useUndoStore((s) => s.message)
  const undo = useUndoStore((s) => s.undo)
  const dismiss = useUndoStore((s) => s.dismiss)

  if (!visible) return null

  return (
    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-[var(--radius-xl)] bg-[var(--color-text)] text-[var(--color-bg)] shadow-[var(--shadow-xl)]">
        <span className="text-[length:var(--text-sm)] font-medium">{message}</span>
        <button
          onClick={undo}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] bg-white/15 hover:bg-white/25 text-[length:var(--text-sm)] font-semibold transition-all duration-150 active:scale-[0.95]"
          style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <Undo2 size={13} />
          {t('undo.action')}
        </button>
        <button
          onClick={dismiss}
          className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-white/15 transition-all duration-150"
          aria-label={t('titlebar.close')}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}
