import { forwardRef, type InputHTMLAttributes, type ReactNode, useId } from 'react'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  helperText?: string
  errorText?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, errorText, leftIcon, rightIcon, className = '', id: externalId, ...rest }, ref) => {
    const autoId = useId()
    const inputId = externalId || autoId
    const errorId = errorText ? `${inputId}-error` : undefined
    const helperId = helperText ? `${inputId}-helper` : undefined
    const hasError = !!errorText

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-[length:var(--text-sm)] text-[var(--color-text-muted)] font-medium">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={hasError || undefined}
            aria-describedby={errorId || helperId || undefined}
            className={`
              w-full h-10 rounded-[var(--radius-md)]
              bg-[var(--color-surface-soft)] border
              text-[length:var(--text-md)] text-[var(--color-text)]
              placeholder:text-[var(--color-text-muted)]
              transition-all
              focus:outline-none focus:ring-2
              ${leftIcon ? 'pl-9' : 'pl-3'} ${rightIcon ? 'pr-9' : 'pr-3'}
              ${hasError
                ? 'border-[var(--color-danger)] focus:ring-[var(--color-danger)]/20'
                : 'border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary)]/20'
              }
              disabled:opacity-50 disabled:pointer-events-none
              ${className}
            `.trim()}
            {...rest}
          />
          {rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
              {rightIcon}
            </span>
          )}
        </div>
        {errorText && (
          <p id={errorId} role="alert" className="text-[length:var(--text-sm)] text-[var(--color-danger)]">
            {errorText}
          </p>
        )}
        {!errorText && helperText && (
          <p id={helperId} className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
