/**
 * StreamingText — shows text being streamed from AI with cursor
 */

import { Sparkles } from 'lucide-react'
import { t } from '../../i18n'

interface Props {
  text: string
}

export default function StreamingText({ text }: Props) {
  if (!text) return null

  return (
    <div className="flex justify-start">
      <div
        className="max-w-[80%] rounded-xl rounded-bl-sm px-4 py-3 bg-[var(--color-surface-soft)] text-[length:var(--text-md)]"
        style={{ lineHeight: 'var(--line-height-base)' }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={14} className="text-[var(--color-primary)]" />
          <span className="text-[length:var(--text-sm)] font-medium text-[var(--color-primary)]">
            {t('app.name')}
          </span>
        </div>
        <div className="whitespace-pre-wrap">
          {text}
          <span className="inline-block w-1.5 h-4 bg-[var(--color-primary)] animate-pulse ml-0.5 rounded-sm" />
        </div>
      </div>
    </div>
  )
}
