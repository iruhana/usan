/**
 * StreamingText — shows text being streamed from AI with cursor and markdown
 */

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
        className="max-w-[80%] rounded-xl rounded-bl-sm px-4 py-3 bg-[var(--color-surface-soft)] border border-[var(--color-border)]/50 text-[length:var(--text-md)]"
        style={{ lineHeight: 'var(--line-height-base)' }}
      >
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[var(--color-primary)]/15">
          <div className="w-5 h-5 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
            <Sparkles size={11} className="text-[var(--color-text-inverse)]" />
          </div>
          <span className="text-[length:var(--text-xs)] font-semibold text-[var(--color-primary)]">
            {t('app.name')}
          </span>
        </div>
        <div>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {text}
          </ReactMarkdown>
          <span className="inline-block w-1.5 h-4 bg-[var(--color-primary)] animate-pulse ml-0.5 rounded-sm align-middle" />
        </div>
      </div>
    </div>
  )
}
