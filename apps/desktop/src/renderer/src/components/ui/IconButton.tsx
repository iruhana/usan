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
    'text-[var(--color-text-muted)] hover:bg-[var(--color-panel-muted)] hover:text-[var(--color-text)]',
  subtle:
    'bg-[var(--color-panel-bg-strong)] text-[var(--color-primary)] ring-1 ring-[var(--color-panel-border)] shadow-[var(--shadow-xs)] hover:bg-[var(--color-primary-light)]',
  danger:
    'text-[var(--color-text-muted)] hover:bg-[var(--color-danger-light)] hover:text-[var(--color-danger)]',
}

const sizeConfig: Record<Size, { box: string; icon: number }> = {
  sm: { box: 'w-9 h-9', icon: 14 },
  md: { box: 'w-11 h-11', icon: 16 },
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
          rounded-[var(--radius-md)] transition-all duration-200
          active:scale-[0.9] active:transition-none
          disabled:opacity-40 disabled:pointer-events-none
          ${cfg.box}
          ${variantStyles[variant]}
          ${className}
        `.trim()}
        style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        {...rest}
      >
        <Icon size={cfg.icon} />
      </button>
    )
  }
)

IconButton.displayName = 'IconButton'
