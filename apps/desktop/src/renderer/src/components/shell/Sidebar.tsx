import {
  FolderOpen,
  Home,
  ListTodo,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Umbrella,
  Wrench,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { FocusTrap } from '../accessibility'
import { t } from '../../i18n'
import { useSettingsStore } from '../../stores/settings.store'
import type { AppPage } from '../../constants/navigation'

interface SidebarProps {
  activePage: AppPage
  onNavigate: (page: AppPage) => void
}

type SidebarStage = 'hidden' | 'compact' | 'default'

const SIDEBAR_SM = 680
const SIDEBAR_MD = 900

const NAV_ITEMS: Array<{
  id: AppPage
  icon: typeof Home
  labelKey: string
  shortcut: string
}> = [
  { id: 'home', icon: Home, labelKey: 'nav.home', shortcut: '1' },
  { id: 'tasks', icon: ListTodo, labelKey: 'nav.tasks', shortcut: '2' },
  { id: 'files', icon: FolderOpen, labelKey: 'nav.files', shortcut: '3' },
  { id: 'tools', icon: Wrench, labelKey: 'nav.tools', shortcut: '4' },
  { id: 'settings', icon: Settings, labelKey: 'nav.settings', shortcut: '5' },
]

function getSidebarStage(width: number, collapsed: boolean): SidebarStage {
  if (width < SIDEBAR_SM) return 'hidden'
  if (width < SIDEBAR_MD || collapsed) return 'compact'
  return 'default'
}

function NavItem({
  item,
  activePage,
  stage,
  onNavigate,
  mobile = false,
}: {
  item: (typeof NAV_ITEMS)[number]
  activePage: AppPage
  stage: SidebarStage
  onNavigate: (page: AppPage) => void
  mobile?: boolean
}) {
  const Icon = item.icon
  const label = t(item.labelKey)
  const isActive = activePage === item.id

  return (
    <button
      type="button"
      data-page-id={item.id}
      onClick={() => onNavigate(item.id)}
      aria-current={isActive ? 'page' : undefined}
      aria-label={label}
      title={mobile ? undefined : `${label} (Ctrl+${item.shortcut})`}
      className={[
        'group no-drag relative overflow-hidden transition-all duration-[250ms] ease-[cubic-bezier(0.25,0.8,0.25,1)]',
        mobile
          ? 'flex min-h-[48px] w-full items-center gap-3 rounded-[16px] px-4 py-3 text-left'
          : 'mx-auto flex items-center justify-center rounded-[18px]',
        stage === 'compact' && !mobile ? 'h-10 w-10' : '',
        stage === 'default' && !mobile ? 'h-11 w-11' : '',
        isActive
          ? 'bg-[linear-gradient(180deg,rgba(37,99,235,0.18),rgba(37,99,235,0.1))] text-[var(--color-primary)] shadow-[0_10px_24px_rgba(37,99,235,0.18)]'
          : 'text-[var(--color-text-secondary)] hover:bg-white/70 hover:text-[var(--color-text)] dark:hover:bg-white/8',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'pointer-events-none absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-[var(--color-primary)] transition-opacity duration-200',
          isActive ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      />
      <Icon size={18} strokeWidth={isActive ? 2.4 : 2.1} className="shrink-0" />
      {mobile && (
        <>
          <span className="flex-1 truncate text-[14px] font-semibold">{label}</span>
          <span className="rounded-full bg-[var(--color-surface-soft)] px-2 py-1 text-[11px] font-medium text-[var(--color-text-muted)]">
            Ctrl+{item.shortcut}
          </span>
        </>
      )}
    </button>
  )
}

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const sidebarCollapsed = useSettingsStore((s) => s.settings.sidebarCollapsed)
  const updateSettings = useSettingsStore((s) => s.update)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === 'undefined' ? SIDEBAR_MD : window.innerWidth,
  )

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth)

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const stage = useMemo(
    () => getSidebarStage(viewportWidth, sidebarCollapsed),
    [sidebarCollapsed, viewportWidth],
  )

  useEffect(() => {
    if (stage !== 'hidden' && mobileOpen) {
      setMobileOpen(false)
    }
  }, [mobileOpen, stage])

  useEffect(() => {
    if (!mobileOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setMobileOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mobileOpen])

  const handleToggleCollapsed = () => {
    void updateSettings({ sidebarCollapsed: !sidebarCollapsed })
  }

  const handleNavigate = (page: AppPage) => {
    onNavigate(page)
    if (stage === 'hidden') {
      setMobileOpen(false)
    }
  }

  if (stage === 'hidden') {
    return (
      <>
        <button
          type="button"
          data-testid="sidebar-mobile-trigger"
          aria-label={t('command.navigate')}
          aria-expanded={mobileOpen}
          aria-controls="usan-mobile-sidebar"
          onClick={() => setMobileOpen(true)}
          className="no-drag absolute left-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/50 bg-white/82 text-[var(--color-text)] shadow-[var(--shadow-md)] backdrop-blur-xl transition-colors hover:bg-white dark:border-white/10 dark:bg-[rgba(15,23,35,0.86)] dark:hover:bg-[rgba(15,23,35,0.96)]"
        >
          <Menu size={18} />
        </button>
        {mobileOpen && (
          <FocusTrap active={mobileOpen}>
            <div className="absolute inset-0 z-40">
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[var(--color-backdrop)] backdrop-blur-sm"
                onClick={() => setMobileOpen(false)}
              />
              <aside
                id="usan-mobile-sidebar"
                data-sidebar-stage="hidden"
                className="glass absolute inset-y-3 left-3 flex w-[280px] flex-col rounded-[24px] border border-white/45 bg-white/88 p-3 shadow-[var(--shadow-xl)] dark:border-white/10 dark:bg-[rgba(15,23,35,0.92)]"
                role="dialog"
                aria-modal="true"
                aria-label={t('command.navigate')}
              >
                <div className="mb-4 flex items-center justify-between gap-3 px-1 pt-1">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[var(--usan-color-ai-gradient)] text-white shadow-[var(--shadow-md)]">
                      <Umbrella size={18} strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-bold text-[var(--color-text)]">
                        {t('titlebar.title')}
                      </div>
                      <div className="truncate text-[12px] text-[var(--color-text-muted)]">
                        {t('command.navigate')}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label={t('titlebar.close')}
                    onClick={() => setMobileOpen(false)}
                    className="no-drag flex h-10 w-10 items-center justify-center rounded-[14px] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text)]"
                  >
                    <X size={18} />
                  </button>
                </div>
                <nav className="flex-1 space-y-2 overflow-auto py-1">
                  {NAV_ITEMS.map((item) => (
                    <NavItem
                      key={item.id}
                      item={item}
                      activePage={activePage}
                      stage={stage}
                      onNavigate={handleNavigate}
                      mobile
                    />
                  ))}
                </nav>
              </aside>
            </div>
          </FocusTrap>
        )}
      </>
    )
  }

  const railWidthClass = stage === 'compact' ? 'w-12' : 'w-16'

  return (
    <aside
      data-testid="sidebar-rail"
      data-sidebar-stage={stage}
      className={[
        'relative z-10 flex h-full shrink-0 flex-col items-center border-r border-white/35 bg-white/58 py-3 backdrop-blur-[24px] transition-[width] duration-[250ms] ease-[cubic-bezier(0.25,0.8,0.25,1)] dark:border-white/8 dark:bg-[rgba(15,23,35,0.42)]',
        railWidthClass,
      ].join(' ')}
      aria-label={t('command.navigate')}
    >
      <div className="mb-4 flex w-full items-center justify-center px-1">
        <button
          type="button"
          aria-label={t('titlebar.title')}
          title={t('titlebar.title')}
          onClick={() => handleNavigate('home')}
          className={[
            'no-drag flex items-center justify-center rounded-[18px] bg-[var(--usan-color-ai-gradient)] text-white shadow-[0_14px_28px_rgba(37,99,235,0.28)] transition-transform duration-200 hover:scale-[1.03]',
            stage === 'compact' ? 'h-10 w-10' : 'h-11 w-11',
          ].join(' ')}
        >
          <Umbrella size={18} strokeWidth={2.3} />
        </button>
      </div>

      <nav className="flex w-full flex-1 flex-col items-center gap-2 overflow-y-auto px-1">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            activePage={activePage}
            stage={stage}
            onNavigate={handleNavigate}
          />
        ))}
      </nav>

      <div className="mt-4 flex w-full items-center justify-center px-1">
        <button
          type="button"
          aria-label={
            sidebarCollapsed ? t('settings.showAdvancedMenus') : t('settings.hideAdvancedMenus')
          }
          title={sidebarCollapsed ? t('settings.showAdvancedMenus') : t('settings.hideAdvancedMenus')}
          onClick={handleToggleCollapsed}
          className={[
            'no-drag flex items-center justify-center rounded-[18px] border border-white/40 bg-white/72 text-[var(--color-text-secondary)] shadow-[var(--shadow-xs)] transition-colors hover:bg-white hover:text-[var(--color-text)] dark:border-white/10 dark:bg-white/6 dark:hover:bg-white/10',
            stage === 'compact' ? 'h-10 w-10' : 'h-11 w-11',
          ].join(' ')}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>
    </aside>
  )
}
