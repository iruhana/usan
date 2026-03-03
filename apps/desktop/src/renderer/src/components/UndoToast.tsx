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
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-in">
      <div className="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)] bg-[var(--color-text)] text-[var(--color-bg)] shadow-[var(--shadow-lg)]">
        <span className="text-[length:var(--text-md)]">{message}</span>
        <button
          onClick={undo}
          className="flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] bg-white/20 hover:bg-white/30 text-[length:var(--text-md)] font-medium transition-all"
          style={{ minHeight: '44px' }}
        >
          <Undo2 size={14} />
          {t('undo.action')}
        </button>
        <button
          onClick={dismiss}
          className="w-9 h-9 flex items-center justify-center rounded-[var(--radius-sm)] hover:bg-white/20 transition-all"
          aria-label={t('titlebar.close')}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
