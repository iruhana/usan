import type { ReactNode } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react'

type NoticeTone = 'info' | 'success' | 'warning' | 'error'

interface InlineNoticeProps {
  tone?: NoticeTone
  title?: string
  children: ReactNode
  className?: string
}

const toneStyles: Record<NoticeTone, { wrapper: string; icon: typeof Info }> = {
  info: {
    wrapper: 'bg-[var(--color-panel-bg-strong)] ring-1 ring-[rgba(49,130,246,0.14)] shadow-[var(--shadow-card)] text-[var(--color-text)]',
    icon: Info,
  },
  success: {
    wrapper: 'bg-[var(--color-panel-bg-strong)] ring-1 ring-[rgba(15,159,110,0.14)] shadow-[var(--shadow-card)] text-[var(--color-text)]',
    icon: CheckCircle2,
  },
  warning: {
    wrapper: 'bg-[var(--color-panel-bg-strong)] ring-1 ring-[rgba(217,129,31,0.16)] shadow-[var(--shadow-card)] text-[var(--color-text)]',
    icon: AlertTriangle,
  },
  error: {
    wrapper: 'bg-[var(--color-panel-bg-strong)] ring-1 ring-[rgba(229,72,77,0.14)] shadow-[var(--shadow-card)] text-[var(--color-text)]',
    icon: AlertCircle,
  },
}

export function InlineNotice({ tone = 'info', title, children, className = '' }: InlineNoticeProps) {
  const style = toneStyles[tone]
  const Icon = style.icon

  return (
    <div
      role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}
      className={`rounded-[22px] px-4 py-3.5 ${style.wrapper} ${className}`.trim()}
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface-soft)]">
          <Icon size={16} className="opacity-80" />
        </div>
        <div className="min-w-0">
          {title ? (
            <p className="mb-0.5 text-[length:var(--text-sm)] font-semibold text-[var(--color-text)]">{title}</p>
          ) : null}
          <div className="text-[length:var(--text-sm)] text-[var(--color-text-secondary)] leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  )
}
