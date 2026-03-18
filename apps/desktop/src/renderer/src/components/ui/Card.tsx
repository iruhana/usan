import type { HTMLAttributes, ReactNode } from 'react'

type Variant = 'default' | 'elevated' | 'outline'
type Padding = 'none' | 'sm' | 'md' | 'lg'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant
  padding?: Padding
  interactive?: boolean
  children: ReactNode
}

const variantStyles: Record<Variant, string> = {
  default:
    'bg-[var(--color-panel-bg-strong)] shadow-[var(--shadow-xs)] ring-1 ring-[color:rgba(138,164,194,0.12)]',
  elevated:
    'bg-[var(--color-panel-bg-strong)] shadow-[var(--shadow-sm)] ring-1 ring-[color:rgba(138,164,194,0.14)]',
  outline: 'bg-[var(--color-panel-muted)] shadow-none ring-1 ring-[color:rgba(138,164,194,0.12)]',
}

const paddingStyles: Record<Padding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
}

export function Card({ variant = 'default', padding = 'md', interactive = false, children, className = '', ...rest }: CardProps) {
  return (
    <div
      className={`rounded-[22px] transition-all duration-200 ${interactive ? 'card-lift cursor-pointer hover:ring-[rgba(49,130,246,0.16)] hover:shadow-[var(--shadow-sm)]' : ''} ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}
