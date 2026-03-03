import { Home, Wrench, FileText, FolderOpen, Settings, User } from 'lucide-react'
import { t } from '../../i18n'
import { useAuthStore } from '../../stores/auth.store'

type Page = 'home' | 'tools' | 'notes' | 'files' | 'settings' | 'account'

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
  const user = useAuthStore((s) => s.user)

  return (
    <nav className="w-[72px] border-r border-[var(--color-border)] flex flex-col items-center py-3 gap-1 shrink-0 bg-[var(--color-bg)] chrome-no-select">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const isActive = activePage === item.id
        const label = t(item.labelKey)
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`
              relative w-16 flex flex-col items-center gap-1 py-2 rounded-[var(--radius-md)] transition-all
              ${
                isActive
                  ? 'text-[var(--color-primary)] bg-[var(--color-primary-light)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-soft)]'
              }
            `}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
          >
            {isActive && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[6px] w-[3px] h-5 rounded-full bg-[var(--color-primary)]" />
            )}
            <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
            <span
              className={`text-[length:var(--text-xs)] leading-tight text-center truncate w-full ${isActive ? 'font-medium' : ''}`}
            >
              {label}
            </span>
          </button>
        )
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Account button at bottom */}
      <button
        onClick={() => onNavigate('account')}
        className={`
          relative w-16 flex flex-col items-center gap-1 py-2 rounded-[var(--radius-md)] transition-all
          ${
            activePage === 'account'
              ? 'text-[var(--color-primary)] bg-[var(--color-primary-light)]'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-soft)]'
          }
        `}
        aria-label={t('nav.account')}
        aria-current={activePage === 'account' ? 'page' : undefined}
      >
        {activePage === 'account' && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[6px] w-[3px] h-5 rounded-full bg-[var(--color-primary)]" />
        )}
        {user ? (
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] flex items-center justify-center shadow-[var(--shadow-sm)]">
            <User size={14} className="text-[var(--color-text-inverse)]" />
          </div>
        ) : (
          <User size={20} strokeWidth={activePage === 'account' ? 2.2 : 1.8} />
        )}
        <span
          className={`text-[length:var(--text-xs)] leading-tight text-center truncate w-full ${activePage === 'account' ? 'font-medium' : ''}`}
        >
          {t('nav.account')}
        </span>
      </button>
    </nav>
  )
}
