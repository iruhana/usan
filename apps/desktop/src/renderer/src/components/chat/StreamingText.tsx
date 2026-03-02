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
        className="max-w-[80%] rounded-2xl px-5 py-4 bg-[var(--color-bg-card)] border border-[var(--color-border)]"
        style={{ fontSize: 'var(--font-size-base)', lineHeight: 'var(--line-height-base)' }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={18} className="text-[var(--color-primary)]" />
          <span
            className="font-semibold text-[var(--color-primary)]"
            style={{ fontSize: 'calc(14px * var(--font-scale))' }}
          >
            {t('app.name')}
          </span>
        </div>
        <div className="whitespace-pre-wrap">
          {text}
          <span className="inline-block w-2 h-5 bg-[var(--color-primary)] animate-pulse ml-0.5 rounded-sm" />
        </div>
      </div>
    </div>
  )
}
