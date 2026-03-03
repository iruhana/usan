import type { HTMLAttributes, ReactNode } from 'react'

type Variant = 'default' | 'elevated' | 'outline'
type Padding = 'sm' | 'md' | 'lg'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant
  padding?: Padding
  children: ReactNode
}

const variantStyles: Record<Variant, string> = {
  default: 'bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-[var(--shadow-sm)]',
  elevated: 'bg-[var(--color-bg-card)] border border-[var(--color-border)] shadow-[var(--shadow-md)]',
  outline: 'bg-transparent border border-[var(--color-border)]',
}

const paddingStyles: Record<Padding, string> = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

export function Card({ variant = 'default', padding = 'md', children, className = '', ...rest }: CardProps) {
  return (
    <div
      className={`rounded-[var(--radius-lg)] ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}
