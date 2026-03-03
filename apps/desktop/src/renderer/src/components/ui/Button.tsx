import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-[var(--color-primary)] text-[var(--color-text-inverse)] hover:bg-[var(--color-primary-hover)] shadow-[0_2px_4px_rgba(99,102,241,0.15)] hover:shadow-[0_4px_12px_rgba(99,102,241,0.25)]',
  secondary:
    'bg-[var(--color-surface-soft)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-bg-card)] hover:border-[var(--color-text-muted)]',
  ghost:
    'bg-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text)]',
  danger:
    'bg-[var(--color-danger)] text-[var(--color-text-inverse)] hover:brightness-110',
}

const sizeStyles: Record<Size, string> = {
  sm: 'h-8 px-3 text-[length:var(--text-sm)] gap-1.5',
  md: 'h-10 px-4 text-[length:var(--text-md)] gap-2',
  lg: 'h-12 px-6 text-[length:var(--text-lg)] gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, leftIcon, rightIcon, children, className = '', ...rest }, ref) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center font-medium
          rounded-[var(--radius-md)] transition-all
          active:scale-[0.97]
          disabled:opacity-50 disabled:pointer-events-none
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `.trim()}
        {...rest}
      >
        {loading ? <Loader2 size={16} className="animate-spin shrink-0" /> : leftIcon && <span className="shrink-0">{leftIcon}</span>}
        {children}
        {rightIcon && !loading && <span className="shrink-0">{rightIcon}</span>}
      </button>
    )
  }
)

Button.displayName = 'Button'
