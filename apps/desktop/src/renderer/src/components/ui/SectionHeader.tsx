import type { ComponentType, ReactNode } from 'react'

interface SectionHeaderProps {
  title: string
  icon?: ComponentType<{ size?: number; className?: string }>
  indicator?: string
  action?: ReactNode
}

export function SectionHeader({ title, icon: Icon, indicator, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {indicator && (
        <div className={`w-1 h-4 rounded-full bg-[${indicator}]`} />
      )}
      {Icon && <Icon size={16} className="text-[var(--color-text-muted)] shrink-0" />}
      <h3 className="text-[length:var(--text-sm)] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide flex-1">
        {title}
      </h3>
      {action}
    </div>
  )
}
