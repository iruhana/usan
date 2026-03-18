import { useEffect } from 'react'
import { Command } from 'cmdk'
import {
  Bell,
  FileSearch,
  FolderOpen,
  Globe,
  Home,
  ListTodo,
  MessageSquarePlus,
  Monitor,
  Search,
  Settings,
  Volume2,
  Wrench,
} from 'lucide-react'
import FocusTrap from '../accessibility/FocusTrap'
import { useChatStore } from '../../stores/chat.store'
import { useSettingsStore } from '../../stores/settings.store'
import { t } from '../../i18n'
import type { AppPage } from '../../constants/navigation'
import { isPageVisible } from '../../constants/navigation'

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate: (page: AppPage) => void
}

export default function CommandPalette({ open, onOpenChange, onNavigate }: CommandPaletteProps) {
  const beginnerMode = useSettingsStore((s) => s.settings.beginnerMode)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onOpenChange])

  if (!open) return null

  const itemClass =
    'flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] cursor-pointer text-[var(--color-text)] hover:bg-[var(--color-surface-soft)] aria-selected:bg-[var(--color-primary-muted)] aria-selected:text-[var(--color-primary)] transition-colors duration-100'

  const allNavigationItems: Array<{ page: AppPage; icon: typeof Home; shortcut: string }> = [
    { page: 'home', icon: Home, shortcut: '1' },
    { page: 'tasks', icon: ListTodo, shortcut: '2' },
    { page: 'files', icon: FolderOpen, shortcut: '3' },
    { page: 'tools', icon: Wrench, shortcut: '4' },
    { page: 'settings', icon: Settings, shortcut: '5' },
  ]
  const navigationItems = allNavigationItems.filter((item) => isPageVisible(item.page, beginnerMode))

  return (
    <FocusTrap active={open}>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh]">
        <div
          className="absolute inset-0 bg-[var(--color-backdrop)] animate-backdrop"
          onClick={() => onOpenChange(false)}
          aria-hidden="true"
        />

        <div className="relative w-full max-w-lg bg-[var(--color-bg-card)] rounded-[var(--radius-xl)] shadow-[var(--shadow-xl)] overflow-hidden ring-1 ring-[var(--color-border-subtle)] animate-scale-in">
          <Command className="flex flex-col" label={t('command.placeholder')}>
            <div className="flex items-center gap-3 px-4 border-b border-[var(--color-border-subtle)]">
              <Search size={18} className="text-[var(--color-text-muted)]" />
              <Command.Input
                placeholder={t('command.inputPlaceholder')}
                className="w-full h-12 bg-transparent outline-none text-[length:var(--text-md)] placeholder:text-[var(--color-text-muted)]"
                aria-label={t('command.inputPlaceholder')}
              />
              <kbd className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-text-muted)] bg-[var(--color-surface-soft)] rounded-[var(--radius-xs)]">
                ESC
              </kbd>
            </div>
            <Command.List className="max-h-72 overflow-auto p-1.5">
              <Command.Empty className="p-8 text-center text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
                {t('command.noResults')}
              </Command.Empty>

              <Command.Group heading={t('command.actions')} className="px-1 py-1 [&_[cmdk-group-heading]]:text-[length:var(--text-xs)] [&_[cmdk-group-heading]]:text-[var(--color-text-muted)] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                <Command.Item
                  onSelect={() => {
                    onNavigate('home')
                    useChatStore.getState().newConversation()
                    onOpenChange(false)
                  }}
                  className={itemClass}
                >
                  <MessageSquarePlus size={18} className="text-[var(--color-primary)] shrink-0" />
                  <span className="flex-1 text-[length:var(--text-sm)]">{t('chat.newConversation')}</span>
                  <kbd className="text-[10px] font-mono text-[var(--color-text-muted)] bg-[var(--color-surface-soft)] px-1.5 py-0.5 rounded-[var(--radius-xs)]">
                    Ctrl+N
                  </kbd>
                </Command.Item>
                <Command.Item
                  onSelect={() => {
                    onNavigate('home')
                    onOpenChange(false)
                  }}
                  className={itemClass}
                >
                  <Monitor size={18} className="text-[var(--color-primary)] shrink-0" />
                  <span className="text-[length:var(--text-sm)]">{t('command.screenAnalyze')}</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => {
                    if (isPageVisible('files', beginnerMode)) {
                      onNavigate('files')
                    }
                    onOpenChange(false)
                  }}
                  className={itemClass}
                >
                  <FileSearch size={18} className="text-[var(--color-primary)] shrink-0" />
                  <span className="text-[length:var(--text-sm)]">{t('command.findFile')}</span>
                </Command.Item>
                <Command.Item
                  onSelect={() => {
                    onNavigate('home')
                    onOpenChange(false)
                  }}
                  className={itemClass}
                >
                  <Globe size={18} className="text-[var(--color-primary)] shrink-0" />
                  <span className="text-[length:var(--text-sm)]">{t('command.search')}</span>
                </Command.Item>
              </Command.Group>

              <Command.Group heading={t('nav.tools')} className="px-1 py-1 [&_[cmdk-group-heading]]:text-[length:var(--text-xs)] [&_[cmdk-group-heading]]:text-[var(--color-text-muted)] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                <Command.Item onSelect={() => { onNavigate('tools'); onOpenChange(false) }} className={itemClass}>
                  <Monitor size={18} className="text-[var(--color-text-muted)] shrink-0" />
                  <span className="text-[length:var(--text-sm)]">{t('tools.screenCapture')}</span>
                </Command.Item>
                <Command.Item onSelect={() => { onNavigate('tools'); onOpenChange(false) }} className={itemClass}>
                  <Globe size={18} className="text-[var(--color-text-muted)] shrink-0" />
                  <span className="text-[length:var(--text-sm)]">{t('tools.webSearch')}</span>
                </Command.Item>
                <Command.Item onSelect={() => { onNavigate('tools'); onOpenChange(false) }} className={itemClass}>
                  <Volume2 size={18} className="text-[var(--color-text-muted)] shrink-0" />
                  <span className="text-[length:var(--text-sm)]">{t('tools.tts')}</span>
                </Command.Item>
                <Command.Item onSelect={() => { onNavigate('tools'); onOpenChange(false) }} className={itemClass}>
                  <Bell size={18} className="text-[var(--color-text-muted)] shrink-0" />
                  <span className="text-[length:var(--text-sm)]">{t('tools.reminder')}</span>
                </Command.Item>
              </Command.Group>

              <Command.Group heading={t('command.navigate')} className="px-1 py-1 [&_[cmdk-group-heading]]:text-[length:var(--text-xs)] [&_[cmdk-group-heading]]:text-[var(--color-text-muted)] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                {navigationItems.map(({ page, icon: Icon, shortcut }) => (
                  <Command.Item
                    key={page}
                    onSelect={() => {
                      if (isPageVisible(page, beginnerMode)) {
                        onNavigate(page)
                      }
                      onOpenChange(false)
                    }}
                    className={itemClass}
                  >
                    <Icon size={18} className="text-[var(--color-text-muted)] shrink-0" />
                    <span className="flex-1 text-[length:var(--text-sm)]">{t(`nav.${page}`)}</span>
                    <kbd className="text-[10px] font-mono text-[var(--color-text-muted)] bg-[var(--color-surface-soft)] px-1.5 py-0.5 rounded-[var(--radius-xs)]">
                      Ctrl+{shortcut}
                    </kbd>
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </div>
      </div>
    </FocusTrap>
  )
}
