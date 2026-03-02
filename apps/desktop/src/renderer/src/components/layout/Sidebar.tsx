import { Home, Wrench, FileText, FolderOpen, Settings } from 'lucide-react'
import { t } from '../../i18n'

type Page = 'home' | 'tools' | 'notes' | 'files' | 'settings'

interface SidebarProps {
  activePage: Page
  onNavigate: (page: Page) => void
}

const NAV_ITEMS: Array<{ id: Page; icon: typeof Home; labelKey: string }> = [
  { id: 'home', icon: Home, labelKey: 'nav.home' },
  { id: 'tools', icon: Wrench, labelKey: 'nav.tools' },
  { id: 'notes', icon: FileText, labelKey: 'nav.notes' },
  { id: 'files', icon: FolderOpen, labelKey: 'nav.files' },
  { id: 'settings', icon: Settings, labelKey: 'nav.settings' },
]

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <nav className="w-24 bg-[var(--color-bg-sidebar)] border-r border-[var(--color-border)] flex flex-col items-center py-6 gap-2 shrink-0">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const isActive = activePage === item.id
        const label = t(item.labelKey)
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`
              w-20 h-20 flex flex-col items-center justify-center gap-1 rounded-2xl transition-all
              ${
                isActive
                  ? 'bg-[var(--color-primary)] text-white shadow-lg'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card)] hover:shadow-sm'
              }
            `}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={28} strokeWidth={isActive ? 2.5 : 2} />
            <span
              className="font-medium"
              style={{ fontSize: 'calc(14px * var(--font-scale))' }}
            >
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
