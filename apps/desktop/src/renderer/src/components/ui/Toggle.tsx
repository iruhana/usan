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
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-[length:var(--text-md)] font-medium text-[var(--color-text)] cursor-pointer">
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
          relative shrink-0 w-12 h-7 rounded-full transition-colors
          disabled:opacity-50 disabled:pointer-events-none
          ${checked ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-border)]'}
        `}
      >
        <span
          className={`
            absolute top-0.5 left-0.5
            w-6 h-6 rounded-full bg-[var(--color-text-inverse)] shadow-sm
            transition-transform
            ${checked ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </button>
    </div>
  )
}
