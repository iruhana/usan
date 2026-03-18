import type { ComponentType, ReactNode } from 'react'

interface SectionHeaderProps {
  title: string
  icon?: ComponentType<{ size?: number; className?: string }>
  indicator?: string
  action?: ReactNode
  className?: string
}

export function SectionHeader({ title, icon: Icon, indicator, action, className }: SectionHeaderProps) {
  return (
    <div className={`mb-3 flex items-center gap-2.5 ${className ?? ''}`}>
      {indicator && (
        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: indicator }} />
      )}
      {Icon && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] text-[var(--color-primary)]">
          <Icon size={16} className="shrink-0" />
        </div>
      )}
      <h3 className="flex-1 text-[length:var(--text-md)] font-semibold tracking-tight text-[var(--color-text)]">
        {title}
      </h3>
      {action}
    </div>
  )
}
