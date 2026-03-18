import type { ReactNode } from 'react'

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info'

interface BadgeProps {
  variant?: Variant
  children: ReactNode
  className?: string
}

const variantStyles: Record<Variant, string> = {
  default: 'bg-[var(--color-panel-muted)] text-[var(--color-text-secondary)] ring-1 ring-[var(--color-panel-border)]',
  success: 'bg-[var(--color-success-light)] text-[var(--color-success)] ring-1 ring-[rgba(15,159,110,0.12)]',
  warning: 'bg-[var(--color-warning-light)] text-[var(--color-warning)] ring-1 ring-[rgba(217,129,31,0.14)]',
  danger: 'bg-[var(--color-danger-light)] text-[var(--color-danger)] ring-1 ring-[rgba(229,72,77,0.14)]',
  info: 'bg-[var(--color-primary-light)] text-[var(--color-primary)] ring-1 ring-[rgba(49,130,246,0.12)]',
}

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1
        px-2.5 py-1 rounded-[var(--radius-full)]
        text-[length:var(--text-xs)] font-semibold
        ${variantStyles[variant]}
        ${className}
      `.trim()}
    >
      {children}
    </span>
  )
}
