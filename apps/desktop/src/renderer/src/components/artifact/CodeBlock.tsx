import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { t } from '../../i18n'

interface CodeBlockProps {
  code: string
  language?: string
  className?: string
}

export default function CodeBlock({ code, language, className = '' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Ignore clipboard failures in restricted environments.
    }
  }

  return (
    <div
      className={`overflow-hidden rounded-[22px] bg-[color:rgba(12,18,29,0.96)] text-slate-100 shadow-[var(--shadow-sm)] ${className}`.trim()}
      data-testid="artifact-code-block"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <span className="ml-2 rounded-full bg-white/8 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
            {language || t('artifact.kind.code')}
          </span>
        </div>

        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex items-center gap-1.5 rounded-[14px] bg-white/8 px-3 py-2 text-[12px] font-semibold text-slate-100 transition-colors hover:bg-white/14"
          aria-label={copied ? t('chat.copied') : t('chat.copy')}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? t('chat.copied') : t('chat.copy')}</span>
        </button>
      </div>

      <pre className="overflow-x-auto px-4 py-4 text-[13px] leading-6">
        <code>{code}</code>
      </pre>
    </div>
  )
}
