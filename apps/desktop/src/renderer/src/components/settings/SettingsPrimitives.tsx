import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Card } from '../ui'

const ROW_CLASS =
  'grid gap-4 border-t border-[var(--color-border-subtle)] py-4 first:border-t-0 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_minmax(260px,360px)] md:items-start'

const SEGMENT_WRAP_CLASS =
  'grid gap-2 rounded-[16px] bg-[var(--color-surface-soft)]/90 p-1'

export function SettingsSwitch({
  checked,
  onClick,
  ariaLabel,
  disabled = false,
}: {
  checked: boolean
  onClick: () => void
  ariaLabel: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border p-[2px] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/25 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked
          ? 'border-[color:rgba(49,130,246,0.26)] bg-[var(--color-primary-light)]'
          : 'border-[var(--color-border)] bg-[var(--color-surface-soft)]'
      }`}
    >
      <span
        className={`block h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.16)] transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

export function SettingsSectionCard({
  cardId,
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  cardId: string
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <Card
      variant="default"
      padding="md"
      className="rounded-[24px] border border-[var(--color-border-subtle)]/80 bg-[var(--color-bg-card)]/95 shadow-[var(--shadow-xs)]"
      data-settings-card={cardId}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--color-panel-muted)] text-[var(--color-text-secondary)]">
            <Icon size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold tracking-tight text-[var(--color-text)]">{title}</h2>
            {description ? (
              <p className="mt-1 text-[13px] leading-6 text-[var(--color-text-secondary)]">{description}</p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </Card>
  )
}

export function SettingsRow({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className={ROW_CLASS}>
      <div className="max-w-[460px]">
        <div className="text-[14px] font-semibold text-[var(--color-text)]">{title}</div>
        {description ? (
          <p className="mt-1 text-[13px] leading-6 text-[var(--color-text-secondary)]">{description}</p>
        ) : null}
      </div>
      <div className="w-full md:justify-self-end">{children}</div>
    </div>
  )
}

export function SettingsSegmentedControl({
  options,
  value,
  onChange,
  columns = 2,
}: {
  options: Array<{ id: string; label: string; icon?: LucideIcon }>
  value: string
  onChange: (id: string) => void
  columns?: 2 | 3
}) {
  return (
    <div className={`${SEGMENT_WRAP_CLASS} ${columns === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {options.map((option) => {
        const isActive = value === option.id
        const Icon = option.icon
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`flex min-h-[38px] items-center justify-center gap-2 rounded-[12px] px-3 py-2 text-[13px] font-semibold leading-5 transition-all ${
              isActive
                ? 'bg-white text-[var(--color-text)] ring-1 ring-[color:rgba(49,130,246,0.16)] shadow-[var(--shadow-xs)]'
                : 'bg-transparent text-[var(--color-text-secondary)] hover:bg-white/70 hover:text-[var(--color-text)]'
            }`}
          >
            {Icon ? <Icon size={14} /> : null}
            <span>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
