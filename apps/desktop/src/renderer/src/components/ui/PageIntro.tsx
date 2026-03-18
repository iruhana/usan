import type { ReactNode } from 'react'

interface PageIntroProps {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function PageIntro({ title, description, action, className = '' }: PageIntroProps) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-5 ${className}`.trim()}>
      <div className="min-w-0 max-w-2xl space-y-1">
        <h1 className="text-[24px] font-semibold tracking-tight text-[var(--color-text)]">{title}</h1>
        {description ? (
          <p className="text-[13px] leading-6 text-[var(--color-text-secondary)]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-start">{action}</div> : null}
    </div>
  )
}
