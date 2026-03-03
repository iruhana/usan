import type { ReactNode } from 'react'

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info'

interface BadgeProps {
  variant?: Variant
  children: ReactNode
  className?: string
}

const variantStyles: Record<Variant, string> = {
  default: 'bg-[var(--color-surface-soft)] text-[var(--color-text-muted)]',
  success: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
  danger: 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
  info: 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]',
}

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1
        px-2 py-0.5 rounded-[var(--radius-sm)]
        text-[length:var(--text-xs)] font-medium
        ${variantStyles[variant]}
        ${className}
      `.trim()}
    >
      {children}
    </span>
  )
}
