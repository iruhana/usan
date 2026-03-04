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
    <div className={`mb-3 flex items-center gap-2 ${className ?? ''}`}>
      {indicator && (
        <div className="h-4 w-1 rounded-full" style={{ backgroundColor: indicator }} />
      )}
      {Icon && <Icon size={16} className="text-[var(--color-text-muted)] shrink-0" />}
      <h3 className="text-[length:var(--text-sm)] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide flex-1">
        {title}
      </h3>
      {action}
    </div>
  )
}
