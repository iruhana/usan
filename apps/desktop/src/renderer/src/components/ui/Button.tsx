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
    'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] hover:shadow-[var(--shadow-lg)] shadow-[var(--shadow-primary)] hover:-translate-y-[1px]',
  secondary:
    'bg-[var(--color-panel-bg-strong)] text-[var(--color-text)] ring-1 ring-[var(--color-panel-border)] shadow-[var(--shadow-xs)] hover:bg-[var(--color-panel-muted)] hover:shadow-[var(--shadow-sm)]',
  ghost:
    'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-panel-muted)] hover:text-[var(--color-text)]',
  danger:
    'bg-[var(--color-danger)] text-white hover:brightness-105 shadow-[var(--shadow-sm)] hover:-translate-y-[1px]',
}

const sizeStyles: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[length:var(--text-sm)] gap-1.5 rounded-[16px]',
  md: 'h-11 px-5 text-[length:var(--text-md)] gap-2 rounded-[18px]',
  lg: 'h-13 px-6 text-[length:var(--text-md)] gap-2 rounded-[22px]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, leftIcon, rightIcon, children, className = '', ...rest }, ref) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center font-semibold
          transition-all duration-200
          active:scale-[0.97] active:transition-none
          disabled:opacity-40 disabled:pointer-events-none
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `.trim()}
        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        {...rest}
      >
        {loading ? <Loader2 size={15} className="animate-spin shrink-0" /> : leftIcon && <span className="shrink-0">{leftIcon}</span>}
        {children}
        {rightIcon && !loading && <span className="shrink-0">{rightIcon}</span>}
      </button>
    )
  }
)

Button.displayName = 'Button'
