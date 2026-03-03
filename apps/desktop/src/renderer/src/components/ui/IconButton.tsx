import { forwardRef, type ButtonHTMLAttributes, type ComponentType } from 'react'

type Variant = 'ghost' | 'subtle' | 'danger'
type Size = 'sm' | 'md'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ComponentType<{ size?: number; className?: string }>
  variant?: Variant
  size?: Size
  label: string
}

const variantStyles: Record<Variant, string> = {
  ghost:
    'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text)]',
  subtle:
    'text-[var(--color-text-muted)] hover:bg-[var(--color-primary-light)] hover:text-[var(--color-primary)]',
  danger:
    'text-[var(--color-text-muted)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)]',
}

const sizeConfig: Record<Size, { box: string; icon: number }> = {
  sm: { box: 'w-8 h-8', icon: 14 },
  md: { box: 'w-10 h-10', icon: 16 },
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, variant = 'ghost', size = 'md', label, className = '', ...rest }, ref) => {
    const cfg = sizeConfig[size]

    return (
      <button
        ref={ref}
        aria-label={label}
        title={label}
        className={`
          inline-flex items-center justify-center shrink-0
          rounded-[var(--radius-md)] transition-all
          active:scale-[0.93]
          disabled:opacity-50 disabled:pointer-events-none
          ${cfg.box}
          ${variantStyles[variant]}
          ${className}
        `.trim()}
        {...rest}
      >
        <Icon size={cfg.icon} />
      </button>
    )
  }
)

IconButton.displayName = 'IconButton'
