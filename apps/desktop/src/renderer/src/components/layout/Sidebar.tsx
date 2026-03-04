import { Home, Wrench, FileText, FolderOpen, Settings, User, Workflow, BookOpen, Activity, Store, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { t } from '../../i18n'
import { useAuthStore } from '../../stores/auth.store'
import { useSettingsStore } from '../../stores/settings.store'

type Page = 'home' | 'tools' | 'notes' | 'files' | 'settings' | 'account' | 'workflows' | 'knowledge' | 'dashboard' | 'marketplace'

interface SidebarProps {
  activePage: Page
  onNavigate: (page: Page) => void
}

const NAV_ITEMS: Array<{ id: Page; icon: typeof Home; labelKey: string }> = [
  { id: 'home', icon: Home, labelKey: 'nav.home' },
  { id: 'tools', icon: Wrench, labelKey: 'nav.tools' },
  { id: 'notes', icon: FileText, labelKey: 'nav.notes' },
  { id: 'files', icon: FolderOpen, labelKey: 'nav.files' },
  { id: 'workflows', icon: Workflow, labelKey: 'nav.workflows' },
  { id: 'knowledge', icon: BookOpen, labelKey: 'nav.knowledge' },
  { id: 'dashboard', icon: Activity, labelKey: 'nav.dashboard' },
  { id: 'marketplace', icon: Store, labelKey: 'nav.marketplace' },
  { id: 'settings', icon: Settings, labelKey: 'nav.settings' },
]

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const user = useAuthStore((s) => s.user)
  const collapsed = useSettingsStore((s) => s.settings.sidebarCollapsed)
  const updateSettings = useSettingsStore((s) => s.update)

  const toggleCollapse = () => {
    updateSettings({ sidebarCollapsed: !collapsed })
  }

  return (
    <nav
      className={`
        ${collapsed ? 'w-[72px]' : 'w-[200px]'}
        border-r border-[var(--color-border)] flex flex-col py-3 gap-1 shrink-0
        bg-[var(--color-bg)] chrome-no-select transition-[width] duration-200
        ${collapsed ? 'items-center' : 'px-2'}
      `}
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const isActive = activePage === item.id
        const label = t(item.labelKey)
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            title={collapsed ? label : undefined}
            className={`
              relative flex items-center gap-3 py-2 rounded-[var(--radius-md)] transition-all
              ${collapsed ? 'w-16 flex-col justify-center' : 'w-full px-3'}
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
            <Icon size={20} strokeWidth={isActive ? 2.2 : 1.8} className="shrink-0" />
            {collapsed ? (
              <span
                className={`text-[length:var(--text-xs)] leading-tight text-center truncate w-full ${isActive ? 'font-medium' : ''}`}
              >
                {label}
              </span>
            ) : (
              <span
                className={`text-[length:var(--text-sm)] leading-tight truncate ${isActive ? 'font-medium' : ''}`}
              >
                {label}
              </span>
            )}
          </button>
        )
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Account button */}
      <button
        onClick={() => onNavigate('account')}
        title={collapsed ? t('nav.account') : undefined}
        className={`
          relative flex items-center gap-3 py-2 rounded-[var(--radius-md)] transition-all
          ${collapsed ? 'w-16 flex-col justify-center' : 'w-full px-3'}
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
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] flex items-center justify-center shadow-[var(--shadow-sm)] shrink-0">
            <User size={14} className="text-[var(--color-text-inverse)]" />
          </div>
        ) : (
          <User size={20} strokeWidth={activePage === 'account' ? 2.2 : 1.8} className="shrink-0" />
        )}
        {collapsed ? (
          <span
            className={`text-[length:var(--text-xs)] leading-tight text-center truncate w-full ${activePage === 'account' ? 'font-medium' : ''}`}
          >
            {t('nav.account')}
          </span>
        ) : (
          <span
            className={`text-[length:var(--text-sm)] leading-tight truncate ${activePage === 'account' ? 'font-medium' : ''}`}
          >
            {t('nav.account')}
          </span>
        )}
      </button>

      {/* Collapse toggle */}
      <button
        onClick={toggleCollapse}
        className={`
          flex items-center justify-center py-2 rounded-[var(--radius-md)] transition-all
          text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-soft)]
          ${collapsed ? 'w-16' : 'w-full px-3'}
        `}
        aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
      >
        {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
        {!collapsed && (
          <span className="text-[length:var(--text-xs)] ml-3 text-[var(--color-text-muted)]">접기</span>
        )}
      </button>
    </nav>
  )
}
