import { useId } from 'react'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label: string
  description?: string
}

export function Toggle({ checked, onChange, disabled, label, description }: ToggleProps) {
  const id = useId()

  return (
    <div className="flex items-center justify-between gap-4 rounded-[var(--radius-lg)] bg-[var(--color-bg-card)] px-1 py-1">
      <div className="min-w-0">
        <label htmlFor={id} className="text-[length:var(--text-md)] font-semibold text-[var(--color-text)] cursor-pointer">
          {label}
        </label>
        {description && (
          <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)] mt-0.5">
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`
          relative shrink-0 w-11 h-6 rounded-full transition-all duration-200
          disabled:opacity-50 disabled:pointer-events-none
          ${checked ? 'bg-[var(--color-primary)] shadow-[var(--shadow-primary)]' : 'bg-[var(--color-border)]'}
        `}
      >
        <span
          className={`
            absolute top-[2px] left-[2px]
            h-5 w-5 rounded-full bg-white
            shadow-[0_1px_3px_rgba(0,0,0,0.12),0_1px_1px_rgba(0,0,0,0.06)]
            transition-all duration-200
            ${checked ? 'translate-x-5' : 'translate-x-0'}
          `}
          style={{
            transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </button>
    </div>
  )
}
