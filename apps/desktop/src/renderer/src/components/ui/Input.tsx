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
      <div className="flex flex-col gap-2">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[13px] font-semibold leading-5 text-[var(--color-text-secondary)]"
          >
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
              h-12 w-full rounded-[var(--radius-lg)]
              bg-[var(--color-bg-card)]
              ring-1 ring-[var(--color-border)]
              shadow-[var(--shadow-xs)]
              text-[14px] leading-[1.4] text-[var(--color-text)]
              placeholder:text-[var(--color-text-muted)] placeholder:leading-[1.4]
              transition-all duration-200
              focus:outline-none focus:ring-[var(--color-primary)] focus:shadow-[var(--shadow-primary)]
              ${leftIcon ? 'pl-11' : 'pl-4'} ${rightIcon ? 'pr-10' : 'pr-4'}
              ${hasError ? 'ring-[var(--color-danger)] focus:ring-[var(--color-danger)]' : ''}
              disabled:opacity-40 disabled:pointer-events-none
              ${className}
            `.trim()}
            style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
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
